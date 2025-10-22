import { fbAuth } from './auth.js?v=3.0';
import { exportToPDF } from './exportPDF.js?v=3.0';
import { formatDateISOToBR, formatCurrencyBRL, encodeWhatsAppText } from './utils/format.js?v=3.0';
import { setSelectedStyles, debounce } from './utils/dom.js?v=3.0';
import { FacebookInsightsService } from './services/facebookInsights.js?v=3.0';
import { GoogleAdsService } from './services/googleAds.js?v=3.0';
import { googleAuth } from './authGoogle.js?v=3.0';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar autenticação Facebook (não obrigatório, pois pode gerar só Google Ads)
const currentAccessToken = fbAuth.getAccessToken();

// Inicializar serviços
const insightsService = currentAccessToken ? new FacebookInsightsService(currentAccessToken) : null;

// Inicializar Google Auth
googleAuth.initialize().catch(err => console.error('Erro ao inicializar Google Auth:', err));

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

// Elementos Google Ads
const googleAdsAccountSelect = document.getElementById('googleAdsAccountId');

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

// Preencher select de unidades Meta
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

    unitSelect.innerHTML = '<option value="">Nenhuma conta selecionada</option>';
    if (sortedAccounts.length === 0) {
        console.warn('Nenhuma conta de anúncios Meta encontrada.');
    } else {
        sortedAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            unitSelect.appendChild(option);
        });
    }
}

// Verificar se Google Ads já está autenticado e carregar contas
async function initializeGoogleAds() {
    if (googleAuth.isAuthenticated()) {
        console.log('✅ Google Ads já autenticado');
        await loadGoogleAdsAccounts();
    } else {
        console.log('⚠️ Google Ads não autenticado');
        googleAdsAccountSelect.innerHTML = '<option value="">Faça login com Google primeiro</option>';
        googleAdsAccountSelect.disabled = true;
    }
}

// Preencher select de contas Google Ads
async function loadGoogleAdsAccounts() {
    try {
        googleAdsAccountSelect.innerHTML = '<option value="">Carregando contas...</option>';
        googleAdsAccountSelect.disabled = true;

        // Primeiro tentar carregar contas salvas
        const storedAccounts = googleAuth.getStoredAccounts();
        
        if (storedAccounts.length > 0) {
            renderGoogleAccounts(storedAccounts);
        }

        // Buscar contas atualizadas da API
        const accounts = await googleAuth.fetchAccessibleAccounts();
        
        if (accounts && accounts.length > 0) {
            renderGoogleAccounts(accounts);
        } else if (storedAccounts.length === 0) {
            googleAdsAccountSelect.innerHTML = '<option value="">Nenhuma conta encontrada</option>';
        }

        googleAdsAccountSelect.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar contas Google Ads:', error);
        googleAdsAccountSelect.innerHTML = '<option value="">Erro ao carregar contas</option>';
        googleAdsAccountSelect.disabled = false;
        
        // Se erro de autenticação, solicitar login novamente
        if (error.message.includes('autenticado')) {
            googleAuth.clearToken();
            googleAdsAccountSelect.innerHTML = '<option value="">Faça login com Google primeiro</option>';
            googleAdsAccountSelect.disabled = true;
        }
    }
}

// Renderizar contas no select
function renderGoogleAccounts(accounts) {
    googleAdsAccountSelect.innerHTML = '<option value="">Nenhuma conta selecionada</option>';
    
    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.customerId;
        option.textContent = account.name;
        googleAdsAccountSelect.appendChild(option);
    });
}

// Inicializar Google Ads ao carregar a página
initializeGoogleAds();

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
            spend: data.spend || 0
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
            spend: data.spend || 0
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
            spend: data.spend || 0
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
            spend: data.spend || 0
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
            spend: data.spend || 0
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
            spend: data.spend || 0
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

// Variável para rastrear a última unidade selecionada
let lastSelectedUnitId = null;
let isLoadingData = false; // Flag para evitar carregamentos simultâneos

