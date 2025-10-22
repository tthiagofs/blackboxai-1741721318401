/**
 * Serviço de gerenciamento de conexões com plataformas (Meta e Google Ads)
 * Responsável por salvar e recuperar tokens de autenticação no Firestore
 */

import { db, auth } from '../config/firebase.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
                    if (this.connections.meta.connected) {
                        localStorage.setItem('fbAccessToken', this.connections.meta.accessToken);
                        localStorage.setItem('adAccountsMap', JSON.stringify(this.connections.meta.adAccounts));
                    }
                    
                    if (this.connections.google.connected) {
                        localStorage.setItem('googleAccessToken', this.connections.google.accessToken);
                        if (this.connections.google.refreshToken) {
                            localStorage.setItem('googleRefreshToken', this.connections.google.refreshToken);
                        }
                        localStorage.setItem('googleAdAccounts', JSON.stringify(this.connections.google.adAccounts));
                    }
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
            this.connections.google = {
                connected: true,
                accessToken: accessToken,
                refreshToken: refreshToken,
                adAccounts: adAccounts,
                lastUpdate: new Date().toISOString()
            };

            await this.saveToFirestore();
            
            console.log('✅ [ConnectionService] Conexão Google salva com sucesso');
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
            
            await updateDoc(userRef, {
                connections: this.connections,
                updatedAt: new Date().toISOString()
            });
            
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
        return {
            meta: {
                connected: this.connections.meta.connected,
                accountsCount: Object.keys(this.connections.meta.adAccounts || {}).length,
                lastUpdate: this.connections.meta.lastUpdate
            },
            google: {
                connected: this.connections.google.connected,
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

