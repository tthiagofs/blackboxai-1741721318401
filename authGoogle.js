import { connectionService } from './services/connectionService.js';

// Autenticação Google para Google Ads
class GoogleAuthService {
    constructor() {
        this.clientId = '73361857075-qoqd61imivlju9l83dd6fevvh8e8ppsf.apps.googleusercontent.com';
        this.scope = 'https://www.googleapis.com/auth/adwords';
        this.accessToken = null;
        this.tokenClient = null;
        this.isInitialized = false;
        this.adAccounts = [];
    }

    // Inicializar Google Identity Services
    async initialize() {
        // Sempre tentar carregar token salvo primeiro (e renovar se necessário)
        const savedToken = await this.loadToken();
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

    // Carregar token do localStorage e renovar se necessário
    async loadToken() {
        try {
            const token = localStorage.getItem('google_ads_access_token');
            const tokenTime = localStorage.getItem('google_ads_token_time');
            
            if (!token || !tokenTime) return null;
            
            // Verificar se token está próximo de expirar (55 minutos = renovar antes de expirar)
            const elapsed = Date.now() - parseInt(tokenTime);
            const EXPIRY_TIME = 3600000; // 1 hora em ms
            const RENEWAL_THRESHOLD = 3300000; // 55 minutos - renovar antes de expirar
            
            if (elapsed > EXPIRY_TIME) {
                // Token expirado - tentar renovar automaticamente
                console.log('🔄 Token Google expirado, tentando renovar automaticamente...');
                try {
                    await this.refreshToken();
                    return this.accessToken;
                } catch (error) {
                    console.warn('⚠️ Não foi possível renovar token automaticamente:', error);
                    this.clearToken();
                    return null;
                }
            } else if (elapsed > RENEWAL_THRESHOLD) {
                // Token próximo de expirar - renovar proativamente
                console.log('🔄 Token Google próximo de expirar, renovando proativamente...');
                try {
                    await this.refreshToken();
                    return this.accessToken;
                } catch (error) {
                    console.warn('⚠️ Não foi possível renovar token proativamente, usando token atual:', error);
                    return token; // Usar token atual mesmo que esteja próximo de expirar
                }
            }
            
            return token;
        } catch (error) {
            console.error('Erro ao carregar token:', error);
            return null;
        }
    }
    
    // Renovar token automaticamente (sem forçar novo consentimento)
    async refreshToken() {
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
                    // Se erro de consentimento, o token precisa ser renovado manualmente
                    if (response.error === 'popup_closed_by_user' || response.error.includes('consent')) {
                        console.warn('⚠️ Renovação automática falhou - usuário precisa reconectar');
                        reject(new Error('TOKEN_REFRESH_REQUIRES_CONSENT'));
                    } else {
                        reject(response);
                    }
                    return;
                }
                
                this.accessToken = response.access_token;
                this.saveToken(response.access_token);
                console.log('✅ Token Google renovado automaticamente');
                resolve(response.access_token);
            };
            
            // Solicitar token sem forçar novo consentimento (sem prompt)
            try {
                this.tokenClient.requestAccessToken({ prompt: '' }); // Vazio = sem prompt, apenas renovar se possível
            } catch (error) {
                reject(error);
            }
        });
    }

    // Limpar token
    async clearToken() {
        localStorage.removeItem('google_ads_access_token');
        localStorage.removeItem('google_ads_token_time');
        localStorage.removeItem('google_ads_accounts');
        this.accessToken = null;
        this.adAccounts = [];
        
        // Remover do Firebase
        try {
            await connectionService.initialize();
            await connectionService.disconnectGoogle();
            console.log('✅ Conexão Google removida do Firebase');
        } catch (error) {
            console.warn('⚠️ Erro ao remover conexão Google do Firebase:', error);
        }
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
            console.log('🔍 Buscando contas Google Ads via API...');
            
            // Chamar a API Function para listar contas
            const response = await fetch('/api/google-ads', {
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
                this.adAccounts = data.accounts;
                localStorage.setItem('google_ads_accounts', JSON.stringify(data.accounts));
                
                // Salvar no Firebase
                try {
                    await connectionService.initialize();
                    await connectionService.saveGoogleConnection(
                        this.accessToken,
                        null, // Google não usa refresh token neste fluxo
                        this.adAccounts
                    );
                    console.log('✅ Conexão Google salva no Firebase');
                } catch (error) {
                    console.warn('⚠️ Erro ao salvar conexão Google no Firebase:', error);
                }
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

