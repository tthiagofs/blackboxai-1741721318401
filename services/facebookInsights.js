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
        let retryCount = 0;
        const MAX_RETRIES = 3;

        while (currentUrl) {
            // Rate limiting - delay entre requisições (aumentado para 500ms)
            await this._delay(500);
            
            const response = await new Promise((resolve) => {
                FB.api(currentUrl, resolve);
            });

            if (response && !response.error) {
                allData = allData.concat(response.data || []);
                currentUrl = response.paging && response.paging.next ? response.paging.next : null;
                retryCount = 0; // Reset retry count on success
            } else {
                if (response?.error?.message?.includes('User request limit reached') || 
                    response?.error?.message?.includes('Application request limit reached')) {
                    
                    if (retryCount >= MAX_RETRIES) {
                        console.error('Número máximo de tentativas atingido. Pulando esta requisição.');
                        break; // Sair do loop em vez de continuar indefinidamente
                    }
                    
                    retryCount++;
                    const waitTime = Math.min(5000 * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30s
                    console.warn(`Rate limit atingido. Tentativa ${retryCount}/${MAX_RETRIES}. Aguardando ${waitTime/1000}s...`);
                    await this._delay(waitTime);
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
            
            // Processar em lotes para evitar rate limit
            const BATCH_SIZE = 5; // Reduzido de Promise.all para 5 por vez
            const insights = [];
            
            for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
                const batch = campaignIds.slice(i, i + BATCH_SIZE);
                const batchInsights = await Promise.all(
                    batch.map(id => this.getCampaignInsights(id, startDate, endDate))
                );
                insights.push(...batchInsights);
                
                // Delay entre lotes
                if (i + BATCH_SIZE < campaignIds.length) {
                    await this._delay(1000); // 1 segundo entre lotes
                }
            }

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
            
            // Processar em lotes para evitar rate limit
            const BATCH_SIZE = 5;
            const insights = [];
            
            for (let i = 0; i < adSetIds.length; i += BATCH_SIZE) {
                const batch = adSetIds.slice(i, i + BATCH_SIZE);
                const batchInsights = await Promise.all(
                    batch.map(id => this.getAdSetInsights(id, startDate, endDate))
                );
                insights.push(...batchInsights);
                
                // Delay entre lotes
                if (i + BATCH_SIZE < adSetIds.length) {
                    await this._delay(1000); // 1 segundo entre lotes
                }
            }

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
                    fields: 'object_story_spec,thumbnail_url,effective_object_story_id,image_hash',
                    access_token: this.accessToken
                },
                async (response) => {
                    if (response && !response.error) {
                        let imageUrl = 'https://dummyimage.com/600x600/ccc/fff';

                        // Priorizar thumbnail_url primeiro (mais rápido)
                        if (response.thumbnail_url) {
                            imageUrl = response.thumbnail_url;
                        } else if (response.image_hash) {
                            try {
                                const imageResponse = await new Promise((imageResolve) => {
                                    FB.api(
                                        `/adimages`,
                                        { hashes: [response.image_hash], fields: 'url', access_token: this.accessToken },
                                        imageResolve
                                    );
                                });
                                if (imageResponse && !imageResponse.error && imageResponse.data && imageResponse.data.length > 0) {
                                    imageUrl = imageResponse.data[0].url;
                                }
                            } catch (error) {
                                console.error('Erro ao buscar imagem por hash:', error);
                            }
                        }
                        
                        // Só buscar em object_story_spec se ainda não encontrou uma imagem válida
                        if (imageUrl.includes('dummyimage') && response.object_story_spec) {
                            const { photo_data, video_data, link_data } = response.object_story_spec;
                            if (photo_data && photo_data.images && photo_data.images.length > 0) {
                                const largestImage = photo_data.images.reduce((prev, current) => 
                                    (prev.width > current.width) ? prev : current, photo_data.images[0]);
                                imageUrl = largestImage.original_url || largestImage.url || photo_data.url;
                            } else if (video_data && video_data.picture) {
                                imageUrl = video_data.picture;
                            } else if (link_data && link_data.picture) {
                                imageUrl = link_data.picture;
                            }
                        }
                        
                        // Só buscar effective_object_story_id como último recurso
                        if (imageUrl.includes('dummyimage') && response.effective_object_story_id) {
                            try {
                                const storyResponse = await new Promise((storyResolve) => {
                                    FB.api(
                                        `/${response.effective_object_story_id}`,
                                        { fields: 'full_picture', access_token: this.accessToken },
                                        storyResolve
                                    );
                                });
                                if (storyResponse && !storyResponse.error && storyResponse.full_picture) {
                                    imageUrl = storyResponse.full_picture;
                                }
                            } catch (error) {
                                console.error('Erro ao buscar full_picture:', error);
                            }
                        }

                        const result = { imageUrl: imageUrl };
                        this.creativeCache.set(creativeId, result);
                        resolve(result);
                    } else {
                        console.error(`Erro ao carregar criativo ${creativeId}:`, response.error);
                        const result = { imageUrl: 'https://dummyimage.com/600x600/ccc/fff' };
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

    // Get best performing ads
    async getBestPerformingAds(unitId, startDate, endDate, selectedCampaigns = new Set(), selectedAdSets = new Set()) {
        const cacheKey = `best_ads_${unitId}_${startDate}_${endDate}_${Array.from(selectedCampaigns).join(',')}_${Array.from(selectedAdSets).join(',')}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        try {
            const adsWithActions = []; // Anúncios com mensagens/conversões/cadastros
            const adsWithoutActions = []; // Anúncios sem mensagens/conversões/cadastros, mas com gasto

            // Determinar as entidades (campanhas, ad sets ou conta) para buscar os anúncios
            const entitiesToFetch = [];
            if (selectedAdSets.size > 0) {
                entitiesToFetch.push(...Array.from(selectedAdSets).map(id => ({ type: 'adset', id })));
            } else if (selectedCampaigns.size > 0) {
                entitiesToFetch.push(...Array.from(selectedCampaigns).map(id => ({ type: 'campaign', id })));
            } else {
                entitiesToFetch.push({ type: 'account', id: unitId });
            }

            // Buscar todos os anúncios das entidades em paralelo
            const adsListPromises = entitiesToFetch.map(async (entity) => {
                const adsList = [];
                let entityUrl = entity.type === 'account' ? `/${entity.id}/ads` : `/${entity.id}/ads`;
                
                while (entityUrl) {
                    const adResponse = await new Promise((resolve) => {
                        FB.api(
                            entityUrl,
                            {
                                fields: 'id,name,creative',
                                time_range: { since: startDate, until: endDate },
                                access_token: this.accessToken,
                                limit: 50
                            },
                            resolve
                        );
                    });

                    if (adResponse && !adResponse.error) {
                        adsList.push(...adResponse.data);
                        entityUrl = adResponse.paging && adResponse.paging.next ? adResponse.paging.next : null;
                    } else {
                        console.error(`Erro ao carregar anúncios para ${entity.type} ${entity.id}:`, adResponse?.error);
                        entityUrl = null;
                    }
                    await this._delay(200);
                }
                return adsList;
            });

            const adsListArrays = await Promise.all(adsListPromises);
            const adsList = adsListArrays.flat();

            if (adsList.length === 0) {
                return [];
            }

            // Processar anúncios em lotes para melhor performance
            const batchSize = 10;
            const adBatches = [];
            for (let i = 0; i < adsList.length; i += batchSize) {
                adBatches.push(adsList.slice(i, i + batchSize));
            }

            for (const batch of adBatches) {
                const batchPromises = batch.map(async (ad) => {
                    let totalActions = 0;
                    let spend = 0;

                    // Buscar insights do anúncio
                    const insights = await this.getAdInsights(ad.id, startDate, endDate);
                    if (insights) {
                        totalActions = this.extractMessages(insights.actions || []);
                        spend = insights.spend ? parseFloat(insights.spend) : 0;
                    }

                    // Adicionar o anúncio à lista apropriada
                    const adData = {
                        creativeId: ad.creative?.id,
                        imageUrl: 'https://dummyimage.com/150x150/ccc/fff',
                        messages: totalActions,
                        spend: spend,
                        costPerMessage: totalActions > 0 ? (spend / totalActions).toFixed(2) : '0.00'
                    };

                    return { adData, totalActions, spend };
                });

                const batchResults = await Promise.all(batchPromises);
                
                batchResults.forEach(({ adData, totalActions, spend }) => {
                    if (totalActions > 0) {
                        adsWithActions.push(adData);
                    } else if (spend > 0) {
                        adsWithoutActions.push(adData);
                    }
                });
            }

            // Ordenar e selecionar os melhores anúncios
            adsWithActions.sort((a, b) => b.messages - a.messages);
            adsWithoutActions.sort((a, b) => b.spend - a.spend);

            const bestAds = [];
            bestAds.push(...adsWithActions.slice(0, 2));
            if (bestAds.length < 2 && adsWithoutActions.length > 0) {
                const remainingSlots = 2 - bestAds.length;
                bestAds.push(...adsWithoutActions.slice(0, remainingSlots));
            }

            // Buscar imagens dos criativos em paralelo
            if (bestAds.length > 0) {
                const imagePromises = bestAds.map(async (ad) => {
                    if (ad.creativeId) {
                        const creativeData = await this.getCreativeData(ad.creativeId);
                        ad.imageUrl = creativeData.imageUrl;
                    }
                    return ad;
                });

                await Promise.all(imagePromises);
            }

            this.setCachedData(cacheKey, bestAds);
            return bestAds;

        } catch (error) {
            console.error('Erro ao carregar melhores anúncios:', error);
            return [];
        }
    }

    // Extract messages from actions
    extractMessages(actions) {
        let totalMessages = 0;
        
        if (actions && Array.isArray(actions)) {
            // Contabilizar conversas iniciadas
            const conversationAction = actions.find(
                action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            );
            if (conversationAction && conversationAction.value) {
                totalMessages += parseInt(conversationAction.value) || 0;
            }

            // Contabilizar conversões personalizadas
            const customConversions = actions.filter(
                action => action.action_type.startsWith('offsite_conversion.')
            );
            customConversions.forEach(action => {
                if (action.value) {
                    totalMessages += parseInt(action.value) || 0;
                }
            });

            // Contabilizar cadastros do Facebook
            const leadActions = actions.filter(
                action => action.action_type === 'lead'
            );
            leadActions.forEach(action => {
                if (action.value) {
                    totalMessages += parseInt(action.value) || 0;
                }
            });
        }
        
        return totalMessages;
    }
}
