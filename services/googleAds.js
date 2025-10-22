// Serviço para Google Ads via Vercel Serverless Functions
export class GoogleAdsService {
    constructor(customerId, accessToken = null) {
        this.customerId = customerId;
        this.accessToken = accessToken;
        // URL da Vercel Function (funciona com ambos os caminhos graças ao vercel.json)
        this.apiUrl = '/api/google-ads';
    }

    async _call(action, params = {}) {
        try {
            const body = {
                action,
                customerId: this.customerId,
                accessToken: this.accessToken,
                ...params,
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro na requisição');
            }

            return await response.json();
        } catch (error) {
            console.error(`Erro ao chamar ${action}:`, error);
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
            const data = await this._call('getAccountInsights', { startDate, endDate });
            return data.insights || {
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
                costPerConversion: 0,
            };
        } catch (error) {
            console.error('Erro ao buscar insights do Google:', error);
            return {
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
                costPerConversion: 0,
            };
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
