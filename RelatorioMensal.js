import { fbAuth } from './auth.js';
import { exportToPDF } from './exportPDF.js';

// Verificar autenticação
const currentAccessToken = fbAuth.getAccessToken();
if (!currentAccessToken) {
    alert('Você precisa fazer login com o Facebook primeiro. Redirecionando para a página inicial.');
    window.location.replace('index.html');
    throw new Error('Token de acesso não encontrado');
}

// Elementos do DOM
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');

// Estado
let reportMetrics = null;
let lastFormState = { unitId: null, year: null, month: null };

// Mapa de contas
const adAccountsMap = fbAuth.getAdAccounts();

// Preencher select de unidades
const unitSelect = document.getElementById('unitId');
if (!unitSelect) {
    console.error('Elemento unitId não encontrado no DOM.');
} else {
    const sortedAccounts = adAccountsMap && typeof adAccountsMap === 'object'
        ? Object.entries(adAccountsMap)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        : [];

    unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
    if (sortedAccounts.length === 0) {
        unitSelect.innerHTML += '<option value="">Nenhuma conta disponível</option>';
    } else {
        sortedAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            unitSelect.appendChild(option);
        });
    }
}

// Preencher select de ano e mês
const yearSelect = document.getElementById('year');
const monthSelect = document.getElementById('month');
if (yearSelect && monthSelect) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y <= currentYear; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    }

    const months = [
        { value: '01', name: 'Janeiro' },
        { value: '02', name: 'Fevereiro' },
        { value: '03', name: 'Março' },
        { value: '04', name: 'Abril' },
        { value: '05', name: 'Maio' },
        { value: '06', name: 'Junho' },
        { value: '07', name: 'Julho' },
        { value: '08', name: 'Agosto' },
        { value: '09', name: 'Setembro' },
        { value: '10', name: 'Outubro' },
        { value: '11', name: 'Novembro' },
        { value: '12', name: 'Dezembro' }
    ];
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.value;
        option.textContent = month.name;
        monthSelect.appendChild(option);
    });
}

// Função para obter datas do mês
function getMonthDates(year, month) {
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    return { startDate, endDate };
}

// Função para calcular métricas
async function calculateMetrics(unitId, startDate, endDate) {
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

// Função para renderizar o relatório
function renderReport(unitName, startDate, endDate, metrics) {
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');

    const reportHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold text-primary mb-4">Relatório Mensal - ${unitName}</h2>
            <button id="exportPDFBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition mb-4">
                <i class="fas fa-file-pdf mr-2"></i>Exportar para PDF
            </button>
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

    reportContainer.innerHTML = reportHTML;
    shareWhatsAppBtn.classList.remove('hidden');
}

// Evento de submissão do formulário
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const unitId = document.getElementById('unitId').value;
        const unitName = unitSelect.options[unitSelect.selectedIndex].text;
        const year = document.getElementById('year').value;
        const month = document.getElementById('month').value;

        if (!unitId || !year || !month) {
            alert('Por favor, preencha todos os campos obrigatórios (unidade, ano e mês).');
            return;
        }

        const { startDate, endDate } = getMonthDates(year, month);

        const formStateChanged = (
            lastFormState.unitId !== unitId ||
            lastFormState.year !== year ||
            lastFormState.month !== month
        );

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        if (formStateChanged || !reportMetrics) {
            reportMetrics = await calculateMetrics(unitId, startDate, endDate);
            renderReport(unitName, startDate, endDate, reportMetrics);
        } else {
            renderReport(unitName, startDate, endDate, reportMetrics);
        }

        lastFormState = { unitId, year, month };

        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Ocorreu um erro ao gerar o relatório. Por favor, tente novamente.');
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Gerar Relatório';
    }
});

// Evento para exportar PDF
document.addEventListener('click', (event) => {
    if (event.target.closest('#exportPDFBtn')) {
        if (!reportMetrics) {
            alert('Por favor, gere o relatório antes de exportar para PDF.');
            return;
        }

        const unitId = document.getElementById('unitId').value;
        const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
        const year = document.getElementById('year').value;
        const month = document.getElementById('month').value;
        const { startDate, endDate } = getMonthDates(year, month);

        exportToPDF(
            unitId,
            unitName,
            startDate,
            endDate,
            reportMetrics,
            { spend: 0, reach: 0, conversations: 0, costPerConversation: 0 }, // blackMetrics vazio
            false, // hasBlack
            0, // budgetsCompleted
            0, // salesCount
            0, // revenue
            '', // performanceAnalysis
            [] // bestAds
        );
    }
});

// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const year = document.getElementById('year').value;
    const month = document.getElementById('month').value;
    const { startDate, endDate } = getMonthDates(year, month);
    const start = startDate.split('-').reverse().join('/');
    const end = endDate.split('-').reverse().join('/');

    let message = `Relatório Mensal - ${unitName}\n`;
    message += `Período: ${start} a ${end}\n\n`;
    message += `Investimento: R$ ${reportMetrics.spend.toFixed(2).replace('.', ',')}\n`;
    message += `Alcance: ${reportMetrics.reach.toLocaleString('pt-BR')}\n`;
    message += `Conversas Iniciadas: ${reportMetrics.conversations.toLocaleString('pt-BR')}\n`;
    message += `Custo por Conversa: R$ ${reportMetrics.costPerConversation.toFixed(2).replace('.', ',')}\n`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
});