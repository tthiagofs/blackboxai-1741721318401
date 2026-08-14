// Serviço de Projetos
import { db } from '../config/firebase.js';
import { auth } from '../config/firebase.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class ProjectsService {
    constructor() {
        this.collectionName = 'projects';
    }

    // Criar novo projeto
    async createProject(projectName) {
        try {
            const user = auth.currentUser;
            
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            const projectData = {
                name: projectName,
                ownerId: user.uid, // Alterado de userId para ownerId
                userId: user.uid,  // Manter por compatibilidade
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                settings: {},
                isActive: true
            };

            const docRef = await addDoc(collection(db, this.collectionName), projectData);
            
            console.log('✅ Projeto criado com sucesso! ID:', docRef.id);
            
            return { 
                success: true, 
                projectId: docRef.id,
                project: { id: docRef.id, ...projectData }
            };
        } catch (error) {
            console.error('❌ Erro ao criar projeto:', error);
            return { success: false, error: error.message };
        }
    }

    // Listar projetos do usuário
    async listProjects() {
        try {
            const user = auth.currentUser;
            
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Versão simplificada SEM índice (temporária até o índice ficar pronto)
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', user.uid)
            );

            const querySnapshot = await getDocs(q);
            const projects = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Filtrar manualmente por isActive e ordenar
                if (data.isActive === true) {
                    projects.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            // Ordenar manualmente por createdAt (mais recentes primeiro)
            projects.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            });

            console.log(`✅ ${projects.length} projeto(s) encontrado(s)`);
            
            return projects;
        } catch (error) {
            console.error('❌ Erro ao listar projetos:', error);
            throw error;
        }
    }

    // Buscar projeto por ID
    async getProject(projectId) {
        try {
            const docRef = doc(db, this.collectionName, projectId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const project = { id: docSnap.id, ...docSnap.data() };
                
                // Verificar se o projeto pertence ao usuário atual
                const user = auth.currentUser;
                if (user && project.userId !== user.uid) {
                    throw new Error('Você não tem permissão para acessar este projeto');
                }
                
                return project;
            } else {
                throw new Error('Projeto não encontrado');
            }
        } catch (error) {
            console.error('❌ Erro ao buscar projeto:', error);
            throw error;
        }
    }

    // Atualizar projeto
    async updateProject(projectId, updates) {
        try {
            const user = auth.currentUser;
            
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Verificar se o projeto pertence ao usuário
            const project = await this.getProject(projectId);
            
            if (project.userId !== user.uid) {
                throw new Error('Você não tem permissão para editar este projeto');
            }

            const docRef = doc(db, this.collectionName, projectId);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });

            console.log('✅ Projeto atualizado com sucesso!');
            
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao atualizar projeto:', error);
            return { success: false, error: error.message };
        }
    }

    // Deletar projeto (soft delete)
    async deleteProject(projectId) {
        try {
            const user = auth.currentUser;
            
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Verificar se o projeto pertence ao usuário
            const project = await this.getProject(projectId);
            
            if (project.userId !== user.uid) {
                throw new Error('Você não tem permissão para deletar este projeto');
            }

            const docRef = doc(db, this.collectionName, projectId);
            await updateDoc(docRef, {
                isActive: false,
                updatedAt: serverTimestamp()
            });

            console.log('✅ Projeto deletado com sucesso!');
            
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar projeto:', error);
            return { success: false, error: error.message };
        }
    }

    // Deletar projeto permanentemente (apenas admin)
    async deleteProjectPermanently(projectId) {
        try {
            const docRef = doc(db, this.collectionName, projectId);
            await deleteDoc(docRef);
            
            console.log('✅ Projeto deletado permanentemente!');
            
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar projeto permanentemente:', error);
            return { success: false, error: error.message };
        }
    }
}

// Exportar instância única (singleton)
export const projectsService = new ProjectsService();

