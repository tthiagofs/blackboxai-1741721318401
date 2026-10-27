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
     * Salva com segurança no documento do próprio usuário (users/UID) onde a permissão é garantida
     */
    static async saveUserAlert(alertData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            const alertId = alertData.id || `alert_${Date.now()}`;
            const alertPayload = {
                id: alertId,
                userId: user.uid,
                userEmail: user.email || '',
                managerName: alertData.managerName || user.displayName || 'Gestor',
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
                metaToken: alertData.metaToken || '',
                googleToken: alertData.googleToken || '',
                lastSentKey: alertData.lastSentKey || '',
                updatedAt: new Date().toISOString()
            };

            // 1. Salvar no documento do próprio usuário (users/UID.whatsappAlerts)
            // Essa coleção tem permissão 'allow write, update' garantida para o próprio usuário autenticado
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            let currentAlerts = userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts) 
                ? userSnap.data().whatsappAlerts 
                : [];

            if (alertData.id) {
                currentAlerts = currentAlerts.map(a => a.id === alertData.id ? alertPayload : a);
            } else {
                alertPayload.createdAt = new Date().toISOString();
                currentAlerts.push(alertPayload);
            }

            await setDoc(userRef, { whatsappAlerts: currentAlerts }, { merge: true });

            // 2. Tentar salvar também na coleção whatsapp_alerts (caso as regras estejam liberadas)
            try {
                if (alertData.id) {
                    const alertRef = doc(db, 'whatsapp_alerts', alertData.id);
                    await setDoc(alertRef, { ...alertPayload, updatedAt: serverTimestamp() }, { merge: true });
                } else {
                    const colRef = doc(db, 'whatsapp_alerts', alertId);
                    await setDoc(colRef, { ...alertPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                }
            } catch (permErr) {
                // Silencioso se a coleção whatsapp_alerts ainda não tiver permissão publicada
                console.warn('ℹ️ Alerta salvo em users/UID (whatsapp_alerts coleção restrita)');
            }

            return { success: true, id: alertId };
        } catch (error) {
            console.error('❌ Erro ao salvar alerta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Listar alertas cadastrados do usuário atual
     */
    static async getUserAlerts() {
        try {
            const user = auth.currentUser;
            if (!user) return [];

            // 1. Tentar ler do documento do usuário (garantido sem erro de permissão)
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts)) {
                    return userSnap.data().whatsappAlerts;
                }
            } catch (e) {
                console.warn('Tentando ler coleção whatsapp_alerts...', e);
            }

            // 2. Fallback para coleção raiz whatsapp_alerts
            try {
                const q = query(collection(db, 'whatsapp_alerts'), where('userId', '==', user.uid));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (err) {
                return [];
            }
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
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Atualizar em users/UID.whatsappAlerts
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts)) {
                const updated = userSnap.data().whatsappAlerts.map(a => 
                    a.id === alertId ? { ...a, active, updatedAt: new Date().toISOString() } : a
                );
                await setDoc(userRef, { whatsappAlerts: updated }, { merge: true });
            }

            // 2. Atualizar também em whatsapp_alerts se possível
            try {
                const docRef = doc(db, 'whatsapp_alerts', alertId);
                await updateDoc(docRef, { active, updatedAt: serverTimestamp() });
            } catch (e) {
                // Silencioso
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao alternar status do alerta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deletar alerta
     */
    static async deleteUserAlert(alertId) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Remover de users/UID.whatsappAlerts
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && Array.isArray(userSnap.data()?.whatsappAlerts)) {
                const filtered = userSnap.data().whatsappAlerts.filter(a => a.id !== alertId);
                await setDoc(userRef, { whatsappAlerts: filtered }, { merge: true });
            }

            // 2. Remover também de whatsapp_alerts se possível
            try {
                await deleteDoc(doc(db, 'whatsapp_alerts', alertId));
            } catch (e) {
                // Silencioso
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar alerta:', error);
            return { success: false, error: error.message };
        }
    }
}
