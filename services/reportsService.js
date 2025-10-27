/**
 * Serviço para gerenciar relatórios salvos no Firestore
 */

import { db, auth } from '../config/firebase.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    deleteDoc, 
    doc, 
    updateDoc,
    query, 
    orderBy,
    where 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class ReportsService {
    /**
     * Salva um relatório no projeto
     */
    async saveReport(projectId, reportData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('💾 Salvando relatório...', reportData);

            const reportRef = await addDoc(
                collection(db, 'projects', projectId, 'reports'),
                {
                    ...reportData,
                    createdAt: new Date().toISOString(),
                    createdBy: user.uid
                }
            );

            console.log('✅ Relatório salvo com ID:', reportRef.id);
            
            // ⭐ Atualizar lastInvestment da unidade (se houver)
            if (reportData.selectedUnitId && reportData.totalInvestment) {
                try {
                    await updateDoc(
                        doc(db, 'projects', projectId, 'units', reportData.selectedUnitId),
                        {
                            lastInvestment: reportData.totalInvestment,
                            lastInvestmentUpdatedAt: new Date().toISOString()
                        }
                    );
                    console.log('✅ lastInvestment atualizado na unidade');
                } catch (updateError) {
                    console.warn('⚠️ Não foi possível atualizar lastInvestment:', updateError.message);
                }
            }
            
            return { success: true, id: reportRef.id };

        } catch (error) {
            console.error('❌ Erro ao salvar relatório:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Lista todos os relatórios de um projeto
     */
    async listReports(projectId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('📋 Listando relatórios do projeto:', projectId);

            const reportsQuery = query(
                collection(db, 'projects', projectId, 'reports'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(reportsQuery);
            
            const reports = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Relatórios carregados:', reports.length);
            return reports;

        } catch (error) {
            console.error('❌ Erro ao listar relatórios:', error);
            throw error;
        }
    }

    /**
     * Deleta um relatório
     */
    async deleteReport(projectId, reportId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('🗑️ Deletando relatório:', reportId);

            await deleteDoc(doc(db, 'projects', projectId, 'reports', reportId));

            console.log('✅ Relatório deletado com sucesso');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao deletar relatório:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Busca um relatório específico
     */
    async getReport(projectId, reportId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const reportDoc = await getDoc(doc(db, 'projects', projectId, 'reports', reportId));
            
            if (!reportDoc.exists()) {
                throw new Error('Relatório não encontrado');
            }

            return {
                id: reportDoc.id,
                ...reportDoc.data()
            };

        } catch (error) {
            console.error('❌ Erro ao buscar relatório:', error);
            throw error;
        }
    }
}

export const reportsService = new ReportsService();

