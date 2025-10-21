// Relatórios Google Ads
import { GoogleAdsService, GoogleAdsAccountManager } from './services/googleAds.js';
import { formatCurrencyBRL } from './utils/format.js';

// Inicializar gerenciador de contas
const accountManager = new GoogleAdsAccountManager();

// Elementos DOM
const accountSelect = document.getElementById('accountSelect');
const savedAccountsList = document.getElementById('savedAccountsList');
const addAccountBtn = document.getElementById('addAccountBtn');
const newCustomerId = document.getElementById('newCustomerId');
const newAccountName = document.getElementById('newAccountName');
const reportForm = document.getElementById('reportForm');
const loadingSection = document.getElementById('loadingSection');
const reportContainer = document.getElementById('reportContainer');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const last7DaysBtn = document.getElementById('last7DaysBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Carregar contas salvas
function loadSavedAccounts() {
    const accounts = accountManager.loadAccounts();
    
    // Atualizar select
    accountSelect.innerHTML = '<option value="">Escolha uma conta</option>';
    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.customerId;
        option.textContent = `${account.name} (${account.customerId})`;
        accountSelect.appendChild(option);
    });

    // Atualizar lista
    savedAccountsList.innerHTML = '';
    if (accounts.length === 0) {
        savedAccountsList.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma conta salva ainda. Adicione uma conta acima!</p>';
        return;
    }

    accounts.forEach(account => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200';
        div.innerHTML = `
            <div>
                <p class="font-medium text-gray-900">${account.name}</p>
                <p class="text-sm text-gray-500">ID: ${account.customerId}</p>
            </div>
            <button class="text-red-600 hover:text-red-800 transition" data-customer-id="${account.customerId}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Adicionar evento de remover
        const deleteBtn = div.querySelector('button');
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Deseja remover a conta "${account.name}"?`)) {
                accountManager.removeAccount(account.customerId);
                loadSavedAccounts();
            }
        });

        savedAccountsList.appendChild(div);
    });
}

// Adicionar nova conta
addAccountBtn.addEventListener('click', () => {
    const customerId = newCustomerId.value.trim();
    const name = newAccountName.value.trim();

    if (!customerId) {
        alert('Por favor, insira o Customer ID');
        return;
    }

    try {
        accountManager.addAccount(customerId, name);
        newCustomerId.value = '';
        newAccountName.value = '';
        loadSavedAccounts();
        alert('Conta adicionada com sucesso!');
    } catch (error) {
        alert(error.message);
    }
});

// Últimos 7 dias
last7DaysBtn.addEventListener('click', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    document.getElementById('startDate').value = formatDate(sevenDaysAgo);
    document.getElementById('endDate').value = formatDate(yesterday);
    
    console.log(`📅 Últimos 7 dias selecionados: ${formatDate(sevenDaysAgo)} a ${formatDate(yesterday)}`);
});

// Limpar
refreshBtn.addEventListener('click', () => {
    reportContainer.innerHTML = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('enableComparison').checked = false;
});

// Gerar relatório
reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerId = accountSelect.value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const enableComparison = document.getElementById('enableComparison').checked;

    if (!customerId || !startDate || !endDate) {
        alert('Por favor, preencha todos os campos obrigatórios');
        return;
    }

    try {
        loadingSection.classList.remove('hidden');
        reportContainer.innerHTML = '';

        console.log('🚀 Gerando relatório Google Ads...');
        console.time('⏱️ Tempo total de geração');

        // Obter refresh token
        const refreshToken = googleAdsAuth.getRefreshToken();
        if (!refreshToken) {
            throw new Error('Refresh token não encontrado. Configure com: googleAdsAuth.setRefreshToken("SEU_TOKEN")');
        }

        // Criar serviço
        const service = new GoogleAdsService(customerId, refreshToken);

        // Buscar insights
        console.log('📊 Buscando insights da conta...');
        const insights = await service.getAccountInsights(startDate, endDate);
        
        // Calcular métricas
        const metrics = service.calculateMetrics(insights);

        // Buscar comparação se habilitado
        let comparisonMetrics = null;
        if (enableComparison) {
            console.log('📊 Buscando dados de comparação...');
            comparisonMetrics = await service.getComparison(startDate, endDate);
        }

        // Renderizar relatório
        renderReport(customerId, startDate, endDate, metrics, comparisonMetrics);

        console.timeEnd('⏱️ Tempo total de geração');
        console.log('✅ Relatório gerado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        alert(`Erro ao gerar relatório: ${error.message}`);
    } finally {
        loadingSection.classList.add('hidden');
    }
});

