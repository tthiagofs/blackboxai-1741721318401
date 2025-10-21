// Autenticação Google para Google Ads
class GoogleAuthService {
    constructor() {
        this.clientId = '73361857075-qoqd61imivlju9l83dd6fevvh8e8ppsf.apps.googleusercontent.com';
        this.scope = 'https://www.googleapis.com/auth/adwords';
        this.accessToken = null;
        this.tokenClient = null;
        this.isInitialized = false;
    }

    // Inicializar Google Identity Services
    async initialize() {
        // Sempre tentar carregar token salvo primeiro
        const savedToken = this.loadToken();
        if (savedToken) {
            this.accessToken = savedToken;
            console.log('✅ Token Google restaurado do localStorage');
        }
        
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            // Carregar a biblioteca Google Identity Services
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log('✅ Google Identity Services carregado');
                
                // Inicializar o token client
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.clientId,
                    scope: this.scope,
                    callback: (response) => {
                        if (response.error) {
                            console.error('❌ Erro no OAuth Google:', response);
                            reject(response);
                            return;
                        }
                        
                        this.accessToken = response.access_token;
                        this.saveToken(response.access_token);
                        console.log('✅ Token Google obtido com sucesso');
                    },
                });
                
                this.isInitialized = true;
                
                resolve();
            };
            
            script.onerror = () => {
                console.error('❌ Erro ao carregar Google Identity Services');
                reject(new Error('Falha ao carregar Google Identity Services'));
            };
            
            document.head.appendChild(script);
        });
    }

    // Fazer login (solicitar token)
    async login() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            // Configurar callback temporário
            const originalCallback = this.tokenClient.callback;
            
            this.tokenClient.callback = (response) => {
                // Restaurar callback original
                this.tokenClient.callback = originalCallback;
                
                if (response.error) {
                    reject(response);
                    return;
                }
                
                this.accessToken = response.access_token;
                this.saveToken(response.access_token);
                resolve(response.access_token);
            };
            
            // Solicitar token
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    // Salvar token no localStorage
    saveToken(token) {
        try {
            localStorage.setItem('google_ads_access_token', token);
            localStorage.setItem('google_ads_token_time', Date.now().toString());
        } catch (error) {
            console.error('Erro ao salvar token:', error);
        }
    }

    // Carregar token do localStorage
    loadToken() {
        try {
            const token = localStorage.getItem('google_ads_access_token');
            const tokenTime = localStorage.getItem('google_ads_token_time');
            
            if (!token || !tokenTime) return null;
            
            // Verificar se token expirou (1 hora)
            const elapsed = Date.now() - parseInt(tokenTime);
            if (elapsed > 3600000) { // 1 hora em ms
                this.clearToken();
                return null;
            }
            
            return token;
        } catch (error) {
            console.error('Erro ao carregar token:', error);
            return null;
        }
    }

    // Limpar token
    clearToken() {
        localStorage.removeItem('google_ads_access_token');
        localStorage.removeItem('google_ads_token_time');
        localStorage.removeItem('google_ads_accounts');
        this.accessToken = null;
    }

    // Verificar se está autenticado
    isAuthenticated() {
        return !!this.accessToken;
    }

    // Obter token atual
    getAccessToken() {
        return this.accessToken;
    }

    // Buscar contas Google Ads acessíveis
    async fetchAccessibleAccounts() {
        if (!this.accessToken) {
            throw new Error('Não autenticado. Faça login primeiro.');
        }

        try {
            console.log('🔍 Buscando contas Google Ads via Netlify Function...');
            
            // Chamar a Netlify Function para listar contas
            const response = await fetch('/.netlify/functions/google-ads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'listAccounts',
                    accessToken: this.accessToken,
                }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Erro na resposta:', data);
                throw new Error(data.error || 'Erro ao buscar contas');
            }

            console.log('✅ Contas recebidas:', data.accounts);
            
            // Salvar contas no localStorage
            if (data.accounts && data.accounts.length > 0) {
                localStorage.setItem('google_ads_accounts', JSON.stringify(data.accounts));
            }
            
            return data.accounts || [];
        } catch (error) {
            console.error('❌ Erro ao buscar contas Google Ads:', error);
            throw error;
        }
    }

    // Carregar contas salvas
    getStoredAccounts() {
        try {
            const stored = localStorage.getItem('google_ads_accounts');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Erro ao carregar contas salvas:', error);
            return [];
        }
    }
}

// Exportar instância única
export const googleAuth = new GoogleAuthService();

