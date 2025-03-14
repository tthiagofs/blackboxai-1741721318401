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
const campaignsModal = document.getElementById('campaignsModal');
const adSetsModal = document.getElementById('adSetsModal');
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
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
let campaignSearchText = '';
let adSetSearchText = '';
let currentAccessToken = localStorage.getItem('fbAccessToken') || null;

// Função para alternar telas
function showScreen(screen) {
    appLoginScreen.style.display = 'none';
    reportSelectionScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    mainContent.style.display = 'none';
    screen.style.display = 'block';
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
simpleReportBtn.addEventListener('click', () => {
    showScreen(mainContent);
    simpleReportBtn.classList.add('active');
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

// Função para carregar campanhas
async function loadCampaigns(unitId, startDate, endDate) {
    try {
        const response = await new Promise((resolve) => {
            FB.api(
                `/${unitId}/campaigns`,
                { fields: 'id,name', access_token: currentAccessToken },
                resolve
            );
        });

        if (response && !response.error) {
            campaignsMap[unitId] = {};
            const campaignIds = response.data.map(camp => camp.id);
            const insights = await Promise.all(
                campaignIds.map(id => getCampaignInsights(id, startDate, endDate))
            );

            campaignIds.forEach((id, index) => {
                const campaign = response.data.find(c => c.id === id);
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
        }
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

// Função para carregar conjuntos de anúncios
async function loadAdSets(unitId, startDate, endDate) {
    try {
        const response = await new Promise((resolve) => {
            FB.api(
                `/${unitId}/adsets`,
                { fields: 'id,name', access_token: currentAccessToken },
                resolve
            );
        });

        if (response && !response.error) {
            adSetsMap[unitId] = {};
            const adSetIds = response.data.map(set => set.id);
            const insights = await Promise.all(
                adSetIds.map(id => getAdSetInsights(id, startDate, endDate))
            );

            adSetIds.forEach((id, index) => {
                const adSet = response.data.find(s => s.id === id);
                const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
                if (spend > 0) {
                    adSetsMap[unitId][id] = {
                        name: adSet.name.toLowerCase(),
                        insights: {
                            spend,
                            reach: insights[index].reach || 0,
                            actions: insights[index].actions || []
                        }
                    };
                }
            });

            renderAdSetOptions();
        }
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
        .filter(campaign => {
            if (!campaignSearchText) return true;
            return campaign.name.toLowerCase().includes(campaignSearchText.toLowerCase());
        })
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = campaigns.map(campaign => `
        <div class="filter-option ${selectedCampaigns.has(campaign.id) ? 'selected' : ''}"
             data-id="${campaign.id}">
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', () => {
            const id = option.dataset.id;
            if (selectedCampaigns.has(id)) {
                selectedCampaigns.delete(id);
                option.classList.remove('selected');
            } else {
                selectedCampaigns.add(id);
                option.classList.add('selected');
            }
            updateFilterButtons();
        });
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
        .filter(adSet => {
            if (!adSetSearchText) return true;
            return adSet.name.toLowerCase().includes(adSetSearchText.toLowerCase());
        })
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = adSets.map(adSet => `
        <div class="filter-option ${selectedAdSets.has(adSet.id) ? 'selected' : ''}"
             data-id="${adSet.id}">
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', () => {
            const id = option.dataset.id;
            if (selectedAdSets.has(id)) {
                selectedAdSets.delete(id);
                option.classList.remove('selected');
            } else {
                selectedAdSets.add(id);
                option.classList.add('selected');
            }
            updateFilterButtons();
        });
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
function toggleModal(modal, show, isCampaign) {
    modal.style.display = show ? 'flex' : 'none';
    
    if (show) {
        if (isCampaign) {
            isCampaignFilterActive = true;
            isAdSetFilterActive = false;
            filterAdSetsBtn.disabled = isFilterActivated;
        } else {
            isAdSetFilterActive = true;
            isCampaignFilterActive = false;
            filterCampaignsBtn.disabled = isFilterActivated;
        }
    } else {
        if (isCampaign) {
            isCampaignFilterActive = false;
            campaignSearchText = '';
            document.getElementById('campaignSearch').value = '';
        } else {
            isAdSetFilterActive = false;
            adSetSearchText = '';
            document.getElementById('adSetSearch').value = '';
        }
    }
    updateFilterButtons();
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
filterCampaignsBtn.addEventListener('click', () => toggleModal(campaignsModal, true, true));
filterAdSetsBtn.addEventListener('click', () => toggleModal(adSetsModal, true, false));
closeCampaignsModalBtn.addEventListener('click', () => toggleModal(campaignsModal, false, true));
closeAdSetsModalBtn.addEventListener('click', () => toggleModal(adSetsModal, false, false));

document.getElementById('campaignSearch').addEventListener('input', (e) => {
    campaignSearchText = e.target.value;
    renderCampaignOptions();
});

document.getElementById('adSetSearch').addEventListener('input', (e) => {
    adSetSearchText = e.target.value;
    renderAdSetOptions();
});

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
backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?screen=reportSelection';
});

// Verificar autenticação e decidir a tela inicial
const storedToken = localStorage.getItem('fbAccessToken');
const targetScreen = new URLSearchParams(window.location.search).get('screen');

if (storedToken && targetScreen === 'reportSelection') {
    currentAccessToken = storedToken;
    showScreen(reportSelectionScreen);
} else {
    showScreen(appLoginScreen);
}
