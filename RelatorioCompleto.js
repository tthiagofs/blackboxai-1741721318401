import { fbAuth } from './auth.js';
import { exportToPDF } from './exportPDF.js';
import { formatDateISOToBR, formatCurrencyBRL, encodeWhatsAppText } from './utils/format.js';
import { setSelectedStyles, debounce } from './utils/dom.js';
import { FacebookInsightsService } from './services/facebookInsights.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar autenticação
const currentAccessToken = fbAuth.getAccessToken();
if (!currentAccessToken) {
    alert('Você precisa fazer login com o Facebook primeiro. Redirecionando para a página inicial.');
    window.location.replace('index.html');
    throw new Error('Token de acesso não encontrado');
}

// Inicializar serviço de insights
const insightsService = new FacebookInsightsService(currentAccessToken);

// Elementos do DOM
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
const filterCampaignsBtn = document.getElementById('filterCampaigns');
const filterAdSetsBtn = document.getElementById('filterAdSets');
const comparePeriodsBtn = document.getElementById('comparePeriods');
const backToReportSelectionBtn = document.getElementById('backToReportSelectionBtn');
const hasBlackYesBtn = document.getElementById('hasBlackYesBtn');
const hasBlackNoBtn = document.getElementById('hasBlackNoBtn');
const filterWhiteCampaignsBtn = document.getElementById('filterWhiteCampaigns');
const filterWhiteAdSetsBtn = document.getElementById('filterWhiteAdSets');
const filterBlackCampaignsBtn = document.getElementById('filterBlackCampaigns');
const filterBlackAdSetsBtn = document.getElementById('filterBlackAdSets');
const whiteFilters = document.getElementById('whiteFilters');
const blackFilters = document.getElementById('blackFilters');
const defaultFilters = document.getElementById('defaultFilters');
const comparisonFilter = document.getElementById('comparisonFilter');

// Modais
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
const applyCampaignsBtn = document.getElementById('applyCampaigns');
const applyAdSetsBtn = document.getElementById('applyAdSets');
const confirmComparisonBtn = document.getElementById('confirmComparison');
const cancelComparisonBtn = document.getElementById('cancelComparison');
const closeWhiteCampaignsModalBtn = document.getElementById('closeWhiteCampaignsModal');
const closeWhiteAdSetsModalBtn = document.getElementById('closeWhiteAdSetsModal');
const applyWhiteCampaignsBtn = document.getElementById('applyWhiteCampaigns');
const applyWhiteAdSetsBtn = document.getElementById('applyWhiteAdSets');
const closeBlackCampaignsModalBtn = document.getElementById('closeBlackCampaignsModal');
const closeBlackAdSetsModalBtn = document.getElementById('closeBlackAdSetsModal');
const applyBlackCampaignsBtn = document.getElementById('applyBlackCampaigns');
const applyBlackAdSetsBtn = document.getElementById('applyBlackAdSets');
const refreshBtn = document.getElementById('refreshBtn');

// Estado
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let selectedWhiteCampaigns = new Set();
let selectedWhiteAdSets = new Set();
let selectedBlackCampaigns = new Set();
let selectedBlackAdSets = new Set();
let isCampaignFilterActive = false;
let isAdSetFilterActive = false;
let isFilterActivated = false;
let comparisonData = null;
let hasBlack = null; // null (não respondido), true (Sim), false (Não)
let reportMetrics = null;      // Para armazenar as métricas (metrics)
let reportBlackMetrics = null; // Para armazenar as métricas Black (blackMetrics)
let reportBestAds = null;      // Para armazenar os melhores anúncios (bestAds)
let lastFormState = {
    unitId: null,
    startDate: null,
    endDate: null,
    selectedCampaigns: new Set(),
    selectedAdSets: new Set(),
    selectedWhiteCampaigns: new Set(),
    selectedWhiteAdSets: new Set(),
    selectedBlackCampaigns: new Set(),
    selectedBlackAdSets: new Set(),
    comparisonData: null,
    hasBlack: null
};

// Mapas
const adAccountsMap = fbAuth.getAdAccounts();
let adSetsMap = {};
let campaignsMap = {};

