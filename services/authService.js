// Serviço de Autenticação
import { auth, db } from '../config/firebase.js';
import { 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc,
    updateDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.initAuthListener();
    }

    // Listener de estado de autenticação
    initAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log('✅ Usuário autenticado:', user.email);
                // Buscar dados do usuário no Firestore
                const userData = await this.getUserData(user.uid);
                this.currentUser = { ...user, ...userData };
                
                // Atualizar último login
                await this.updateLastLogin(user.uid);
            } else {
                console.log('⚠️ Usuário não autenticado');
                this.currentUser = null;
            }
        });
    }

    // Login com email e senha
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('✅ Login realizado com sucesso!', user.email);
            
            // Buscar dados completos do usuário
            const userData = await this.getUserData(user.uid);
            
            // Verificar se conta está ativa
            if (!userData.isActive) {
                await this.logout();
                throw new Error('Conta desativada. Entre em contato com o administrador.');
            }
            
            return { success: true, user: userData };
        } catch (error) {
            console.error('❌ Erro no login:', error);
            
            let errorMessage = 'Erro ao fazer login. Tente novamente.';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Usuário desabilitado.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Usuário não encontrado.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Senha incorreta.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Email ou senha incorretos.';
                    break;
            }
            
            return { success: false, error: errorMessage };
        }
    }

    // Criar novo usuário (via convite)
    async createUser(email, password, userData) {
        try {
            // Criar usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('✅ Usuário criado no Firebase Auth:', user.email);
            
            // Criar documento do usuário no Firestore
            await setDoc(doc(db, 'users', user.uid), {
                name: userData.name,
                email: email,
                profilePhoto: userData.profilePhoto || null,
                role: 'user',
                isActive: true,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            
            console.log('✅ Documento do usuário criado no Firestore');
            
            return { success: true, user };
        } catch (error) {
            console.error('❌ Erro ao criar usuário:', error);
            
            let errorMessage = 'Erro ao criar conta. Tente novamente.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Este email já está em uso.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
                    break;
            }
            
            return { success: false, error: errorMessage };
        }
    }

    // Logout
    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            console.log('✅ Logout realizado com sucesso');
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao fazer logout:', error);
            return { success: false, error: 'Erro ao fazer logout' };
        }
    }

    // Verificar se usuário está autenticado
    isAuthenticated() {
        return auth.currentUser !== null;
    }

    // Buscar dados do usuário no Firestore
    async getUserData(uid) {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            
            if (userDoc.exists()) {
                return { uid, ...userDoc.data() };
            } else {
                console.warn('⚠️ Documento do usuário não encontrado no Firestore');
                return null;
            }
        } catch (error) {
            console.error('❌ Erro ao buscar dados do usuário:', error);
            return null;
        }
    }

    // Atualizar último login
    async updateLastLogin(uid) {
        try {
            await updateDoc(doc(db, 'users', uid), {
                lastLogin: serverTimestamp()
            });
        } catch (error) {
            console.error('❌ Erro ao atualizar último login:', error);
        }
    }

    // Obter usuário atual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar se é admin
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    // Proteger rota (middleware)
    requireAuth(redirectTo = '/login.html') {
        if (!this.isAuthenticated()) {
            console.warn('⚠️ Acesso negado - redirecionando para login');
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    // Proteger rota admin
    requireAdmin(redirectTo = '/dashboard.html') {
        if (!this.isAdmin()) {
            console.warn('⚠️ Acesso negado - requer privilégios de admin');
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }
}

// Exportar instância única (singleton)
export const authService = new AuthService();