// Limpar dados quando trocar de conta
document.getElementById('unitId').addEventListener('change', function() {
    const newUnitId = this.value;
    
    if (lastSelectedUnitId && lastSelectedUnitId !== newUnitId) {
        console.log('Mudança de conta detectada. Limpando dados...');
        
        // Limpar seleções
        selectedCampaigns.clear();
        selectedAdSets.clear();
        selectedWhiteCampaigns.clear();
        selectedWhiteAdSets.clear();
        selectedBlackCampaigns.clear();
        selectedBlackAdSets.clear();
        
        // Limpar relatório
        reportContainer.innerHTML = '';
        shareWhatsAppBtn.classList.add('hidden');
        
        // Limpar mapas de campanhas e ad sets
        campaignsMap = {};
        adSetsMap = {};
        
        // Reset hasBlack
        hasBlack = null;
        
        // Resetar filtros
        whiteFilters.classList.add('hidden');
        blackFilters.classList.add('hidden');
        defaultFilters.classList.add('hidden');
        // Manter comparisonFilter visível
        // comparisonFilter.classList.add('hidden');
        
        // Desabilitar botões
        disableButtons();
        
        // Limpar campos manuais
        document.getElementById('budgetsCompleted').value = '';
        document.getElementById('salesCount').value = '';
        document.getElementById('revenue').value = '';
        document.getElementById('performanceAnalysis').value = '';
    }
    
    lastSelectedUnitId = newUnitId;
});

// Carregar dados ao preencher o formulário (com debounce otimizado)
const onFormInput = debounce(async function(e) {
    // Não carregar se já está carregando
    if (isLoadingData) {
        console.log('⏳ Carregamento em andamento...');
            return;
        }

    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        isLoadingData = true;
        console.time('⏱️ TEMPO TOTAL DE CARREGAMENTO');
        try {
            await Promise.all([
                loadCampaigns(unitId, startDate, endDate),
                loadAdSets(unitId, startDate, endDate)
            ]);
        } finally {
            console.timeEnd('⏱️ TEMPO TOTAL DE CARREGAMENTO');
            isLoadingData = false;
        }
    }
}, 300); // Reduzido para 300ms

// Remover o event listener de input do form para evitar chamadas duplicadas
// form.addEventListener('input', onFormInput);

// Adicionar listeners apenas nos campos específicos
document.getElementById('unitId').addEventListener('change', onFormInput);
document.getElementById('startDate').addEventListener('change', onFormInput);
document.getElementById('endDate').addEventListener('change', onFormInput);

