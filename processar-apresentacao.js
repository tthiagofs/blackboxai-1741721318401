/**
 * Lógica de Processamento de Apresentações
 * Este arquivo contém as funções para buscar dados, filtrar por plataforma,
 * e gerar o HTML da apresentação
 */

/**
 * Verificar se linha atende regras de tráfego (reutilizando lógica do spreadsheetProcessor)
 */
function matchesTrafficRules(row, trafficSources, customKeywords) {
    // Se row.source existe, usar ele (formato processado)
    const colL = (row.source || row.L || "").toString().trim();
    const colLLower = colL.toLowerCase();
    const colK = (row.K || "").toString().toLowerCase();
    
    // Regra 1: Células vazias (sem fonte definida)
    if (trafficSources.empty && colL === "") {
        return true;
    }
    
    // Regra 2: Células com "..."
    if (trafficSources.dots && colL === "...") {
        return true;
    }
    
    // Regra 3: Fontes de tráfego padrão (coluna L)
    const platforms = [];
    if (trafficSources.facebook) platforms.push("facebook");
    if (trafficSources.instagram) platforms.push("instagram");
    if (trafficSources.google) platforms.push("google");
    if (trafficSources.revista) platforms.push("revista");
    
    const matchesPlatform = platforms.some(platform => 
        colLLower.includes(platform)
    );
    
    // Regra 4: "Outros" + palavras-chave personalizadas
    let matchesCustom = false;
    if (customKeywords && customKeywords.enabled && colLLower.includes("outros")) {
        matchesCustom = customKeywords.terms.some(term => 
            colK.includes(term.toLowerCase())
        );
    }
    
    return matchesPlatform || matchesCustom;
}

/**
 * Filtrar dados da planilha por fonte de tráfego (Meta ou Google)
 * @param {Array} rawData - Dados brutos da planilha
 * @param {String} platform - 'meta' ou 'google'
 * @param {Object} trafficSources - Configurações de fontes de tráfego para a plataforma
 * @param {Object} customKeywords - Configurações de palavras-chave personalizadas para a plataforma
 * @param {Boolean} excludeMaintenance - Se deve excluir manutenções
 * @returns {Object} - Dados filtrados { sales, revenue, budgets }
 */
export function filterSpreadsheetByPlatform(rawData, platform, trafficSources, customKeywords, excludeMaintenance = false) {
    if (!rawData || !Array.isArray(rawData)) {
        return { sales: 0, revenue: 0, budgets: 0 };
    }

    console.log(`🔍 Filtrando ${rawData.length} registros para plataforma: ${platform}`);
    console.log(`⚙️ Configurações de filtro:`, { trafficSources, customKeywords, excludeMaintenance });

    const filteredData = rawData.filter(row => {
        // Excluir manutenções se opção estiver ativa
        if (excludeMaintenance && isMaintenanceProcedure(row)) {
            return false;
        }

        // Filtrar por regras de tráfego específicas da plataforma
        return matchesTrafficRules(row, trafficSources, customKeywords);
    });

    // Calcular métricas
    const sales = filteredData.filter(r => r.status === "APPROVED").length;
    const revenue = filteredData
        .filter(r => r.status === "APPROVED")
        .reduce((sum, r) => sum + (r.value || 0), 0);
    const budgets = filteredData.length;

    console.log(`✅ Resultados filtrados:`, { sales, revenue, budgets, total: rawData.length });

    return { sales, revenue, budgets };
}

/**
 * Verificar se um registro é procedimento de manutenção ortodôntica
 * @param {Object} row - Linha da planilha
 * @returns {Boolean}
 */
function isMaintenanceProcedure(row) {
    const procedure = (row.procedure || row.H || "").toString().trim().toLowerCase();
    
    const maintenanceTerms = [
        "manutenção aparelho móvel",
        "manutenção aparelho ortodôntico autoligado",
        "manutenção aparelho ortodôntico safira",
        "manutenção ortodôntica mensal"
    ];
    
    // Verificar se tem APENAS manutenção (sem outros procedimentos)
    return maintenanceTerms.some(term => procedure.includes(term));
}

/**
 * Extrair mensagens das ações do Meta Ads
 * @param {Array} actions - Array de ações do Meta Ads
 * @returns {Number} - Total de mensagens
 */
export function extractMessages(actions) {
    if (!actions || !Array.isArray(actions)) return 0;
    
    const messageTypes = [
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_first_reply',
        'messaging_conversation_started_7d',
        'offsite_conversion.messaging_conversation_started_7d'
    ];
    
    const total = actions
        .filter(action => messageTypes.includes(action.action_type))
        .reduce((sum, action) => sum + Number(action.value || 0), 0);
    
    return total;
}

/**
 * Calcular métricas consolidadas
 * @param {Object} params - Parâmetros { metaMetrics, googleMetrics, spreadsheetData, platform }
 * @returns {Object} - Métricas consolidadas
 */
