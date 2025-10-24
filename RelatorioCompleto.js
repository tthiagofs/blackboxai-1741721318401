import { fbAuth } from './auth.js?v=3.0';
import { exportToPDF } from './exportPDF.js?v=3.0';
import { formatDateISOToBR, formatCurrencyBRL, encodeWhatsAppText } from './utils/format.js?v=3.0';
import { setSelectedStyles, debounce } from './utils/dom.js?v=3.0';
import { FacebookInsightsService } from './services/facebookInsights.js?v=3.0';
import { GoogleAdsService } from './services/googleAds.js?v=3.0';
import { googleAuth } from './authGoogle.js?v=3.0';
import { projectsService } from './services/projects.js?v=1.3';
import { listUnits } from './services/unitsService.js';
import { createIconWithBackgroundSVG } from './iconsSVG.js';
import { 
    getTemplatesByCategory, 
    detectCategory, 
    generateBusinessText,
    ANALYSIS_CATEGORIES 
} from './services/analysisTemplates.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Variável global para armazenar a logo do projeto
let currentProjectLogo = '';

// Carregar logo do projeto
async function loadProjectLogo() {
    try {
        const projectId = localStorage.getItem('currentProject');
        if (projectId) {
            const project = await projectsService.getProject(projectId);
            if (project && project.logoUrl) {
                currentProjectLogo = project.logoUrl;
                console.log('✅ Logo do projeto carregada:', currentProjectLogo);
            }
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar a logo do projeto:', error.message);
    }
}

// Carregar unidades do projeto
async function loadUnits() {
    try {
        const projectId = localStorage.getItem('currentProject');
        if (!projectId) return;
        
        const units = await listUnits(projectId);
        const unitSelect = document.getElementById('unitSelect');
        
        if (units.length === 0) {
            unitSelect.innerHTML = '<option value="">Nenhuma unidade cadastrada</option>';
            unitSelect.disabled = true;
            return;
        }
        
        // Preencher dropdown
        unitSelect.innerHTML = '<option value="">Selecione uma unidade (opcional)</option>';
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.name;
            option.dataset.unit = JSON.stringify(unit);
            unitSelect.appendChild(option);
        });
        
        // Event listener para quando selecionar uma unidade
        unitSelect.addEventListener('change', onUnitSelected);
        
        console.log(`✅ ${units.length} unidades carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar unidades:', error);
    }
}

// Quando uma unidade é selecionada
function onUnitSelected(event) {
    const selectedOption = event.target.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.dataset.unit) {
        // Limpar campos
        document.getElementById('budgetsCompleted').value = '';
        document.getElementById('salesCount').value = '';
        document.getElementById('revenue').value = '';
        return;
    }
    
    const unit = JSON.parse(selectedOption.dataset.unit);
    
    if (!unit.budgetData || !unit.budgetData.rawData) {
        alert('⚠️ Esta unidade não possui planilha importada.');
        document.getElementById('budgetsCompleted').value = '';
        document.getElementById('salesCount').value = '';
        document.getElementById('revenue').value = '';
        return;
    }
    
    // Pegar datas do relatório
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('⚠️ Selecione primeiro o período do relatório para preencher os dados automaticamente.');
        return;
    }
    
    // Filtrar dados por período
    const filteredData = filterUnitDataByPeriod(unit.budgetData.rawData, startDate, endDate);
    
    // Verificar se tem dados no período
    if (filteredData.totalBudgets === 0) {
        const confirmation = confirm(
            `⚠️ Não há dados nesta unidade para o período selecionado (${startDate} a ${endDate}).\n\n` +
            `Deseja preencher com zeros e inserir manualmente?`
        );
        
        if (confirmation) {
            document.getElementById('budgetsCompleted').value = '0';
            document.getElementById('salesCount').value = '0';
            document.getElementById('revenue').value = '0';
        }
        return;
    }
    
    // Preencher campos
    document.getElementById('budgetsCompleted').value = filteredData.totalBudgets;
    document.getElementById('salesCount').value = filteredData.totalSales;
    document.getElementById('revenue').value = filteredData.totalRevenue.toFixed(2);
    
    console.log(`✅ Dados da unidade "${unit.name}" preenchidos:`, filteredData);
}

// Filtrar dados da unidade por período
function filterUnitDataByPeriod(rawData, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filtered = rawData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= start && itemDate <= end;
    });
    
    return {
        totalBudgets: filtered.length,
        totalSales: filtered.filter(r => r.status === "APPROVED").length,
        totalRevenue: filtered.filter(r => r.status === "APPROVED")
                            .reduce((sum, r) => sum + r.value, 0)
    };
}

// Exibir sugestões de análise
async function displayAnalysisSuggestions(currentConversations, previousConversations, budgets, sales) {
    console.log('🎯 [displayAnalysisSuggestions] Iniciando...');
    
    // Importar auth do Firebase
    const { auth } = await import('./config/firebase.js');
    
    // Verificar autenticação de forma mais robusta
    const user = auth.currentUser;
    if (!user || !user.uid) {
        console.error('❌ [displayAnalysisSuggestions] Usuário não autenticado!', { user, fbAuth: fbAuth.currentUser });
        return;
    }
    const userId = user.uid;
    console.log('✅ [displayAnalysisSuggestions] User ID:', userId);

    try {
        const suggestionsDiv = document.getElementById('analysisSuggestions');
        const trafficContainer = document.getElementById('trafficSuggestionsContainer');
        const businessContainer = document.getElementById('businessSuggestionsContainer');
        const specialContainer = document.getElementById('specialSuggestionsContainer');
        const businessSection = document.getElementById('businessSuggestions');
        const specialSection = document.getElementById('specialSuggestions');

        console.log('✅ [displayAnalysisSuggestions] Elementos encontrados:', {
            suggestionsDiv: !!suggestionsDiv,
            trafficContainer: !!trafficContainer,
            businessContainer: !!businessContainer,
            specialContainer: !!specialContainer
        });

        // Limpar containers
        trafficContainer.innerHTML = '';
        businessContainer.innerHTML = '';
        specialContainer.innerHTML = '';

        // 1. Detectar categoria de tráfego
        const category = detectCategory(currentConversations, previousConversations);
        console.log('📊 [displayAnalysisSuggestions] Categoria detectada:', category);
        
        if (!category) {
            console.log('⚠️ Sem dados de comparação, não exibindo sugestões de tráfego');
        } else {
            // Buscar templates da categoria
            console.log('🔍 Buscando templates para categoria:', category);
            const templates = await getTemplatesByCategory(userId, category);
            console.log('📝 Templates encontrados:', templates.length, templates);
            
            if (templates.length > 0) {
                templates.forEach(template => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-full text-left px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition text-sm text-gray-700';
                    btn.innerHTML = `<i class="fas fa-plus-circle mr-2 text-blue-600"></i>${template.text}`;
                    btn.onclick = () => addTextToAnalysis(template.text);
                    trafficContainer.appendChild(btn);
                    console.log('✅ Adicionado botão de tráfego:', template.text.substring(0, 50) + '...');
                });
            }
        }

        // 2. Gerar texto de negócio (se houver dados)
        console.log('💼 Verificando dados de negócio:', { budgets, sales });
        if (budgets > 0) {
            const businessText = generateBusinessText(budgets, sales);
            console.log('💼 Texto de negócio gerado:', businessText);
            if (businessText) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left px-3 py-2 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition text-sm text-gray-700';
                btn.innerHTML = `<i class="fas fa-plus-circle mr-2 text-green-600"></i>${businessText}`;
                btn.onclick = () => addTextToAnalysis(businessText);
                businessContainer.appendChild(btn);
                businessSection.style.display = 'block';
                console.log('✅ Adicionado botão de negócio');
            }
        }

        // 3. Buscar casos especiais
        console.log('🔧 Buscando casos especiais...');
        const specialTemplates = await getTemplatesByCategory(userId, ANALYSIS_CATEGORIES.ESPECIAL);
        console.log('🔧 Templates especiais encontrados:', specialTemplates.length, specialTemplates);
        
        if (specialTemplates.length > 0) {
            specialTemplates.forEach(template => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left px-3 py-2 bg-white border border-yellow-200 rounded-lg hover:bg-yellow-100 transition text-sm text-gray-700';
                btn.innerHTML = `<i class="fas fa-plus-circle mr-2 text-yellow-600"></i>${template.text}`;
                btn.onclick = () => addTextToAnalysis(template.text);
                specialContainer.appendChild(btn);
                console.log('✅ Adicionado botão especial:', template.text.substring(0, 50) + '...');
            });
            specialSection.style.display = 'block';
        }

        // Mostrar seção de sugestões se houver alguma sugestão
        const totalSuggestions = trafficContainer.children.length + businessContainer.children.length + specialContainer.children.length;
        console.log('📊 Total de sugestões:', totalSuggestions);
        
        if (totalSuggestions > 0) {
            suggestionsDiv.style.display = 'block';
            console.log('✅ Seção de sugestões MOSTRADA');
        } else {
            suggestionsDiv.style.display = 'none';
            console.log('⚠️ Nenhuma sugestão, seção OCULTA');
        }

    } catch (error) {
        console.error('❌ Erro ao carregar sugestões:', error);
        console.error('Stack:', error.stack);
    }
}

// Adicionar texto à análise
function addTextToAnalysis(text) {
    const textarea = document.getElementById('performanceAnalysis');
    const currentValue = textarea.value.trim();
    
    if (currentValue === '') {
        textarea.value = text;
    } else {
        // Adiciona com quebra de linha dupla (cria bullet point no relatório)
        textarea.value = currentValue + '\n\n' + text;
    }
    
    // Scroll para o final do textarea
    textarea.scrollTop = textarea.scrollHeight;
    
    // Feedback visual
    textarea.classList.add('ring-2', 'ring-green-500');
    setTimeout(() => {
        textarea.classList.remove('ring-2', 'ring-green-500');
    }, 500);
}

// Carregar logo e unidades ao iniciar
loadProjectLogo();
loadUnits();

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
let reportComparisonMetrics = null; // Para armazenar os dados de comparação (Meta)
let reportComparisonGoogleMetrics = null; // Para armazenar os dados de comparação (Google)
let reportHasMultiplePlatforms = false; // Flag para saber se tem múltiplas plataformas
let reportSeparateMetaMetrics = null; // Métricas Meta separadas
let reportSeparateGoogleMetrics = null; // Métricas Google separadas
let reportSeparateBlackMetrics = null; // Métricas Black separadas
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
        // Armazenar managedBy como data attribute para usar ao criar o serviço
        if (account.managedBy) {
            option.dataset.managedBy = account.managedBy;
        }
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
async function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal com ID "${modalId}" não encontrado no DOM.`);
        return;
    }
    if (show) {
        // Para modal de comparação, não precisa validar conta (funciona com Google Ads também)
        if (modalId === 'comparisonModal') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (!startDate || !endDate) {
                alert('Por favor, selecione o período do relatório primeiro');
                return;
            }
            // Comparação pode ser usada com Meta ou Google Ads
            modal.classList.remove('hidden');
            return;
        }
        
        // Verificar se os dados foram carregados (apenas para modais Meta)
        const unitId = document.getElementById('unitId').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!unitId || !startDate || !endDate) {
            alert('Por favor, selecione a conta e o período primeiro');
            return;
        }
        
        // Verificar se campanhas foram carregadas
        if ((modalId.includes('campaign') || modalId.includes('Campaigns')) && !campaignsMap[unitId]) {
            console.warn('❌ Campanhas ainda não carregadas para unitId:', unitId);
            console.log('📊 campaignsMap atual:', campaignsMap);
            console.log('🔄 Tentando carregar agora...');
            
            // Tentar carregar agora se não estiver carregando
            if (!isLoadingData) {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                
                if (startDate && endDate) {
                    isLoadingData = true;
                    try {
                        await loadCampaigns(unitId, startDate, endDate);
                        console.log('✅ Campanhas carregadas com sucesso!');
                    } catch (error) {
                        console.error('❌ Erro ao carregar campanhas:', error);
                        alert('Erro ao carregar campanhas. Tente novamente.');
                        return;
                    } finally {
                        isLoadingData = false;
                    }
                } else {
                    alert('Por favor, selecione o período primeiro');
                    return;
                }
            } else {
                alert('Aguarde o carregamento dos dados...');
                return;
            }
        }
        
        // Verificar se ad sets foram carregados
        if ((modalId.includes('adSet') || modalId.includes('AdSets')) && !adSetsMap[unitId]) {
            console.warn('❌ Ad Sets ainda não carregados para unitId:', unitId);
            console.log('📊 adSetsMap atual:', adSetsMap);
            console.log('🔄 Tentando carregar agora...');
            
            // Tentar carregar agora se não estiver carregando
            if (!isLoadingData) {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                
                if (startDate && endDate) {
                    isLoadingData = true;
                    try {
                        await loadAdSets(unitId, startDate, endDate);
                        console.log('✅ Ad Sets carregados com sucesso!');
                    } catch (error) {
                        console.error('❌ Erro ao carregar ad sets:', error);
                        alert('Erro ao carregar ad sets. Tente novamente.');
                        return;
                    } finally {
                        isLoadingData = false;
                    }
                } else {
                    alert('Por favor, selecione o período primeiro');
                    return;
                }
            } else {
                alert('Aguarde o carregamento dos dados...');
                return;
            }
        }
        
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
    
    // Resetar botão de salvar ao iniciar nova geração
    if (typeof window.resetSaveButton === 'function') {
        window.resetSaveButton();
    }
    
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
                // Pegar managedBy (MCC ID) se a conta for gerenciada
                const selectedOption = googleAdsAccountSelect.options[googleAdsAccountSelect.selectedIndex];
                const managedBy = selectedOption?.dataset?.managedBy || null;
                const googleService = new GoogleAdsService(googleAccountId, accessToken, managedBy);
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

        // Determinar tipo de relatório e preparar métricas
        let metrics, blackMetrics;
        let accountName = 'Relatório';
        let hasMultiplePlatforms = false; // Flag para saber se precisa mostrar total
        
        // Armazenar métricas separadas para renderização
        let separateMetaMetrics = metaMetrics;
        let separateGoogleMetrics = googleMetrics;
        let separateBlackMetrics = metaBlackMetrics;
        
        if (metaMetrics && googleMetrics) {
            // Combinar métricas das duas plataformas APENAS para cálculos gerais
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
            hasMultiplePlatforms = true; // Ativar flag
        } else if (metaMetrics) {
            metrics = metaMetrics;
            blackMetrics = metaBlackMetrics;
            accountName = adAccountsMap[unitId] || 'Meta Ads';
            // Se tem Black, também é múltiplo
            if (metaBlackMetrics) {
                hasMultiplePlatforms = true;
            }
        } else if (googleMetrics) {
            metrics = googleMetrics;
            metrics.platform = 'google'; // Marcar explicitamente como Google Ads
            blackMetrics = null;
            // Pegar nome da conta selecionada do select
            const selectedOption = googleAdsAccountSelect.options[googleAdsAccountSelect.selectedIndex];
            accountName = selectedOption ? selectedOption.textContent : 'Google Ads';
        }

        // Buscar dados de comparação se solicitado (para Meta ou Google)
    let comparisonMetrics = null;
    let comparisonBlackMetrics = null;
    let comparisonGoogleMetrics = null; // Nova variável para comparação do Google
        
        // Comparação para Google Ads (sempre buscar se tiver Google selecionado)
        if (comparisonData && googleAccountId) {
            try {
                console.log('📊 Buscando dados de comparação Google Ads...');
                // Pegar managedBy (MCC ID) se a conta for gerenciada
                const selectedOption = googleAdsAccountSelect.options[googleAdsAccountSelect.selectedIndex];
                const managedBy = selectedOption?.dataset?.managedBy || null;
                const googleService = new GoogleAdsService(googleAccountId, googleAuth.getAccessToken(), managedBy);
                const comparison = await googleService.getComparison(startDate, endDate);
                
                if (comparison) {
                    comparisonGoogleMetrics = comparison; // Salvar separadamente
                    console.log('✓ Dados de comparação Google Ads carregados', comparison);
                }
            } catch (error) {
                console.warn('Erro ao carregar dados de comparação Google Ads:', error);
            }
        }
        
        // Comparação para Meta
        if (comparisonData && unitId && insightsService) {
            try {
                if (hasBlack) {
                    // Comparação separada para White e Black
                    console.log('📊 Buscando dados de comparação Meta (White e Black)...');
                    const whiteCampaignsArray = selectedWhiteCampaigns.size > 0 ? Array.from(selectedWhiteCampaigns) : [];
                    const whiteAdSetsArray = selectedWhiteAdSets.size > 0 ? Array.from(selectedWhiteAdSets) : [];
                    const blackCampaignsArray = selectedBlackCampaigns.size > 0 ? Array.from(selectedBlackCampaigns) : [];
                    const blackAdSetsArray = selectedBlackAdSets.size > 0 ? Array.from(selectedBlackAdSets) : [];
                    
                    const [whiteComparison, blackComparison] = await Promise.all([
                        insightsService.getComparisonData(unitId, startDate, endDate, whiteCampaignsArray, whiteAdSetsArray),
                        insightsService.getComparisonData(unitId, startDate, endDate, blackCampaignsArray, blackAdSetsArray)
                    ]);
                    
                    comparisonMetrics = whiteComparison;
                    comparisonBlackMetrics = blackComparison;
                    
                    console.log('✓ Dados de comparação White e Black carregados');
                } else {
                    // Comparação simples (sem Black)
                    console.log('📊 Buscando dados de comparação Meta...');
                    const campaignsToCompare = selectedCampaigns.size > 0 ? Array.from(selectedCampaigns) : [];
                    const adSetsToCompare = selectedAdSets.size > 0 ? Array.from(selectedAdSets) : [];
                    comparisonMetrics = await insightsService.getComparisonData(unitId, startDate, endDate, campaignsToCompare, adSetsToCompare);
                    
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
                }
            } catch (error) {
                console.warn('Erro ao carregar dados de comparação:', error);
            }
        }

        // Adicionar dados de comparação às métricas SEPARADAS (para renderização correta)
        if (comparisonMetrics && separateMetaMetrics) {
            separateMetaMetrics.previousSpend = comparisonMetrics.previous.spend;
            separateMetaMetrics.previousReach = comparisonMetrics.previous.impressions;
            separateMetaMetrics.previousConversations = comparisonMetrics.previous.conversations;
            separateMetaMetrics.previousCostPerConversation = comparisonMetrics.previous.costPerConversation;
        }
        
        if (comparisonBlackMetrics && separateBlackMetrics) {
            separateBlackMetrics.previousSpend = comparisonBlackMetrics.previous.spend;
            separateBlackMetrics.previousReach = comparisonBlackMetrics.previous.impressions;
            separateBlackMetrics.previousConversations = comparisonBlackMetrics.previous.conversations;
            separateBlackMetrics.previousCostPerConversation = comparisonBlackMetrics.previous.costPerConversation;
        }
        
        if (comparisonGoogleMetrics && separateGoogleMetrics) {
            separateGoogleMetrics.previousSpend = comparisonGoogleMetrics.previous.spend;
            separateGoogleMetrics.previousReach = comparisonGoogleMetrics.previous.impressions;
            separateGoogleMetrics.previousConversations = comparisonGoogleMetrics.previous.conversations;
            separateGoogleMetrics.previousCostPerConversation = comparisonGoogleMetrics.previous.costPerConversation;
        }

        // Armazenar métricas globalmente
        reportMetrics = metrics;
        reportBlackMetrics = blackMetrics;
    reportBestAds = bestAds;
        reportComparisonMetrics = comparisonMetrics;
        reportComparisonGoogleMetrics = comparisonGoogleMetrics; // Salvar comparação do Google
        reportHasMultiplePlatforms = hasMultiplePlatforms;
        reportSeparateMetaMetrics = separateMetaMetrics;
        reportSeparateGoogleMetrics = separateGoogleMetrics;
        reportSeparateBlackMetrics = separateBlackMetrics;

        // Renderizar relatório COM dados de negócio, mas SEM análise de texto ainda
        renderCompleteReport(accountName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted, salesCount, revenue, '', currentProjectLogo, hasMultiplePlatforms, separateMetaMetrics, separateGoogleMetrics, separateBlackMetrics, comparisonGoogleMetrics);
        
        // Mostrar seção de análise
        const analysisSection = document.getElementById('analysisSection');
        if (analysisSection) {
            analysisSection.style.display = 'block';
            // Scroll suave para a seção
            setTimeout(() => {
                analysisSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 500);
        }
        
        // Exibir sugestões de análise
        console.log('🔍 [SUGESTÕES] Iniciando cálculo...');
        const currentConversations = metrics.conversations + (blackMetrics ? blackMetrics.conversations : 0);
        const previousConversations = metrics.previousConversations + (blackMetrics ? blackMetrics.previousConversations : 0);
        console.log('🔍 [SUGESTÕES] Conversas:', { atual: currentConversations, anterior: previousConversations });
        console.log('🔍 [SUGESTÕES] Negócio:', { orçamentos: budgetsCompleted, vendas: salesCount });
        
        await displayAnalysisSuggestions(currentConversations, previousConversations, budgetsCompleted, salesCount);
        
        // Preparar dados para salvamento (⭐ ADICIONADO bestAds)
        prepareReportDataForSaving(accountName, startDate, endDate, unitId, googleAccountId, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted, salesCount, revenue, performanceAnalysis);
        
        // Mostrar botão de salvar relatório
        if (typeof window.showSaveButton === 'function') {
            window.showSaveButton();
        }
        
        console.timeEnd('⏱️ GERAÇÃO COMPLETA DO RELATÓRIO');

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        
        // Verificar se o erro é de token expirado
        if (error.message === 'TOKEN_EXPIRED' || error.message.includes('Session has expired')) {
            alert('⚠️ Sua sessão do Facebook expirou!\n\nPor favor, vá até a tela de CONEXÕES e faça login novamente no Facebook.');
            
            // Redirecionar para a tela de conexões após 1 segundo
            setTimeout(() => {
                if (confirm('Deseja ir para a tela de CONEXÕES agora?')) {
                    window.location.href = '/conexoes.html?tokenExpired=true';
                }
            }, 1000);
        } else {
            alert('Erro ao gerar relatório. Tente novamente.');
        }
        
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

function renderCompleteReport(unitName, startDate, endDate, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted = 0, salesCount = 0, revenue = 0, performanceAnalysis = '', projectLogoUrl = '', hasMultiplePlatforms = false, separateMetaMetrics = null, separateGoogleMetrics = null, separateBlackMetrics = null, comparisonGoogleMetrics = null) {
    const formattedStartDate = formatDateISOToBR(startDate);
    const formattedEndDate = formatDateISOToBR(endDate);
    
    // Calcular investimento total para o ROI
    const totalInvestment = hasBlack 
        ? (parseFloat(metrics?.spend || 0) + parseFloat(blackMetrics?.spend || 0))
        : parseFloat(metrics?.spend || 0);
    
    // Lógica de renderização do relatório (similar ao original, mas otimizada)
    const reportHTML = `
        <style>
            /* Melhorar renderização de ícones para PDF */
            .report-card-icon {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 14px !important;
                height: 14px !important;
                min-width: 14px !important;
                min-height: 14px !important;
                text-align: center !important;
                vertical-align: middle !important;
            }
            .fas, .fab {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
        </style>
        <div class="max-w-4xl mx-auto">
            <!-- Header do Relatório -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-4">
                        <!-- Logo do Projeto -->
                        ${projectLogoUrl 
                            ? `<img src="${projectLogoUrl}" alt="Logo" class="w-16 h-16 rounded-xl object-cover border-2 border-gray-200" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div class="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center" style="display:none;">
                                   <i class="fas fa-chart-line text-white text-2xl"></i>
                               </div>`
                            : `<div class="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                                   <i class="fas fa-chart-line text-white text-2xl"></i>
                               </div>`
                        }
                        <div>
                            <h2 class="text-2xl font-bold text-gray-900">${unitName}</h2>
                            <p class="text-sm text-gray-600">${formattedStartDate} - ${formattedEndDate}</p>
                        </div>
                    </div>
                    <button id="exportPDFBtn" class="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-semibold shadow-lg">
                        <i class="fas fa-download"></i>
                        Exportar PDF
                    </button>
                </div>
            </div>

            <!-- Conteúdo do Relatório -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                ${renderPlatformMetrics(separateMetaMetrics, separateGoogleMetrics, separateBlackMetrics, hasMultiplePlatforms, comparisonMetrics, comparisonGoogleMetrics, unitName)}
                
                ${hasMultiplePlatforms ? renderTotalLeads(separateMetaMetrics, separateBlackMetrics, separateGoogleMetrics) : ''}
            
                ${renderBestAds(bestAds, !separateMetaMetrics && separateGoogleMetrics)}
                
                ${renderBusinessResults(budgetsCompleted, salesCount, revenue, totalInvestment)}
                
                ${renderPerformanceAnalysis(performanceAnalysis)}
            </div>
        </div>
    `;

    // Limpar relatório anterior antes de adicionar o novo
    reportContainer.innerHTML = '';
    reportContainer.insertAdjacentHTML('beforeend', reportHTML);
    shareWhatsAppBtn.classList.remove('hidden');
}

function renderTotalLeads(metaMetrics, blackMetrics, googleMetrics = null) {
    // Calcular variação percentual
    const renderMetricChange = (current, previous) => {
        if (!previous || previous === 0) return '';
        const change = ((current - previous) / previous) * 100;
        const isPositive = change > 0;
        const color = isPositive ? 'text-green-600' : 'text-red-600';
        const arrow = isPositive ? '▲' : '▼';
        return `<span class="${color} text-xs font-semibold block mt-1">${arrow} ${Math.abs(change).toFixed(2)}%</span>`;
    };

    // Calcular totais (Meta White + Black + Google)
    const currentTotal = (metaMetrics?.conversations || 0) + 
                        (blackMetrics?.conversations || 0) + 
                        (googleMetrics?.conversations || 0);
    
    const previousTotal = (metaMetrics?.previousConversations || 0) + 
                         (blackMetrics?.previousConversations || 0) + 
                         (googleMetrics?.previousConversations || 0);

    return `
        <!-- Número Total de Leads -->
        <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 mb-6 shadow-sm border-2 border-purple-200">
            <div class="flex items-center justify-center gap-3 mb-3">
                <i class="fas fa-calculator text-purple-600 text-xl"></i>
                <h3 class="text-lg font-bold text-purple-900">Número Total de Leads</h3>
            </div>
            <div class="bg-white rounded-lg p-6 text-center">
                <div class="flex items-center justify-center gap-2 mb-2">
                    ${createIconWithBackgroundSVG('comments', '#8b5cf6')}
                    <h4 class="text-sm text-gray-600 font-medium">Conversas Totais (Todas as Fontes)</h4>
                </div>
                <p class="text-4xl font-bold text-purple-900">
                    ${currentTotal}
                    ${renderMetricChange(currentTotal, previousTotal)}
                </p>
                ${previousTotal > 0 ? `<p class="text-sm text-gray-500 mt-2">${previousTotal} no período anterior</p>` : ''}
            </div>
        </div>
    `;
}

function renderBlackWhiteReport(metrics, blackMetrics, accountName = '') {
    // Helper para criar ícone com fundo colorido (melhor para PDF)
    const createIconWithBackground = (iconClass, bgColor) => {
        return `<div style="width: 20px; height: 20px; min-width: 20px; min-height: 20px; background-color: ${bgColor}; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="${iconClass}" style="font-size: 11px; color: white; line-height: 1;"></i>
        </div>`;
    };

    // Calcular variações se houver período anterior
    const renderMetricChange = (current, previous) => {
        if (!previous || previous === 0) return '';
        const change = ((current - previous) / previous) * 100;
        const isPositive = change > 0;
        const color = isPositive ? 'text-green-600' : 'text-red-600';
        const arrow = isPositive ? '▲' : '▼';
        return `<span class="${color} text-xs font-semibold block mt-1">${arrow} ${Math.abs(change).toFixed(2)}%</span>`;
    };

    const renderCostChange = (current, previous) => {
        if (!previous || previous === 0) return '';
        const change = ((current - previous) / previous) * 100;
        const isPositive = change > 0;
        // Custo: diminuir é bom (verde), aumentar é ruim (vermelho)
        const color = isPositive ? 'text-red-600' : 'text-green-600';
        const arrow = isPositive ? '▲' : '▼';
        return `<span class="${color} text-xs font-semibold block mt-1">${arrow} ${Math.abs(change).toFixed(2)}%</span>`;
    };

    return `
            <!-- Campanhas White -->
            <div class="bg-blue-600 rounded-xl p-5 mb-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <i class="fab fa-facebook text-white text-2xl"></i>
                    <h3 class="text-xl font-bold text-white">Meta Ads - Campanhas White</h3>
                    <span class="text-sm text-blue-100">${accountName || 'CA - Oral Center'}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('dollar', '#3b82f6')}
                            <h4 class="text-xs text-gray-600 font-medium">Valor investido</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${formatCurrencyBRL(metrics.spend || 0)}
                            ${renderCostChange(metrics.spend, metrics.previousSpend)}
                        </p>
                        ${metrics.previousSpend ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(metrics.previousSpend)} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('users', '#10b981')}
                            <h4 class="text-xs text-gray-600 font-medium">Alcance Total</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${(metrics.reach || 0).toLocaleString('pt-BR')}
                            ${renderMetricChange(metrics.reach, metrics.previousReach)}
                        </p>
                        ${metrics.previousReach ? `<p class="text-xs text-gray-500 mt-1">${metrics.previousReach.toLocaleString('pt-BR')} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('comments', '#8b5cf6')}
                            <h4 class="text-xs text-gray-600 font-medium">Conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${metrics.conversations || 0}
                            ${renderMetricChange(metrics.conversations, metrics.previousConversations)}
                        </p>
                        ${metrics.previousConversations ? `<p class="text-xs text-gray-500 mt-1">${metrics.previousConversations} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('chart-line', '#f59e0b')}
                            <h4 class="text-xs text-gray-600 font-medium">Custo por conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${formatCurrencyBRL(metrics.costPerConversation || 0)}
                            ${renderCostChange(metrics.costPerConversation, metrics.previousCostPerConversation)}
                        </p>
                        ${metrics.previousCostPerConversation ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(metrics.previousCostPerConversation)} no período anterior</p>` : ''}
                    </div>
                </div>
            </div>

            <!-- Campanhas Black -->
            <div class="bg-gray-900 rounded-xl p-5 mb-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <i class="fab fa-facebook text-white text-2xl"></i>
                    <h3 class="text-xl font-bold text-white">Meta Ads - Campanhas Black</h3>
                    <span class="text-sm text-gray-300">${accountName || 'CA - Oral Center'}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('dollar', '#3b82f6')}
                            <h4 class="text-xs text-gray-600 font-medium">Valor investido</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${formatCurrencyBRL(blackMetrics.spend || 0)}
                            ${renderCostChange(blackMetrics.spend, blackMetrics.previousSpend)}
                        </p>
                        ${blackMetrics.previousSpend ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(blackMetrics.previousSpend)} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('users', '#10b981')}
                            <h4 class="text-xs text-gray-600 font-medium">Alcance Total</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${(blackMetrics.reach || 0).toLocaleString('pt-BR')}
                            ${renderMetricChange(blackMetrics.reach, blackMetrics.previousReach)}
                        </p>
                        ${blackMetrics.previousReach ? `<p class="text-xs text-gray-500 mt-1">${blackMetrics.previousReach.toLocaleString('pt-BR')} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('comments', '#8b5cf6')}
                            <h4 class="text-xs text-gray-600 font-medium">Conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${blackMetrics.conversations || 0}
                            ${renderMetricChange(blackMetrics.conversations, blackMetrics.previousConversations)}
                        </p>
                        ${blackMetrics.previousConversations ? `<p class="text-xs text-gray-500 mt-1">${blackMetrics.previousConversations} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('chart-line', '#f59e0b')}
                            <h4 class="text-xs text-gray-600 font-medium">Custo por conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">
                            ${formatCurrencyBRL(blackMetrics.costPerConversation || 0)}
                            ${renderCostChange(blackMetrics.costPerConversation, blackMetrics.previousCostPerConversation)}
                        </p>
                        ${blackMetrics.previousCostPerConversation ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(blackMetrics.previousCostPerConversation)} no período anterior</p>` : ''}
                    </div>
                </div>
            </div>
    `;
}

