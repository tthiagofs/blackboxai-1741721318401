import { fbAuth } from './auth.js';
import { exportToPDF } from './exportPDF.js';

// Função para obter datas do mês
function getMonthDates(year, month) {
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    return { startDate, endDate };
}

// Função para calcular métricas mensais
async function calculateMonthlyMetrics(unitId, startDate, endDate) {
    const currentAccessToken = fbAuth.getAccessToken();
    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    const response = await new Promise((resolve) => {
        FB.api(
            `/${unitId}/insights`,
            {
                fields: 'spend,reach,actions{action_type,value}',
                time_range: { since: startDate, until: endDate },
                level: 'account',
                access_token: currentAccessToken
            },
            resolve
        );
    });

    if (response && !response.error && response.data && response.data.length > 0) {
        response.data.forEach(data => {
            totalSpend += parseFloat(data.spend) || 0;
            totalReach += parseInt(data.reach) || 0;
            if (data.actions && Array.isArray(data.actions)) {
                const conversationAction = data.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalConversations += parseInt(conversationAction.value) || 0;
                }
                const customConversions = data.actions.filter(
                    action => action.action_type.startsWith('offsite_conversion.')
                );
                customConversions.forEach(action => {
                    if (action.value) {
                        totalConversations += parseInt(action.value) || 0;
                    }
                });
            }
        });
    }

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;
    return { spend: totalSpend, reach: totalReach, conversations: totalConversations, costPerConversation };
}

// Função para renderizar o relatório mensal
function renderMonthlyReport(unitName, startDate, endDate, metrics) {
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');

    const reportHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold text-primary mb-4">Relatório Mensal - ${unitName}</h2>
            <p class="text-gray-600 text-base mb-4">
                <i class="fas fa-calendar-alt mr-2"></i>Período Analisado: ${formattedStartDate} a ${formattedEndDate}
            </p>
            <div class="bg-blue-900 text-white rounded-lg p-4 mb-6">
                <h3 class="text-xl font-semibold uppercase mb-3">Métricas Gerais</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                        <p class="text-lg font-semibold text-white">R$ ${metrics.spend.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                        <p class="text-lg font-semibold text-white">${metrics.reach.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                        <p class="text-lg font-semibold text-white">${metrics.conversations.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                        <p class="text-lg font-semibold text-white">R$ ${metrics.costPerConversation.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const monthlyReportContainer = document.getElementById('monthlyReport');
    monthlyReportContainer.innerHTML = reportHTML;
}

// Exportar funções para uso em RelatorioCompleto.js
export { getMonthDates, calculateMonthlyMetrics, renderMonthlyReport };