// Preencher select de unidades
const unitSelect = document.getElementById('unitId');
if (!unitSelect) {
    console.error('Elemento unitId não encontrado no DOM.');
} else {
    // Verificar se adAccountsMap é válido
    const sortedAccounts = adAccountsMap && typeof adAccountsMap === 'object'
        ? Object.entries(adAccountsMap)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        : [];

    unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
    if (sortedAccounts.length === 0) {
        console.warn('Nenhuma conta de anúncios encontrada em adAccountsMap.');
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

// Desabilitar botões até que a pergunta "A unidade possui Black?" seja respondida
function disableButtons() {
    filterCampaignsBtn.disabled = true;
    filterAdSetsBtn.disabled = true;
    comparePeriodsBtn.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;

    filterWhiteCampaignsBtn.disabled = true;
    filterWhiteAdSetsBtn.disabled = true;
    filterBlackCampaignsBtn.disabled = true;
    filterBlackAdSetsBtn.disabled = true;

    filterCampaignsBtn.classList.add('opacity-50');
    filterAdSetsBtn.classList.add('opacity-50');
    comparePeriodsBtn.classList.add('opacity-50');
    form.querySelector('button[type="submit"]').classList.add('opacity-50');

    filterWhiteCampaignsBtn.classList.add('opacity-50');
    filterWhiteAdSetsBtn.classList.add('opacity-50');
    filterBlackCampaignsBtn.classList.add('opacity-50');
    filterBlackAdSetsBtn.classList.add('opacity-50');
}

// Habilitar botões após a resposta
function enableButtons() {
    if (hasBlack) {
        filterWhiteCampaignsBtn.disabled = false;
        filterWhiteAdSetsBtn.disabled = false;
        filterBlackCampaignsBtn.disabled = false;
        filterBlackAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;
        form.querySelector('button[type="submit"]').disabled = false;

        filterWhiteCampaignsBtn.classList.remove('opacity-50');
        filterWhiteAdSetsBtn.classList.remove('opacity-50');
        filterBlackCampaignsBtn.classList.remove('opacity-50');
        filterBlackAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
        form.querySelector('button[type="submit"]').classList.remove('opacity-50');
    } else {
        filterCampaignsBtn.disabled = false;
        filterAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;
        form.querySelector('button[type="submit"]').disabled = false;

        filterCampaignsBtn.classList.remove('opacity-50');
        filterAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
        form.querySelector('button[type="submit"]').classList.remove('opacity-50');
    }
}

// Inicialmente desabilitar os botões
disableButtons();

// Funções de Modal
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal com ID "${modalId}" não encontrado no DOM.`);
        return;
    }
    if (show) {
        modal.classList.remove('hidden');
        if (modalId === 'campaignsModal') {
            renderCampaignOptions();
        } else if (modalId === 'adSetsModal') {
            renderAdSetOptions();
        } else if (modalId === 'whiteCampaignsModal') {
            renderWhiteCampaignOptions();
        } else if (modalId === 'whiteAdSetsModal') {
            renderWhiteAdSetOptions();
        } else if (modalId === 'blackCampaignsModal') {
            renderBlackCampaignOptions();
        } else if (modalId === 'blackAdSetsModal') {
            renderBlackAdSetOptions();
        }
    } else {
        modal.classList.add('hidden');
    }
}

function setupComparisonModal() {
    if (comparisonData) {
        if (comparisonData.startDate && comparisonData.endDate) {
            document.querySelector('input[name="comparisonOption"][value="custom"]').checked = true;
            document.getElementById('compareStartDate').value = comparisonData.startDate;
            document.getElementById('compareEndDate').value = comparisonData.endDate;
        } else if (comparisonData.isPrevious) {
            document.querySelector('input[name="comparisonOption"][value="previous"]').checked = true;
        } else {
            document.querySelector('input[name="comparisonOption"][value="none"]').checked = true;
        }
    } else {
        document.querySelector('input[name="comparisonOption"][value="none"]').checked = true;
    }
}

// Funções de carregamento de dados usando o serviço
async function loadCampaigns(unitId, startDate, endDate) {
    try {
        campaignsMap[unitId] = await insightsService.loadCampaigns(unitId, startDate, endDate);
        
        if (hasBlack) {
            renderWhiteCampaignOptions();
            renderBlackCampaignOptions();
        } else {
            renderCampaignOptions();
        }
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

async function loadAdSets(unitId, startDate, endDate) {
    try {
        adSetsMap[unitId] = await insightsService.loadAdSets(unitId, startDate, endDate);
        
        if (hasBlack) {
            renderWhiteAdSetOptions();
            renderBlackAdSetOptions();
        } else {
            renderAdSetOptions();
        }
    } catch (error) {
        console.error('Erro ao carregar ad sets:', error);
    }
}

// Funções de renderização otimizadas
function renderCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('campaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    // Usar DocumentFragment para melhor performance
    const fragment = document.createDocumentFragment();
    
    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        
        const isSelected = selectedCampaigns.has(campaign.id);
        const spendClass = campaign.spend > 0 ? 'text-green-600' : 'text-gray-500';
        const spendFormatted = formatCurrencyBRL(campaign.spend);
        
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${spendClass}">
                    ${spendFormatted}
                </span>
            </div>
        `;

        setSelectedStyles(option, isSelected);

        option.addEventListener('click', () => {
            const isCurrentlySelected = selectedCampaigns.has(campaign.id);
            if (isCurrentlySelected) {
                selectedCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedCampaigns.add(campaign.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        fragment.appendChild(option);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

function renderAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('adSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    ${formatCurrencyBRL(adSet.spend)}
                </span>
            </div>
        `;

        setSelectedStyles(option, selectedAdSets.has(adSet.id));

        option.addEventListener('click', () => {
            if (selectedAdSets.has(adSet.id)) {
                selectedAdSets.delete(adSet.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedAdSets.add(adSet.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

// Funções similares para White e Black (renderWhiteCampaignOptions, renderWhiteAdSetOptions, etc.)
function renderWhiteCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('whiteCampaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedWhiteCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    ${formatCurrencyBRL(campaign.spend)}
                </span>
            </div>
        `;

        setSelectedStyles(option, selectedWhiteCampaigns.has(campaign.id));

        option.addEventListener('click', () => {
            if (selectedWhiteCampaigns.has(campaign.id)) {
                selectedWhiteCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedWhiteCampaigns.add(campaign.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderWhiteAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('whiteAdSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedWhiteAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    ${formatCurrencyBRL(adSet.spend)}
                </span>
            </div>
        `;

        setSelectedStyles(option, selectedWhiteAdSets.has(adSet.id));

        option.addEventListener('click', () => {
            if (selectedWhiteAdSets.has(adSet.id)) {
                selectedWhiteAdSets.delete(adSet.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedWhiteAdSets.add(adSet.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderBlackCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('blackCampaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedBlackCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    ${formatCurrencyBRL(campaign.spend)}
                </span>
            </div>
        `;

        setSelectedStyles(option, selectedBlackCampaigns.has(campaign.id));

        option.addEventListener('click', () => {
            if (selectedBlackCampaigns.has(campaign.id)) {
                selectedBlackCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedBlackCampaigns.add(campaign.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderBlackAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('blackAdSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedBlackAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    ${formatCurrencyBRL(adSet.spend)}
                </span>
            </div>
        `;

        setSelectedStyles(option, selectedBlackAdSets.has(adSet.id));

        option.addEventListener('click', () => {
            if (selectedBlackAdSets.has(adSet.id)) {
                selectedBlackAdSets.delete(adSet.id);
                option.classList.remove('selected');
                setSelectedStyles(option, false);
            } else {
                selectedBlackAdSets.add(adSet.id);
                option.classList.add('selected');
                setSelectedStyles(option, true);
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

// Função para atualizar botões de filtro
function updateFilterButtons() {
    filterCampaignsBtn.disabled = isFilterActivated && selectedAdSets.size > 0;
    filterAdSetsBtn.disabled = isFilterActivated && selectedCampaigns.size > 0;
    
    filterCampaignsBtn.classList.toggle('opacity-50', filterCampaignsBtn.disabled);
    filterAdSetsBtn.classList.toggle('opacity-50', filterAdSetsBtn.disabled);
}

// Carregar dados ao preencher o formulário (com debounce)
const onFormInput = debounce(async function() {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        await Promise.all([
            loadCampaigns(unitId, startDate, endDate),
            loadAdSets(unitId, startDate, endDate)
        ]);
    }
}, 350);
form.addEventListener('input', onFormInput);

// Função para gerar o relatório completo
async function generateCompleteReport() {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
    const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';

    if (!unitId || !startDate || !endDate) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }

    try {
        // Carregar dados usando o serviço
        const [campaigns, adSets, bestAds, comparisonMetrics] = await Promise.all([
            insightsService.loadCampaigns(unitId, startDate, endDate),
            insightsService.loadAdSets(unitId, startDate, endDate),
            insightsService.getBestAds(unitId, startDate, endDate),
            insightsService.getComparisonData(unitId, startDate, endDate, comparisonData)
        ]);

        // Calcular métricas
        let metrics, blackMetrics;
        
        if (hasBlack) {
            // Lógica para White e Black separadamente
            const whiteMetrics = calculateMetricsForSelection(selectedWhiteCampaigns, selectedWhiteAdSets, campaigns, adSets);
            const blackMetricsData = calculateMetricsForSelection(selectedBlackCampaigns, selectedBlackAdSets, campaigns, adSets);
            
            metrics = whiteMetrics;
            blackMetrics = blackMetricsData;
        } else {
            metrics = calculateMetricsForSelection(selectedCampaigns, selectedAdSets, campaigns, adSets);
        }

        // Armazenar métricas globalmente
        reportMetrics = metrics;
        reportBlackMetrics = blackMetrics;
        reportBestAds = bestAds;

        // Renderizar relatório
        renderCompleteReport(unitName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics);

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório. Tente novamente.');
    }
}

function calculateMetricsForSelection(selectedCampaigns, selectedAdSets, campaigns, adSets) {
    let totalSpend = 0;
    let totalReach = 0;
    let totalConversations = 0;

    if (selectedCampaigns.size > 0) {
        for (const campaignId of selectedCampaigns) {
            const campaign = campaigns[campaignId];
            if (campaign) {
                totalSpend += campaign.insights.spend;
                totalReach += parseInt(campaign.insights.reach || 0);
                totalConversations += insightsService.extractMessages(campaign.insights.actions || []);
            }
        }
    } else if (selectedAdSets.size > 0) {
        for (const adSetId of selectedAdSets) {
            const adSet = adSets[adSetId];
            if (adSet) {
                totalSpend += adSet.insights.spend;
                totalReach += parseInt(adSet.insights.reach || 0);
                totalConversations += insightsService.extractMessages(adSet.insights.actions || []);
            }
        }
    }

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

    return {
        spend: totalSpend,
        reach: totalReach,
        conversations: totalConversations,
        costPerConversation
    };
}

function renderCompleteReport(unitName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics) {
    const formattedStartDate = formatDateISOToBR(startDate);
    const formattedEndDate = formatDateISOToBR(endDate);
    
    // Lógica de renderização do relatório (similar ao original, mas otimizada)
    const reportHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold text-primary mb-4">Relatório Completo - ${unitName}</h2>
            <button id="exportPDFBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition mb-4">
                <i class="fas fa-file-pdf mr-2"></i>Exportar para PDF
            </button>
            <p class="text-gray-600 text-base mb-4">
                <i class="fas fa-calendar-alt mr-2"></i>Período Analisado: ${formattedStartDate} a ${formattedEndDate}
            </p>
            
            ${hasBlack ? renderBlackWhiteReport(metrics, blackMetrics) : renderStandardReport(metrics, comparisonMetrics)}
            
            ${renderBestAds(bestAds)}
        </div>
    `;

    reportContainer.insertAdjacentHTML('beforeend', reportHTML);
    shareWhatsAppBtn.classList.remove('hidden');
}

function renderBlackWhiteReport(metrics, blackMetrics) {
    return `
        <div class="campaign-section white-report text-white rounded-lg p-4 mb-6">
            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas White</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.spend)}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                    <p class="text-lg font-semibold text-white">${metrics.reach}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                    <p class="text-lg font-semibold text-white">${metrics.conversations}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.costPerConversation)}</p>
                </div>
            </div>
        </div>
        <div class="campaign-section black-report text-white rounded-lg p-4 mb-6">
            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas Black</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(blackMetrics.spend)}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                    <p class="text-lg font-semibold text-white">${blackMetrics.reach}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                    <p class="text-lg font-semibold text-white">${blackMetrics.conversations}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(blackMetrics.costPerConversation)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderStandardReport(metrics, comparisonMetrics) {
    return `
        <div class="bg-blue-900 text-white rounded-lg p-4 mb-6">
            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.spend)}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                    <p class="text-lg font-semibold text-white">${metrics.reach}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                    <p class="text-lg font-semibold text-white">${metrics.conversations}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                    <p class="text-lg font-semibold text-white">${formatCurrencyBRL(metrics.costPerConversation)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderBestAds(bestAds) {
    if (bestAds.length === 0) {
        return '<p class="text-gray-600 text-base">Nenhum anúncio com dados (leads ou investimento) encontrado para este período.</p>';
    }

    return `
        <h3 class="text-xl font-semibold text-primary mb-3">Anúncios em Destaque</h3>
        <div class="space-y-4">
            ${bestAds.map(ad => `
                <div class="flex items-center bg-white border border-gray-200 rounded-lg p-3">
                    <img src="${ad.imageUrl}" alt="Anúncio" class="w-24 h-24 object-cover rounded-md mr-4">
                    <div>
                        <p class="text-gray-700 text-base"><strong>Leads:</strong> ${ad.messages}</p>
                        <p class="text-gray-700 text-base"><strong>Investimento:</strong> ${formatCurrencyBRL(ad.spend)}</p>
                        <p class="text-gray-700 text-base"><strong>Custo por Lead:</strong> ${formatCurrencyBRL(ad.costPerMessage)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Event listeners
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateCompleteReport();
});

// Event listeners para filtros
if (filterCampaignsBtn) {
    filterCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', true));
}
if (filterAdSetsBtn) {
    filterAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', true));
}
if (filterWhiteCampaignsBtn) {
    filterWhiteCampaignsBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', true));
}
if (filterWhiteAdSetsBtn) {
    filterWhiteAdSetsBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', true));
}
if (filterBlackCampaignsBtn) {
    filterBlackCampaignsBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', true));
}
if (filterBlackAdSetsBtn) {
    filterBlackAdSetsBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', true));
}

// Event listeners para modais
if (closeCampaignsModalBtn) {
    closeCampaignsModalBtn.addEventListener('click', () => toggleModal('campaignsModal', false));
}
if (closeAdSetsModalBtn) {
    closeAdSetsModalBtn.addEventListener('click', () => toggleModal('adSetsModal', false));
}
if (applyCampaignsBtn) {
    applyCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', false));
}
if (applyAdSetsBtn) {
    applyAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', false));
}

// Event listeners para White modals
if (closeWhiteCampaignsModalBtn) {
    closeWhiteCampaignsModalBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', false));
}
if (closeWhiteAdSetsModalBtn) {
    closeWhiteAdSetsModalBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', false));
}
if (applyWhiteCampaignsBtn) {
    applyWhiteCampaignsBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', false));
}
if (applyWhiteAdSetsBtn) {
    applyWhiteAdSetsBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', false));
}

// Event listeners para Black modals
if (closeBlackCampaignsModalBtn) {
    closeBlackCampaignsModalBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', false));
}
if (closeBlackAdSetsModalBtn) {
    closeBlackAdSetsModalBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', false));
}
if (applyBlackCampaignsBtn) {
    applyBlackCampaignsBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', false));
}
if (applyBlackAdSetsBtn) {
    applyBlackAdSetsBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', false));
}

// Event listeners para comparação
if (comparePeriodsBtn) {
    comparePeriodsBtn.addEventListener('click', () => {
        setupComparisonModal();
        toggleModal('comparisonModal', true);
    });
}
if (confirmComparisonBtn) {
    confirmComparisonBtn.addEventListener('click', () => {
        const selectedOption = document.querySelector('input[name="comparisonOption"]:checked').value;
        
        if (selectedOption === 'custom') {
            const startDate = document.getElementById('compareStartDate').value;
            const endDate = document.getElementById('compareEndDate').value;
            if (!startDate || !endDate) {
                alert('Preencha as datas de comparação');
                return;
            }
            comparisonData = { startDate, endDate };
        } else if (selectedOption === 'previous') {
            comparisonData = { isPrevious: true };
        } else {
            comparisonData = null;
        }
        
        toggleModal('comparisonModal', false);
    });
}
if (cancelComparisonBtn) {
    cancelComparisonBtn.addEventListener('click', () => toggleModal('comparisonModal', false));
}

// Event listeners para Black question
if (hasBlackYesBtn) {
    hasBlackYesBtn.addEventListener('click', () => {
        hasBlack = true;
        whiteFilters.classList.remove('hidden');
        blackFilters.classList.remove('hidden');
        defaultFilters.classList.add('hidden');
        enableButtons();
    });
}
if (hasBlackNoBtn) {
    hasBlackNoBtn.addEventListener('click', () => {
        hasBlack = false;
        whiteFilters.classList.add('hidden');
        blackFilters.classList.add('hidden');
        defaultFilters.classList.remove('hidden');
        enableButtons();
    });
}

// Event listener para exportar PDF
document.addEventListener('click', (event) => {
    if (event.target.closest('#exportPDFBtn')) {
        if (!reportMetrics) {
            alert('Por favor, gere o relatório antes de exportar para PDF.');
            return;
        }

        const unitId = document.getElementById('unitId').value;
        const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
        const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
        const revenue = parseFloat(document.getElementById('revenue').value) || 0;
        const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';

        exportToPDF(
            unitId,
            unitName,
            startDate,
            endDate,
            reportMetrics,
            reportBlackMetrics || { spend: 0, reach: 0, conversations: 0, costPerConversation: 0 },
            hasBlack,
            budgetsCompleted,
            salesCount,
            revenue,
            performanceAnalysis,
            reportBestAds
        );
    }
});

// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const startDate = formatDateISOToBR(document.getElementById('startDate').value);
    const endDate = formatDateISOToBR(document.getElementById('endDate').value);

    let message = `Relatório Completo - ${unitName}\n`;
    message += `Período Analisado: ${startDate} a ${endDate}\n\n`;

    const report = reportContainer.querySelector('.bg-white');
    if (hasBlack) {
        message += `Campanhas White:\n`;
        const whiteMetrics = report.querySelectorAll('.metric-card')[0].parentElement.querySelectorAll('.metric-card');
        whiteMetrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });

        message += `\nCampanhas Black:\n`;
        const blackMetrics = report.querySelectorAll('.metric-card')[4].parentElement.querySelectorAll('.metric-card');
        blackMetrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });
    } else {
        message += `Campanhas:\n`;
        const metrics = report.querySelectorAll('.metric-card');
        metrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });
    }

    const bestAds = report.querySelectorAll('.flex.items-center');
    if (bestAds.length > 0) {
        message += `\nAnúncios em Destaque:\n`;
        bestAds.forEach((ad, adIndex) => {
            const messages = ad.querySelector('p:nth-child(1)').textContent;
            const costPerMessage = ad.querySelector('p:nth-child(2)').textContent;
            message += `Anúncio ${adIndex + 1}:\n${messages}\n${costPerMessage}\n`;
        });
    }

    const encodedMessage = encodeWhatsAppText(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
});

// Voltar para a seleção de relatórios
backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?appLoggedIn=true';
});

// Limpar seleções e recarregar a página
refreshBtn.addEventListener('click', () => {
    // Limpar todas as seleções
    selectedCampaigns.clear();
    selectedAdSets.clear();
    selectedWhiteCampaigns.clear();
    selectedWhiteAdSets.clear();
    selectedBlackCampaigns.clear();
    selectedBlackAdSets.clear();
    comparisonData = null;
    hasBlack = null;
    reportMetrics = null;
    reportBlackMetrics = null;
    reportBestAds = null;

    // Limpar caches para liberar memória
    insightsService.clearAllCaches();

    // Limpar o formulário
    form.reset();
    reportContainer.innerHTML = '';
    shareWhatsAppBtn.classList.add('hidden');

    // Limpar os filtros visuais
    whiteFilters.classList.add('hidden');
    blackFilters.classList.add('hidden');
    defaultFilters.classList.remove('hidden');
    comparisonFilter.classList.remove('hidden');

    // Desabilitar botões novamente até que "A unidade possui Black?" seja respondido
    disableButtons();

    // Recarregar a página
    window.location.reload();
});

// Adicionar botão para limpar cache
function addClearCacheButton() {
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.id = 'clearCacheBtn';
    clearCacheBtn.className = 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition ml-2';
    clearCacheBtn.innerHTML = '<i class="fas fa-trash mr-2"></i>Limpar Cache';
    clearCacheBtn.addEventListener('click', () => {
        insightsService.clearAllCaches();
        alert('Cache limpo com sucesso!');
    });
    
    if (refreshBtn && refreshBtn.parentNode) {
        refreshBtn.parentNode.appendChild(clearCacheBtn);
    }
}

// Inicializar botão de limpar cache
addClearCacheButton();
