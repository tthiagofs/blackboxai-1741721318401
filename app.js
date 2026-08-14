import { appAuth, fbAuth } from './auth.js?v=2.9';
import { formatDateISOToBR, encodeWhatsAppText, formatCurrencyBRL } from './utils/format.js?v=2.9';
import { debounce, setSelectedStyles } from './utils/dom.js?v=2.9';
import { googleAuth } from './authGoogle.js?v=2.9';

const appLoginScreen = document.getElementById('appLoginScreen');
const reportSelectionScreen = document.getElementById('reportSelectionScreen');
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const appLoginForm = document.getElementById('appLoginForm');
const appLoginError = document.getElementById('appLoginError');
const simpleReportBtn = document.getElementById('simpleReportBtn');
const completeReportBtn = document.getElementById('completeReportBtn');
const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const continueToReportBtn = document.getElementById('continueToReportBtn');
const continueToReportBtnContainer = document.getElementById('continueToReportBtnContainer');
const togglePassword = document.getElementById('togglePassword');
const fbLoginStatus = document.getElementById('fbLoginStatus');
const googleLoginStatus = document.getElementById('googleLoginStatus');
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
const filterCampaignsBtn = document.getElementById('filterCampaigns');
const filterAdSetsBtn = document.getElementById('filterAdSets');
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
const applyCampaignsBtn = document.getElementById('applyCampaigns');
const applyAdSetsBtn = document.getElementById('applyAdSets');
const backToReportSelectionBtn = document.getElementById('backToReportSelectionBtn');

// Inicializar Google Auth
googleAuth.initialize().catch(err => console.error('Erro ao inicializar Google Auth:', err));

// Mapa para armazenar os nomes das contas, IDs dos ad sets e campanhas
const adAccountsMap = {};
const adSetsMap = {};
const campaignsMap = {};
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let isCampaignFilterActive = false;
let isAdSetFilterActive = false;
let isFilterActivated = false;
let currentAccessToken = localStorage.getItem('fbAccessToken') || null;

// Função para alternar telas
function showScreen(screen) {
    // Esconder todas as telas
    appLoginScreen.classList.add('hidden');
    reportSelectionScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    if (mainContent) mainContent.classList.add('hidden');
    
    // Mostrar a tela solicitada
    screen.classList.remove('hidden');

    if (screen === mainContent) {
        const backBtn = document.getElementById('backToReportSelectionBtn');
        if (backBtn) {
            backBtn.removeEventListener('click', backBtn.clickHandler);
            backBtn.clickHandler = (e) => {
                e.preventDefault();
                console.log('Botão Voltar clicado - Redirecionando para seleção de relatório');
                // Verifica se o usuário já fez login no app
                if (localStorage.getItem('appLoggedIn') === 'true') {
                    showScreen(reportSelectionScreen);  // Mostra direto sem recarregar
                } else {
                    window.location.href = 'index.html?screen=reportSelection';
                }
            };
            backBtn.addEventListener('click', backBtn.clickHandler);
        } else {
            console.error('Botão backToReportSelectionBtn não encontrado');
        }
    }
}

// Validate Facebook login status
async function validateFacebookLogin() {
    if (!currentAccessToken) {
        showScreen(loginScreen);
        await handleFacebookLogin();
        return false;
    }

    return new Promise((resolve) => {
        FB.getLoginStatus((response) => {
            if (response.status === 'connected' && response.authResponse.accessToken === currentAccessToken) {
                resolve(true);
            } else {
                currentAccessToken = null;
                localStorage.removeItem('fbAccessToken');
                localStorage.removeItem('adAccountsMap');
                showScreen(loginScreen);
                handleFacebookLogin();
                resolve(false);
            }
        });
    });
}

// Login do app
appLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (username === '' || password === '') {
        appLoginError.textContent = 'Por favor, preencha todos os campos.';
        appLoginError.classList.remove('hidden');
        return;
    }

    if (appAuth.validateAppLogin(username, password)) {
        appLoginError.classList.add('hidden');
        localStorage.setItem('appLoggedIn', 'true');  // Armazena que o login foi bem-sucedido
        showScreen(loginScreen);  // Vai direto para login Meta/Google
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        appLoginError.textContent = 'Usuário ou senha inválidos.';
        appLoginError.classList.remove('hidden');
        usernameInput.value = '';
        passwordInput.value = '';
    }
});

