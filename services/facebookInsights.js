// Serviço para gerenciar insights do Facebook Ads
export class FacebookInsightsService {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.creativeCache = new Map();
        this.insightsCache = new Map();
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
        this.MAX_CACHE_SIZE = 50;
    }

    // Cache utilities
    getCachedData(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > this.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Erro ao ler cache:', error);
            localStorage.removeItem(key);
            return null;
        }
    }

    setCachedData(key, data) {
        try {
            const cacheEntry = { data, timestamp: Date.now() };
            localStorage.setItem(key, JSON.stringify(cacheEntry));
            this.cleanupCache();
        } catch (error) {
            console.error('Erro ao salvar cache:', error);
            if (error.name === 'QuotaExceededError') {
                this.clearOldCache();
                try {
                    localStorage.setItem(key, JSON.stringify(cacheEntry));
                } catch (retryError) {
                    console.error('Falha ao salvar cache após limpeza:', retryError);
                }
            }
        }
    }

    cleanupCache() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => 
            key.startsWith('campaigns_') || 
            key.startsWith('adsets_') || 
            key.startsWith('ads_') || 
            key.startsWith('best_ads_')
        );
        
        if (cacheKeys.length > this.MAX_CACHE_SIZE) {
            const cacheEntries = cacheKeys.map(key => {
                try {
                    const cached = localStorage.getItem(key);
                    const { timestamp } = JSON.parse(cached);
                    return { key, timestamp };
                } catch {
                    return { key, timestamp: 0 };
                }
            }).sort((a, b) => a.timestamp - b.timestamp);
            
            const toRemove = Math.floor(cacheEntries.length * 0.25);
            for (let i = 0; i < toRemove; i++) {
                localStorage.removeItem(cacheEntries[i].key);
            }
        }
    }

    clearOldCache() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => 
            key.startsWith('campaigns_') || 
            key.startsWith('adsets_') || 
            key.startsWith('ads_') || 
            key.startsWith('best_ads_')
        );
        
        cacheKeys.forEach(key => {
            try {
                const cached = localStorage.getItem(key);
                const { timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp > this.CACHE_DURATION) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        });
    }

    clearAllCaches() {
        this.creativeCache.clear();
        this.insightsCache.clear();
        
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => 
            key.startsWith('campaigns_') || 
            key.startsWith('adsets_') || 
            key.startsWith('ads_') || 
            key.startsWith('best_ads_')
        );
        cacheKeys.forEach(key => localStorage.removeItem(key));
        
        console.log('Todos os caches foram limpos');
    }

    // API calls with pagination and rate limiting
    async fetchWithPagination(url, fields = []) {
        let allData = [];
        let currentUrl = url;

        while (currentUrl) {
            // Rate limiting - delay entre requisições
            await this._delay(300);
            
            const response = await new Promise((resolve) => {
                FB.api(currentUrl, resolve);
            });

            if (response && !response.error) {
                allData = allData.concat(response.data || []);
                currentUrl = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                if (response?.error?.message?.includes('User request limit reached')) {
                    console.warn('Rate limit atingido, aguardando 5 segundos...');
                    await this._delay(5000); // Aguardar 5 segundos
                    continue; // Tentar novamente
                }
                if (response?.error?.message?.includes('Application request limit reached')) {
                    console.warn('Limite de aplicação atingido, aguardando 10 segundos...');
                    await this._delay(10000); // Aguardar 10 segundos
                    continue; // Tentar novamente
                }
                console.error('Erro na API do Facebook:', response?.error);
                throw new Error(response?.error?.message || 'Erro na API do Facebook');
            }
        }

        return allData;
    }

    // Helper para delay
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Load campaigns with insights
    async loadCampaigns(unitId, startDate, endDate) {
        const cacheKey = `campaigns_${unitId}_${startDate}_${endDate}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        try {
            const url = `/${unitId}/campaigns?fields=id,name&access_token=${this.accessToken}`;
            const campaigns = await this.fetchWithPagination(url);
            
            const campaignIds = campaigns.map(camp => camp.id);
            const insights = await Promise.all(
                campaignIds.map(id => this.getCampaignInsights(id, startDate, endDate))
            );

            const result = {};
            campaignIds.forEach((id, index) => {
                const campaign = campaigns.find(c => c.id === id);
                const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
                result[id] = {
                    name: campaign.name.toLowerCase(),
                    insights: { 
                        spend,
                        reach: insights[index].reach || 0,
                        actions: insights[index].actions || []
                    }
                };
            });

            this.setCachedData(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
            return {};
        }
    }

    // Load ad sets with insights
    async loadAdSets(unitId, startDate, endDate) {
        const cacheKey = `adsets_${unitId}_${startDate}_${endDate}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        try {
            const url = `/${unitId}/adsets?fields=id,name&access_token=${this.accessToken}`;
            const adSets = await this.fetchWithPagination(url);
            
            const adSetIds = adSets.map(set => set.id);
            const insights = await Promise.all(
                adSetIds.map(id => this.getAdSetInsights(id, startDate, endDate))
            );

            const result = {};
            adSetIds.forEach((id, index) => {
                const adSet = adSets.find(s => s.id === id);
                const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
                result[id] = {
                    name: adSet.name.toLowerCase(),
                    insights: {
                        spend,
                        reach: insights[index].reach || 0,
                        actions: insights[index].actions || []
                    }
                };
            });

            this.setCachedData(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Erro ao carregar ad sets:', error);
            return {};
        }
    }

    // Get campaign insights
    async getCampaignInsights(campaignId, startDate, endDate) {
        const cacheKey = `campaign_insights_${campaignId}_${startDate}_${endDate}`;
        
        if (this.insightsCache.has(cacheKey)) {
            return this.insightsCache.get(cacheKey);
        }

        return new Promise((resolve) => {
            FB.api(
                `/${campaignId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    level: 'campaign',
                    access_token: this.accessToken
                },
                (response) => {
                    if (response && !response.error && response.data && response.data.length > 0) {
                        const result = response.data[0];
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    } else {
                        const result = { spend: '0', actions: [], reach: '0' };
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    }
                }
            );
        });
    }

    // Get ad set insights
    async getAdSetInsights(adSetId, startDate, endDate) {
        const cacheKey = `adset_insights_${adSetId}_${startDate}_${endDate}`;
        
        if (this.insightsCache.has(cacheKey)) {
            return this.insightsCache.get(cacheKey);
        }

        return new Promise((resolve) => {
            FB.api(
                `/${adSetId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    access_token: this.accessToken
                },
                (response) => {
                    if (response && !response.error && response.data && response.data.length > 0) {
                        const result = response.data[0];
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    } else {
                        const result = { spend: '0', actions: [], reach: '0' };
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    }
                }
            );
        });
    }

    // Get account insights
    async getAccountInsights(unitId, startDate, endDate) {
        return new Promise((resolve) => {
            FB.api(
                `/${unitId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    level: 'account',
                    access_token: this.accessToken
                },
                (response) => {
                    if (response && !response.error && response.data && response.data.length > 0) {
                        resolve(response.data);
                    } else {
                        resolve([]);
                    }
                }
            );
        });
    }

    // Load ads with creative data
    async loadAds(unitId, startDate, endDate) {
        const cacheKey = `ads_${unitId}_${startDate}_${endDate}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        try {
            const url = `/${unitId}/ads?fields=id,name,creative&access_token=${this.accessToken}`;
            const ads = await this.fetchWithPagination(url);
            
            const result = {};
            for (const ad of ads) {
                const insights = await this.getAdInsights(ad.id, startDate, endDate);
                const creative = await this.getCreativeData(ad.creative.id);
                
                result[ad.id] = {
                    name: ad.name,
                    insights,
                    creative
                };
            }

            this.setCachedData(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Erro ao carregar anúncios:', error);
            return {};
        }
    }

    // Get ad insights
    async getAdInsights(adId, startDate, endDate) {
        const cacheKey = `ad_insights_${adId}_${startDate}_${endDate}`;
        
        if (this.insightsCache.has(cacheKey)) {
            return this.insightsCache.get(cacheKey);
        }

        return new Promise((resolve) => {
            FB.api(
                `/${adId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    access_token: this.accessToken
                },
                (response) => {
                    if (response && !response.error && response.data && response.data.length > 0) {
                        const result = response.data[0];
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    } else {
                        const result = { spend: '0', actions: [], reach: '0' };
                        this.insightsCache.set(cacheKey, result);
                        resolve(result);
                    }
                }
            );
        });
    }

    // Get creative data
    async getCreativeData(creativeId) {
        if (this.creativeCache.has(creativeId)) {
            return this.creativeCache.get(creativeId);
        }

        return new Promise((resolve) => {
            FB.api(
                `/${creativeId}`,
                {
                    fields: ['thumbnail_url', 'body', 'title', 'image_url'],
                    access_token: this.accessToken
                },
                (response) => {
                    if (response && !response.error) {
                        this.creativeCache.set(creativeId, response);
                        resolve(response);
                    } else {
                        const result = { thumbnail_url: '', body: '', title: '', image_url: '' };
                        this.creativeCache.set(creativeId, result);
                        resolve(result);
                    }
                }
            );
        });
    }

    // Get best performing ads
    async getBestAds(unitId, startDate, endDate, limit = 5) {
        const cacheKey = `best_ads_${unitId}_${startDate}_${endDate}_${limit}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        try {
            const ads = await this.loadAds(unitId, startDate, endDate);
            const adsWithData = Object.entries(ads)
                .filter(([_, adData]) => {
                    const spend = parseFloat(adData.insights.spend || 0);
                    const messages = this.extractMessages(adData.insights.actions || []);
                    return spend > 0 || messages > 0;
                })
                .map(([id, adData]) => {
                    const spend = parseFloat(adData.insights.spend || 0);
                    const messages = this.extractMessages(adData.insights.actions || []);
                    const costPerMessage = messages > 0 ? spend / messages : 0;
                    
                    return {
                        id,
                        name: adData.name,
                        spend,
                        messages,
                        costPerMessage,
                        imageUrl: adData.creative.thumbnail_url || adData.creative.image_url || ''
                    };
                })
                .sort((a, b) => b.messages - a.messages)
                .slice(0, limit);

            this.setCachedData(cacheKey, adsWithData);
            return adsWithData;
        } catch (error) {
            console.error('Erro ao carregar melhores anúncios:', error);
            return [];
        }
    }

    // Extract messages from actions
    extractMessages(actions) {
        if (!Array.isArray(actions)) return 0;
        
        const messageAction = actions.find(action => 
            action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        );
        
        return messageAction ? parseInt(messageAction.value || 0) : 0;
    }

    // Calculate metrics from insights
    calculateMetrics(insights) {
        const spend = parseFloat(insights.spend || 0);
        const reach = parseInt(insights.reach || 0);
        const messages = this.extractMessages(insights.actions || []);
        const costPerConversation = messages > 0 ? spend / messages : 0;

        return {
            spend,
            reach,
            conversations: messages,
            costPerConversation
        };
    }

    // Get comparison data
    async getComparisonData(unitId, startDate, endDate, comparisonData) {
        if (!comparisonData) return null;

        let compareStartDate, compareEndDate;

        if (comparisonData.isPrevious) {
            const periodDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
            const previousEndDate = new Date(startDate);
            previousEndDate.setDate(previousEndDate.getDate() - 1);
            const previousStartDate = new Date(previousEndDate);
            previousStartDate.setDate(previousStartDate.getDate() - periodDays);
            
            compareStartDate = previousStartDate.toISOString().split('T')[0];
            compareEndDate = previousEndDate.toISOString().split('T')[0];
        } else {
            compareStartDate = comparisonData.startDate;
            compareEndDate = comparisonData.endDate;
        }

        try {
            const response = await this.getAccountInsights(unitId, compareStartDate, compareEndDate);
            if (response && response.length > 0) {
                return this.calculateMetrics(response[0]);
            }
            return null;
        } catch (error) {
            console.error('Erro ao carregar dados de comparação:', error);
            return null;
        }
    }
}
