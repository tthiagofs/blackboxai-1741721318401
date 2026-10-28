// Serviço para Google Ads via Vercel Serverless Functions
export class GoogleAdsService {
    constructor(customerId, accessToken = null, loginCustomerId = null) {
        this.customerId = customerId;
        this.accessToken = accessToken;
        this.loginCustomerId = loginCustomerId; // ID da MCC se a conta for gerenciada
        // URL da Vercel Function (funciona com ambos os caminhos graças ao vercel.json)
        this.apiUrl = '/api/google-ads';
    }

    async _call(action, params = {}) {
        try {
            const body = {
                action,
                customerId: this.customerId,
                accessToken: this.accessToken,
                loginCustomerId: this.loginCustomerId, // Incluir MCC ID se existir
                ...params,
            };

            console.log(`🔍 [GoogleAdsService._call] Chamando ${action}:`, {
                customerId: this.customerId,
                hasToken: !!this.accessToken,
                loginCustomerId: this.loginCustomerId,
                params: Object.keys(params)
            });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            console.log(`📡 [GoogleAdsService._call] Resposta status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [GoogleAdsService._call] Erro na resposta:`, errorText);
                let error;
                try {
                    error = JSON.parse(errorText);
                } catch {
                    error = { error: errorText };
                }
                const errMsg = error.error || `Erro na requisição: ${response.status}`;

                // Se der 401 e tiver refresh_token, renova automaticamente e retenta de forma transparente
                const isAuthError = response.status === 401 || errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('invalid authentication credentials');
                const rt = localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token');

                if (isAuthError && rt && !params._isRetry) {
                    console.log('🔄 [GoogleAdsService] 401 detectado no frontend. Renovando token via refresh_token silenciosamente...');
                    try {
                        const rRes = await fetch('/api/exchange-token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ platform: 'google', refreshToken: rt })
                        });
                        if (rRes.ok) {
                            const rData = await rRes.json();
                            if (rData.accessToken) {
                                this.accessToken = rData.accessToken;
                                localStorage.setItem('googleAccessToken', rData.accessToken);
                                localStorage.setItem('google_ads_access_token', rData.accessToken);
                                localStorage.setItem('google_ads_token_time', Date.now().toString());
                                console.log('✅ [GoogleAdsService] Token renovado com sucesso! Retentando chamada...');
                                return await this._call(action, { ...params, _isRetry: true });
                            }
                        }
                    } catch (eRetry) {
                        console.warn('⚠️ [GoogleAdsService] Falha na auto-renovação silenciosa:', eRetry);
                    }
                }

                throw new Error(errMsg);
            }

