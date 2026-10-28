import { connectionService } from './services/connectionService.js';

// Reimplementei a autenticação Google para Google Ads com API pública compatível
class GoogleAuthService {
    constructor() {
        this.clientId = '73361857075-qoqd61imivlju9l83dd6fevvh8e8ppsf.apps.googleusercontent.com';
        this.scope = 'https://www.googleapis.com/auth/adwords';
        this.accessToken = null;
        this.tokenClient = null;
        this.isInitialized = false;
        this.adAccounts = [];
    }

    // Carrega a biblioteca GSI e inicializa token client
    async initialize() {
        if (this.isInitialized) return;

        // Tentar carregar token salvo rapidamente
        const saved = this._loadTokenFromStorage();
        if (saved) this.accessToken = saved;

        await this._loadGsiScript();

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: this.scope,
            callback: (resp) => {
                // callback é substituído dinamicamente nos requests
                console.debug('GSI callback:', resp);
            },
        });

        this.isInitialized = true;
    }

    // Internal: carrega o script GSI
    _loadGsiScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                return resolve();
            }
            const existing = document.querySelector('script[data-gsi]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Falha ao carregar GSI')));
                return;
            }

            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.defer = true;
            s.setAttribute('data-gsi', '1');
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Falha ao carregar GSI'));
            document.head.appendChild(s);
        });
    }

    // Solicita token ao usuário. Usa initCodeClient para obter Refresh Token permanente
    async login(prompt = 'consent') {
        await this.initialize();

        return new Promise((resolve, reject) => {
            let timeoutId = null;

            try {
                // Tentar Authorization Code Flow com popup (obtém refresh_token permanente)
                const codeClient = google.accounts.oauth2.initCodeClient({
                    client_id: this.clientId,
                    scope: this.scope,
                    ux_mode: 'popup',
                    prompt: 'consent',
                    access_type: 'offline',
                    callback: async (response) => {
                        if (timeoutId) clearTimeout(timeoutId);
                        if (response.error) {
                            console.error('❌ [GoogleAuth] Erro retornado pelo Google Identity:', response);
                            return reject(new Error(response.error_description || response.error));
                        }

                        if (!response.code) {
                            return reject(new Error('Nenhum código de autorização retornado pelo Google.'));
                        }

                        try {
                            console.log('🔄 [GoogleAuth] Trocando authorization code por refresh_token permanente...');
                            const res = await fetch('/api/exchange-token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    platform: 'google',
                                    code: response.code,
                                    redirectUri: 'postmessage'
                                })
                            });

                            const data = await res.json();
                            if (!res.ok || data.error) {
                                throw new Error(data.error || 'Falha ao trocar código de autorização do Google');
                            }

                            this.accessToken = data.accessToken;
                            this._saveTokenToStorage(data.accessToken);

                            if (data.refreshToken) {
                                this.refreshTokenVal = data.refreshToken;
                                localStorage.setItem('googleRefreshToken', data.refreshToken);
                                localStorage.setItem('google_ads_refresh_token', data.refreshToken);
                                console.log('🎉 [GoogleAuth] Refresh token permanente do Google Ads obtido com sucesso!');
                            }

                            // Persistir imediatamente no Firestore e sincronizar com alertas programados
                            try {
                                await connectionService.initialize();
                                const finalRt = data.refreshToken || localStorage.getItem('googleRefreshToken') || this.refreshTokenVal || null;
                                await connectionService.saveGoogleConnection(data.accessToken, finalRt, this.getStoredAccounts());
                            } catch (ePersist) {
                                console.warn('⚠️ [GoogleAuth] Aviso ao persistir token no Firestore após login:', ePersist);
                            }

                            resolve(data.accessToken);
                        } catch (err) {
                            console.error('❌ [GoogleAuth] Erro no exchange-token:', err);
                            reject(err);
                        }
                    }
                });

                timeoutId = setTimeout(() => {
                    reject(new Error('Tempo limite para login excedido'));
                }, 120000);

                codeClient.requestCode();
            } catch (errInit) {
                if (timeoutId) clearTimeout(timeoutId);
                console.warn('⚠️ [GoogleAuth] Falha no initCodeClient, tentando tokenClient fallback:', errInit);
                this._loginWithTokenClient(prompt, resolve, reject);
            }
        });
    }

    // Fallback: login legado via tokenClient (implicit token)
    _loginWithTokenClient(prompt, resolve, reject) {
        let timeoutId = null;
        const original = this.tokenClient.callback;

        const handler = (resp) => {
            if (timeoutId) clearTimeout(timeoutId);
            this.tokenClient.callback = original;
            if (resp.error) return reject(resp);
            this.accessToken = resp.access_token;
            this._saveTokenToStorage(resp.access_token);
            resolve(resp.access_token);
        };

        this.tokenClient.callback = handler;

        const maxWait = prompt === '' ? 4000 : 120000;
        timeoutId = setTimeout(() => {
            this.tokenClient.callback = original;
            reject(new Error(prompt === '' ? 'Renovação silenciosa indisponível' : 'Tempo limite para login excedido'));
        }, maxWait);

        try {
            this.tokenClient.requestAccessToken({ prompt });
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            this.tokenClient.callback = original;
            reject(err);
        }
    }

    // Força seleção de conta
    async loginWithAccount() {
        return this.login('select_account');
    }

    // Renova token silenciosamente via backend (usando refresh_token permanente)
    async refreshSilently() {
        let rt = localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token') || this.refreshTokenVal;
        if (!rt) {
            try {
                await connectionService.initialize();
                rt = connectionService.connections?.google?.refreshToken || null;
                if (rt) {
                    this.refreshTokenVal = rt;
                    localStorage.setItem('googleRefreshToken', rt);
                    localStorage.setItem('google_ads_refresh_token', rt);
                }
            } catch (eConn) {}
        }
        if (!rt) return null;

        try {
            console.log('🔄 [GoogleAuth] Renovando token Google Ads silenciosamente via refresh_token...');
            const res = await fetch('/api/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'google',
                    refreshToken: rt
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.accessToken) {
                    this.accessToken = data.accessToken;
                    this._saveTokenToStorage(data.accessToken);
                    console.log('✅ [GoogleAuth] Access token renovado com sucesso via backend!');
                    try {
                        await connectionService.initialize();
                        await connectionService.saveGoogleConnection(data.accessToken, rt, this.getStoredAccounts());
                    } catch (eSync) {}
                    return data.accessToken;
                }
            } else {
                console.warn('⚠️ [GoogleAuth] Falha na resposta do exchange-token:', await res.text());
            }
        } catch (e) {
            console.warn('⚠️ [GoogleAuth] Erro ao renovar via refresh_token:', e.message);
        }
        return null;
    }

    // Tenta renovar token silenciosamente (primeiro via refresh_token permanente, depois GSI)
    async refreshToken() {
        const backendRefreshed = await this.refreshSilently();
        if (backendRefreshed) return backendRefreshed;

        await this.initialize();
        return new Promise((resolve, reject) => {
            this._loginWithTokenClient('', resolve, reject);
        });
    }

    // Limpar token e dados locais SEM apagar Firestore por padrão
    async clearToken(disconnectFirestore = false) {
        localStorage.removeItem('google_ads_access_token');
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('google_ads_token_time');
        localStorage.removeItem('google_ads_accounts');
        localStorage.removeItem('googleRefreshToken');
        localStorage.removeItem('google_ads_refresh_token');
        this.accessToken = null;
        this.refreshTokenVal = null;
        this.adAccounts = [];

        if (disconnectFirestore) {
            try {
                await connectionService.initialize();
                await connectionService.disconnectGoogle();
            } catch (err) {
                console.warn('Erro ao desconectar no Firebase:', err);
            }
        }
    }

    // Indica se há um token válido (não expirado)
    async isAuthenticated() {
        const t = this._loadTokenFromStorage();
        if (t) {
            this.accessToken = t;
            return true;
        }
        this.accessToken = null;
        return false;
    }

    // Retorna token atual (carrega do storage, renova silenciosamente se necessário ou interativo se permitido)
    async getAccessToken(interactiveIfExpired = false) {
        let t = this._loadTokenFromStorage();
        
        const tokenTime = localStorage.getItem('google_ads_token_time');
        const isExpiring = !tokenTime || (Date.now() - parseInt(tokenTime, 10) > 45 * 60 * 1000);

        if (!t || isExpiring) {
            try {
                console.log('🔄 [GoogleAuth] Renovando token Google Ads silenciosamente...');
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    this.accessToken = refreshed;
                    return refreshed;
                }
            } catch (err) {
                console.warn('⚠️ [GoogleAuth] Renovação silenciosa indisponível sem interação.');

                // Se permitido interativo (ex: clique do usuário em Disparar Teste ou Salvar)
                if (interactiveIfExpired) {
                    try {
                        console.log('🔄 [GoogleAuth] Solicitando renovação interativa ao usuário...');
                        const interactiveToken = await this.login('consent');
                        if (interactiveToken) {
                            this.accessToken = interactiveToken;
                            try {
                                await connectionService.initialize();
                                const rt = localStorage.getItem('googleRefreshToken') || this.refreshTokenVal || null;
                                await connectionService.saveGoogleConnection(interactiveToken, rt, this.getStoredAccounts());
                            } catch (eSave) {}
                            return interactiveToken;
                        }
                    } catch (eInter) {
                        console.warn('⚠️ [GoogleAuth] Renovação interativa cancelada ou falhou:', eInter);
                    }
                }
            }

            // Se ainda não tiver token, tentar restaurar do Firestore
            if (!t) {
                try {
                    await connectionService.initialize();
                    if (connectionService.connections?.google?.accessToken) {
                        t = connectionService.connections.google.accessToken;
                        this._saveTokenToStorage(t);
                        console.log('✅ [GoogleAuth] Token restaurado do Firestore');
                    }
                } catch (e) {
                    console.warn('Erro ao restaurar token Google do Firestore:', e);
                }
            }
        }

        this.accessToken = t;
        return this.accessToken;
    }

    // Buscar contas acessíveis via backend
    async fetchAccessibleAccounts() {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Sessão do Google Ads expirada ou não autenticada. Faça login novamente.');

        const res = await fetch('/api/google-ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'listAccounts', accessToken: token }),
        });

        const data = await res.json();

        // ▼ LOG DE DIAGNÓSTICO — abra F12 > Console para ver os detalhes
        if (data.debug) {
            console.group('🔍 [Google Ads] Diagnóstico da listagem de contas');
            console.log('IDs acessíveis:', data.debug.find(d => d.step === 'listAccessibleCustomers')?.ids);
            console.table(data.debug.filter(d => d.step === 'getAccountInfo'));
            console.log('Expansões MCC:');
            data.debug.filter(d => d.step === 'getAllClientsFromMCC').forEach(d => {
                if (d.error || d.exception) {
                    console.warn(`  ❌ ID ${d.id} HTTP ${d.status}:`, d.error || d.exception);
                } else {
                    console.log(`  ✅ ID ${d.id}: ${d.totalRows} registros raw | sample:`, d.sample);
                }
            });
            console.log('Resultado final:', data.accounts?.length, 'contas');
            console.groupEnd();
        }

        if (!res.ok) {
            if (res.status === 401 || data.error?.includes('401') || data.error?.includes('UNAUTHENTICATED') || data.error?.includes('invalid authentication credentials')) {
                console.warn('⚠️ [GoogleAuth] 401 ao listar contas. Tentando renovação silenciosa via refresh_token...');
                const refreshed = await this.refreshSilently();
                if (refreshed) {
                    return this.fetchAccessibleAccounts();
                }
                throw new Error('Sessão do Google Ads expirada (401). Reconecte a conta em Conexões.');
            }
            throw new Error(data.error || 'Erro ao listar contas');
        }

        if (Array.isArray(data.accounts) && data.accounts.length) {
            this.adAccounts = data.accounts;
            localStorage.setItem('google_ads_accounts', JSON.stringify(this.adAccounts));

            try {
                await connectionService.initialize();
                const rt = localStorage.getItem('googleRefreshToken') || this.refreshTokenVal || null;
                await connectionService.saveGoogleConnection(token, rt, this.adAccounts);
            } catch (err) {
                console.warn('Erro ao salvar conexão no Firebase:', err);
            }
        }

        return data.accounts || [];
    }


    getStoredAccounts() {
        try {
            const s = localStorage.getItem('google_ads_accounts');
            return s ? JSON.parse(s) : [];
        } catch (err) {
            return [];
        }
    }

    // ---------- helpers de storage ----------
    _saveTokenToStorage(token) {
        try {
            localStorage.setItem('google_ads_access_token', token);
            localStorage.setItem('googleAccessToken', token);
            localStorage.setItem('google_ads_token_time', Date.now().toString());
        } catch (e) {
            console.warn('Erro ao salvar token:', e);
        }
    }

    _loadTokenFromStorage() {
        try {
            const token = localStorage.getItem('google_ads_access_token') || localStorage.getItem('googleAccessToken');
            return token || null;
        } catch (e) {
            return null;
        }
    }
}

export const googleAuth = new GoogleAuthService();
