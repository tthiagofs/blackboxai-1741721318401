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
        this.adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
        this.initializeFacebookSDK();
    }

    initializeFacebookSDK() {
        return new Promise((resolve, reject) => {
            try {
                const initFB = () => {
                    FB.init({
                        appId: '618519427538646',
                        cookie: true,
                        xfbml: true,
                        version: 'v20.0'
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

            if (statusResponse.status === 'connected') {
                this.accessToken = statusResponse.authResponse.accessToken;
                localStorage.setItem('fbAccessToken', this.accessToken);
                await this.loadAllAdAccounts();
                return statusResponse;
            }

            // If no valid session, proceed with login
            const loginResponse = await new Promise((resolve, reject) => {
                FB.login(async (response) => {
                    if (response.authResponse) {
                        try {
                            this.accessToken = response.authResponse.accessToken;
                            localStorage.setItem('fbAccessToken', this.accessToken);
                            await this.loadAllAdAccounts();
                            resolve(response);
                        } catch (error) {
                            console.error('Erro ao carregar contas após login:', error);
                            reject(error);
                        }
                    } else {
                        console.error('Login negado ou cancelado pelo usuário');
                        reject(new Error('Login do Facebook não autorizado'));
                    }
                }, {
                    scope: 'ads_read,ads_management,business_management',
                    return_scopes: true,
                    auth_type: 'rerequest'  // Force re-authentication
                });
            });

            return loginResponse;
        } catch (error) {
            console.error('Erro durante o processo de login:', error);
            throw new Error(`Falha no login do Facebook: ${error.message}`);
        }
    }

    async loadAllAdAccounts() {
        try {
            await this.loadPersonalAdAccounts();
            const businesses = await this.getBusinesses();
            
            for (const business of businesses) {
                await Promise.all([
                    this.loadOwnedAccounts(business.id),
                    this.loadClientAccounts(business.id)
                ]);
            }

            localStorage.setItem('adAccountsMap', JSON.stringify(this.adAccountsMap));
            return this.adAccountsMap;
        } catch (error) {
            console.error('Erro ao carregar contas:', error);
            throw error;
        }
    }

    async loadPersonalAdAccounts() {
        return new Promise((resolve, reject) => {
            FB.api('/me/adaccounts', {
                fields: 'id,name,account_status',
                access_token: this.accessToken
            }, (response) => {
                if (response && !response.error) {
                    const accounts = response.data || [];
                    accounts.forEach(account => {
                        if (account.account_status === 1) {
                            this.adAccountsMap[account.id] = account.name;
                        }
                    });
                    resolve(accounts);
                } else {
                    reject(new Error('Erro ao carregar contas pessoais'));
                }
            });
        });
    }

    async getBusinesses() {
        return new Promise((resolve, reject) => {
            FB.api('/me/businesses', {
                fields: 'id,name',
                access_token: this.accessToken
            }, (response) => {
                if (response && !response.error) {
                    resolve(response.data || []);
                } else {
                    reject(new Error('Erro ao carregar Business Managers'));
                }
            });
        });
    }

    async loadOwnedAccounts(businessId) {
        return new Promise((resolve) => {
            FB.api(`/${businessId}/owned_ad_accounts`, {
                fields: 'id,name,account_status',
                access_token: this.accessToken
            }, (response) => {
                if (response && !response.error) {
                    const accounts = response.data || [];
                    accounts.forEach(account => {
                        if (account.account_status === 1) {
                            this.adAccountsMap[account.id] = account.name;
                        }
                    });
                    resolve(accounts);
                } else {
                    resolve([]);
                }
            });
        });
    }

    async loadClientAccounts(businessId) {
        return new Promise((resolve) => {
            FB.api(`/${businessId}/client_ad_accounts`, {
                fields: 'id,name,account_status',
                access_token: this.accessToken
            }, (response) => {
                if (response && !response.error) {
                    const accounts = response.data || [];
                    accounts.forEach(account => {
                        if (account.account_status === 1) {
                            this.adAccountsMap[account.id] = account.name;
                        }
                    });
                    resolve(accounts);
                } else {
                    resolve([]);
                }
            });
        });
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
