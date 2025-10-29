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
                // Verificar se o token expirou
                if (response?.error?.message?.includes('Session has expired') || 
                    response?.error?.message?.includes('Error validating access token') ||
                    response?.error?.code === 190) {
                    console.error('🔴 Token do Facebook expirado!');
                    throw new Error('TOKEN_EXPIRED');
                }
                
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
            // Buscar creative com TODOS os campos possíveis de mídia
            const url = `/${adId}?fields=creative{thumbnail_url,image_hash,image_url,video_id,object_story_spec,effective_object_story_id,asset_feed_spec}&access_token=${this.accessToken}`;
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout ao buscar dados do criativo'));
                }, 10000); // 10 segundos de timeout
                
                FB.api(url, (res) => {
                    clearTimeout(timeout);
                    if (res && res.error) {
                        reject(new Error(res.error.message || 'Erro na API do Facebook'));
                    } else {
                        resolve(res);
                    }
                });
            });

            if (response && !response.error && response.creative) {
                const creative = response.creative;
                let imageUrl = 'https://via.placeholder.com/200x200?text=Sem+Imagem';
                let type = 'image'; // padrão
                
                console.log(`🔍 Creative recebido para ad ${adId}:`, {
                    has_effective_object_story_id: !!creative.effective_object_story_id,
                    has_object_story_spec: !!creative.object_story_spec,
                    has_video_id: !!creative.video_id,
                    effective_object_story_id: creative.effective_object_story_id,
                    video_id: creative.video_id,
                    thumbnail_url: creative.thumbnail_url ? creative.thumbnail_url.substring(0, Math.min(50, creative.thumbnail_url.length)) : null
                });
                
                // SE TEM VIDEO_ID: Buscar thumbnail de alta qualidade do vídeo
                if (creative.video_id) {
                    console.log(`   🎥 TEM VIDEO_ID! Buscando thumbnail HD do vídeo: ${creative.video_id}`);
                    try {
                        // Buscar thumbnail de alta qualidade do vídeo
                        const videoUrl = `/${creative.video_id}?fields=picture,source&access_token=${this.accessToken}`;
                        const videoResponse = await new Promise((resolve) => {
                            FB.api(videoUrl, (res) => resolve(res));
                        });
                        
                        if (videoResponse && !videoResponse.error) {
                            console.log('   ✅ Dados do vídeo recebidos:', {
                                has_picture: !!videoResponse.picture,
                                has_source: !!videoResponse.source
                            });
                            
                            // picture = thumbnail HD, source = URL do vídeo completo
                            if (videoResponse.picture) {
                                imageUrl = videoResponse.picture;
                                type = 'video';
                                console.log('   🎬 Usando thumbnail HD do vídeo!');
                                console.log(`   📸 URL: ${imageUrl.substring(0, 100)}...`);
                                return { imageUrl, type };
                            }
                        }
                    } catch (err) {
                        console.warn('   ⚠️ Erro ao buscar vídeo, usando fallback:', err.message);
                    }
                }
                
                // VERIFICAR SE VAI ENTRAR NA CONDIÇÃO
                if (creative.effective_object_story_id && !creative.object_story_spec) {
                    console.log('   ✅ VAI buscar post existente!');
                } else {
                    console.log('   ℹ️ NÃO é post existente (vai usar object_story_spec)');
                }
                
                // PARA "USAR POST EXISTENTE": buscar dados do post original (Stories, Reels, Feed)
                if (creative.effective_object_story_id && !creative.object_story_spec) {
                    console.log(`   🔄 Iniciando busca do post: ${creative.effective_object_story_id}`);
                    try {
                        // Buscar TODOS os campos possíveis do post (funciona para Stories, Reels, Feed, Instagram)
                        const postUrl = `/${creative.effective_object_story_id}?fields=full_picture,picture,type,source,format_type,permalink_url,attachments{media_type,type,media{source,image{src,width,height}},subattachments,target{id}}&access_token=${this.accessToken}`;
                        console.log(`   📡 Chamando FB.api...`);
                        
                        const postResponse = await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('Timeout ao buscar post'));
                            }, 10000);
                            
                            FB.api(postUrl, (res) => {
                                clearTimeout(timeout);
                                console.log(`   ✅ FB.api retornou:`, res);
                                resolve(res);
                            });
                        });
                        
                        console.log(`   🔍 Analisando resposta...`, { 
                            hasError: !!postResponse?.error, 
                            hasData: !!postResponse,
                            errorMessage: postResponse?.error?.message,
                            errorCode: postResponse?.error?.code,
                            fullResponse: postResponse
                        });
                        
                        if (postResponse && !postResponse.error) {
                            console.log('✅✅✅ Post existente COMPLETO (SUCESSO):', {
                                id: creative.effective_object_story_id,
                                type: postResponse.type,
                                format_type: postResponse.format_type,
                                has_source: !!postResponse.source,
                                has_full_picture: !!postResponse.full_picture,
                                has_picture: !!postResponse.picture,
                                attachments: postResponse.attachments?.data?.[0],
                                thumbnail_url: creative.thumbnail_url
                            });
                            
                            // Detectar tipo e pegar ALTA QUALIDADE
                            const attachment = postResponse.attachments?.data?.[0];
                            
                            // VÍDEO (incluindo Reels e Stories de vídeo)
                            // Reels do Instagram geralmente vêm como type='video' OU têm 'source' OU attachment.type='video_inline'
                            const isVideo = postResponse.type === 'video' || 
                                          postResponse.source || 
                                          attachment?.media_type === 'video' ||
                                          attachment?.type === 'video_inline' ||
                                          postResponse.format_type === 'video';
                            
                            if (isVideo) {
                                type = 'video';
                                console.log('   🎬 Detectado como VÍDEO');
                                
                                // Ordem de prioridade para ALTA QUALIDADE
                                if (attachment?.media?.image?.src) {
                                    imageUrl = attachment.media.image.src;
                                    console.log('   ✅ Usando attachment.media.image.src');
                                } else if (creative.thumbnail_url) {
                                    imageUrl = creative.thumbnail_url;
                                    console.log('   ✅ Usando thumbnail_url');
                                } else if (postResponse.picture) {
                                    imageUrl = postResponse.picture;
                                    console.log('   ✅ Usando picture');
                                } else if (postResponse.full_picture) {
                                    imageUrl = postResponse.full_picture;
                                    console.log('   ⚠️ Usando full_picture (pode ser baixa qualidade)');
                                }
                            } 
                            // CARROSSEL
                            else if (attachment?.subattachments) {
                                type = 'carousel';
                                console.log('   🎠 Detectado como CARROSSEL');
                                const firstImage = attachment.subattachments.data?.[0]?.media?.image?.src;
                                imageUrl = firstImage || postResponse.full_picture || creative.thumbnail_url || imageUrl;
                            } 
                            // IMAGEM (incluindo Stories de imagem)
                            else {
                                type = 'image';
                                console.log('   📷 Detectado como IMAGEM');
                                
                                if (attachment?.media?.image?.src) {
                                    imageUrl = attachment.media.image.src;
                                    console.log('   ✅ Usando attachment.media.image.src');
                                } else if (postResponse.picture) {
                                    imageUrl = postResponse.picture;
                                    console.log('   ✅ Usando picture');
                                } else if (postResponse.full_picture) {
                                    imageUrl = postResponse.full_picture;
                                    console.log('   ⚠️ Usando full_picture');
                                } else if (creative.thumbnail_url) {
                                    imageUrl = creative.thumbnail_url;
                                    console.log('   ✅ Usando thumbnail_url');
                                }
                            }
                            
                            console.log(`   📸 URL final: ${imageUrl.substring(0, 80)}...`);
                        } else {
                            console.warn('⚠️ Sem permissão para acessar post orgânico, usando FALLBACK inteligente');
                            console.warn('   Erro:', postResponse?.error?.message);
                            
                            // FALLBACK: Usar thumbnail_url SEM MODIFICAR (Facebook rejeita URLs customizadas)
                            if (creative.thumbnail_url) {
                                // Usar URL original sem modificações - Facebook valida hash da URL
                                imageUrl = creative.thumbnail_url;
                                
                                // Detectar se é vídeo pela URL do thumbnail
                                // URLs de vídeo geralmente contém "video", "scontent", "fna.fbcdn.net/v/t15"
                                const urlLower = creative.thumbnail_url.toLowerCase();
                                const isLikelyVideo = urlLower.includes('/v/t15') || 
                                                     urlLower.includes('video') || 
                                                     urlLower.includes('t15.5256');
                                
                                if (isLikelyVideo) {
                                    type = 'video';
                                    console.log('   🎬 Detectado como VÍDEO (pela URL do thumbnail)');
                                } else {
                                    type = 'image';
                                    console.log('   📷 Detectado como IMAGEM (pela URL do thumbnail)');
                                }
                                
                                console.log('   ✅ Usando thumbnail_url original (Facebook valida hash)');
                                console.log(`   📸 URL: ${imageUrl.substring(0, 100)}...`);
                            }
                        }
                    } catch (err) {
                        console.error('❌❌❌ EXCEÇÃO CAPTURADA ao buscar post existente:', err);
                        console.error('   Stack:', err.stack);
                        console.error('   Message:', err.message);
                    }
                }
                // PARA "CRIAR ANÚNCIO": usar object_story_spec
                else if (creative.object_story_spec) {
                    // Vídeo
                    if (creative.object_story_spec.video_data) {
                        type = 'video';
                        imageUrl = creative.object_story_spec.video_data.image_url || creative.thumbnail_url || imageUrl;
                    }
                    // Carrossel
                    else if (creative.object_story_spec.link_data?.child_attachments) {
                        type = 'carousel';
                        imageUrl = creative.object_story_spec.link_data.picture || creative.thumbnail_url || imageUrl;
                    }
                    // Imagem estática
                    else if (creative.object_story_spec.link_data) {
                        type = 'image';
                        imageUrl = creative.object_story_spec.link_data.picture || creative.image_url || creative.thumbnail_url || imageUrl;
                    }
                }
                
                // Detectar carrossel via asset_feed_spec
                if (creative.asset_feed_spec) {
                    type = 'carousel';
                }
                
                // Se tiver image_hash, buscar imagem de ALTA QUALIDADE usando a Graph API
                if (creative.image_hash && type === 'image') {
                    try {
                        const imageHashUrl = `/${creative.image_hash}?fields=url_128&access_token=${this.accessToken}`;
                        const imageHashResponse = await new Promise((resolve) => {
                            FB.api(imageHashUrl, (res) => resolve(res));
                        });
                        
                        if (imageHashResponse && imageHashResponse.url_128) {
                            // url_128 é uma versão de alta qualidade - substituir 128 por tamanho maior
                            imageUrl = imageHashResponse.url_128.replace('_128.', '_720.');
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar imagem de alta qualidade via image_hash:', err);
                    }
                }
                
                // Fallback final
                if (!imageUrl || imageUrl === 'https://via.placeholder.com/200x200?text=Sem+Imagem') {
                    if (creative.thumbnail_url) {
                        imageUrl = creative.thumbnail_url;
                    } else if (creative.image_url) {
                        imageUrl = creative.image_url;
                    }
                }
                
                return { imageUrl, type };
            }
            
            // Fallback para imagem placeholder
            return { imageUrl: 'https://via.placeholder.com/300x200?text=Sem+Imagem', type: 'image' };
        } catch (error) {
            console.error('Erro ao buscar creative:', error);
            return { imageUrl: 'https://via.placeholder.com/300x200?text=Erro', type: 'image' };
        }
    }

    // Insights da conta
    async getAccountInsights(unitId, startDate, endDate, selectedCampaigns = [], selectedAdSets = []) {
        // Se não há filtros, buscar insights da conta toda
        if (selectedCampaigns.length === 0 && selectedAdSets.length === 0) {
            const url = `/${unitId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
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
                spend: parseFloat(insights.spend || 0),
                impressions: parseInt(insights.impressions || 0),
                clicks: parseInt(insights.clicks || 0),
                conversions: parseInt(conversions),
                actions: insights.actions || []
            };
        }

        // Se há filtros, buscar insights apenas das campanhas/ad sets selecionados
        console.log(`📊 Buscando insights filtrados:`, {
            campanhas: selectedCampaigns.length,
            adSets: selectedAdSets.length,
            periodo: `${startDate} a ${endDate}`
        });

        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalConversions = 0;
        let allActions = [];

        // Buscar insights das campanhas selecionadas
        if (selectedCampaigns.length > 0) {
            for (const campaignId of selectedCampaigns) {
                try {
                    const url = `/${campaignId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
                    const data = await this.fetchWithPagination(url);
                    
                    if (data.length > 0) {
                        const insights = data[0];
                        totalSpend += parseFloat(insights.spend || 0);
                        totalImpressions += parseInt(insights.impressions || 0);
                        totalClicks += parseInt(insights.clicks || 0);
                        
                        if (insights.actions) {
                            allActions.push(...insights.actions);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao buscar insights da campanha ${campaignId}:`, error.message);
                }
            }
        }

        // Buscar insights dos ad sets selecionados
        if (selectedAdSets.length > 0) {
            for (const adSetId of selectedAdSets) {
                try {
                    const url = `/${adSetId}/insights?fields=spend,impressions,clicks,actions&time_range={'since':'${startDate}','until':'${endDate}'}&access_token=${this.accessToken}`;
                    const data = await this.fetchWithPagination(url);
                    
                    if (data.length > 0) {
                        const insights = data[0];
                        totalSpend += parseFloat(insights.spend || 0);
                        totalImpressions += parseInt(insights.impressions || 0);
                        totalClicks += parseInt(insights.clicks || 0);
                        
                        if (insights.actions) {
                            allActions.push(...insights.actions);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao buscar insights do ad set ${adSetId}:`, error.message);
                }
            }
        }

        return {
            spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
            conversions: totalConversions,
            actions: allActions
        };
    }

    // Calcular métricas
    calculateMetrics(insights) {
        const spend = parseFloat(insights.spend || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const conversions = parseInt(insights.conversions || 0);
        
        // Extrair mensagens (conversas) das actions
        const messages = insights.actions?.find(action => 
            action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )?.value || 0;
        const conversations = parseInt(messages);

        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;
        const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
        const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : 0;
        const costPerConversion = conversions > 0 ? (spend / conversions).toFixed(2) : 0;
        const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : 0;
        const costPerConversation = conversations > 0 ? (spend / conversations).toFixed(2) : 0;

        return {
            spend: spend.toFixed(2),
            impressions,
            clicks,
            conversions,
            conversations,
            costPerConversation,
            ctr,
            cpc,
            cpm,
            costPerConversion,
            conversionRate
        };
    }

    // Dados de comparação
    async getComparisonData(unitId, currentStartDate, currentEndDate, selectedCampaigns = [], selectedAdSets = []) {
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

        console.log(`📊 Comparando períodos com filtros:`, {
            campanhas: selectedCampaigns.length,
            adSets: selectedAdSets.length,
            atual: `${currentStartDate} a ${currentEndDate}`,
            anterior: `${previousStartDate} a ${previousEndDate}`
        });

        const [currentMetrics, previousMetrics] = await Promise.all([
            this.getAccountInsights(unitId, currentStartDate, currentEndDate, selectedCampaigns, selectedAdSets),
            this.getAccountInsights(unitId, previousStartDate, previousEndDate, selectedCampaigns, selectedAdSets)
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
                console.log('ℹ️ Nenhum anúncio com dados encontrado no período');
                console.timeEnd('⏱️ Tempo - Melhores Anúncios');
                return [];
            }
            
            console.log(`📊 ${adsData.length} anúncios encontrados, processando...`);

            // Processar dados dos anúncios
            const adsWithMetrics = adsData.map(ad => {
                const conversions = ad.actions?.find(action => 
                    action.action_type === 'offsite_conversion.fb_pixel_purchase' || 
                    action.action_type === 'omni_purchase'
                )?.value || 0;
                
                // Buscar mensagens (leads)
                const messages = ad.actions?.find(action => 
                    action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
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
                    messages: parseInt(messages),
                    imageUrl: 'https://via.placeholder.com/300x200?text=Anúncio' // Placeholder inicial
                };
            });

            // Ordenar por mensagens (leads), depois por conversões, depois por cliques
            const sorted = adsWithMetrics
                .filter(ad => ad.impressions > 0 || ad.spend > 0)
                .sort((a, b) => b.messages - a.messages || b.conversions - a.conversions || b.clicks - a.clicks);

            // Pegar os top N anúncios
            const topAds = sorted.slice(0, limit);
            
            console.log(`🏆 Top ${topAds.length} anúncios selecionados`);

            // Buscar creativos apenas para os top anúncios (em sequência para evitar rate limit)
            for (let i = 0; i < topAds.length; i++) {
                await this._delay(300); // Delay entre cada busca de creative
                try {
                    console.log(`🖼️ Buscando creative do anúncio ${i+1}/${topAds.length}: ${topAds[i].id}`);
                    const creativeData = await this.getCreativeData(topAds[i].id);
                    topAds[i].imageUrl = creativeData.imageUrl;
                    console.log(`✅ Creative obtido para anúncio ${i+1}`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao buscar creative do anúncio ${topAds[i].id}:`, error.message);
                    console.warn('Stack:', error.stack);
                    // Mantém o placeholder - não interrompe o fluxo
                }
            }

            console.log(`✅ Retornando ${topAds.length} anúncios com dados completos`);
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
