class AppAuth {
    static validateAppLogin(username, password) {
        return username === '@admin' && password === '134679';
    }
}

class FacebookAuth {
    constructor() {
        this.accessToken = localStorage.getItem('fbAccessToken');
        this.adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
        this.initializeFacebookSDK();
    }

    initializeFacebookSDK() {
        window.fbAsyncInit = () => {
            FB.init({
                appId: '618519427538646',
                cookie: true,
                xfbml: true,
                version: 'v20.0'
            });
            FB.AppEvents.logPageView();
            console.log("Facebook SDK inicializado com sucesso!");
        };
    }

    async login() {
        return new Promise((resolve, reject) => {
            FB.login(async (response) => {
                if (response.authResponse) {
                    this.accessToken = response.authResponse.accessToken;
                    localStorage.setItem('fbAccessToken', this.accessToken);
                    
                    try {
                        // Carregar todas as contas de anúncios disponíveis
                        await this.loadAllAdAccounts();
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error('Login do Facebook falhou'));
                }
            }, {
                scope: 'ads_read,ads_management,business_management',
                return_scopes: true
            });
        });
    }

    async loadAllAdAccounts() {
        try {
            // 1. Carregar contas de anúncios pessoais
            await this.loadPersonalAdAccounts();
            
            // 2. Carregar Business Managers
            const businesses = await this.getBusinesses();
            
            // 3. Para cada Business Manager, carregar contas próprias e compartilhadas
            for (const business of businesses) {
                await Promise.all([
                    this.loadOwnedAccounts(business.id),
                    this.loadClientAccounts(business.id)
                ]);
            }

            // Salvar no localStorage
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
                        if (account.account_status === 1) { // 1 = ativo
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
        return new Promise((resolve, reject) => {
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
                    resolve([]); // Não rejeitar se não tiver acesso
                }
            });
        });
    }

    async loadClientAccounts(businessId) {
        return new Promise((resolve, reject) => {
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
                    resolve([]); // Não rejeitar se não tiver acesso
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

// Exportar classes
export const appAuth = new AppAuth();
export const fbAuth = new FacebookAuth();