// Função para gerar o relatório completo
async function generateCompleteReport() {
    console.time('⏱️ GERAÇÃO COMPLETA DO RELATÓRIO');
    
    const unitId = document.getElementById('unitId').value;
    const googleAccountId = googleAdsAccountSelect.value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
    const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';

    // Validar se pelo menos uma plataforma foi selecionada
    if (!unitId && !googleAccountId) {
        alert('Selecione pelo menos uma conta (Meta ou Google Ads)');
        return;
    }

    if (!startDate || !endDate) {
        alert('Preencha as datas de início e fim');
        return;
    }

    try {
        let metaMetrics = null;
        let googleMetrics = null;
        let metaBlackMetrics = null;
        let bestAds = [];

        // ========== PROCESSAR META ADS ==========
        if (unitId && insightsService) {
            const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
            console.log(`📱 Processando Meta Ads: ${unitName}`);

            // Carregar campanhas e ad sets APENAS se não foram carregados ainda
            if (!campaignsMap[unitId] || !adSetsMap[unitId]) {
                console.log('📥 Carregando dados da API Meta...');
                await Promise.all([
                    loadCampaigns(unitId, startDate, endDate),
                    loadAdSets(unitId, startDate, endDate)
                ]);
    } else {
                console.log('✓ Usando dados Meta já carregados');
            }

            // Calcular métricas Meta baseadas nos dados carregados
    if (hasBlack) {
                // Lógica para White e Black separadamente
                const whiteMetrics = calculateMetricsForSelection(selectedWhiteCampaigns, selectedWhiteAdSets, campaignsMap[unitId] || {}, adSetsMap[unitId] || {});
                const blackMetricsData = calculateMetricsForSelection(selectedBlackCampaigns, selectedBlackAdSets, campaignsMap[unitId] || {}, adSetsMap[unitId] || {});
                
                metaMetrics = whiteMetrics;
                metaBlackMetrics = blackMetricsData;
    } else {
                metaMetrics = calculateMetricsForSelection(selectedCampaigns, selectedAdSets, campaignsMap[unitId] || {}, adSetsMap[unitId] || {});
            }

            // Buscar melhores anúncios da Meta
            try {
                const rawBestAds = await insightsService.getBestPerformingAds(unitId, startDate, endDate, 2);
                
                // Transformar dados para o formato esperado pela renderização
                bestAds = rawBestAds.map(ad => {
                    // As mensagens já vêm corretas do serviço
                    const costPerMessage = ad.messages > 0 ? ad.spend / ad.messages : 0;
                    
                    return {
                        id: ad.id,
                        name: ad.name,
                        imageUrl: ad.imageUrl,
                        spend: ad.spend,
                        impressions: ad.impressions,
                        clicks: ad.clicks,
                        conversions: ad.conversions,
                        messages: ad.messages, // Já vem correto do serviço
                        costPerMessage: costPerMessage,
                        platform: 'meta'
                    };
                });
                
                console.log(`✓ ${bestAds.length} melhores anúncios Meta carregados`);
            } catch (error) {
                console.warn('Erro ao carregar melhores anúncios Meta:', error);
            }
        }

        // ========== PROCESSAR GOOGLE ADS ==========
        if (googleAccountId && googleAuth.isAuthenticated()) {
            const accounts = googleAuth.getStoredAccounts();
            const googleAccount = accounts.find(acc => acc.customerId === googleAccountId);
            const googleAccountName = googleAccount ? googleAccount.name : googleAccountId;

            console.log(`🌐 Processando Google Ads: ${googleAccountName}`);

            try {
                // Usar o accessToken do Google Auth
                const accessToken = googleAuth.getAccessToken();
                const googleService = new GoogleAdsService(googleAccountId, accessToken);
                const googleInsights = await googleService.getAccountInsights(startDate, endDate);
                googleMetrics = googleService.calculateMetrics(googleInsights);
                
                console.log(`✓ Métricas Google Ads carregadas`, googleMetrics);
            } catch (error) {
                console.error('Erro ao carregar Google Ads:', error);
                alert('Erro ao carregar dados do Google Ads. Verifique sua autenticação.');
            }
        } else if (googleAccountId && !googleAuth.isAuthenticated()) {
            alert('Faça login com Google Ads para gerar o relatório.');
        }

        // Combinar métricas ou usar apenas uma plataforma
        let metrics, blackMetrics;
        let accountName = 'Relatório';
        
        if (metaMetrics && googleMetrics) {
            // Combinar métricas das duas plataformas
            const totalSpend = parseFloat(metaMetrics.spend) + parseFloat(googleMetrics.spend);
            const totalConversations = metaMetrics.conversations + googleMetrics.conversations;
            
            metrics = {
                spend: totalSpend.toFixed(2),
                reach: metaMetrics.reach + googleMetrics.reach,
                conversations: totalConversations,
                costPerConversation: totalConversations > 0 ? (totalSpend / totalConversations).toFixed(2) : '0.00'
            };
            blackMetrics = metaBlackMetrics; // Black só existe no Meta
            accountName = 'Meta + Google Ads';
        } else if (metaMetrics) {
            metrics = metaMetrics;
            blackMetrics = metaBlackMetrics;
            accountName = adAccountsMap[unitId] || 'Meta Ads';
        } else if (googleMetrics) {
            metrics = googleMetrics;
            blackMetrics = null;
            const accounts = googleAccountManager.loadAccounts();
            const googleAccount = accounts.find(acc => acc.customerId === googleAccountId);
            accountName = googleAccount ? googleAccount.name : 'Google Ads';
        }

        // Buscar dados de comparação se solicitado (apenas para Meta por enquanto)
        let comparisonMetrics = null;
        if (comparisonData && !hasBlack && unitId && insightsService) {
            try {
                console.log('📊 Buscando dados de comparação Meta...');
                comparisonMetrics = await insightsService.getComparisonData(unitId, startDate, endDate);
                
                console.log('✓ Dados de comparação carregados', {
                    current: {
                        conversations: comparisonMetrics.current.conversations,
                        costPerConversation: comparisonMetrics.current.costPerConversation
                    },
                    previous: {
                        conversations: comparisonMetrics.previous.conversations,
                        costPerConversation: comparisonMetrics.previous.costPerConversation
                    }
                });
            } catch (error) {
                console.warn('Erro ao carregar dados de comparação:', error);
            }
        }

        // Armazenar métricas globalmente
        reportMetrics = metrics;
        reportBlackMetrics = blackMetrics;
        reportBestAds = bestAds;

        // Renderizar relatório
        renderCompleteReport(accountName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted, salesCount, revenue, performanceAnalysis);
        
        // Preparar dados para salvamento
        prepareReportDataForSaving(accountName, startDate, endDate, unitId, googleAccountId, metrics, blackMetrics, comparisonMetrics, budgetsCompleted, salesCount, revenue, performanceAnalysis);
        
        // Mostrar botão de salvar relatório
        if (typeof window.showSaveButton === 'function') {
            window.showSaveButton();
        }
        
        console.timeEnd('⏱️ GERAÇÃO COMPLETA DO RELATÓRIO');

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório. Tente novamente.');
        console.timeEnd('⏱️ GERAÇÃO COMPLETA DO RELATÓRIO');
    }
}

