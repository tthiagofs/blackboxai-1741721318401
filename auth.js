import { connectionService } from './services/connectionService.js';

// Classe para autenticação do aplicativo
class AppAuth {
    constructor() {
        this.username = '@admin';
        this.password = '134679';
    }

    validateAppLogin(username, password) {
        return username === this.username && password === this.password;
    }
}

// Classe para autenticação do Facebook
class FacebookAuth {
    constructor() {
        this.accessToken = localStorage.getItem('fbAccessToken');
        this.tokenExpiry = localStorage.getItem('fbTokenExpiry'); // Data de expiração do token
        this.adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
        this.initializeFacebookSDK().catch(error => {
            console.error('Erro ao inicializar o Facebook SDK no construtor:', error);
            // Não interrompe a execução do app, apenas loga o erro
        });
        
        // ⭐ Verificar se token está válido ao inicializar
        this.checkTokenValidity();
    }
    
    // Verificar se token está válido e renovar se necessário
    async checkTokenValidity() {
        if (!this.accessToken) return false;
        
        // Se temos data de expiração salva, verificar
        if (this.tokenExpiry) {
            const expiryDate = new Date(this.tokenExpiry);
            const now = new Date();
            const daysUntilExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24);
            
            // Se expira em menos de 7 dias, tentar renovar proativamente
            if (daysUntilExpiry < 7) {
                console.log('🔄 Token Meta expira em menos de 7 dias, verificando status...');
                await this.verifyAndRefreshToken();
            }
        } else {
            // Se não temos data de expiração, verificar se token ainda é válido
            await this.verifyAndRefreshToken();
        }
        
