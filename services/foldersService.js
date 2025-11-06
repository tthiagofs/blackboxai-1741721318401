/**
 * Serviço para gerenciar pastas de apresentações
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
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class FoldersService {
    /**
     * Criar uma nova pasta
     */
    async createFolder(projectId, folderData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const folderRef = await addDoc(
                collection(db, 'projects', projectId, 'folders'),
                {
                    name: folderData.name,
                    createdAt: new Date().toISOString(),
                    createdBy: user.uid,
                    presentationIds: [] // Array de IDs de apresentações
                }
            );

            console.log('✅ Pasta criada com ID:', folderRef.id);
            return { success: true, id: folderRef.id };

        } catch (error) {
            console.error('❌ Erro ao criar pasta:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Listar todas as pastas de um projeto
     */
    async listFolders(projectId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const foldersQuery = query(
                collection(db, 'projects', projectId, 'folders'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(foldersQuery);
            
            const folders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Pastas carregadas:', folders.length);
            return folders;

        } catch (error) {
            console.error('❌ Erro ao listar pastas:', error);
            throw error;
        }
    }

    /**
     * Mover apresentação para pasta
     */
    async movePresentationToFolder(projectId, folderId, presentationId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const folderRef = doc(db, 'projects', projectId, 'folders', folderId);
            
            await updateDoc(folderRef, {
                presentationIds: arrayUnion(presentationId),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Apresentação movida para pasta');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao mover apresentação:', error);
            throw error;
        }
    }

    /**
     * Remover apresentação de pasta
     */
    async removePresentationFromFolder(projectId, folderId, presentationId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const folderRef = doc(db, 'projects', projectId, 'folders', folderId);
            
            await updateDoc(folderRef, {
                presentationIds: arrayRemove(presentationId),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Apresentação removida da pasta');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao remover apresentação:', error);
            throw error;
        }
    }

    /**
     * Deletar pasta
     */
    async deleteFolder(projectId, folderId) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            await deleteDoc(doc(db, 'projects', projectId, 'folders', folderId));

            console.log('✅ Pasta deletada com sucesso');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao deletar pasta:', error);
            throw error;
        }
    }

    /**
     * Renomear pasta
     */
    async renameFolder(projectId, folderId, newName) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const folderRef = doc(db, 'projects', projectId, 'folders', folderId);
            await updateDoc(folderRef, {
                name: newName,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Pasta renomeada com sucesso');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao renomear pasta:', error);
            throw error;
        }
    }

    /**
     * Atualizar lista de IDs de apresentações da pasta (limpar IDs inválidos)
     */
    async updateFolderPresentationIds(projectId, folderId, presentationIds) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const folderRef = doc(db, 'projects', projectId, 'folders', folderId);
            await updateDoc(folderRef, {
                presentationIds: presentationIds,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ IDs da pasta atualizados');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao atualizar IDs da pasta:', error);
            throw error;
        }
    }
}

export const foldersService = new FoldersService();