function calculateMetricsForSelection(selectedCampaigns, selectedAdSets, campaigns, adSets) {
    let totalSpend = 0;
    let totalReach = 0;
    let totalConversations = 0;

    if (selectedCampaigns.size > 0) {
        for (const campaignId of selectedCampaigns) {
            const campaign = campaigns[campaignId];
            if (campaign && campaign.insights) {
                totalSpend += campaign.insights.spend || 0;
                totalReach += parseInt(campaign.insights.reach || 0);
                totalConversations += extractMessages(campaign.insights.actions || []);
            }
        }
    } else if (selectedAdSets.size > 0) {
        for (const adSetId of selectedAdSets) {
            const adSet = adSets[adSetId];
            if (adSet && adSet.insights) {
                totalSpend += adSet.insights.spend || 0;
                totalReach += parseInt(adSet.insights.reach || 0);
                totalConversations += extractMessages(adSet.insights.actions || []);
            }
        }
            } else {
        // Se nenhum filtro selecionado, usar todos os dados
        Object.values(campaigns).forEach(campaign => {
            if (campaign && campaign.insights) {
                totalSpend += campaign.insights.spend || 0;
                totalReach += parseInt(campaign.insights.reach || 0);
                totalConversations += extractMessages(campaign.insights.actions || []);
            }
        });
    }

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

    return {
        spend: totalSpend,
        reach: totalReach,
        conversations: totalConversations,
        costPerConversation
    };
}

// Função auxiliar para extrair mensagens das ações
function extractMessages(actions) {
    let totalMessages = 0;
    
    if (actions && Array.isArray(actions)) {
                    // Contabilizar conversas iniciadas
        const conversationAction = actions.find(
                        action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                    );
                    if (conversationAction && conversationAction.value) {
            totalMessages += parseInt(conversationAction.value) || 0;
                    }

                    // Contabilizar conversões personalizadas
        const customConversions = actions.filter(
                        action => action.action_type.startsWith('offsite_conversion.')
                    );
                    customConversions.forEach(action => {
                        if (action.value) {
                totalMessages += parseInt(action.value) || 0;
                        }
                    });

        // Contabilizar cadastros do Facebook
        const leadActions = actions.filter(
                        action => action.action_type === 'lead'
                    );
                    leadActions.forEach(action => {
                        if (action.value) {
                totalMessages += parseInt(action.value) || 0;
                        }
                    });
                }

    return totalMessages;
}

