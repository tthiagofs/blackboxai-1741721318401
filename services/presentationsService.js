/**
 * Serviço para gerenciar apresentações salvas no Firestore
 */

import { db, auth } from '../config/firebase.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    deleteDoc,
    updateDoc,
    doc, 
    query, 
    orderBy,
    where 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class PresentationsService {
    /**
     * Salva uma apresentação no projeto
     */
    async savePresentation(projectId, presentationData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('💾 Salvando apresentação...', presentationData);

            const presentationRef = await addDoc(
                collection(db, 'projects', projectId, 'presentations'),
                {
                    ...presentationData,
                    createdAt: new Date().toISOString(),
                    createdBy: user.uid
                }
            );

            console.log('✅ Apresentação salva com ID:', presentationRef.id);
            return { success: true, id: presentationRef.id };

        } catch (error) {
            console.error('❌ Erro ao salvar apresentação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Lista todas as apresentações de um projeto
     */
    async listPresentations(projectId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('📋 Listando apresentações do projeto:', projectId);

            const presentationsQuery = query(
                collection(db, 'projects', projectId, 'presentations'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(presentationsQuery);
            
            const presentations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Apresentações carregadas:', presentations.length);
            return presentations;

        } catch (error) {
            console.error('❌ Erro ao listar apresentações:', error);
            throw error;
        }
    }

    /**
     * Deleta uma apresentação
     */
    async deletePresentation(projectId, presentationId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('🗑️ Deletando apresentação:', presentationId);

            await deleteDoc(doc(db, 'projects', projectId, 'presentations', presentationId));

            console.log('✅ Apresentação deletada com sucesso');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao deletar apresentação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Busca uma apresentação específica
     */
    async getPresentation(projectId, presentationId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const presentationDoc = await getDoc(doc(db, 'projects', projectId, 'presentations', presentationId));
            
            if (!presentationDoc.exists()) {
                throw new Error('Apresentação não encontrada');
            }

            return {
                id: presentationDoc.id,
                ...presentationDoc.data()
            };

        } catch (error) {
            console.error('❌ Erro ao buscar apresentação:', error);
            throw error;
        }
    }

    /**
     * Atualiza uma apresentação
     */
    async updatePresentation(projectId, presentationId, updateData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            console.log('💾 Atualizando apresentação:', presentationId);

            const presentationRef = doc(db, 'projects', projectId, 'presentations', presentationId);
            await updateDoc(presentationRef, {
                ...updateData,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Apresentação atualizada com sucesso');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao atualizar apresentação:', error);
            throw error;
        }
    }
}

export const presentationsService = new PresentationsService();