            const data = await response.json();
            console.log(`✅ [GoogleAdsService._call] Dados retornados para ${action}:`, data);
            return data;
        } catch (error) {
            console.error(`❌ [GoogleAdsService._call] Erro ao chamar ${action}:`, error);
            throw error;
        }
    }

    // Buscar campanhas
    async getCampaigns(startDate, endDate) {
        try {
            console.time('⏱️ Google Ads - Campanhas');
            const data = await this._call('getCampaigns', { startDate, endDate });
            console.timeEnd('⏱️ Google Ads - Campanhas');
            return data.campaigns || [];
        } catch (error) {
            console.error('Erro ao buscar campanhas do Google:', error);
            return [];
        }
    }

    // Buscar insights da conta
    async getAccountInsights(startDate, endDate) {
        try {
            console.log(`📊 [getAccountInsights] Buscando insights para ${this.customerId}`, { startDate, endDate });
            const data = await this._call('getAccountInsights', { startDate, endDate });
            console.log(`📊 [getAccountInsights] Dados recebidos do _call:`, data);
            
            // ⭐ API retorna { insights: {...} }, então extrair insights
            const insights = data.insights || data;
            console.log('📊 [getAccountInsights] Insights extraídos:', insights);
            return insights;
        } catch (error) {
            console.error('❌ [getAccountInsights] Erro ao buscar insights do Google:', error);
            console.error('❌ [getAccountInsights] Stack:', error.stack);
            const isUnauthenticated = error.message?.includes('401') || 
                                     error.message?.includes('UNAUTHENTICATED') || 
                                     error.message?.includes('invalid authentication credentials');
            // Retornar objeto de erro para que o dashboard saiba que houve problema
            return {
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
                costPerConversion: 0,
                error: error.message, // Adicionar mensagem de erro para debug
                isUnauthenticated
            };
        }
    }

    // Buscar insights diários da conta
    async getAccountInsightsDaily(startDate, endDate) {
        try {
            console.log(`📊 [getAccountInsightsDaily] Buscando insights diários para ${this.customerId}`, { startDate, endDate });
            const data = await this._call('getAccountInsightsDaily', { startDate, endDate });
            console.log(`📊 [getAccountInsightsDaily] Dados recebidos do _call:`, data);
            
            // ⭐ API retorna array de dados diários ou { daily: [...] }
            const dailyData = data.daily || data;
            if (Array.isArray(dailyData)) {
                console.log(`📊 [getAccountInsightsDaily] ${dailyData.length} dias de dados retornados`);
                return dailyData;
            } else {
                console.warn('⚠️ [getAccountInsightsDaily] Formato de dados inesperado, retornando vazio');
                return [];
            }
        } catch (error) {
            console.error('❌ [getAccountInsightsDaily] Erro ao buscar insights diários do Google:', error);
            // Retornar array vazio para fallback
            return [];
        }
    }

    // Buscar dados de comparação
    async getComparison(startDate, endDate) {
        try {
            console.time('⏱️ Google Ads - Comparação');
            const data = await this._call('getComparison', { startDate, endDate });
            console.timeEnd('⏱️ Google Ads - Comparação');
            return {
                current: data.current,
                previous: data.previous,
            };
        } catch (error) {
            console.error('Erro ao buscar comparação do Google:', error);
            return null;
        }
    }

    // Buscar saldo e orçamento da conta Google Ads
    async getAccountBudget() {
        try {
            console.log(`💳 [GoogleAdsService] Buscando saldo/orçamento para ${this.customerId}`);
            const data = await this._call('getAccountBudget');
            return data;
        } catch (error) {
            console.warn('⚠️ [GoogleAdsService] Erro ao buscar saldo/orçamento:', error);
            return { budget: null, isPostpaid: true };
        }
    }

    // Calcular métricas formatadas
    calculateMetrics(insights) {
        const cost = parseFloat(insights.cost || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const conversions = parseInt(insights.conversions || 0);

        return {
            spend: cost.toFixed(2),
            reach: impressions, // Google usa impressions como "alcance"
            conversations: conversions, // Conversões = "conversas iniciadas" no contexto
            costPerConversation: conversions > 0 ? (cost / conversions).toFixed(2) : '0.00',
            clicks: clicks, // ✅ Adicionar cliques
            impressions: impressions, // ✅ Adicionar impressões
        };
    }
}

// Gerenciador de Contas Google Ads (armazenamento local)
export class GoogleAdsAccountManager {
    constructor() {
        this.storageKey = 'googleAdsAccounts';
    }

    // Salvar contas no localStorage
    saveAccounts(accounts) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(accounts));
        } catch (error) {
            console.error('Erro ao salvar contas Google Ads:', error);
        }
    }

    // Carregar contas do localStorage
    loadAccounts() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Erro ao carregar contas Google Ads:', error);
            return [];
        }
    }

    // Adicionar nova conta
    addAccount(customerId, name) {
        const accounts = this.loadAccounts();
        // Verificar se a conta já existe
        const exists = accounts.some(acc => acc.customerId === customerId);
        if (exists) {
            throw new Error('Esta conta já está cadastrada');
        }
        accounts.push({ customerId, name });
        this.saveAccounts(accounts);
        return accounts;
    }

    // Remover conta
    removeAccount(customerId) {
        let accounts = this.loadAccounts();
        accounts = accounts.filter(acc => acc.customerId !== customerId);
        this.saveAccounts(accounts);
        return accounts;
    }

    // Atualizar nome da conta
    updateAccountName(customerId, newName) {
        const accounts = this.loadAccounts();
        const account = accounts.find(acc => acc.customerId === customerId);
        if (account) {
            account.name = newName;
            this.saveAccounts(accounts);
        }
        return accounts;
    }
}