function renderCompleteReport(unitName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted = 0, salesCount = 0, revenue = 0, performanceAnalysis = '') {
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
            
            ${renderBusinessResults(budgetsCompleted, salesCount, revenue)}
            
            ${renderPerformanceAnalysis(performanceAnalysis)}
        </div>
    `;

    // Limpar relatório anterior antes de adicionar o novo
    reportContainer.innerHTML = '';
    reportContainer.insertAdjacentHTML('beforeend', reportHTML);
    shareWhatsAppBtn.classList.remove('hidden');
}

function renderBlackWhiteReport(metrics, blackMetrics) {
    return `
            <div class="bg-blue-600 rounded-lg p-6 mb-6 shadow-lg">
                <h3 class="text-2xl font-bold text-white mb-4 uppercase">Campanhas White</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Investimento</h4>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.spend)}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Alcance</h4>
                        <p class="text-2xl font-bold text-gray-900">${metrics.reach.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Conversas Iniciadas</h4>
                        <p class="text-2xl font-bold text-gray-900">${metrics.conversations}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Custo por Conversa</h4>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.costPerConversation)}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-800 rounded-lg p-6 mb-6 shadow-lg">
                <h3 class="text-2xl font-bold text-white mb-4 uppercase">Campanhas Black</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-gray-800 uppercase mb-2">Investimento</h4>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(blackMetrics.spend)}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-gray-800 uppercase mb-2">Alcance</h4>
                        <p class="text-2xl font-bold text-gray-900">${blackMetrics.reach.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-gray-800 uppercase mb-2">Conversas Iniciadas</h4>
                        <p class="text-2xl font-bold text-gray-900">${blackMetrics.conversations}</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-md">
                        <h4 class="text-xs font-semibold text-gray-800 uppercase mb-2">Custo por Conversa</h4>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(blackMetrics.costPerConversation)}</p>
                    </div>
                </div>
            </div>
    `;
}

function renderStandardReport(metrics, comparisonMetrics) {
    // Helper para calcular variação percentual
    const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return null;
        const change = ((current - previous) / previous) * 100;
        return change;
    };
    
    // Helper para renderizar badge de mudança (normal)
    const renderChangeBadge = (change) => {
        if (change === null) return '';
        const isPositive = change > 0;
        const color = isPositive ? 'text-green-400' : 'text-red-400';
        const arrow = isPositive ? '↑' : '↓';
        return `<span class="${color} text-sm ml-2">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
    };
    
    // Helper especial para custo (diminuir é bom, então cores invertidas)
    const renderCostChangeBadge = (change) => {
        if (change === null) return '';
        const isPositive = change > 0; // Aumentou
        // Se aumentou = vermelho (ruim), se diminuiu = verde (bom)
        const color = isPositive ? 'text-red-400' : 'text-green-400';
        const arrow = isPositive ? '↑' : '↓';
        return `<span class="${color} text-sm ml-2">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
    };
    
    // Calcular mudanças usando comparisonMetrics.previous (agora tem conversations e costPerConversation)
    const spendChange = comparisonMetrics ? calculateChange(parseFloat(metrics.spend), parseFloat(comparisonMetrics.previous.spend)) : null;
    const reachChange = comparisonMetrics ? calculateChange(metrics.reach, comparisonMetrics.previous.impressions) : null;
    const conversationsChange = comparisonMetrics ? calculateChange(metrics.conversations, comparisonMetrics.previous.conversations) : null;
    const costChange = comparisonMetrics ? calculateChange(parseFloat(metrics.costPerConversation), parseFloat(comparisonMetrics.previous.costPerConversation)) : null;
    
    return `
                        <div class="bg-blue-600 rounded-lg p-6 mb-6 shadow-lg">
                            <h3 class="text-2xl font-bold text-white mb-4 uppercase">Campanhas</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="bg-white rounded-lg p-4 shadow-md">
                                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Investimento</h4>
                                    <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.spend)}</p>
                    ${renderChangeBadge(spendChange)}
                                </div>
                                <div class="bg-white rounded-lg p-4 shadow-md">
                                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Alcance</h4>
                                    <p class="text-2xl font-bold text-gray-900">${metrics.reach.toLocaleString('pt-BR')}</p>
                    ${renderChangeBadge(reachChange)}
                                </div>
                                <div class="bg-white rounded-lg p-4 shadow-md">
                                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Conversas Iniciadas</h4>
                                    <p class="text-2xl font-bold text-gray-900">${metrics.conversations}</p>
                    ${renderChangeBadge(conversationsChange)}
                                </div>
                                <div class="bg-white rounded-lg p-4 shadow-md">
                                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Custo por Conversa</h4>
                                    <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.costPerConversation)}</p>
                    ${renderCostChangeBadge(costChange)}
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
                        <div class="mt-6">
                            <h3 class="text-2xl font-bold text-blue-600 mb-4">Anúncios em Destaque</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${bestAds.map(ad => `
                    <div class="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-md">
                        <div class="flex items-start gap-4">
                            <img src="${ad.imageUrl}" alt="Anúncio" class="w-24 h-24 object-cover rounded-md border border-gray-300" onerror="this.src='https://dummyimage.com/150x150/2563eb/fff&text=AD'">
                            <div class="flex-1">
                                <div class="bg-blue-50 rounded-md p-3 mb-2 border border-blue-200">
                                    <p class="text-sm font-semibold text-blue-600">Leads: <span class="text-xl font-bold text-gray-900">${ad.messages}</span></p>
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm text-gray-700"><strong class="text-blue-600">Investimento:</strong> ${formatCurrencyBRL(ad.spend)}</p>
                                    <p class="text-sm text-gray-700"><strong class="text-blue-600">Custo/Lead:</strong> ${formatCurrencyBRL(ad.costPerMessage)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                            </div>
                        </div>
    `;
}

function renderBusinessResults(budgetsCompleted, salesCount, revenue) {
    if (budgetsCompleted === 0 && salesCount === 0 && revenue === 0) {
        return '';
    }

    return `
        <div class="mt-6">
            <h3 class="text-2xl font-bold text-blue-600 mb-4">Resultados do Negócio</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white border-2 border-blue-200 rounded-lg p-5 shadow-md">
                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Orçamentos Concluídos</h4>
                    <p class="text-3xl font-bold text-gray-900">${budgetsCompleted.toLocaleString('pt-BR')}</p>
                </div>
                <div class="bg-white border-2 border-blue-200 rounded-lg p-5 shadow-md">
                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Número de Vendas</h4>
                    <p class="text-3xl font-bold text-gray-900">${salesCount.toLocaleString('pt-BR')}</p>
                </div>
                <div class="bg-white border-2 border-blue-200 rounded-lg p-5 shadow-md">
                    <h4 class="text-xs font-semibold text-blue-600 uppercase mb-2">Faturamento</h4>
                    <p class="text-3xl font-bold text-gray-900">${formatCurrencyBRL(revenue)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderPerformanceAnalysis(performanceAnalysis) {
    if (!performanceAnalysis || performanceAnalysis.trim() === '') {
        return '';
    }

    const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length === 0) {
        return '';
    }

    return `
        <div class="mt-6">
            <h3 class="text-2xl font-bold text-blue-600 mb-4">Análise de Desempenho e Pontos de Melhoria</h3>
            <div class="bg-white border-2 border-blue-200 rounded-lg p-6 shadow-md">
                <ul class="list-disc list-inside space-y-3 text-gray-800 leading-relaxed">
                    ${paragraphs.map(paragraph => {
                        const formattedParagraph = paragraph.replace(/\n/g, '<br>');
                        return `<li class="text-base">${formattedParagraph}</li>`;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;
}

// Event listeners

// Botão "Últimos 7 Dias"
const last7DaysBtn = document.getElementById('last7DaysBtn');
if (last7DaysBtn) {
    last7DaysBtn.addEventListener('click', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1); // Ontem
        
        const sevenDaysAgo = new Date(yesterday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 dias atrás (incluindo ontem = 7 dias)
        
        // Formatar datas para YYYY-MM-DD
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
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Mostrar loading
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';
    
    try {
        await generateCompleteReport();
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório. Verifique sua conexão e tente novamente.');
    } finally {
        // Restaurar botão
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
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
    lastSelectedUnitId = null;
    isLoadingData = false;

    // Limpar o formulário
    form.reset();
    reportContainer.innerHTML = '';
    shareWhatsAppBtn.classList.add('hidden');
    
    // Limpar campos manuais
    document.getElementById('budgetsCompleted').value = '';
    document.getElementById('salesCount').value = '';
    document.getElementById('revenue').value = '';
    document.getElementById('performanceAnalysis').value = '';

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

// ==================== FUNÇÃO PARA PREPARAR DADOS DO RELATÓRIO PARA SALVAMENTO ====================
function prepareReportDataForSaving(accountName, startDate, endDate, metaAccountId, googleAccountId, metrics, blackMetrics, comparisonMetrics, budgetsCompleted, salesCount, revenue, performanceAnalysis) {
    console.log('📦 Preparando dados do relatório para salvamento...');
    
    // Determinar plataforma e nome do relatório
    let platform = '';
    let reportName = '';
    let metaAccount = null;
    let googleAccount = null;
    
    if (metaAccountId && googleAccountId) {
        platform = 'both';
        reportName = adAccountsMap[metaAccountId] || accountName; // Prioridade para Meta
        metaAccount = {
            id: metaAccountId,
            name: adAccountsMap[metaAccountId] || 'Conta Meta'
        };
        const accounts = googleAuth.getStoredAccounts();
        const googleAcc = accounts.find(acc => acc.customerId === googleAccountId);
        googleAccount = {
            id: googleAccountId,
            name: googleAcc ? googleAcc.name : 'Conta Google'
        };
    } else if (metaAccountId) {
        platform = 'meta';
        reportName = adAccountsMap[metaAccountId] || accountName;
        metaAccount = {
            id: metaAccountId,
            name: adAccountsMap[metaAccountId] || 'Conta Meta'
        };
    } else if (googleAccountId) {
        platform = 'google';
        const accounts = googleAuth.getStoredAccounts();
        const googleAcc = accounts.find(acc => acc.customerId === googleAccountId);
        reportName = googleAcc ? googleAcc.name : accountName;
        googleAccount = {
            id: googleAccountId,
            name: googleAcc ? googleAcc.name : 'Conta Google'
        };
    }
    
    // Formatar data para exibição
    const formatDateBR = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    const dateRange = `${formatDateBR(startDate)} - ${formatDateBR(endDate)}`;
    
    // Preparar dados de comparação
    let comparisonStart = null;
    let comparisonEnd = null;
    
    if (comparisonMetrics && comparisonStartDate && comparisonEndDate) {
        comparisonStart = comparisonStartDate;
        comparisonEnd = comparisonEndDate;
    }
    
    // Criar objeto com todos os dados do relatório
    window.currentReportData = {
        reportName: reportName,
        platform: platform,
        dateRange: dateRange,
        analysisStart: startDate,
        analysisEnd: endDate,
        comparisonStart: comparisonStart,
        comparisonEnd: comparisonEnd,
        
        // Contas
        metaAccount: metaAccount,
        googleAccount: googleAccount,
        
        // Dados manuais
        manualData: {
            revenue: revenue || 0,
            sales: salesCount || 0,
            budgets: budgetsCompleted || 0,
            analysis: performanceAnalysis || '',
            hasBlack: hasBlack || false
        },
        
        // Configurações de filtros (para regenerar o relatório)
        filters: {
            selectedCampaigns: Array.from(selectedCampaigns),
            selectedAdSets: Array.from(selectedAdSets),
            selectedWhiteCampaigns: Array.from(selectedWhiteCampaigns),
            selectedWhiteAdSets: Array.from(selectedWhiteAdSets),
            selectedBlackCampaigns: Array.from(selectedBlackCampaigns),
            selectedBlackAdSets: Array.from(selectedBlackAdSets),
            hasBlack: hasBlack
        }
    };
    
    console.log('✅ Dados do relatório preparados:', window.currentReportData);
}

// Botão de limpar cache removido - cache desabilitado para melhor performance