/**
 * Renderizar métricas das plataformas (Meta, Google, ou ambas)
 */
function renderPlatformMetrics(metaMetrics, googleMetrics, blackMetrics, hasMultiplePlatforms, comparisonMetaMetrics, comparisonGoogleMetrics, accountName) {
    let html = '';
    
    // Cenário 1: Meta White + Black
    if (metaMetrics && blackMetrics && !googleMetrics) {
        html += renderBlackWhiteReport(metaMetrics, blackMetrics, accountName);
    }
    // Cenário 2: Apenas Meta (sem Black)
    else if (metaMetrics && !blackMetrics && !googleMetrics) {
        html += renderStandardReport(metaMetrics, comparisonMetaMetrics, accountName);
    }
    // Cenário 3: Meta + Google (com ou sem Black)
    else if (metaMetrics && googleMetrics) {
        // Renderizar Meta (White + Black se existir)
        if (blackMetrics) {
            html += renderBlackWhiteReport(metaMetrics, blackMetrics, accountName);
        } else {
            html += renderStandardReport(metaMetrics, comparisonMetaMetrics, accountName);
        }
        
        // Renderizar Google separadamente COM COMPARAÇÃO
        const googleAccountSelect = document.getElementById('googleAdsAccountSelect');
        const googleAccountName = googleAccountSelect?.options[googleAccountSelect.selectedIndex]?.textContent || 'Google Ads';
        googleMetrics.platform = 'google'; // Marcar como Google
        html += renderStandardReport(googleMetrics, comparisonGoogleMetrics, googleAccountName); // Passar comparação do Google
    }
    // Cenário 4: Apenas Google
    else if (!metaMetrics && googleMetrics) {
        googleMetrics.platform = 'google';
        html += renderStandardReport(googleMetrics, comparisonGoogleMetrics, accountName);
    }
    
    return html;
}