// Seleção de relatório simplificado
simpleReportBtn.addEventListener('click', async () => {
    simpleReportBtn.classList.add('active');
    // Já está logado, apenas carrega contas e vai para tela
        showScreen(mainContent);
    if (fbLoggedIn) {
        await loadAdAccounts();
    }
});

// Seleção de relatório completo
completeReportBtn.addEventListener('click', async () => {
    // Já está logado, vai direto para a tela de relatório
        window.location.href = 'RelatorioCompleto.html';
});

// Variáveis de estado de login
let fbLoggedIn = false;
let googleLoggedIn = false;

// Login com Facebook
async function handleFacebookLogin() {
    const loginError = document.getElementById('loginError');
    loginError.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Conectando...';

    try {
        // Limpar qualquer token antigo
        localStorage.removeItem('fbAccessToken');
        localStorage.removeItem('adAccountsMap');
        
        const response = await fbAuth.login();
        if (response && response.authResponse) {
            currentAccessToken = response.authResponse.accessToken;
            
            // Verificar se temos permissões necessárias
            const permissions = await new Promise((resolve) => {
                FB.api('/me/permissions', (response) => resolve(response.data || []));
            });

            const hasAllPermissions = ['ads_read', 'ads_management', 'business_management']
                .every(perm => permissions.some(p => p.permission === perm && p.status === 'granted'));

            if (!hasAllPermissions) {
                throw new Error('Permissões necessárias não foram concedidas');
            }

            // Marcar como logado
            fbLoggedIn = true;
            fbLoginStatus.classList.remove('hidden');
            loginBtn.classList.add('hidden');
            // checkLoginStatus() será chamado no event listener
            
            console.log('✅ Facebook conectado com sucesso!');
        } else {
            throw new Error('Login não autorizado');
        }
    } catch (error) {
        console.error('Erro detalhado:', error);
        loginError.textContent = `Erro no login Facebook: ${error.message}`;
        loginError.style.display = 'block';
        
        // Limpar tokens em caso de erro
        localStorage.removeItem('fbAccessToken');
        localStorage.removeItem('adAccountsMap');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fab fa-facebook-f mr-2"></i>Continuar com Facebook';
    }
}

// Login com Google
async function handleGoogleLogin() {
    const loginError = document.getElementById('loginError');
    loginError.style.display = 'none';
    googleLoginBtn.disabled = true;
    googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Conectando...';

    try {
        await googleAuth.login();
        
        // Marcar como logado
        googleLoggedIn = true;
        googleLoginStatus.classList.remove('hidden');
        googleLoginBtn.classList.add('hidden');
        // checkLoginStatus() será chamado no event listener
        
        console.log('✅ Google conectado com sucesso!');
    } catch (error) {
        console.error('Erro no login Google:', error);
        loginError.textContent = `Erro no login Google: ${error.message}`;
        loginError.style.display = 'block';
    } finally {
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = '<i class="fab fa-google mr-2"></i>Continuar com Google';
    }
}

// Função para carregar contas de anúncio
async function loadAdAccounts() {
    const unitSelect = document.getElementById('unitId');
    unitSelect.innerHTML = '<option value="">Carregando unidades...</option>';
    unitSelect.disabled = true;

    try {
        const adAccounts = fbAuth.getAdAccounts();
        if (!adAccounts || Object.keys(adAccounts).length === 0) {
            throw new Error('Nenhuma conta de anúncio encontrada');
        }

        const sortedAccounts = Object.entries(adAccounts)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

        unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
        sortedAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            unitSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar contas:', error);
        unitSelect.innerHTML = '<option value="">Erro ao carregar unidades</option>';
    } finally {
        unitSelect.disabled = false;
    }
}

// Função para carregar campanhas (com paginação)
async function loadCampaigns(unitId, startDate, endDate) {
    try {
        campaignsMap[unitId] = {};
        let allCampaigns = [];
        let url = `/${unitId}/campaigns?fields=id,name&access_token=${currentAccessToken}`;

        // Paginação para buscar todas as campanhas
        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allCampaigns = allCampaigns.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                throw new Error(response.error?.message || 'Erro ao carregar campanhas');
            }
        }

        const campaignIds = allCampaigns.map(camp => camp.id);
        const insights = await Promise.all(
            campaignIds.map(id => getCampaignInsights(id, startDate, endDate))
        );

        campaignIds.forEach((id, index) => {
            const campaign = allCampaigns.find(c => c.id === id);
            const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
            campaignsMap[unitId][id] = {
                name: campaign.name.toLowerCase(),
                insights: { 
                    spend,
                    reach: insights[index].reach || 0,
                    actions: insights[index].actions || []
                }
            };
        });

        renderCampaignOptions();
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