export function calculateConsolidatedMetrics(params) {
    const { metaMetrics, googleMetrics, spreadsheetData, platform } = params;
    
    let invested = 0;
    let clicks = 0;
    let leads = 0;
    let messages = 0;
    let impressions = 0;

    // Meta Ads
    if (platform === 'meta' && metaMetrics) {
        invested = Number(metaMetrics.spend || 0);
        clicks = Number(metaMetrics.clicks || 0);
        impressions = Number(metaMetrics.impressions || 0);
        
        // Leads e Mensagens das actions
        if (metaMetrics.actions && Array.isArray(metaMetrics.actions)) {
            leads = metaMetrics.actions
                .filter(a => a.action_type === 'lead')
                .reduce((sum, a) => sum + Number(a.value || 0), 0);
            
            messages = extractMessages(metaMetrics.actions);
        }
    }

    // Google Ads
    if (platform === 'google' && googleMetrics) {
        invested = Number(googleMetrics.spend || 0);
        clicks = Number(googleMetrics.clicks || 0);
        impressions = Number(googleMetrics.impressions || 0);
        // Google não tem leads/mensagens
    }

    // Dados da Planilha (já filtrados)
    const sales = spreadsheetData?.sales || 0;
    const revenue = spreadsheetData?.revenue || 0;
    const budgets = spreadsheetData?.budgets || 0;

    // Calcular métricas derivadas
    const cpc = invested > 0 && clicks > 0 ? invested / clicks : 0;
    const cpl = invested > 0 && leads > 0 ? invested / leads : 0;
    const cpa = invested > 0 && messages > 0 ? invested / messages : 0;
    const roi = invested > 0 && revenue > 0 ? (revenue * 0.25) / invested : 0;

    return {
        invested,
        clicks,
        impressions,
        leads,
        messages,
        cpc,
        cpl,
        cpa,
        budgets,
        sales,
        revenue,
        roi
    };
}

/**
 * Buscar os 3 melhores anúncios do período
 * @param {String} adAccountId - ID da conta Meta Ads
 * @param {String} startDate - Data inicial
 * @param {String} endDate - Data final
 * @param {Object} fbService - Instância do FacebookInsightsService
 * @returns {Array} - Top 3 anúncios
 */
export async function fetchTop3Ads(adAccountId, startDate, endDate, fbService) {
    try {
        console.log('🏆 Buscando top 3 anúncios...');

        // Buscar todos os anúncios com métricas básicas
        const response = await new Promise((resolve, reject) => {
            window.FB.api(
                `/${adAccountId}/ads`,
                'GET',
                {
                    fields: 'id,name,insights.time_range({"since":"' + startDate + '","until":"' + endDate + '"}){impressions,clicks,spend,actions}',
                    limit: 100
                },
                (response) => {
                    if (!response || response.error) {
                        reject(response?.error || new Error('Erro ao buscar anúncios'));
                    } else {
                        resolve(response);
                    }
                }
            );
        });

        if (!response.data || response.data.length === 0) {
            console.warn('⚠️ Nenhum anúncio encontrado');
            return [];
        }

        // Processar anúncios
        const ads = response.data
            .filter(ad => ad.insights && ad.insights.data && ad.insights.data.length > 0)
            .map(ad => {
                const insight = ad.insights.data[0];
                const impressions = Number(insight.impressions || 0);
                const clicks = Number(insight.clicks || 0);
                const spend = Number(insight.spend || 0);
                
                // Extrair leads das actions
                let leads = 0;
                if (insight.actions && Array.isArray(insight.actions)) {
                    leads = insight.actions
                        .filter(a => a.action_type === 'lead')
                        .reduce((sum, a) => sum + Number(a.value || 0), 0);
                }

                return {
                    id: ad.id,
                    name: ad.name,
                    impressions,
                    clicks,
                    spend,
                    leads,
                    cpl: spend > 0 && leads > 0 ? spend / leads : 0
                };
            })
            .filter(ad => ad.impressions > 0) // Apenas ads com impressões
            .sort((a, b) => b.impressions - a.impressions) // Ordenar por impressões
            .slice(0, 3); // Top 3

        console.log(`✅ Top 3 anúncios encontrados:`, ads);

        // Buscar imagens dos anúncios
        for (const ad of ads) {
            try {
                const creativeData = await fbService.getCreativeData(ad.id);
                ad.thumbnailUrl = creativeData.thumbnailUrl;
                ad.type = creativeData.type;
            } catch (error) {
                console.warn(`⚠️ Erro ao buscar imagem do anúncio ${ad.id}:`, error);
                ad.thumbnailUrl = 'https://via.placeholder.com/200x200?text=Sem+Imagem';
                ad.type = 'image';
            }
        }

        return ads;

    } catch (error) {
        console.error('❌ Erro ao buscar top 3 anúncios:', error);
        return [];
    }
}

/**
 * Formatar número como moeda brasileira
 * @param {Number} value - Valor numérico
 * @returns {String} - Valor formatado
 */
export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Formatar número com separador de milhares
 * @param {Number} value - Valor numérico
 * @returns {String} - Valor formatado
 */
export function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
}

/**
 * Formatar data no formato brasileiro
 * @param {String} dateStr - Data no formato ISO
 * @returns {String} - Data formatada
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

