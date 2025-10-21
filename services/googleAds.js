// Serviço para Google Ads via Netlify Functions
export class GoogleAdsService {
    constructor(customerId, refreshToken) {
        this.customerId = customerId;
        this.refreshToken = refreshToken;
        // URL da Netlify Function (será configurada depois)
        this.apiUrl = '/.netlify/functions/google-ads';
    }

    async _call(action, params = {}) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    customerId: this.customerId,
                    refreshToken: this.refreshToken,
                    ...params,
                }),
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