// Função para carregar conjuntos de anúncios (com paginação)
async function loadAdSets(unitId, startDate, endDate) {
    try {
        adSetsMap[unitId] = {};
        let allAdSets = [];
        let url = `/${unitId}/adsets?fields=id,name&access_token=${currentAccessToken}`;

        // Paginação para buscar todos os ad sets
        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allAdSets = allAdSets.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                throw new Error(response.error?.message || 'Erro ao carregar ad sets');
            }
        }

        const adSetIds = allAdSets.map(set => set.id);
        const insights = await Promise.all(
            adSetIds.map(id => getAdSetInsights(id, startDate, endDate))
        );

        adSetIds.forEach((id, index) => {
            const adSet = allAdSets.find(s => s.id === id);
            const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
            adSetsMap[unitId][id] = {
                name: adSet.name.toLowerCase(),
                insights: {
                    spend,
                    reach: insights[index].reach || 0,
                    actions: insights[index].actions || []
                }
            };
        });

        renderAdSetOptions();
    } catch (error) {
        console.error('Erro ao carregar conjuntos:', error);
    }
}

// Funções para obter insights
async function getCampaignInsights(campaignId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${campaignId}/insights`,
            {
                fields: ['spend', 'actions', 'reach'],
                time_range: { since: startDate, until: endDate },
                level: 'campaign',
                access_token: currentAccessToken
            },
            (response) => {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    resolve({});
                }
            }
        );
    });
}

async function getAdSetInsights(adSetId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${adSetId}/insights`,
            {
                fields: ['spend', 'actions', 'reach'],
                time_range: { since: startDate, until: endDate },
                access_token: currentAccessToken
            },
            (response) => {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

// Função para renderizar opções de filtro
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

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        // Aplicar estilo usando classes
        setSelectedStyles(option, selectedCampaigns.has(campaign.id));

        option.addEventListener('click', () => {
            if (selectedCampaigns.has(campaign.id)) {
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

        container.appendChild(option);
    });
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
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        // Aplicar estilo usando classes
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

// Função para atualizar botões de filtro
function updateFilterButtons() {
    filterCampaignsBtn.disabled = isFilterActivated && selectedAdSets.size > 0;
    filterAdSetsBtn.disabled = isFilterActivated && selectedCampaigns.size > 0;
    
    filterCampaignsBtn.classList.toggle('opacity-50', filterCampaignsBtn.disabled);
    filterAdSetsBtn.classList.toggle('opacity-50', filterAdSetsBtn.disabled);
}

// Função para alternar modais
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
        }
    } else {
        modal.classList.add('hidden');
    }
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

// Função para gerar o relatório simplificado
async function generateReport() {
    const unitId = document.getElementById('unitId').value;
    const unitName = fbAuth.getAdAccounts()[unitId] || 'Unidade Desconhecida';
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!unitId || !startDate || !endDate) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }

    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    if (selectedCampaigns.size > 0) {
        for (const campaignId of selectedCampaigns) {
            const insights = await getCampaignInsights(campaignId, startDate, endDate);
            if (insights.spend) totalSpend += parseFloat(insights.spend);
            if (insights.reach) totalReach += parseInt(insights.reach);
            if (insights.actions) {
                insights.actions.forEach(action => {
                    if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                        totalConversations += parseInt(action.value);
                    }
                });
            }
        }
    } else if (selectedAdSets.size > 0) {
        for (const adSetId of selectedAdSets) {
            const insights = await getAdSetInsights(adSetId, startDate, endDate);
            if (insights.spend) totalSpend += parseFloat(insights.spend);
            if (insights.reach) totalReach += parseInt(insights.reach);
            if (insights.actions) {
                insights.actions.forEach(action => {
                    if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                        totalConversations += parseInt(action.value);
                    }
                });
            }
        }
    } else {
        const response = await new Promise((resolve) => {
            FB.api(
                `/${unitId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    level: 'account',
                    access_token: currentAccessToken
                },
                resolve
            );
        });

        if (response && !response.error && response.data.length > 0) {
            response.data.forEach(data => {
                if (data.spend) totalSpend += parseFloat(data.spend);
                if (data.reach) totalReach += parseInt(data.reach);
                if (data.actions) {
                    data.actions.forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            totalConversations += parseInt(action.value);
                        }
                    });
                }
            });
        }
    }

    const costPerConversation = totalConversations > 0 ? (totalSpend / totalConversations) : 0;
    const formattedStartDate = formatDateISOToBR(startDate);
    const formattedEndDate = formatDateISOToBR(endDate);

    reportContainer.innerHTML = `
        <div class="report-container">
            <div class="report-header">
                <h2>Relatório Simplificado - ${unitName}</h2>
                <p>${formattedStartDate} a ${formattedEndDate}</p>
            </div>
            <div class="metrics-grid">
                <div class="metric-card reach">
                    <div class="metric-label">Alcance Total</div>
                    <div class="metric-value">${totalReach.toLocaleString('pt-BR')}</div>
                </div>
                <div class="metric-card messages">
                    <div class="metric-label">Mensagens</div>
                    <div class="metric-value">${totalConversations.toLocaleString('pt-BR')}</div>
                </div>
                <div class="metric-card cost">
                    <div class="metric-label">Custo por Mensagem</div>
                    <div class="metric-value">${formatCurrencyBRL(costPerConversation)}</div>
                </div>
                <div class="metric-card investment">
                    <div class="metric-label">Investimento Total</div>
                    <div class="metric-value">${formatCurrencyBRL(totalSpend)}</div>
                </div>
            </div>
        </div>
    `;

    shareWhatsAppBtn.style.display = 'block';
}

// Form submission for report generation
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isLoggedIn = await validateFacebookLogin();
    if (isLoggedIn) {
        await generateReport();
    }
});

// Event listeners for filters
if (filterCampaignsBtn) {
    filterCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', true));
}
if (filterAdSetsBtn) {
    filterAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', true));
}
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

// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const reportText = reportContainer.innerText;
    const encodedText = encodeWhatsAppText(reportText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
});

// Toggle de visualização de senha
if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        const passwordInput = document.getElementById('password');
        const icon = togglePassword.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });
}

// Função para mostrar loading no botão
function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    if (isLoading) {
        button.disabled = true;
        button.classList.add('opacity-75', 'cursor-not-allowed');
        if (btnText) {
            btnText.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Conectando...';
        }
    } else {
        button.disabled = false;
        button.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Função para verificar e mostrar botão "Continuar"
function checkLoginStatus() {
    if (fbLoggedIn || googleLoggedIn) {
        if (continueToReportBtnContainer) {
            continueToReportBtnContainer.classList.remove('hidden');
        }
    } else {
        if (continueToReportBtnContainer) {
            continueToReportBtnContainer.classList.add('hidden');
        }
    }
}

loginBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    setButtonLoading(loginBtn, true);
    try {
        await handleFacebookLogin();
        checkLoginStatus();
    } finally {
        const btnText = loginBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.innerHTML = '<i class="fab fa-facebook-f mr-2"></i>Conectar Facebook';
        }
        setButtonLoading(loginBtn, false);
    }
});

googleLoginBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    setButtonLoading(googleLoginBtn, true);
    try {
        await handleGoogleLogin();
        checkLoginStatus();
    } finally {
        const btnText = googleLoginBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.innerHTML = '<i class="fab fa-google mr-2"></i>Conectar Google';
        }
        setButtonLoading(googleLoginBtn, false);
    }
});

continueToReportBtn.addEventListener('click', () => {
    showScreen(reportSelectionScreen);
});

// Listener do botão Voltar é configurado em showScreen(mainContent)

// Verificar autenticação e decidir a tela inicial
const appLoggedIn = localStorage.getItem('appLoggedIn') === 'true';

console.log('Checando estado inicial...');
console.log('appLoggedIn:', appLoggedIn);

// Verificar se já está logado nas plataformas
const storedFbToken = localStorage.getItem('fbAccessToken');
const storedGoogleToken = localStorage.getItem('google_ads_access_token');

if (appLoggedIn) {
    if (storedFbToken || storedGoogleToken) {
        // Já logado no app E em alguma plataforma → vai para seleção de relatórios
        console.log('✅ Já logado no app e nas plataformas');
        
        // Restaurar estado de login
        if (storedFbToken) {
            currentAccessToken = storedFbToken;
            fbLoggedIn = true;
        }
        if (storedGoogleToken) {
            googleLoggedIn = true;
        }
        
    showScreen(reportSelectionScreen);
    } else {
        // Logado no app mas não nas plataformas → vai para login de plataformas
        console.log('⚠️ Logado no app, mas não nas plataformas');
            showScreen(loginScreen);
        }
} else {
    // Não logado no app → vai para login do app
    console.log('⚠️ Não logado no app');
    showScreen(appLoginScreen);
}