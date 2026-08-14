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

    // Solicita token ao usuário. prompt: 'consent' | 'select_account' | ''
    async login(prompt = 'consent') {
        await this.initialize();

        return new Promise((resolve, reject) => {
            const handler = (resp) => {
                if (resp.error) return reject(resp);
                this.accessToken = resp.access_token;
                this._saveTokenToStorage(resp.access_token);
                resolve(resp.access_token);
            };

            // Temporariamente substitui o callback
            const original = this.tokenClient.callback;
            this.tokenClient.callback = handler;
            try {
                this.tokenClient.requestAccessToken({ prompt });
            } catch (err) {
                this.tokenClient.callback = original;
                reject(err);
            }
        });
    }

    // Força seleção de conta
    async loginWithAccount() {
        return this.login('select_account');
    }

    // Tenta renovar token silenciosamente
    async refreshToken() {
        await this.initialize();
        try {
            return await this.login('');
        } catch (err) {
            // sinalizar que precisa de consentimento interativo
            throw err;
        }
    }

    // Limpar token e dados locais
    async clearToken() {
        localStorage.removeItem('google_ads_access_token');
        localStorage.removeItem('google_ads_token_time');
        localStorage.removeItem('google_ads_accounts');
        this.accessToken = null;
        this.adAccounts = [];

        try {
            await connectionService.initialize();
            await connectionService.disconnectGoogle();
        } catch (err) {
            console.warn('Erro ao desconectar no Firebase:', err);
        }
    }

    // Indica se há um token (não garante validade contra Google)
    async isAuthenticated() {
        if (this.accessToken) return true;
        const t = this._loadTokenFromStorage();
        if (t) {
            this.accessToken = t;
            return true;
        }
        return false;
    }

    // Retorna token atual (carrega do storage se necessário)
    async getAccessToken() {
        if (!this.accessToken) this.accessToken = this._loadTokenFromStorage();
        return this.accessToken;
    }

    // Buscar contas acessíveis via backend
    async fetchAccessibleAccounts() {
        const token = await this.getAccessToken();
        if (!token) throw new Error('Não autenticado. Faça login primeiro.');

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

        if (!res.ok) throw new Error(data.error || 'Erro ao listar contas');

        if (Array.isArray(data.accounts) && data.accounts.length) {
            this.adAccounts = data.accounts;
            localStorage.setItem('google_ads_accounts', JSON.stringify(this.adAccounts));

            try {
                await connectionService.initialize();
                await connectionService.saveGoogleConnection(token, null, this.adAccounts);
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
            localStorage.setItem('google_ads_token_time', Date.now().toString());
        } catch (e) {
            console.warn('Erro ao salvar token:', e);
        }
    }

    _loadTokenFromStorage() {
        try {
            return localStorage.getItem('google_ads_access_token');
        } catch (e) {
            return null;
        }
    }
}

export const googleAuth = new GoogleAuthService();

