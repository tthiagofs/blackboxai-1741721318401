/**
 * Serviço de Conexão e Disparos WhatsApp
 * Suporta Z-API, Evolution API ou endpoints genéricos de WhatsApp Gateway
 */

import { db, auth } from '../config/firebase.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const CONFIG_DOC = 'global_gateway';

export class WhatsAppService {
    /**
     * Obter a configuração do gateway do robô WhatsApp (Apenas Admin pode editar)
     */
    static async getGatewayConfig() {
        try {
            const configRef = doc(db, 'whatsapp_config', CONFIG_DOC);
            const docSnap = await getDoc(configRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return {
                provider: 'z-api',
                instanceId: '',
                token: '',
                clientToken: '',
                serverUrl: 'https://api.z-api.io',
                status: 'disconnected',
                senderPhone: '',
                lastChecked: null
            };
        } catch (error) {
            console.error('❌ Erro ao buscar configuração do WhatsApp:', error);
            return null;
        }
    }

    /**
     * Salvar a configuração do gateway (Apenas Admin)
     */
    static async saveGatewayConfig(config) {
        try {
            const configRef = doc(db, 'whatsapp_config', CONFIG_DOC);
            await setDoc(configRef, {
                ...config,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao salvar configuração do WhatsApp:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar mensagem de teste ou alerta pelo backend
     */
    static async sendMessage({ phone, message }) {
        try {
            const response = await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Erro ao chamar /api/send-whatsapp:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Buscar status da conexão via backend
     */
    static async checkConnectionStatus() {
        try {
            const response = await fetch('/api/whatsapp-status');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Erro ao verificar status da conexão:', error);
            return { connected: false, error: error.message };
        }
    }

    /**
     * Salvar configuração de alerta do gestor
     * Salva com segurança no documento do próprio usuário (users/UID) e na coleção whatsapp_alerts
     */
    static async saveUserAlert(alertData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : {};
            const userConn = userData.connections || {};

            // Resolver nome real do gestor logado
            let resolvedManagerName = alertData.managerName || userData.name || userData.fullName || userData.displayName || user.displayName || '';
            if (!resolvedManagerName || (resolvedManagerName === 'Thiago Felipe' && user.email && !user.email.toLowerCase().includes('thiago'))) {
                const rawName = userData.name || userData.fullName || user.displayName || (user.email ? user.email.split('@')[0] : 'Gestor');
                const parts = rawName.trim().split(/\s+/);
                resolvedManagerName = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
            }

            // Garantir que metaToken, googleToken e googleRefreshToken estejam preenchidos
            const finalMetaToken = alertData.metaToken || userConn.meta?.accessToken || localStorage.getItem('fbAccessToken') || '';
            const finalGoogleToken = alertData.googleToken || userConn.google?.accessToken || localStorage.getItem('google_ads_access_token') || localStorage.getItem('googleAccessToken') || '';
            const finalGoogleRefreshToken = alertData.googleRefreshToken || userConn.google?.refreshToken || localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token') || '';

            const alertId = alertData.id || `alert_${Date.now()}`;
            const alertPayload = {
                id: alertId,
                userId: user.uid,
                userEmail: user.email || '',
                managerName: resolvedManagerName || 'Gestor',
                phone: (alertData.phone || '').replace(/\D/g, ''),
                projectId: alertData.projectId || '',
                projectName: alertData.projectName || '',
                active: alertData.active ?? true,
                schedules: alertData.schedules || ['08:00'],
                reportPeriod: alertData.reportPeriod || 'yesterday',
                customDays: alertData.customDays ? parseInt(alertData.customDays, 10) : 1,
                includeToday: !!alertData.includeToday,
                startActivationDate: alertData.startActivationDate || null,
                optimizationRules: alertData.optimizationRules || null,
                blockOrder: alertData.blockOrder || null,
                daysOfWeek: alertData.daysOfWeek || [1, 2, 3, 4, 5],
                modules: alertData.modules || {},
                selectedUnits: alertData.selectedUnits || [],
                unitsSnapshot: alertData.unitsSnapshot || [],
                metaToken: finalMetaToken,
                googleToken: finalGoogleToken,
                googleRefreshToken: finalGoogleRefreshToken,
                lastSentKey: alertData.lastSentKey || '',
                updatedAt: new Date().toISOString()
            };

            // 1. Salvar no documento do próprio usuário (users/UID.whatsappAlerts)
            let currentAlerts = Array.isArray(userData.whatsappAlerts) 
                ? userData.whatsappAlerts.filter(a => a && (!a.userId || a.userId === user.uid))
                : [];

            if (alertData.id) {
                const exists = currentAlerts.some(a => String(a.id) === String(alertData.id));
                if (exists) {
                    currentAlerts = currentAlerts.map(a => String(a.id) === String(alertData.id) ? alertPayload : a);
                } else {
                    currentAlerts.push(alertPayload);
                }
            } else {
                alertPayload.createdAt = new Date().toISOString();
                currentAlerts.push(alertPayload);
            }

            await setDoc(userRef, { whatsappAlerts: currentAlerts }, { merge: true });

            // 2. Salvar na coleção whatsapp_alerts e atualizar doc espelho de tokens
            try {
                if (alertData.id) {
                    const alertRef = doc(db, 'whatsapp_alerts', String(alertData.id));
                    await setDoc(alertRef, { ...alertPayload, updatedAt: serverTimestamp() }, { merge: true });
                } else {
                    const colRef = doc(db, 'whatsapp_alerts', String(alertId));
                    await setDoc(colRef, { ...alertPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                }

                if (finalMetaToken || finalGoogleToken || finalGoogleRefreshToken) {
                    const tokenDocRef = doc(db, 'whatsapp_alerts', `_tokens_${user.uid}`);
                    await setDoc(tokenDocRef, {
                        isTokenStore: true,
                        active: false,
                        userId: user.uid,
                        userEmail: user.email || '',
                        metaToken: finalMetaToken,
                        googleToken: finalGoogleToken,
                        googleRefreshToken: finalGoogleRefreshToken,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
            } catch (permErr) {
                console.warn('ℹ️ Alerta salvo em users/UID (whatsapp_alerts coleção restrita)');
            }

            return { success: true, id: alertId };
        } catch (error) {
            console.error('❌ Erro ao salvar alerta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Listar alertas cadastrados APENAS do usuário autenticado atual (isolamento por conta)
     * Cada gestor tem seus próprios envios programados (limite individual de 3 ativos)
     */
    static async getUserAlerts() {
        try {
            const user = auth.currentUser;
            if (!user) return [];

            const alertsMap = new Map();

            // 1. Buscar de users/UID primeiro (também obtemos nome e tokens para auto-reparo)
            let userData = {};
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    userData = userSnap.data() || {};
                    const userAlerts = userData.whatsappAlerts;
                    if (Array.isArray(userAlerts)) {
                        userAlerts.forEach(a => {
                            if (!a || a.isTokenStore) return;
                            if (a.userId && a.userId !== user.uid) return;
                            const id = a.id ? String(a.id) : null;
                            if (id && !id.startsWith('_tokens_')) {
                                alertsMap.set(id, { ...a, id, userId: user.uid });
                            }
                        });
                    }
                }
            } catch (errUser) {
                console.warn('⚠️ Falha ao ler users/UID.whatsappAlerts:', errUser);
            }

            // 2. Buscar da coleção raiz whatsapp_alerts filtrando SEMPRE por userId == user.uid
            try {
                const colRef = collection(db, 'whatsapp_alerts');
                const q = query(colRef, where('userId', '==', user.uid));
                const snapshot = await getDocs(q);

                if (snapshot && !snapshot.empty) {
                    snapshot.docs.forEach(d => {
                        if (d.id.startsWith('_tokens_')) return;
                        const data = d.data();
                        if (data.isTokenStore) return;
                        if (data.userId && data.userId !== user.uid) return;
                        const id = String(data.id || d.id);
                        if (alertsMap.has(id)) {
                            alertsMap.set(id, { ...alertsMap.get(id), ...data, id });
                        } else {
                            alertsMap.set(id, { ...data, id });
                        }
                    });
                }
            } catch (errCol) {
                console.warn('⚠️ Falha ao ler coleção whatsapp_alerts:', errCol);
            }

            // 3. Auto-reparo de managerName legado e sincronização de googleRefreshToken nos alertas do usuário
            const realNameRaw = userData.name || userData.fullName || userData.displayName || user.displayName || '';
            const realNameParts = realNameRaw.trim().split(/\s+/);
            const cleanUserName = realNameParts.length > 1 ? `${realNameParts[0]} ${realNameParts[1]}` : realNameParts[0];
            const isThiagoAccount = user.email && user.email.toLowerCase().includes('thiago');
            const userGoogleRt = userData.connections?.google?.refreshToken || localStorage.getItem('googleRefreshToken') || localStorage.getItem('google_ads_refresh_token') || '';
            const userGoogleTok = userData.connections?.google?.accessToken || localStorage.getItem('google_ads_access_token') || '';
            const userMetaTok = userData.connections?.meta?.accessToken || localStorage.getItem('fbAccessToken') || '';

            const alerts = Array.from(alertsMap.values()).map(alertItem => {
                let needsPatch = false;
                const patchFields = {};

                if (!isThiagoAccount && alertItem.managerName === 'Thiago Felipe' && cleanUserName) {
                    alertItem.managerName = cleanUserName;
                    patchFields.managerName = cleanUserName;
                    needsPatch = true;
                }
                if (userGoogleRt && !alertItem.googleRefreshToken) {
                    alertItem.googleRefreshToken = userGoogleRt;
                    patchFields.googleRefreshToken = userGoogleRt;
                    needsPatch = true;
                }
                if (userGoogleTok && !alertItem.googleToken) {
                    alertItem.googleToken = userGoogleTok;
                    patchFields.googleToken = userGoogleTok;
                    needsPatch = true;
                }
                if (userMetaTok && !alertItem.metaToken) {
                    alertItem.metaToken = userMetaTok;
                    patchFields.metaToken = userMetaTok;
                    needsPatch = true;
                }

                if (needsPatch && alertItem.id) {
                    setDoc(doc(db, 'whatsapp_alerts', String(alertItem.id)), patchFields, { merge: true }).catch(() => {});
                }

                return alertItem;
            });

            return alerts;
        } catch (error) {
            console.error('❌ Erro ao carregar alertas do usuário:', error);
            return [];
        }
    }

    /**
     * Alternar status de ativação do alerta (ativo/pausado)
     */
    static async toggleUserAlertStatus(alertId, active) {
        try {
            if (!alertId) return { success: false, error: 'ID inválido' };
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Atualizar em whatsapp_alerts
            try {
                const docRef = doc(db, 'whatsapp_alerts', String(alertId));
                await setDoc(docRef, { active: !!active, updatedAt: serverTimestamp() }, { merge: true });
            } catch (e) {
                console.warn('⚠️ Erro ao atualizar status em whatsapp_alerts:', e.message);
            }

            // 2. Atualizar em users/UID.whatsappAlerts
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts)) {
                    const updated = userSnap.data().whatsappAlerts.map(a => 
                        (a && String(a.id) === String(alertId)) 
                            ? { ...a, active: !!active, updatedAt: new Date().toISOString() } 
                            : a
                    );
                    await setDoc(userRef, { whatsappAlerts: updated }, { merge: true });
                }
            } catch (e) {
                console.warn('⚠️ Erro ao atualizar status em users/UID:', e.message);
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao alternar status do alerta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deletar alerta de forma definitiva (apenas da conta do usuário atual)
     */
    static async deleteUserAlert(alertId) {
        try {
            if (!alertId) throw new Error('ID do alerta é obrigatório');
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            const idStr = String(alertId).trim();
            console.log(`🗑️ [deleteUserAlert] Excluindo alerta ${idStr}...`);

            // 1. Deletar da coleção whatsapp_alerts
            try {
                const alertDocRef = doc(db, 'whatsapp_alerts', idStr);
                await deleteDoc(alertDocRef);
                console.log(`✅ [deleteUserAlert] Removido de whatsapp_alerts doc: ${idStr}`);
            } catch (e) {
                console.warn('⚠️ Erro ao deletar doc whatsapp_alerts:', e.message);
            }

            // 2. Remover de users/UID.whatsappAlerts
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts)) {
                    const originalList = userSnap.data().whatsappAlerts;
                    const filtered = originalList.filter(a => a && a.id && String(a.id) !== idStr);
                    await setDoc(userRef, { whatsappAlerts: filtered }, { merge: true });
                    console.log(`✅ [deleteUserAlert] Removido de users/${user.uid}.whatsappAlerts`);
                }
            } catch (e) {
                console.warn('⚠️ Erro ao atualizar users/UID:', e.message);
            }

            return { success: true, deletedId: idStr };
        } catch (error) {
            console.error('❌ Erro ao deletar alerta:', error);
            return { success: false, error: error.message };
        }
    }
}
