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
let currentAccessToken = null;

// Função para alternar telas
function showScreen(screen) {
    appLoginScreen.style.display = 'none';
    reportSelectionScreen.style.display = 'none';
    loginScreen.style.display = 'none';
    mainContent.style.display = 'none';
    screen.style.display = 'block';
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
    if (currentAccessToken) {
        showScreen(mainContent);
    } else {
        showScreen(loginScreen);
    }
    simpleReportBtn.classList.add('active');
});

// Seleção de relatório completo
completeReportBtn.addEventListener('click', () => {
    if (!currentAccessToken) {
        showScreen(loginScreen);
        handleFacebookLogin();
    } else {
        window.location.href = 'RelatorioCompleto.html';
    }
});

// Login com Facebook
async function handleFacebookLogin() {
    const loginError = document.getElementById('loginError');
    loginError.style.display = 'none';

    try {
        const response = await fbAuth.login();
        if (response && response.authResponse) {
            currentAccessToken = response.authResponse.accessToken;
            
            if (simpleReportBtn.classList.contains('active')) {
                showScreen(mainContent);
                
                // Preencher select de unidades
                const unitSelect = document.getElementById('unitId');
                const adAccounts = fbAuth.getAdAccounts();
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
            } else {
                window.location.href = 'RelatorioCompleto.html';
            }
        } else {
            throw new Error('Login não autorizado');
        }
    } catch (error) {
        loginError.textContent = `Erro no login: ${error.message}`;
        loginError.style.display = 'block';
    }
}

loginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    handleFacebookLogin();
});

// Voltar para a seleção de relatório
backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?screen=reportSelection';
});

// Resto do código permanece o mesmo...
// (Funções de filtro, carregamento de campanhas, ad sets, etc.)

// Verificar autenticação e decidir a tela inicial
const storedToken = localStorage.getItem('fbAccessToken');
const targetScreen = new URLSearchParams(window.location.search).get('screen');

if (storedToken && targetScreen === 'reportSelection') {
    currentAccessToken = storedToken;
    showScreen(reportSelectionScreen);
} else {
    showScreen(appLoginScreen);
}
