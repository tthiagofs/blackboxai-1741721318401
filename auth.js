class AppAuth {
    constructor() {
        this.username = '@admin';
        this.password = '134679';
    }

    validateAppLogin(username, password) {
        return username === this.username && password === this.password;
    }
}

class FacebookAuth {
    constructor() {
        this.accessToken = localStorage.getItem('fbAccessToken');
        this.adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};

        const appLoggedIn = localStorage.getItem('appLoggedIn') === 'true';
        const storedToken = localStorage.getItem('fbAccessToken');
        console.log('appLoggedIn (do localStorage):', appLoggedIn);
        console.log('storedToken (tem token do Facebook?):', storedToken ? 'Sim' : 'Não');

        if (appLoggedIn && !storedToken) {
            console.log('Token ausente, forçando logout e limpando estado');
            localStorage.removeItem('appLoggedIn');
            localStorage.removeItem('fbAccessToken');
            localStorage.removeItem('adAccountsMap');
            this.accessToken = null;
            this.adAccountsMap = {};
        }

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
                        scope: 'public_profile,ads_read',
                        return_scopes: true,
                        auth_type: 'rerequest'
                    });
                });
            }

            // Verificar permissões concedidas
            const grantedScopes = response.authResponse.grantedScopes.split(',');
            const requiredScopes = ['public_profile', 'ads_read'];
            const missingScopes = requiredScopes.filter(scope => !grantedScopes.includes(scope));
            if (missingScopes.length > 0) {
                console.warn('Permissões necessárias não foram concedidas:', missingScopes);
                // Fazer logout para limpar o estado
                await this.logout();
                throw new Error('Permissões necessárias não foram concedidas: ' + missingScopes.join(', '));
            }

            this.accessToken = response.authResponse.accessToken;
            localStorage.setItem('fbAccessToken', this.accessToken);

            const adAccounts = await this.loadAllAdAccounts();
            if (adAccounts.length === 0) {
                throw new Error('Nenhuma conta de anúncios encontrada. Verifique suas permissões no Facebook.');
            }

            this.adAccountsMap = {};
            adAccounts.forEach(account => {
                if (account.account_status === 1) {
                    this.adAccountsMap[account.id] = account.name;
                }
            });

            localStorage.setItem('adAccountsMap', JSON.stringify(this.adAccountsMap));
            localStorage.setItem('appLoggedIn', 'true');

            return response;
        } catch (error) {
            console.error('Erro durante o processo de login:', error);
            throw new Error(`Falha no login do Facebook: ${error.message}`);
        }
    }

    async loadAllAdAccounts() {
        try {
            console.log('Carregando contas de anúncios...');
            const response = await new Promise((resolve, reject) => {
                FB.api('/me/adaccounts', { fields: 'id,name,account_id,account_status,business_name' }, (response) => {
                    if (response.error) {
                        console.error('Erro do Facebook API:', response.error);
                        reject(response.error);
                    } else {
                        resolve(response);
                    }
                });
            });

            if (!response.data || response.data.length === 0) {
                console.warn('Nenhuma conta de anúncios encontrada para este usuário.');
                return [];
            }

            console.log('Contas de anúncios carregadas:', response.data);
            return response.data;
        } catch (error) {
            console.error('Erro ao carregar contas de anúncios:', error);
            throw new Error('Erro ao carregar contas de anúncios: ' + (error.message || 'Erro desconhecido'));
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
                localStorage.removeItem('appLoggedIn');
                this.accessToken = null;
                this.adAccountsMap = {};
                resolve();
            });
        });
    }
}

const appAuth = new AppAuth();
const fbAuth = new FacebookAuth();

export { appAuth, fbAuth };