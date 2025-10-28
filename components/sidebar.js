// Componente de Sidebar Unificado
// Este arquivo gerencia a sidebar em todas as páginas do app

import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { db } from '../config/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let isAdmin = false;

// Inicializar sidebar
export async function initSidebar(currentPage = '') {
  // Esperar autenticação
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await checkAdminStatus();
      renderSidebar(currentPage);
    }
  });
}

// Verificar se usuário é admin
async function checkAdminStatus() {
  if (!currentUser) return false;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      isAdmin = userData.role === 'admin';
      return isAdmin;
    }
  } catch (error) {
    console.error('Erro ao verificar status admin:', error);
  }
  
  return false;
}

// Renderizar sidebar
function renderSidebar(currentPage) {
  const sidebarContainer = document.getElementById('app-sidebar');
  if (!sidebarContainer) return;

  // Verificar se há projeto selecionado
  const currentProject = localStorage.getItem('currentProject');
  const showSubMenus = !!currentProject;
  
  // Verificar se está em uma das sub-páginas da Tela Inicial
  const isHomeSection = ['home', 'projeto', 'relatorios', 'unidades'].includes(currentPage);

  const sidebarHTML = `
    <aside class="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      <!-- Logo -->
      <div class="p-6 border-b border-gray-200">
        <h1 class="text-xl font-bold text-gray-800">Relatórios</h1>
      </div>

      <!-- Menu de Navegação -->
      <nav class="flex-1 px-3 py-2">
        <!-- Tela Inicial (Principal) -->
        <a href="${showSubMenus ? '/projeto.html' : '/home.html'}" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${isHomeSection ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-home mr-3 text-sm"></i>
          <span class="text-sm">Tela Inicial</span>
        </a>
        
        ${showSubMenus ? `
        <!-- Sub-aba: Relatórios -->
        <a href="/projeto.html" class="flex items-center px-3 py-2 mb-1 ml-6 border-l-4 ${currentPage === 'projeto' || currentPage === 'relatorios' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50'} transition-all">
          <i class="fas fa-file-alt mr-2 text-xs"></i>
          <span class="text-xs">Relatórios</span>
        </a>
        
        <!-- Sub-aba: Unidades -->
        <a href="/unidades.html" class="flex items-center px-3 py-2 mb-1 ml-6 border-l-4 ${currentPage === 'unidades' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50'} transition-all">
          <i class="fas fa-building mr-2 text-xs"></i>
          <span class="text-xs">Unidades</span>
        </a>
        ` : ''}
        
        <a href="/dashboard.html" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${currentPage === 'dashboard' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-chart-line mr-3 text-sm"></i>
          <span class="text-sm">Dashboard</span>
        </a>
        
        <a href="/conexoes.html" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${currentPage === 'conexoes' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-plug mr-3 text-sm"></i>
          <span class="text-sm">Conexões</span>
        </a>
        
        <a href="/minha-conta.html" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${currentPage === 'minha-conta' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-user mr-3 text-sm"></i>
          <span class="text-sm">Minha Conta</span>
        </a>
        
        ${isAdmin ? `
        <a href="/usuarios.html" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${currentPage === 'usuarios' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-users-cog mr-3 text-sm"></i>
          <span class="text-sm">Usuários</span>
        </a>
        ` : ''}
        
        ${isAdmin ? `
        <a href="/analises-predefinidas.html" class="flex items-center px-3 py-2.5 mb-1 border-l-4 ${currentPage === 'analises' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-transparent text-gray-700 hover:bg-gray-50'} transition-all">
          <i class="fas fa-comments mr-3 text-sm"></i>
          <span class="text-sm">Análises Pré-Definidas</span>
        </a>
        ` : ''}
      </nav>

      <!-- Botão Voltar e Logout -->
      <div class="p-3 border-t border-gray-200 space-y-2">
        <button onclick="history.back()" class="w-full flex items-center px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
          <i class="fas fa-arrow-left mr-3 text-sm"></i>
          <span class="text-sm">Voltar</span>
        </button>
        
        <button id="logoutBtn" class="w-full flex items-center px-3 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all">
          <i class="fas fa-sign-out-alt mr-3 text-sm"></i>
          <span class="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  `;

  sidebarContainer.innerHTML = sidebarHTML;

  // Adicionar event listener para logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// Função de logout
async function handleLogout() {
  try {
    await auth.signOut();
    localStorage.clear();
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    alert('Erro ao sair. Tente novamente.');
  }
}

// Atualizar sidebar quando projeto muda
export function updateSidebarOnProjectChange() {
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'home';
  renderSidebar(currentPage);
}