// Renderizar relatório
function renderReport(customerId, startDate, endDate, metrics, comparisonMetrics) {
    const accountName = accountSelect.options[accountSelect.selectedIndex].text;

    // Helper para calcular mudança percentual
    const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return null;
        return ((current - previous) / previous) * 100;
    };

    // Helper para renderizar badge de mudança
    const renderChangeBadge = (change) => {
        if (change === null) return '';
        const isPositive = change > 0;
        const color = isPositive ? 'text-green-400' : 'text-red-400';
        const arrow = isPositive ? '↑' : '↓';
        return `<span class="${color} text-sm ml-2">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
    };

    // Helper para custo (diminuir é bom)
    const renderCostChangeBadge = (change) => {
        if (change === null) return '';
        const isPositive = change > 0;
        const color = isPositive ? 'text-red-400' : 'text-green-400';
        const arrow = isPositive ? '↑' : '↓';
        return `<span class="${color} text-sm ml-2">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
    };

    // Calcular mudanças se houver comparação
    let spendChange = null, reachChange = null, conversationsChange = null, costChange = null;
    if (comparisonMetrics) {
        spendChange = calculateChange(parseFloat(metrics.spend), parseFloat(comparisonMetrics.previous.cost));
        reachChange = calculateChange(metrics.reach, comparisonMetrics.previous.impressions);
        conversationsChange = calculateChange(metrics.conversations, comparisonMetrics.previous.conversions);
        costChange = calculateChange(parseFloat(metrics.costPerConversation), parseFloat(comparisonMetrics.previous.costPerConversion || 0));
    }

    const html = `
        <div class="bg-white rounded-lg shadow-lg p-6">
            <!-- Header -->
            <div class="mb-6 pb-4 border-b border-gray-200">
                <h2 class="text-2xl font-bold text-gray-900">
                    <i class="fab fa-google text-blue-600 mr-2"></i>
                    Relatório Google Ads
                </h2>
                <p class="text-gray-600 mt-2">
                    <span class="font-medium">${accountName}</span>
                    <span class="mx-2">•</span>
                    ${new Date(startDate).toLocaleDateString('pt-BR')} - ${new Date(endDate).toLocaleDateString('pt-BR')}
                </p>
            </div>

            <!-- Métricas -->
            <div class="bg-blue-900 text-white rounded-lg p-4 mb-6">
                <h3 class="text-xl font-semibold uppercase mb-3">Campanhas</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                        <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.spend)}${renderChangeBadge(spendChange)}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Impressões</h4>
                        <p class="text-lg font-semibold text-white">${metrics.reach}${renderChangeBadge(reachChange)}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Conversões</h4>
                        <p class="text-lg font-semibold text-white">${metrics.conversations}${renderChangeBadge(conversationsChange)}</p>
                    </div>
                    <div class="metric-card">
                        <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversão</h4>
                        <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.costPerConversation)}${renderCostChangeBadge(costChange)}</p>
                    </div>
                </div>
            </div>

            <!-- Informação -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p class="text-sm text-blue-800">
                    <i class="fas fa-info-circle mr-2"></i>
                    <strong>Nota:</strong> Os dados são obtidos diretamente da API do Google Ads.
                    ${comparisonMetrics ? 'As porcentagens mostram a variação em relação ao período anterior de mesma duração.' : ''}
                </p>
            </div>
        </div>
    `;

    reportContainer.innerHTML = html;
}

// Voltar para home
backToHomeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Inicializar
loadSavedAccounts();

console.log('✅ Relatório Google Ads inicializado!');

