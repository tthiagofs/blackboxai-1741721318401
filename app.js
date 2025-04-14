import { appAuth, fbAuth } from './auth.js';

const appLoginScreen = document.getElementById('appLoginScreen');
const reportSelectionScreen = document.getElementById('reportSelectionScreen');
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const appLoginForm = document.getElementById('appLoginForm');
const appLoginError = document.getElementById('appLoginError');
const simpleReportBtn = document.getElementById('simpleReportBtn');
const completeReportBtn = document.getElementById('completeReportBtn');
const loginBtn = document.getElementById('loginBtn');
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
    appLoginScreen.style.display = 'none';
    reportSelectionScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    mainContent.style.display = 'none';
    screen.style.display = 'block';

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
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (username === '' || password === '') {
        appLoginError.textContent = 'Por favor, preencha todos os campos.';
        appLoginError.style.display = 'block';
        return;
    }

    if (appAuth.validateAppLogin(username, password)) {
        appLoginError.style.display = 'none';
        localStorage.setItem('appLoggedIn', 'true');  // Armazena que o login foi bem-sucedido
        showScreen(reportSelectionScreen);
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        appLoginError.textContent = 'Usuário ou senha inválidos.';
        appLoginError.style.display = 'block';
        usernameInput.value = '';
        passwordInput.value = '';
    }
});

// Seleção de relatório simplificado
simpleReportBtn.addEventListener('click', async () => {
    simpleReportBtn.classList.add('active');
    const isLoggedIn = await validateFacebookLogin();
    if (isLoggedIn) {
        showScreen(mainContent);
        await loadAdAccounts();
    }
});

// Seleção de relatório completo
completeReportBtn.addEventListener('click', async () => {
    const isLoggedIn = await validateFacebookLogin();
    if (isLoggedIn) {
        window.location.href = 'RelatorioCompleto.html';
    }
});

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

            if (simpleReportBtn.classList.contains('active')) {
                showScreen(mainContent);
                await loadAdAccounts();
            } else {
                window.location.href = 'RelatorioCompleto.html';
            }
        } else {
            throw new Error('Login não autorizado');
        }
    } catch (error) {
        console.error('Erro detalhado:', error);
        loginError.textContent = `Erro no login: ${error.message}`;
        loginError.style.display = 'block';
        
        // Limpar tokens em caso de erro
        localStorage.removeItem('fbAccessToken');
        localStorage.removeItem('adAccountsMap');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fab fa-facebook-f mr-2"></i>Continuar com Facebook';
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

        // Aplicar estilo inicial diretamente
        if (selectedCampaigns.has(campaign.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedCampaigns.has(campaign.id)) {
                selectedCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedCampaigns.add(campaign.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
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

        // Aplicar estilo inicial diretamente
        if (selectedAdSets.has(adSet.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedAdSets.has(adSet.id)) {
                selectedAdSets.delete(adSet.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedAdSets.add(adSet.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
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

// Carregar dados ao preencher o formulário
form.addEventListener('input', async function(e) {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        await Promise.all([
            loadCampaigns(unitId, startDate, endDate),
            loadAdSets(unitId, startDate, endDate)
        ]);
    }
});

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

    const costPerConversation = totalConversations > 0 ? (totalSpend / totalConversations).toFixed(2) : '0';
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');

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
                    <div class="metric-value">R$ ${costPerConversation.replace('.', ',')}</div>
                </div>
                <div class="metric-card investment">
                    <div class="metric-label">Investimento Total</div>
                    <div class="metric-value">R$ ${totalSpend.toFixed(2).replace('.', ',')}</div>
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
    const encodedText = encodeURIComponent(reportText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
});

loginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    handleFacebookLogin();
});

// Voltar para a seleção de relatório
backToReportSelectionBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Botão Voltar clicado - Redirecionando para seleção de relatório');
    window.location.href = 'index.html?screen=reportSelection';
});

// Verificar autenticação e decidir a tela inicial
const storedToken = localStorage.getItem('fbAccessToken');
const appLoggedIn = localStorage.getItem('appLoggedIn') === 'true';
const urlParams = new URLSearchParams(window.location.search);
const targetScreen = urlParams.get('screen');
const appLoggedInParam = urlParams.get('appLoggedIn') === 'true';

console.log('Checando estado inicial...');
console.log('appLoggedIn (do localStorage):', appLoggedIn);
console.log('appLoggedInParam (da URL):', appLoggedInParam);
console.log('storedToken (tem token do Facebook?):', storedToken ? 'Sim' : 'Não');
console.log('targetScreen (tela pedida):', targetScreen);

if (targetScreen === 'reportSelection' && (appLoggedIn || appLoggedInParam)) {
    console.log('Indo direto para a tela de seleção de relatórios!');
    showScreen(reportSelectionScreen);
} else if (storedToken) {
    console.log('Tem token do Facebook, verificando login...');
    currentAccessToken = storedToken;
    validateFacebookLogin().then(isLoggedIn => {
        console.log('Resultado da validação do Facebook:', isLoggedIn);
        if (isLoggedIn && (appLoggedIn || appLoggedInParam)) {
            console.log('Facebook OK e logado no app, indo para seleção de relatórios');
            showScreen(reportSelectionScreen);
        } else if (isLoggedIn) {
            console.log('Apenas Facebook logado, indo para tela de login do Facebook');
            showScreen(loginScreen);
        } else {
            console.log('Facebook não validado, indo para tela de login do app');
            showScreen(appLoginScreen);
        }
    });
} else {
    console.log('Sem token do Facebook, indo para tela de login do app');
    showScreen(appLoginScreen);
}