        return !!this.accessToken;
    }
    
    // Verificar token via API e renovar se necessário
    async verifyAndRefreshToken() {
        try {
            // 1. Se não tiver token em memória/localStorage, tentar restaurar do Firestore
            if (!this.accessToken) {
                try {
                    await connectionService.initialize();
                    if (connectionService.connections?.meta?.accessToken) {
                        this.accessToken = connectionService.connections.meta.accessToken;
                        localStorage.setItem('fbAccessToken', this.accessToken);
                        console.log('✅ Token Meta restaurado do Firestore');
                    }
                } catch (e) {
                    console.warn('Erro ao restaurar token Meta do Firestore:', e);
                }
            }

            if (!this.accessToken) return false;

            // 2. Testar validade real do token com uma chamada direta à Graph API
            try {
                const testRes = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${this.accessToken}`);
                const testData = await testRes.json();
                
                if (testData.id) {
                    // Token está 100% ativo e funcional no Graph API!
                    return true;
                } else if (testData.error?.code === 190) {
                    console.warn('⚠️ Token Meta expirou (code 190).');
                    // Tentar se o Firestore tem um token mais recente
                    try {
                        await connectionService.initialize();
                        const firestoreToken = connectionService.connections?.meta?.accessToken;
                        if (firestoreToken && firestoreToken !== this.accessToken) {
                            this.accessToken = firestoreToken;
                            localStorage.setItem('fbAccessToken', this.accessToken);
                            return true;
                        }
                    } catch (e) {}

                    this.accessToken = null;
                    localStorage.removeItem('fbAccessToken');
                    localStorage.removeItem('fbTokenExpiry');
                    return false;
                }
            } catch (netErr) {
                // Falha de rede ou timeout: manter o token existente
                console.warn('⚠️ Não foi possível verificar token Meta via rede. Mantendo token existente.');
                return !!this.accessToken;
            }

            return true;
        } catch (error) {
            console.warn('⚠️ Erro ao verificar token Meta:', error);
            return !!this.accessToken;
        }
    }

    initializeFacebookSDK() {
        return new Promise((resolve, reject) => {
            try {
                const initFB = () => {
                    FB.init({
                        appId: '1595817924411708', // Novo App ID
                        cookie: true,
                        xfbml: true,
                        version: 'v22.0' // Nova versão da API
                    });
                    
                    // Check login status first
                    FB.getLoginStatus((response) => {
                        if (response.status === 'connected') {
                            this.accessToken = response.authResponse.accessToken;
                            localStorage.setItem('fbAccessToken', this.accessToken);
                            console.log("Facebook SDK inicializado e usuário já conectado!");
                        } else {
                            console.log("Facebook SDK inicializado com sucesso!");
                        }
                        resolve();
                    });
                };

                // Check if FB SDK is loaded
                if (window.FB) {
                    initFB();
                } else {
                    // If not loaded, set up async init and wait
                    window.fbAsyncInit = initFB;
                    
                    // Create script element if not exists
                    if (!document.getElementById('facebook-jssdk')) {
                        const js = document.createElement('script');
                        js.id = 'facebook-jssdk';
                        js.src = "https://connect.facebook.net/en_US/sdk.js";
                        js.crossOrigin = "anonymous";
                        js.async = true;
                        js.defer = true;
                        document.head.appendChild(js);
                    }
                    
                    // Wait for SDK to load
                    const checkFB = setInterval(() => {
                        if (window.FB) {
                            clearInterval(checkFB);
                            initFB();
                        }
                    }, 100);

                    // Timeout after 10 seconds
                    setTimeout(() => {
                        clearInterval(checkFB);
                        reject(new Error('Timeout ao carregar Facebook SDK'));
                    }, 10000);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async login() {
        try {
            await this.initializeFacebookSDK();
            
            // First check if we already have a valid session
            const statusResponse = await new Promise((resolve) => {
                FB.getLoginStatus((response) => resolve(response));
            });

            let response;
            if (statusResponse.status === 'connected') {
                response = statusResponse;
            } else {
                // If no valid session, proceed with login
                response = await new Promise((resolve, reject) => {
                    FB.login((loginResponse) => {
                        if (loginResponse.authResponse) {
                            resolve(loginResponse);
                        } else {
                            console.error('Login negado ou cancelado pelo usuário');
                            reject(new Error('Login do Facebook não autorizado'));
                        }
                    }, {
                        scope: 'public_profile,ads_read,ads_management,business_management,instagram_basic,pages_read_engagement', // Incluídas permissões para posts orgânicos
                        return_scopes: true,
                        auth_type: 'rerequest'  // Force re-authentication
                    });
                });
            }

            // Set access token and load accounts after successful login/status check
            this.accessToken = response.authResponse.accessToken;
            
            // ⭐ Tentar trocar por Long-Lived Token (60 dias) via backend
            try {
                console.log('🔄 Obtendo Long-Lived Token oficial (60 dias)...');
                const exchRes = await fetch('/api/exchange-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: 'meta',
                        shortLivedToken: this.accessToken
                    })
                });
                const exchData = await exchRes.json();
                if (exchRes.ok && exchData.accessToken) {
                    this.accessToken = exchData.accessToken;
                    const days = Math.round((exchData.expiresIn || 5184000) / 86400);
                    console.log(`✅ Long-Lived Token Meta obtido! Válido por ~${days} dias`);
                    const expiryDate = new Date(Date.now() + ((exchData.expiresIn || 5184000) * 1000));
                    this.tokenExpiry = expiryDate.toISOString();
                }
            } catch (err) {
                console.warn('⚠️ Não foi possível trocar por Long-Lived Token via backend:', err);
                const expiryDate = new Date(Date.now() + (5184000 * 1000));
                this.tokenExpiry = expiryDate.toISOString();
            }
            
            localStorage.setItem('fbAccessToken', this.accessToken);
            localStorage.setItem('fbTokenExpiry', this.tokenExpiry);
            await this.loadAllAdAccounts();
            
            // Salvar no Firebase
            try {
                await connectionService.initialize();
                console.log('💾 Salvando token no Firebase (primeiros 20 chars):', this.accessToken?.substring(0, 20) + '...');
                await connectionService.saveMetaConnection(this.accessToken, this.adAccountsMap);
                console.log('✅ Conexão Meta salva no Firebase');
            } catch (error) {
                console.warn('⚠️ Erro ao salvar conexão no Firebase:', error);
                // Não interrompe o fluxo, apenas loga
            }
            
            return response;
        } catch (error) {
            console.error('Erro durante o processo de login:', error);
            throw new Error(`Falha no login do Facebook: ${error.message}`);
        }
    }

    async loadAllAdAccounts() {
        try {
            // Limpar o mapa de contas antes de recarregar
            this.adAccountsMap = {};

            // Carregar contas pessoais
            const personalAccounts = await this.loadPersonalAdAccounts();
            console.log('Contas pessoais carregadas:', personalAccounts.length);

            // Carregar gerenciadores de negócios
            const businesses = await this.getBusinesses();
            console.log('Gerenciadores de negócios encontrados:', businesses.length);

            // Para cada gerenciador de negócios, carregar contas próprias e de clientes
            for (const business of businesses) {
                console.log(`Carregando contas do gerenciador de negócios: ${business.name} (${business.id})`);
                const [ownedAccounts, clientAccounts] = await Promise.all([
                    this.loadOwnedAccounts(business.id),
                    this.loadClientAccounts(business.id)
                ]);
                console.log(`Contas próprias (${business.name}):`, ownedAccounts.length);
                console.log(`Contas de clientes (${business.name}):`, clientAccounts.length);
            }

            // Verificar se alguma conta foi carregada
            const totalAccounts = Object.keys(this.adAccountsMap).length;
            if (totalAccounts === 0) {
                console.warn('Nenhuma conta de anúncio foi carregada. Verifique as permissões e o status das contas.');
            } else {
                console.log(`Total de contas carregadas: ${totalAccounts}`);
            }

            localStorage.setItem('adAccountsMap', JSON.stringify(this.adAccountsMap));
            return this.adAccountsMap;
        } catch (error) {
            console.error('Erro ao carregar contas:', error);
            throw new Error(`Falha ao carregar contas: ${error.message}`);
        }
    }

    async loadPersonalAdAccounts() {
        try {
            let allAccounts = [];
            let url = `/me/adaccounts?fields=id,name,account_status&access_token=${this.accessToken}`;

            while (url) {
                const response = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });

                if (response && !response.error) {
                    allAccounts = allAccounts.concat(response.data || []);
                    url = response.paging && response.paging.next ? response.paging.next : null;
                } else {
                    throw new Error(response?.error?.message || 'Erro ao carregar contas pessoais');
                }
            }

            allAccounts.forEach(account => {
                if (account.account_status === 1) {
                    this.adAccountsMap[account.id] = account.name;
                }
            });

            return allAccounts;
        } catch (error) {
            console.error('Erro ao carregar contas pessoais:', error);
            throw new Error(`Falha ao carregar contas pessoais: ${error.message}`);
        }
    }

    async getBusinesses() {
        try {
            let allBusinesses = [];
            let url = `/me/businesses?fields=id,name&access_token=${this.accessToken}`;

            while (url) {
                const response = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });

                if (response && !response.error) {
                    allBusinesses = allBusinesses.concat(response.data || []);
                    url = response.paging && response.paging.next ? response.paging.next : null;
                } else {
                    throw new Error(response?.error?.message || 'Erro ao carregar Business Managers');
                }
            }

            return allBusinesses;
        } catch (error) {
            console.error('Erro ao carregar gerenciadores de negócios:', error);
            throw new Error(`Falha ao carregar gerenciadores de negócios: ${error.message}`);
        }
    }

    async loadOwnedAccounts(businessId) {
        try {
            let allAccounts = [];
            let url = `/${businessId}/owned_ad_accounts?fields=id,name,account_status&access_token=${this.accessToken}`;

            while (url) {
                const response = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });

                if (response && !response.error) {
                    allAccounts = allAccounts.concat(response.data || []);
                    url = response.paging && response.paging.next ? response.paging.next : null;
                } else {
                    throw new Error(response?.error?.message || `Erro ao carregar contas próprias do gerenciador ${businessId}`);
                }
            }

            allAccounts.forEach(account => {
                if (account.account_status === 1) {
                    this.adAccountsMap[account.id] = account.name;
                }
            });

            return allAccounts;
        } catch (error) {
            console.error(`Erro ao carregar contas próprias do gerenciador ${businessId}:`, error);
            throw new Error(`Falha ao carregar contas próprias: ${error.message}`);
        }
    }

    async loadClientAccounts(businessId) {
        try {
            let allAccounts = [];
            let url = `/${businessId}/client_ad_accounts?fields=id,name,account_status&access_token=${this.accessToken}`;

            while (url) {
                const response = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });

                if (response && !response.error) {
                    allAccounts = allAccounts.concat(response.data || []);
                    url = response.paging && response.paging.next ? response.paging.next : null;
                } else {
                    throw new Error(response?.error?.message || `Erro ao carregar contas de clientes do gerenciador ${businessId}`);
                }
            }

            allAccounts.forEach(account => {
                if (account.account_status === 1) {
                    this.adAccountsMap[account.id] = account.name;
                }
            });

            return allAccounts;
        } catch (error) {
            console.error(`Erro ao carregar contas de clientes do gerenciador ${businessId}:`, error);
            throw new Error(`Falha ao carregar contas de clientes: ${error.message}`);
        }
    }

    getAccessToken() {
        return this.accessToken;
    }
    
    // Converter short-lived token para long-lived token (60 dias)
    // ⚠️ IMPORTANTE: Esta função expõe o App Secret no frontend (não é ideal)
    // Para produção, essa conversão deve ser feita no backend
    async exchangeToLongLivedToken(shortLivedToken) {
        try {
            const appId = '1595817924411708';
            // ⚠️ App Secret não deve estar no frontend - idealmente fazer via backend
            // Por enquanto, vamos tentar usar o FB.getLoginStatus que já retorna long-lived tokens
            // quando a sessão está ativa
            console.log('ℹ️ Tentando obter long-lived token via FB.getLoginStatus...');
            
            // Verificar se já temos um token long-lived através do status
            const statusResponse = await new Promise((resolve) => {
                FB.getLoginStatus((response) => resolve(response));
            });
            
            if (statusResponse.status === 'connected' && statusResponse.authResponse.accessToken) {
                // Se o status já está conectado, o token pode já ser long-lived
                // O Facebook SDK automaticamente gerencia isso quando há sessão ativa
                return statusResponse.authResponse.accessToken;
            }
            
            // Se não conseguir via getLoginStatus, tentar conversão direta
            // (mas isso requer App Secret, que não deve estar no frontend)
            console.warn('⚠️ Conversão direta de token requer App Secret (não disponível no frontend)');
            return null;
        } catch (error) {
            console.error('❌ Erro ao converter token para long-lived:', error);
            return null;
        }
    }

    getAdAccounts() {
        return this.adAccountsMap;
    }

    async logout() {
        return new Promise((resolve) => {
            FB.logout(async () => {
                localStorage.removeItem('fbAccessToken');
                localStorage.removeItem('fbTokenExpiry');
                localStorage.removeItem('adAccountsMap');
                this.accessToken = null;
                this.tokenExpiry = null;
                this.adAccountsMap = {};
                
                // Remover do Firebase
                try {
                    await connectionService.initialize();
                    await connectionService.disconnectMeta();
                    console.log('✅ Conexão Meta removida do Firebase');
                } catch (error) {
                    console.warn('⚠️ Erro ao remover conexão do Firebase:', error);
                }
                
                resolve();
            });
        });
    }
    
    // Verificar se está autenticado (com token válido)
    isAuthenticated() {
        if (!this.accessToken) return false;
        
        // Se temos data de expiração, verificar
        if (this.tokenExpiry) {
            const expiryDate = new Date(this.tokenExpiry);
            const now = new Date();
            return now < expiryDate;
        }
        
        // Se não temos data de expiração, assumir válido (será verificado quando usar)
        return true;
    }
}

// Criar e exportar instâncias únicas
const appAuth = new AppAuth();
const fbAuth = new FacebookAuth();

export { appAuth, fbAuth };