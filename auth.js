// Classe para autenticação do Facebook
class FacebookAuth {
    constructor() {
        this.accessToken = localStorage.getItem('fbAccessToken');
        this.adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
        this.initializeFacebookSDK();
    }

    initializeFacebookSDK() {
        return new Promise((resolve, reject) => {
            try {
                const initFB = () => {
                    FB.init({
                        appId: '1595817924411708',
                        cookie: true,
                        xfbml: true,
                        version: 'v22.0'
                    });
                    
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

                if (window.FB) {
                    initFB();
                } else {
                    window.fbAsyncInit = initFB;
                    
                    if (!document.getElementById('facebook-jssdk')) {
                        const js = document.createElement('script');
                        js.id = 'facebook-jssdk';
                        js.src = "https://connect.facebook.net/en_US/sdk.js";
                        js.crossOrigin = "anonymous";
                        js.async = true;
                        js.defer = true;
                        document.head.appendChild(js);
                    }
                    
                    const checkFB = setInterval(() => {
                        if (window.FB) {
                            clearInterval(checkFB);
                            initFB();
                        }
                    }, 100);

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
            
            const statusResponse = await new Promise((resolve) => {
                FB.getLoginStatus((response) => resolve(response));
            });

            let response;
            if (statusResponse.status === 'connected') {
                response = statusResponse;
            } else {
                response = await new Promise((resolve, reject) => {
                    FB.login((loginResponse) => {
                        if (loginResponse.authResponse) {
                            resolve(loginResponse);
                        } else {
                            console.error('Login negado ou cancelado pelo usuário');
                            reject(new Error('Login do Facebook não autorizado'));
                        }
                    }, {
                        scope: 'public_profile,ads_read,ads_management,business_management',
                        return_scopes: true,
                        auth_type: 'rerequest'
                    });
                });
            }

            this.accessToken = response.authResponse.accessToken;
            localStorage.setItem('fbAccessToken', this.accessToken);
            await this.loadAllAdAccounts();
            
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
            console.error('Erro ao carregar contas de anúncio:', error);
            throw new Error(`Falha ao carregar contas: ${error.message}`);
        }
    }

    async loadPersonalAdAccounts() {
        try {
            let allAccounts = [];
            let url = '/me/adaccounts?fields=id,name,account_status&access_token=' + this.accessToken;

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
            let url = '/me/businesses?fields=id,name&access_token=' + this.accessToken;

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
                    console.error(`Erro ao carregar contas próprias do gerenciador ${businessId}:`, response?.error);
                    url = null;
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
            return [];
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
                    console.error(`Erro ao carregar contas de clientes do gerenciador ${businessId}:`, response?.error);
                    url = null;
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
            return [];
        }
    }

    getAccessToken() {
        return this.accessToken;
    }

    getAdAccounts() {
        return this.adAccountsMap;
    }

    logout() {
        return new Promise((resolve) => {
            FB.logout(() => {
                localStorage.removeItem('fbAccessToken');
                localStorage.removeItem('adAccountsMap');
                this.accessToken = null;
                this.adAccountsMap = {};
                resolve();
            });
        });
    }
}

// Criar e exportar instâncias únicas
const appAuth = new AppAuth();
const fbAuth = new FacebookAuth();

export { appAuth, fbAuth };