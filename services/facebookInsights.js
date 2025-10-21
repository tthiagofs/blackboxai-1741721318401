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

    // Melhores anúncios - OTIMIZADO para evitar rate limit
    async getBestPerformingAds(unitId, startDate, endDate, limit = 3) {
        try {
            console.time('⏱️ Tempo - Melhores Anúncios');
            
            // Aguardar para evitar rate limit após carregar campanhas/adsets
            await this._delay(2000);
            
            // ESTRATÉGIA OTIMIZADA: Buscar insights diretamente do account
            // Isso retorna anúncios JÁ COM dados, evitando múltiplas requisições
            const url = `/${unitId}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,ctr,cpc,cpm,actions&time_range={'since':'${startDate}','until':'${endDate}'}&limit=50&access_token=${this.accessToken}`;
            
            let adsData = [];
            try {
                adsData = await this.fetchWithPagination(url, [], true);
            } catch (error) {
                console.warn('⚠️ Não foi possível buscar insights de anúncios:', error.message);
                console.timeEnd('⏱️ Tempo - Melhores Anúncios');
                return [];
            }
            
            if (adsData.length === 0) {
                console.log('ℹ️ Nenhum anúncio com dados encontrado');
                console.timeEnd('⏱️ Tempo - Melhores Anúncios');
                return [];
            }

            // Processar dados dos anúncios
            const adsWithMetrics = adsData.map(ad => {
                const conversions = ad.actions?.find(action => 
                    action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
                    action.action_type === 'omni_purchase'
                )?.value || 0;

                return {
                    id: ad.ad_id,
                    name: ad.ad_name || 'Sem nome',
                    spend: parseFloat(ad.spend || 0),
                    impressions: parseInt(ad.impressions || 0),
                    clicks: parseInt(ad.clicks || 0),
                    ctr: parseFloat(ad.ctr || 0),
                    cpc: parseFloat(ad.cpc || 0),
                    cpm: parseFloat(ad.cpm || 0),
                    conversions: parseInt(conversions),
                    imageUrl: 'https://via.placeholder.com/300x200?text=Anúncio' // Placeholder inicial
                };
            });

            // Ordenar por conversões e depois por cliques
            const sorted = adsWithMetrics
                .filter(ad => ad.impressions > 0 || ad.spend > 0)
                .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);

            // Pegar os top N anúncios
            const topAds = sorted.slice(0, limit);

            // Buscar creativos apenas para os top anúncios (em sequência para evitar rate limit)
            for (let i = 0; i < topAds.length; i++) {
                await this._delay(300); // Delay entre cada busca de creative
                try {
                    const creativeData = await this.getCreativeData(topAds[i].id);
                    topAds[i].imageUrl = creativeData.imageUrl;
                } catch (error) {
                    console.warn(`⚠️ Erro ao buscar creative do anúncio ${topAds[i].id}:`, error.message);
                    // Mantém o placeholder
                }
            }

            console.timeEnd('⏱️ Tempo - Melhores Anúncios');
            return topAds;
        } catch (error) {
            console.error('Erro ao buscar melhores anúncios:', error);
            console.timeEnd('⏱️ Tempo - Melhores Anúncios');
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
