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
                provider: 'z-api', // 'z-api' ou 'evolution'
                instanceId: '',
                token: '',
                clientToken: '',
                serverUrl: 'https://api.z-api.io',
                status: 'disconnected', // 'connected', 'disconnected', 'connecting'
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
     * Buscar QR Code ou status da conexão via backend
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
     */
    static async saveUserAlert(alertData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Usuário não autenticado');

            const payload = {
                userId: user.uid,
                userEmail: user.email,
                phone: alertData.phone.replace(/\D/g, ''),
                projectId: alertData.projectId,
                projectName: alertData.projectName,
                active: alertData.active ?? true,
                schedules: alertData.schedules || ['08:00'],
                modules: {
                    dailyReport: alertData.modules?.dailyReport ?? true,
                    balanceForecast: alertData.modules?.balanceForecast ?? true,
                    topAd: alertData.modules?.topAd ?? true,
                    statusAlerts: alertData.modules?.statusAlerts ?? false
                },
                selectedUnits: alertData.selectedUnits || [],
                updatedAt: serverTimestamp()
            };

            if (alertData.id) {
                const docRef = doc(db, 'whatsapp_alerts', alertData.id);
                await updateDoc(docRef, payload);
                return { success: true, id: alertData.id };
            } else {
                payload.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'whatsapp_alerts'), payload);
                return { success: true, id: docRef.id };
            }
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

            const q = query(collection(db, 'whatsapp_alerts'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Erro ao carregar alertas do usuário:', error);
            return [];
        }
    }

    /**
     * Alternar status de ativação do alerta (ativo/inativo)
     */
    static async toggleUserAlertStatus(alertId, active) {
        try {
            const docRef = doc(db, 'whatsapp_alerts', alertId);
            await updateDoc(docRef, {
                active,
                updatedAt: serverTimestamp()
            });
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
            await deleteDoc(doc(db, 'whatsapp_alerts', alertId));
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar alerta:', error);
            return { success: false, error: error.message };
        }
    }
}
