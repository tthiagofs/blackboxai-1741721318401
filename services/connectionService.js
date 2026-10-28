/**
 * Serviço de gerenciamento de conexões com plataformas (Meta e Google Ads)
 * Responsável por salvar e recuperar tokens de autenticação no Firestore
 */

import { db, auth } from '../config/firebase.js';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class ConnectionService {
    constructor() {
        this.userId = null;
        this.connections = {
            meta: {
                connected: false,
                accessToken: null,
                adAccounts: {},
                lastUpdate: null
            },
            google: {
                connected: false,
                accessToken: null,
                refreshToken: null,
                adAccounts: [],
                lastUpdate: null
            }
        };
    }

    /**
     * Inicializa o serviço com o ID do usuário atual
     */
    async initialize() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Usuário não autenticado');
        }
        
        this.userId = user.uid;
        console.log('🔌 [ConnectionService] Inicializado para usuário:', user.email);
        
        // Carregar conexões salvas
        await this.loadConnections();
    }

    /**
     * Carrega as conexões salvas do Firestore
     */
    async loadConnections() {
        try {
            const userDoc = await getDoc(doc(db, 'users', this.userId));
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                
                if (data.connections) {
                    this.connections = data.connections;
                    console.log('✅ [ConnectionService] Conexões carregadas do Firestore');
                    
                    // Restaurar no localStorage para compatibilidade
                    if (this.connections.meta?.connected) {
                        localStorage.setItem('fbAccessToken', this.connections.meta.accessToken);
                        localStorage.setItem('adAccountsMap', JSON.stringify(this.connections.meta.adAccounts));
                    }
                    
                    if (this.connections.google?.connected) {
                        localStorage.setItem('googleAccessToken', this.connections.google.accessToken);
                        localStorage.setItem('google_ads_access_token', this.connections.google.accessToken);
                        if (this.connections.google.lastUpdate) {
                            const lastTime = new Date(this.connections.google.lastUpdate).getTime();
                            localStorage.setItem('google_ads_token_time', lastTime.toString());
                        }
                        if (this.connections.google.refreshToken) {
                            localStorage.setItem('googleRefreshToken', this.connections.google.refreshToken);
                            localStorage.setItem('google_ads_refresh_token', this.connections.google.refreshToken);
                        } else {
                            // Se localStorage tiver refreshToken que não estava no doc, salvar de volta
                            const localRt = localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token');
                            if (localRt) {
                                this.connections.google.refreshToken = localRt;
                                try { await this.saveToFirestore(); } catch (e) {}
                            }
                        }
                        localStorage.setItem('googleAdAccounts', JSON.stringify(this.connections.google.adAccounts));
                        if (this.connections.google.adAccounts) {
                            localStorage.setItem('google_ads_accounts', JSON.stringify(this.connections.google.adAccounts));
                        }
                    }

                    // Sincronizar tokens em background para whatsapp_alerts (garante que o Cron tenha acesso ao refreshToken mesmo com regras de users restritas)
                    this.syncTokensToAlerts().catch(() => {});
                } else {
                    console.log('ℹ️ [ConnectionService] Nenhuma conexão salva encontrada');
                }
            }
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao carregar conexões:', error);
            throw error;
        }
    }

    /**
     * Sincroniza os tokens atuais (incluindo googleRefreshToken) com a coleção whatsapp_alerts
     * para que o Cron da Vercel consiga sempre renovar o token de 1h sem depender de leitura em users/{uid}
     */
    async syncTokensToAlerts() {
        if (!this.userId) return;
        try {
            const metaTok = this.connections.meta?.accessToken || localStorage.getItem('fbAccessToken') || '';
            const googleTok = this.connections.google?.accessToken || localStorage.getItem('google_ads_access_token') || localStorage.getItem('googleAccessToken') || '';
            const googleRt = this.connections.google?.refreshToken || localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token') || '';

            if (!metaTok && !googleTok && !googleRt) return;

            // 1. Salvar doc espelho de tokens em whatsapp_alerts/_tokens_{uid} (active: false para não disparar como alerta)
            const tokenDocRef = doc(db, 'whatsapp_alerts', `_tokens_${this.userId}`);
            const tokenPayload = {
                isTokenStore: true,
                active: false,
                userId: this.userId,
                userEmail: auth.currentUser?.email || '',
                updatedAt: new Date().toISOString()
            };
            if (metaTok) tokenPayload.metaToken = metaTok;
            if (googleTok) tokenPayload.googleToken = googleTok;
            if (googleRt) tokenPayload.googleRefreshToken = googleRt;

            await setDoc(tokenDocRef, tokenPayload, { merge: true });

            // 2. Atualizar alertas existentes deste usuário em whatsapp_alerts
            const colRef = collection(db, 'whatsapp_alerts');
            const q = query(colRef, where('userId', '==', this.userId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                for (const d of snap.docs) {
                    if (d.id.startsWith('_tokens_')) continue;
                    const patch = {};
                    if (metaTok) patch.metaToken = metaTok;
                    if (googleTok) patch.googleToken = googleTok;
                    if (googleRt) patch.googleRefreshToken = googleRt;
                    if (Object.keys(patch).length > 0) {
                        await setDoc(doc(db, 'whatsapp_alerts', d.id), patch, { merge: true });
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ [ConnectionService] Aviso ao sincronizar tokens com whatsapp_alerts:', err.message);
        }
    }

    /**
     * Salva a conexão do Meta Ads
     */
    async saveMetaConnection(accessToken, adAccounts) {
        try {
            this.connections.meta = {
                connected: true,
                accessToken: accessToken,
                adAccounts: adAccounts,
                lastUpdate: new Date().toISOString()
            };

            await this.saveToFirestore();
            await this.syncTokensToAlerts();
            
            console.log('✅ [ConnectionService] Conexão Meta salva com sucesso');
            return true;
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao salvar conexão Meta:', error);
            throw error;
        }
    }

    /**
     * Salva a conexão do Google Ads
     */
    async saveGoogleConnection(accessToken, refreshToken, adAccounts) {
        try {
            const finalRefreshToken = refreshToken || this.connections.google?.refreshToken || localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token') || null;
            const finalAccounts = (Array.isArray(adAccounts) && adAccounts.length > 0)
                ? adAccounts
                : (this.connections.google?.adAccounts || []);

            this.connections.google = {
                connected: true,
                accessToken: accessToken,
                refreshToken: finalRefreshToken,
                adAccounts: finalAccounts,
                lastUpdate: new Date().toISOString()
            };

            localStorage.setItem('googleAccessToken', accessToken);
            localStorage.setItem('google_ads_access_token', accessToken);
            localStorage.setItem('google_ads_token_time', Date.now().toString());
            if (finalRefreshToken) {
                localStorage.setItem('googleRefreshToken', finalRefreshToken);
                localStorage.setItem('google_ads_refresh_token', finalRefreshToken);
            }

            await this.saveToFirestore();
            await this.syncTokensToAlerts();
            
            console.log('✅ [ConnectionService] Conexão Google salva com sucesso (Refresh Token:', !!finalRefreshToken, ')');
            return true;
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao salvar conexão Google:', error);
            throw error;
        }
    }

    /**
     * Salva as conexões no Firestore
     */
    async saveToFirestore() {
        try {
            const userRef = doc(db, 'users', this.userId);
            
            await setDoc(userRef, {
                connections: this.connections,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            console.log('💾 [ConnectionService] Conexões salvas no Firestore');
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao salvar no Firestore:', error);
            throw error;
        }
    }

    /**
     * Remove a conexão do Meta Ads
     */
    async disconnectMeta() {
        try {
            this.connections.meta = {
                connected: false,
                accessToken: null,
                adAccounts: {},
                lastUpdate: new Date().toISOString()
            };

            // Limpar localStorage
            localStorage.removeItem('fbAccessToken');
            localStorage.removeItem('adAccountsMap');

            await this.saveToFirestore();
            
            console.log('✅ [ConnectionService] Conexão Meta removida');
            return true;
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao remover conexão Meta:', error);
            throw error;
        }
    }

    /**
     * Remove a conexão do Google Ads
     */
    async disconnectGoogle() {
        try {
            this.connections.google = {
                connected: false,
                accessToken: null,
                refreshToken: null,
                adAccounts: [],
                lastUpdate: new Date().toISOString()
            };

            // Limpar localStorage
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleRefreshToken');
            localStorage.removeItem('google_ads_refresh_token');
            localStorage.removeItem('googleAdAccounts');

            await this.saveToFirestore();
            
            console.log('✅ [ConnectionService] Conexão Google removida');
            return true;
        } catch (error) {
            console.error('❌ [ConnectionService] Erro ao remover conexão Google:', error);
            throw error;
        }
    }

    /**
     * Retorna o status das conexões
     */
    getConnectionStatus() {
        // Verificar também o localStorage para compatibilidade
        const fbToken = localStorage.getItem('fbAccessToken');
        const googleToken = localStorage.getItem('google_ads_access_token');
        
        return {
            meta: {
                connected: this.connections.meta.connected || !!fbToken,
                token: this.connections.meta.accessToken || fbToken,
                accountsCount: Object.keys(this.connections.meta.adAccounts || {}).length,
                lastUpdate: this.connections.meta.lastUpdate
            },
            google: {
                connected: this.connections.google.connected || !!googleToken,
                token: this.connections.google.accessToken || googleToken,
                accountsCount: (this.connections.google.adAccounts || []).length,
                lastUpdate: this.connections.google.lastUpdate
            }
        };
    }

    /**
     * Retorna os tokens salvos
     */
    getTokens() {
        return {
            meta: {
                accessToken: this.connections.meta.accessToken,
                adAccounts: this.connections.meta.adAccounts
            },
            google: {
                accessToken: this.connections.google.accessToken,
                refreshToken: this.connections.google.refreshToken,
                adAccounts: this.connections.google.adAccounts
            }
        };
    }

    /**
     * Verifica se o usuário tem ao menos uma conexão ativa
     */
    hasAnyConnection() {
        return this.connections.meta.connected || this.connections.google.connected;
    }

    /**
     * Verifica se precisa reconectar (token expirado, etc)
     */
    needsReconnection(platform) {
        if (platform === 'meta') {
            // Tokens do Meta geralmente duram 60 dias
            if (!this.connections.meta.connected || !this.connections.meta.lastUpdate) {
                return true;
            }
            
            const lastUpdate = new Date(this.connections.meta.lastUpdate);
            const daysSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
            
            return daysSinceUpdate > 50; // Reconectar após 50 dias por segurança
        }
        
        if (platform === 'google') {
            // Access tokens do Google expiram em ~1 hora, mas temos refresh token
            return !this.connections.google.connected || !this.connections.google.refreshToken;
        }
        
        return false;
    }
}

// Exportar instância única
export const connectionService = new ConnectionService();