function renderStandardReport(metrics, comparisonMetrics, accountName = '') {
    // Helper para criar ícone com fundo colorido (melhor para PDF)
    const createIconWithBackground = (iconClass, bgColor) => {
        return `<div style="width: 20px; height: 20px; min-width: 20px; min-height: 20px; background-color: ${bgColor}; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="${iconClass}" style="font-size: 11px; color: white; line-height: 1;"></i>
        </div>`;
    };

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
        const color = isPositive ? 'text-green-600' : 'text-red-600';
        const arrow = isPositive ? '▲' : '▼';
        return `<span class="${color} text-xs font-semibold block mt-1">${arrow} ${Math.abs(change).toFixed(2)}%</span>`;
    };
    
    // Helper especial para custo (diminuir é bom, então cores invertidas)
    const renderCostChangeBadge = (change) => {
        if (change === null) return '';
        const isPositive = change > 0; // Aumentou
        // Se aumentou = vermelho (ruim), se diminuiu = verde (bom)
        const color = isPositive ? 'text-red-600' : 'text-green-600';
        const arrow = isPositive ? '▲' : '▼';
        return `<span class="${color} text-xs font-semibold block mt-1">${arrow} ${Math.abs(change).toFixed(2)}%</span>`;
    };
    
    // Calcular mudanças usando comparisonMetrics.previous (agora tem conversations e costPerConversation)
    const spendChange = comparisonMetrics ? calculateChange(parseFloat(metrics.spend), parseFloat(comparisonMetrics.previous.spend)) : null;
    const reachChange = comparisonMetrics ? calculateChange(metrics.reach, comparisonMetrics.previous.impressions) : null;
    const conversationsChange = comparisonMetrics ? calculateChange(metrics.conversations, comparisonMetrics.previous.conversations) : null;
    const costChange = comparisonMetrics ? calculateChange(parseFloat(metrics.costPerConversation), parseFloat(comparisonMetrics.previous.costPerConversation)) : null;
    
    // Detectar se é Google Ads ou Meta Ads baseado nos dados
    const isGoogleAds = metrics.hasOwnProperty('clicks') || metrics.platform === 'google';
    const platformName = isGoogleAds ? 'Google Ads' : 'Meta Ads';
    const platformIcon = isGoogleAds ? 'fab fa-google' : 'fab fa-facebook';
    const platformColor = isGoogleAds ? 'bg-red-600' : 'bg-blue-600';
    const platformLightColor = isGoogleAds ? 'text-red-100' : 'text-blue-100';
    
    return `
            <!-- Meta Ads / Google Ads (quando não tem Black) -->
            <div class="${platformColor} rounded-xl p-5 mb-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <i class="${platformIcon} text-white text-2xl"></i>
                    <h3 class="text-xl font-bold text-white">${platformName}</h3>
                    <span class="text-sm ${platformLightColor}">${accountName || (isGoogleAds ? 'Google Ads' : 'CA - Oral Center')}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('dollar', '#3b82f6')}
                            <h4 class="text-xs text-gray-600 font-medium">Valor investido</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.spend || 0)}</p>
                        ${renderChangeBadge(spendChange)}
                        ${comparisonMetrics ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(comparisonMetrics.previous.spend || 0)} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('users', '#10b981')}
                            <h4 class="text-xs text-gray-600 font-medium">Alcance Total</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">${(metrics.reach || 0).toLocaleString('pt-BR')}</p>
                        ${renderChangeBadge(reachChange)}
                        ${comparisonMetrics ? `<p class="text-xs text-gray-500 mt-1">${(comparisonMetrics.previous.impressions || 0).toLocaleString('pt-BR')} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('comments', '#8b5cf6')}
                            <h4 class="text-xs text-gray-600 font-medium">Conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">${metrics.conversations || 0}</p>
                        ${renderChangeBadge(conversationsChange)}
                        ${comparisonMetrics ? `<p class="text-xs text-gray-500 mt-1">${comparisonMetrics.previous.conversations || 0} no período anterior</p>` : ''}
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            ${createIconWithBackgroundSVG('chart-line', '#f59e0b')}
                            <h4 class="text-xs text-gray-600 font-medium">Custo por conversas iniciadas por mensagem</h4>
                        </div>
                        <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(metrics.costPerConversation || 0)}</p>
                        ${renderCostChangeBadge(costChange)}
                        ${comparisonMetrics ? `<p class="text-xs text-gray-500 mt-1">${formatCurrencyBRL(comparisonMetrics.previous.costPerConversation || 0)} no período anterior</p>` : ''}
                    </div>
                </div>
            </div>
    `;
}

function renderBestAds(bestAds, isGoogleAds = false) {
    // Se for Google Ads, não mostrar nada (Google não tem imagens de anúncios)
    if (isGoogleAds || !bestAds || bestAds.length === 0) {
        return '';
    }

    return `
        <div class="mt-6">
            <div class="bg-yellow-50 rounded-xl p-5 border-l-4 border-yellow-400 mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <i class="fas fa-star text-yellow-500 text-xl"></i>
                    <h3 class="text-lg font-bold text-gray-900">Anúncios em Destaque</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${bestAds.map(ad => `
                        <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                            <div class="flex items-start gap-3">
                                <div class="relative">
                                    <img src="${ad.imageUrl}" alt="Anúncio" class="w-20 h-20 object-cover rounded-lg border border-gray-300" onerror="this.src='https://dummyimage.com/150x150/2563eb/fff&text=AD'">
                                </div>
                                <div class="flex-1">
                                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-2 border border-blue-200">
                                        <p class="text-xs text-gray-600 mb-1">Leads</p>
                                        <p class="text-2xl font-bold text-blue-600">${ad.messages}</p>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <p class="text-gray-500">Investimento</p>
                                            <p class="font-bold text-gray-900">${formatCurrencyBRL(ad.spend)}</p>
                                        </div>
                                        <div>
                                            <p class="text-gray-500">Custo/Lead</p>
                                            <p class="font-bold text-gray-900">${formatCurrencyBRL(ad.costPerMessage)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderBusinessResults(budgetsCompleted, salesCount, revenue, totalInvestment) {
    if (budgetsCompleted === 0 && salesCount === 0 && revenue === 0) {
        return '';
    }

    // Calcular ROI: (Faturamento x 0.25) / gasto total
    const roi = totalInvestment && totalInvestment > 0 && revenue > 0
        ? (revenue * 0.25) / totalInvestment
        : 0;

    return `
        <div class="mt-6">
            <div class="bg-green-50 rounded-xl p-5 border-l-4 border-green-400 mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <i class="fas fa-chart-line text-green-600 text-xl"></i>
                    <h3 class="text-lg font-bold text-gray-900">Resultados do Negócio</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                ${createIconWithBackgroundSVG('file-invoice', '#3b82f6', 'white', 16, 40)}
                            </div>
                            <div class="flex-1">
                                <p class="text-xs text-gray-600">Orçamentos Concluídos</p>
                                <p class="text-2xl font-bold text-gray-900">${budgetsCompleted.toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                                ${createIconWithBackgroundSVG('shopping-bag', '#10b981', 'white', 16, 40)}
                            </div>
                            <div class="flex-1">
                                <p class="text-xs text-gray-600">Número de Vendas</p>
                                <p class="text-2xl font-bold text-gray-900">${salesCount.toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">${budgetsCompleted > 0 ? ((salesCount / budgetsCompleted) * 100).toFixed(1) : 0}% convertido</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                                ${createIconWithBackgroundSVG('dollar', '#8b5cf6', 'white', 16, 40)}
                            </div>
                            <div class="flex-1">
                                <p class="text-xs text-gray-600">Faturamento Total</p>
                                <p class="text-2xl font-bold text-gray-900">${formatCurrencyBRL(revenue)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ROI em destaque -->
                <div class="bg-gradient-to-r from-yellow-100 to-yellow-50 rounded-lg p-4 border-2 border-yellow-400">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                                ${createIconWithBackgroundSVG('trophy', '#eab308', 'white', 18, 48)}
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 font-medium">Retorno sobre Investimento (ROI)</p>
                                <p class="text-4xl font-bold text-yellow-700">${roi.toFixed(2)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-600 mb-1">Investimento Total</p>
                            <p class="text-lg font-bold text-gray-900">${formatCurrencyBRL(totalInvestment || 0)}</p>
                        </div>
                    </div>
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
            <div class="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div class="flex items-center gap-2 mb-4">
                    <i class="fas fa-lightbulb text-purple-600 text-xl"></i>
                    <h3 class="text-lg font-bold text-gray-900">Análise de Desempenho e Melhorias</h3>
                </div>
                <div class="space-y-3">
                    ${paragraphs.map(paragraph => {
                        const formattedParagraph = paragraph.replace(/\n/g, '<br>');
                        return `
                            <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div class="flex-shrink-0 mt-1">
                                    <div class="w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                                        <div class="w-2 h-2 rounded-full bg-gray-400"></div>
                                    </div>
                                </div>
                                <p class="text-sm text-gray-700 leading-relaxed flex-1">${formattedParagraph}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
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

// Event listeners para campos de negócio (atualizar sugestões)
const budgetsInput = document.getElementById('budgetsCompleted');
const salesInput = document.getElementById('salesCount');

if (budgetsInput && salesInput) {
    const updateBusinessSuggestions = debounce(async () => {
        // Só atualiza se o relatório já foi gerado
        if (reportMetrics) {
            const budgets = parseInt(budgetsInput.value) || 0;
            const sales = parseInt(salesInput.value) || 0;
            const currentConversations = reportMetrics.conversations + (reportBlackMetrics ? reportBlackMetrics.conversations : 0);
            const previousConversations = reportMetrics.previousConversations + (reportBlackMetrics ? reportBlackMetrics.previousConversations : 0);
            await displayAnalysisSuggestions(currentConversations, previousConversations, budgets, sales);
        }
    }, 500);

    budgetsInput.addEventListener('input', updateBusinessSuggestions);
    salesInput.addEventListener('input', updateBusinessSuggestions);
}

// Event listener para "Incluir Análise e Gerar Relatório Final"
const generateFinalReportBtn = document.getElementById('generateFinalReportBtn');
if (generateFinalReportBtn) {
    generateFinalReportBtn.addEventListener('click', async () => {
        console.log('🎯 Regenerando relatório com análise...');
        
        if (!reportMetrics) {
            alert('Erro: Métricas do relatório não encontradas. Gere o relatório novamente.');
            return;
        }
        
        // Pegar valores atualizados dos campos
        const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
        const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
        const revenue = parseFloat(document.getElementById('revenue').value) || 0;
        const performanceAnalysis = document.getElementById('performanceAnalysis').value || '';
        
        // Pegar dados originais do relatório
        const unitId = document.getElementById('unitId').value;
        const accountName = adAccountsMap[unitId] || 'Unidade Desconhecida';
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        // Renderizar relatório COM análise
        renderCompleteReport(
            accountName, 
            startDate, 
            endDate, 
            reportMetrics, 
            reportBlackMetrics, 
            reportBestAds, 
            reportComparisonMetrics, // Usar os dados de comparação salvos
            budgetsCompleted, 
            salesCount, 
            revenue, 
            performanceAnalysis, 
            currentProjectLogo,
            reportHasMultiplePlatforms, // Passar a flag
            reportSeparateMetaMetrics, // Métricas separadas
            reportSeparateGoogleMetrics,
            reportSeparateBlackMetrics,
            reportComparisonGoogleMetrics // Comparação do Google
        );
        
        // Atualizar dados para salvamento
        if (window.currentReportData) {
            window.currentReportData.manualData = {
                revenue: revenue,
                sales: salesCount,
                budgets: budgetsCompleted,
                analysis: performanceAnalysis,
                hasBlack: hasBlack || false
            };
        }
        
        // Scroll para o topo do relatório
        const reportContainer = document.getElementById('reportContainer');
        if (reportContainer) {
            reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        console.log('✅ Relatório regenerado com sucesso!');
    });
}

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
function prepareReportDataForSaving(accountName, startDate, endDate, metaAccountId, googleAccountId, metrics, blackMetrics, bestAds, comparisonMetrics, budgetsCompleted, salesCount, revenue, performanceAnalysis) {
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
    
    if (comparisonMetrics && comparisonData) {
        if (comparisonData.startDate && comparisonData.endDate) {
            comparisonStart = comparisonData.startDate;
            comparisonEnd = comparisonData.endDate;
        }
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
        logoUrl: currentProjectLogo || '', // ⭐ Logo do projeto
        
        // Contas
        metaAccount: metaAccount,
        googleAccount: googleAccount,
        
        // ⭐ MÉTRICAS SALVAS (para visualização offline)
        savedMetrics: metrics || { spend: 0, reach: 0, conversations: 0 },
        savedBlackMetrics: blackMetrics || { spend: 0, reach: 0, conversations: 0 },
        savedBestAds: bestAds || [],
        savedComparisonMetrics: comparisonMetrics || null,
        
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

