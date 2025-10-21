// Serviço otimizado para gerenciar insights do Facebook Ads
// OTIMIZADO PARA VELOCIDADE - SEM CACHE
export class FacebookInsightsService {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.requestQueue = [];
        this.isProcessing = false;
    }

    // API calls com controle de rate limit otimizado
    async fetchWithPagination(url, fields = [], isHighPriority = false) {
        let allData = [];
        let currentUrl = url;
        let retryCount = 0;
        const MAX_RETRIES = isHighPriority ? 2 : 1; // Mais retries para requisições importantes

        while (currentUrl) {
            // Pequeno delay para evitar sobrecarga
            if (allData.length > 0) await this._delay(100);
            
            const response = await new Promise((resolve) => {
                FB.api(currentUrl, resolve);
            });

            if (response && !response.error) {
                allData = allData.concat(response.data || []);
                currentUrl = response.paging && response.paging.next ? response.paging.next : null;
                retryCount = 0;
            } else {
                if (response?.error?.message?.includes('User request limit reached') || 
                    response?.error?.message?.includes('Application request limit reached') ||
                    response?.error?.code === 17 || 
                    response?.error?.code === 4 || 
                    response?.error?.code === 613) {
                    
                    if (retryCount >= MAX_RETRIES) {
                        console.warn('⚠️ Rate limit - usando dados parciais');
                        break;
                    }
                    
                    retryCount++;
                    const waitTime = isHighPriority ? 3000 : 2000;
                    console.warn(`⏳ Rate limit - aguardando ${waitTime/1000}s... (${retryCount}/${MAX_RETRIES})`);
                    await this._delay(waitTime);
                    continue;
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

    // Carregar campanhas (SEM CACHE)
    async loadCampaigns(unitId, startDate, endDate) {
        const timerId = `⏱️ Campanhas - ${unitId}`;
        try {
            console.time(timerId);
            
            const url = `/${unitId}/campaigns?fields=id,name&access_token=${this.accessToken}`;
            const campaigns = await this.fetchWithPagination(url);
            
            // PARALELIZAÇÃO MÁXIMA - todas de uma vez
            const insights = await Promise.all(
                campaigns.map(camp => this.getCampaignInsights(camp.id, startDate, endDate))
            );

            const result = {};
            campaigns.forEach((camp, index) => {
                result[camp.id] = {
                    name: camp.name,
                    spend: insights[index].spend ? parseFloat(insights[index].spend) : 0,
                    insights: {
                        spend: insights[index].spend ? parseFloat(insights[index].spend) : 0,
                        impressions: insights[index].impressions || 0,
                        clicks: insights[index].clicks || 0,
                        conversions: insights[index].conversions || 0,
                        reach: insights[index].impressions || 0,
                        actions: insights[index].actions || []
                    }
                };
            });

            console.timeEnd(timerId);
            return result;
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
            return {};
        }
    }

    // Carregar conjuntos de anúncios (SEM CACHE)
    async loadAdSets(unitId, startDate, endDate) {
        const timerId = `⏱️ Ad Sets - ${unitId}`;
        try {
            console.time(timerId);
            
            const url = `/${unitId}/adsets?fields=id,name&access_token=${this.accessToken}`;
            const adSets = await this.fetchWithPagination(url);
            
            // PARALELIZAÇÃO MÁXIMA - todas de uma vez
            const insights = await Promise.all(
                adSets.map(set => this.getAdSetInsights(set.id, startDate, endDate))
            );

            const result = {};
            adSets.forEach((set, index) => {
                result[set.id] = {
                    name: set.name,
                    spend: insights[index].spend ? parseFloat(insights[index].spend) : 0,
                    insights: {
                        spend: insights[index].spend ? parseFloat(insights[index].spend) : 0,
                        impressions: insights[index].impressions || 0,
                        clicks: insights[index].clicks || 0,
                        conversions: insights[index].conversions || 0,
                        reach: insights[index].impressions || 0,
                        actions: insights[index].actions || []
                    }
                };
            });

            console.timeEnd(timerId);
            return result;
        } catch (error) {
            console.error('Erro ao carregar ad sets:', error);
            return {};
        }
    }

    // Insights de campanha
    async getCampaignInsights(campaignId, startDate, endDate) {
        const url = `/${campaignId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
        const data = await this.fetchWithPagination(url);
        
        if (data.length === 0) {
            return { spend: 0, impressions: 0, clicks: 0, conversions: 0, actions: [] };
        }

        const insights = data[0];
        const conversions = insights.actions?.find(action => 
            action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
            action.action_type === 'omni_purchase'
        )?.value || 0;

        return {
            spend: insights.spend || 0,
            impressions: insights.impressions || 0,
            clicks: insights.clicks || 0,
            conversions: parseInt(conversions),
            actions: insights.actions || []
        };
    }

    // Insights de conjunto de anúncios
    async getAdSetInsights(adSetId, startDate, endDate) {
        const url = `/${adSetId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
        const data = await this.fetchWithPagination(url);
        
        if (data.length === 0) {
            return { spend: 0, impressions: 0, clicks: 0, conversions: 0, actions: [] };
        }

        const insights = data[0];
        const conversions = insights.actions?.find(action => 
            action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
            action.action_type === 'omni_purchase'
        )?.value || 0;

        return {
            spend: insights.spend || 0,
            impressions: insights.impressions || 0,
            clicks: insights.clicks || 0,
            conversions: parseInt(conversions),
            actions: insights.actions || []
        };
    }

    // Insights de anúncio
    async getAdInsights(adId, startDate, endDate) {
        const url = `/${adId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
        const data = await this.fetchWithPagination(url);
        
        if (data.length === 0) {
            return { 
                spend: 0, 
                impressions: 0, 
                clicks: 0, 
                ctr: 0, 
                cpc: 0, 
                cpm: 0, 
                conversions: 0 
            };
        }

        const insights = data[0];
        const conversions = insights.actions?.find(action => 
            action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
            action.action_type === 'omni_purchase'
        )?.value || 0;

        return {
            spend: parseFloat(insights.spend || 0),
            impressions: parseInt(insights.impressions || 0),
            clicks: parseInt(insights.clicks || 0),
            ctr: parseFloat(insights.ctr || 0),
            cpc: parseFloat(insights.cpc || 0),
            cpm: parseFloat(insights.cpm || 0),
            conversions: parseInt(conversions)
        };
    }

    // Dados do criativo com fallback
    async getCreativeData(adId) {
        try {
            const url = `/${adId}?fields=creative{thumbnail_url,image_hash,object_story_spec,effective_object_story_id}&access_token=${this.accessToken}`;
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error && response.creative) {
                const creative = response.creative;
                
                // Tentar thumbnail_url primeiro
                if (creative.thumbnail_url) {
                    return { imageUrl: creative.thumbnail_url };
                }
                
                // Tentar object_story_spec
                if (creative.object_story_spec?.link_data?.picture) {
                    return { imageUrl: creative.object_story_spec.link_data.picture };
                }
                
                if (creative.object_story_spec?.video_data?.image_url) {
                    return { imageUrl: creative.object_story_spec.video_data.image_url };
                }
                
                // Tentar effective_object_story_id
                if (creative.effective_object_story_id) {
                    const storyUrl = `/${creative.effective_object_story_id}?fields=full_picture&access_token=${this.accessToken}`;
                    const storyResponse = await new Promise((resolve) => {
                        FB.api(storyUrl, resolve);
                    });
                    
                    if (storyResponse && !storyResponse.error && storyResponse.full_picture) {
                        return { imageUrl: storyResponse.full_picture };
                    }
                }
            }
            
            // Fallback para imagem placeholder
            return { imageUrl: 'https://via.placeholder.com/300x200?text=Sem+Imagem' };
        } catch (error) {
            console.error('Erro ao buscar creative:', error);
            return { imageUrl: 'https://via.placeholder.com/300x200?text=Erro' };
        }
    }

    // Insights da conta
    async getAccountInsights(unitId, startDate, endDate) {
        const url = `/${unitId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
        const data = await this.fetchWithPagination(url);
        
        if (data.length === 0) {
            return { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        }

        const insights = data[0];
        const conversions = insights.actions?.find(action => 
            action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
            action.action_type === 'omni_purchase'
        )?.value || 0;

        return {
            spend: parseFloat(insights.spend || 0),
            impressions: parseInt(insights.impressions || 0),
            clicks: parseInt(insights.clicks || 0),
            conversions: parseInt(conversions)
        };
    }

    // Calcular métricas
    calculateMetrics(insights) {
        const spend = parseFloat(insights.spend || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const conversions = parseInt(insights.conversions || 0);

        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;
        const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
        const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : 0;
        const costPerConversion = conversions > 0 ? (spend / conversions).toFixed(2) : 0;
        const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : 0;

        return {
            spend: spend.toFixed(2),
            impressions,
            clicks,
            conversions,
            ctr,
            cpc,
            cpm,
            costPerConversion,
            conversionRate
        };
    }

    // Dados de comparação
    async getComparisonData(unitId, currentStartDate, currentEndDate) {
        const current = new Date(currentStartDate);
        const end = new Date(currentEndDate);
        const diffTime = Math.abs(end - current);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const previousEnd = new Date(current);
        previousEnd.setDate(previousEnd.getDate() - 1);
        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - diffDays + 1);

        const previousStartDate = previousStart.toISOString().split('T')[0];
        const previousEndDate = previousEnd.toISOString().split('T')[0];

        const [currentMetrics, previousMetrics] = await Promise.all([
            this.getAccountInsights(unitId, currentStartDate, currentEndDate),
            this.getAccountInsights(unitId, previousStartDate, previousEndDate)
        ]);

        return {
            current: this.calculateMetrics(currentMetrics),
            previous: this.calculateMetrics(previousMetrics)
        };
    }

    // Melhores anúncios
    async getBestPerformingAds(unitId, startDate, endDate, limit = 3) {
        try {
            console.time('⏱️ Tempo - Melhores Anúncios');
            
            // Aguardar um pouco antes de buscar anúncios para evitar rate limit
            await this._delay(1000);
            
            const url = `/${unitId}/ads?fields=id,name&access_token=${this.accessToken}`;
            const ads = await this.fetchWithPagination(url, [], true); // HIGH PRIORITY
            
            if (ads.length === 0) {
                console.timeEnd('⏱️ Tempo - Melhores Anúncios');
                return [];
            }

            // Pegar apenas os primeiros 10 anúncios para evitar rate limit
            const topAds = ads.slice(0, 10);
            
            // Processar insights e creativos em lotes pequenos
            const insights = [];
            const creatives = [];
            
            for (const ad of topAds) {
                await this._delay(200); // Delay entre requisições
                const [insightData, creativeData] = await Promise.all([
                    this.getAdInsights(ad.id, startDate, endDate),
                    this.getCreativeData(ad.id)
                ]);
                insights.push(insightData);
                creatives.push(creativeData);
            }

            const adsWithData = topAds.map((ad, index) => ({
                id: ad.id,
                name: ad.name,
                ...insights[index],
                imageUrl: creatives[index].imageUrl
            }));

            const sorted = adsWithData
                .filter(ad => ad.impressions > 0 || ad.spend > 0)
                .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);

            console.timeEnd('⏱️ Tempo - Melhores Anúncios');
            return sorted.slice(0, limit);
        } catch (error) {
            console.error('Erro ao buscar melhores anúncios:', error);
            return [];
        }
    }

    // Extrair mensagens de anúncios
    extractMessages(ads) {
        return ads.map(ad => ({
            id: ad.id,
            name: ad.name,
            message: ad.message || 'Sem mensagem disponível'
        }));
    }

    // Método vazio para compatibilidade (não faz mais nada)
    clearAllCaches() {
        console.log('✓ Cache desabilitado - operação ignorada');
    }
}
