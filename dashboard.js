// dashboard.js - Lógica do Dashboard de Performance
import { auth, db } from './config/firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';

console.log('🚀 Dashboard inicializando...');

// ==================== VARIÁVEIS GLOBAIS ====================
let allUnits = [];
let selectedUnits = [];
let currentFilters = {
    projectId: null,
    period: 'last7Days',
    startDate: null,
    endDate: null,
    units: 'all'
};

let roiChart = null;
let investmentRevenueChart = null;

// ==================== AUTENTICAÇÃO ====================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn('⚠️ Usuário não autenticado - redirecionando para login');
        window.location.href = '/login.html';
        return;
    }

    console.log('✅ Usuário autenticado:', user.email);

    // Carregar info do usuário
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('userName').textContent = userData.name || 'Usuário';
            document.getElementById('userRole').textContent = userData.role === 'admin' ? 'Administrador' : 'Usuário';
            
            if (userData.role === 'admin') {
                document.getElementById('adminLink').classList.remove('hidden');
                document.getElementById('adminLink').href = '/usuarios.html';
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
    }

    // Inicializar dashboard
    await initDashboard();
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm('Deseja realmente sair?')) {
        await signOut(auth);
        window.location.href = '/login.html';
    }
});

// ==================== INICIALIZAÇÃO ====================
async function initDashboard() {
    console.log('🚀 Dashboard carregando...');
    
    await loadProjects();
    setupEventListeners();
    
    console.log('✅ Dashboard pronto!');
}

// ==================== CARREGAR PROJETOS ====================
async function loadProjects() {
    try {
        console.log('📂 Carregando projetos...');
        const projectFilter = document.getElementById('projectFilter');
        const projects = await projectsService.listProjects();
        
        console.log(`✅ ${projects.length} projetos encontrados:`, projects);
        
        projectFilter.innerHTML = '<option value="">Selecione um projeto</option>';
        
        if (projects.length === 0) {
            projectFilter.innerHTML = '<option value="">Nenhum projeto encontrado</option>';
            console.warn('⚠️ Nenhum projeto encontrado. Crie um projeto primeiro.');
            return;
        }
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectFilter.appendChild(option);
        });
        
        // Se tiver projeto no localStorage, selecionar automaticamente
        const savedProject = localStorage.getItem('currentProject');
        if (savedProject && projects.find(p => p.id === savedProject)) {
            console.log('🔄 Auto-selecionando projeto salvo:', savedProject);
            projectFilter.value = savedProject;
            currentFilters.projectId = savedProject;
            await loadUnitsForProject(savedProject);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar projetos:', error);
        const projectFilter = document.getElementById('projectFilter');
        projectFilter.innerHTML = '<option value="">Erro ao carregar projetos</option>';
        alert('Erro ao carregar projetos: ' + error.message);
    }
}

// ==================== CARREGAR UNIDADES ====================
async function loadUnitsForProject(projectId) {
    try {
        console.log('📋 Carregando unidades do projeto:', projectId);
        
        allUnits = await unitsService.listUnits(projectId);
        
        console.log(`✅ ${allUnits.length} unidades carregadas`);
        
        // Log detalhado das unidades
        allUnits.forEach((unit, index) => {
            const hasBudgetData = unit.budgetData && unit.budgetData.rawData;
            const dataCount = hasBudgetData ? unit.budgetData.rawData.length : 0;
            console.log(`   ${index + 1}. ${unit.name} - ${hasBudgetData ? `✅ ${dataCount} registros` : '❌ Sem planilha'}`);
        });
        
        // Atualizar lista de unidades específicas
        updateSpecificUnitsList();
        
    } catch (error) {
        console.error('❌ Erro ao carregar unidades:', error);
        alert('Erro ao carregar unidades');
    }
}

// ==================== ATUALIZAR LISTA DE UNIDADES ====================
function updateSpecificUnitsList() {
    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';
    
    allUnits.forEach(unit => {
        const checkbox = document.createElement('label');
        checkbox.className = 'flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer';
        checkbox.innerHTML = `
            <input type="checkbox" value="${unit.id}" class="unit-checkbox mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <span class="text-sm text-gray-700">${unit.name}</span>
        `;
        unitsList.appendChild(checkbox);
    });
}

// ==================== SETUP EVENT LISTENERS ====================
function setupEventListeners() {
    // Projeto selecionado
    document.getElementById('projectFilter').addEventListener('change', async (e) => {
        const projectId = e.target.value;
        currentFilters.projectId = projectId;
        
        if (projectId) {
            await loadUnitsForProject(projectId);
        } else {
            allUnits = [];
            updateSpecificUnitsList();
        }
    });
    
    // Período personalizado
    document.getElementById('periodFilter').addEventListener('change', (e) => {
        const customStart = document.getElementById('customDateStart');
        const customEnd = document.getElementById('customDateEnd');
        
        if (e.target.value === 'custom') {
            customStart.classList.remove('hidden');
            customEnd.classList.remove('hidden');
        } else {
            customStart.classList.add('hidden');
            customEnd.classList.add('hidden');
        }
        
        currentFilters.period = e.target.value;
    });
    
    // Unidades - mostrar/ocultar seleção específica
    document.getElementById('unitsFilter').addEventListener('change', (e) => {
        const specificSection = document.getElementById('specificUnitsSection');
        
        if (e.target.value === 'select') {
            specificSection.classList.remove('hidden');
        } else {
            specificSection.classList.add('hidden');
        }
        
        currentFilters.units = e.target.value;
    });
    
    // Aplicar filtros
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    
    // Resetar filtros
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    
    // Filtro de métrica de anúncios
    document.getElementById('adMetricFilter').addEventListener('change', () => {
        if (document.getElementById('dashboardContent').classList.contains('hidden')) return;
        loadBestAds();
    });
    
    // Filtro de conta de anúncios
    document.getElementById('adAccountFilter').addEventListener('change', () => {
        if (document.getElementById('dashboardContent').classList.contains('hidden')) return;
        loadBestAds();
    });
}

// ==================== APLICAR FILTROS ====================
async function applyFilters() {
    try {
        // Validar projeto
        if (!currentFilters.projectId) {
            alert('❌ Selecione um projeto');
            return;
        }
        
        // Validar período personalizado
        if (currentFilters.period === 'custom') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (!startDate || !endDate) {
                alert('❌ Selecione as datas de início e fim');
                return;
            }
            
            if (new Date(startDate) > new Date(endDate)) {
                alert('❌ A data de início não pode ser maior que a data de fim');
                return;
            }
            
            currentFilters.startDate = startDate;
            currentFilters.endDate = endDate;
        } else {
            // Calcular datas baseado no período
            const dates = calculatePeriodDates(currentFilters.period);
            currentFilters.startDate = dates.start;
            currentFilters.endDate = dates.end;
        }
        
        // Validar unidades selecionadas
        if (currentFilters.units === 'select') {
            const checkboxes = document.querySelectorAll('.unit-checkbox:checked');
            if (checkboxes.length === 0) {
                alert('❌ Selecione pelo menos uma unidade');
                return;
            }
            selectedUnits = Array.from(checkboxes).map(cb => cb.value);
        } else {
            selectedUnits = allUnits.map(u => u.id);
        }
        
        console.log('🎯 Aplicando filtros:', currentFilters);
        console.log('📋 Unidades selecionadas:', selectedUnits);
        
        // Mostrar loading
        showLoading();
        
        // Carregar dados
        await loadDashboardData();
        
    } catch (error) {
        console.error('❌ Erro ao aplicar filtros:', error);
        alert('Erro ao carregar dashboard: ' + error.message);
        hideLoading();
    }
}

// ==================== CALCULAR DATAS DO PERÍODO ====================
function calculatePeriodDates(period) {
    const now = new Date();
    let start, end;
    
    switch (period) {
        case 'last7Days':
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            end = new Date(now);
            break;
            
        case 'thisMonth':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
            
        case 'lastMonth':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
            
        case 'last3Months':
            start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
            
        case 'last6Months':
            start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
            
        case 'thisYear':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            break;
            
        default:
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            end = new Date(now);
    }
    
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

// ==================== CARREGAR DADOS DO DASHBOARD ====================
async function loadDashboardData() {
    try {
        console.log('📊 Carregando dados do dashboard...');
        
        // Processar dados de cada unidade
        const unitsData = await Promise.all(
            selectedUnits.map(async (unitId) => {
                const unit = allUnits.find(u => u.id === unitId);
                if (!unit) return null;
                
                const metrics = calculateUnitMetrics(unit);
                return {
                    id: unit.id,
                    name: unit.name,
                    ...metrics
                };
            })
        );
        
        // Filtrar unidades sem dados
        const validUnits = unitsData.filter(u => u !== null && u.investment > 0);
        
        console.log(`📊 Resumo do processamento:`);
        console.log(`   - Total de unidades selecionadas: ${selectedUnits.length}`);
        console.log(`   - Unidades com dados válidos: ${validUnits.length}`);
        console.log(`   - Unidades sem dados: ${selectedUnits.length - validUnits.length}`);
        
        if (validUnits.length === 0) {
            hideLoading();
            
            // Mostrar mensagem detalhada
            const emptyState = document.getElementById('emptyState');
            emptyState.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-exclamation-circle text-6xl text-yellow-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">Nenhum Dado Encontrado</h3>
                    <p class="text-gray-600 mb-4">As unidades selecionadas não possuem dados de planilha no período escolhido.</p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                        <p class="text-sm text-blue-900 mb-2"><strong>💡 Dica:</strong></p>
                        <ul class="text-sm text-blue-800 space-y-1">
                            <li>• Verifique se as unidades têm planilhas importadas</li>
                            <li>• Tente selecionar um período diferente</li>
                            <li>• Vá em "Unidades" → Selecione uma unidade → Importe a planilha</li>
                        </ul>
                    </div>
                </div>
            `;
            emptyState.classList.remove('hidden');
            return;
        }
        
        console.log(`✅ ${validUnits.length} unidades com dados válidos`);
        
        // Calcular totais
        const totals = calculateTotals(validUnits);
        
        // Atualizar UI
        updateSummaryCards(totals);
        updateTopBottomUnits(validUnits);
        updateCharts(validUnits);
        await loadBestAds();
        
        // Mostrar conteúdo
        hideLoading();
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        throw error;
    }
}

// ==================== CALCULAR MÉTRICAS DA UNIDADE ====================
function calculateUnitMetrics(unit) {
    console.log(`📊 Calculando métricas para unidade: ${unit.name}`);
    
    if (!unit.budgetData || !unit.budgetData.rawData) {
        console.warn(`⚠️ Unidade ${unit.name} não tem dados de planilha`);
        return {
            investment: 0,
            revenue: 0,
            leads: 0,
            roi: 0
        };
    }
    
    console.log(`   📋 Total de registros na planilha: ${unit.budgetData.rawData.length}`);
    
    // Filtrar dados pelo período
    const filteredData = unit.budgetData.rawData.filter(item => {
        const itemDate = item.date;
        return itemDate >= currentFilters.startDate && itemDate <= currentFilters.endDate;
    });
    
    console.log(`   📅 Registros no período (${currentFilters.startDate} a ${currentFilters.endDate}): ${filteredData.length}`);
    
    // Calcular métricas
    let investment = 0;
    let revenue = 0;
    let leads = 0;
    
    filteredData.forEach(item => {
        if (item.budgetCompleted === 'Sim') {
            investment += parseFloat(item.budgetValue) || 0;
            revenue += parseFloat(item.saleValue) || 0;
            leads++;
        }
    });
    
    // Calcular ROI
    const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : 0;
    
    console.log(`   💰 Investimento: R$ ${investment.toFixed(2)}`);
    console.log(`   💵 Faturamento: R$ ${revenue.toFixed(2)}`);
    console.log(`   📈 ROI: ${roi.toFixed(2)}%`);
    console.log(`   👥 Leads: ${leads}`);
    
    return {
        investment,
        revenue,
        leads,
        roi
    };
}

// ==================== CALCULAR TOTAIS ====================
function calculateTotals(unitsData) {
    const totals = {
        investment: 0,
        revenue: 0,
        leads: 0,
        roi: 0
    };
    
    unitsData.forEach(unit => {
        totals.investment += unit.investment;
        totals.revenue += unit.revenue;
        totals.leads += unit.leads;
    });
    
    // ROI médio
    totals.roi = totals.investment > 0 
        ? ((totals.revenue - totals.investment) / totals.investment) * 100 
        : 0;
    
    return totals;
}

// ==================== ATUALIZAR CARDS DE RESUMO ====================
function updateSummaryCards(totals) {
    document.getElementById('totalInvestment').textContent = formatCurrency(totals.investment);
    document.getElementById('totalRevenue').textContent = formatCurrency(totals.revenue);
    document.getElementById('averageROI').textContent = formatPercentage(totals.roi);
    document.getElementById('totalLeads').textContent = totals.leads;
    
    // TODO: Adicionar comparações com período anterior
    document.getElementById('investmentComparison').textContent = 'Comparação em desenvolvimento';
    document.getElementById('revenueComparison').textContent = 'Comparação em desenvolvimento';
    document.getElementById('roiComparison').textContent = 'Comparação em desenvolvimento';
    document.getElementById('leadsComparison').textContent = 'Comparação em desenvolvimento';
}

// ==================== ATUALIZAR TOP/BOTTOM UNIDADES ====================
function updateTopBottomUnits(unitsData) {
    // Ordenar por ROI
    const sortedByROI = [...unitsData].sort((a, b) => b.roi - a.roi);
    
    // Top 5
    const top5 = sortedByROI.slice(0, 5);
    const topContainer = document.getElementById('topUnits');
    topContainer.innerHTML = '';
    
    top5.forEach((unit, index) => {
        const item = createUnitRankItem(unit, index + 1, 'success');
        topContainer.appendChild(item);
    });
    
    // Bottom 5
    const bottom5 = sortedByROI.slice(-5).reverse();
    const bottomContainer = document.getElementById('bottomUnits');
    bottomContainer.innerHTML = '';
    
    bottom5.forEach((unit, index) => {
        const item = createUnitRankItem(unit, sortedByROI.length - index, 'warning');
        bottomContainer.appendChild(item);
    });
}

// ==================== CRIAR ITEM DE RANKING ====================
function createUnitRankItem(unit, rank, type) {
    const div = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    const rankColor = type === 'success' ? 'text-green-600' : 'text-red-600';
    
    div.className = `p-4 rounded-lg border ${colorClass}`;
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-2xl font-bold ${rankColor}">#${rank}</span>
                <div>
                    <p class="font-semibold text-gray-900">${unit.name}</p>
                    <p class="text-sm text-gray-600">
                        ${formatCurrency(unit.revenue)} / ${formatCurrency(unit.investment)}
                    </p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-2xl font-bold ${rankColor}">${formatPercentage(unit.roi)}</p>
                <p class="text-xs text-gray-500">${unit.leads} leads</p>
            </div>
        </div>
    `;
    
    return div;
}

// ==================== ATUALIZAR GRÁFICOS ====================
function updateCharts(unitsData) {
    // Limitar a 10 unidades para melhor visualização
    const top10 = [...unitsData].sort((a, b) => b.roi - a.roi).slice(0, 10);
    
    // Gráfico de ROI
    const roiCtx = document.getElementById('roiChart').getContext('2d');
    
    if (roiChart) {
        roiChart.destroy();
    }
    
    roiChart = new Chart(roiCtx, {
        type: 'bar',
        data: {
            labels: top10.map(u => u.name),
            datasets: [{
                label: 'ROI (%)',
                data: top10.map(u => u.roi.toFixed(2)),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico de Investimento vs Faturamento
    const invRevCtx = document.getElementById('investmentRevenueChart').getContext('2d');
    
    if (investmentRevenueChart) {
        investmentRevenueChart.destroy();
    }
    
    investmentRevenueChart = new Chart(invRevCtx, {
        type: 'bar',
        data: {
            labels: top10.map(u => u.name),
            datasets: [
                {
                    label: 'Investimento',
                    data: top10.map(u => u.investment),
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 2
                },
                {
                    label: 'Faturamento',
                    data: top10.map(u => u.revenue),
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// ==================== CARREGAR MELHORES ANÚNCIOS ====================
async function loadBestAds() {
    const bestAdsContainer = document.getElementById('bestAds');
    bestAdsContainer.innerHTML = `
        <div class="col-span-full text-center p-8 text-gray-500">
            <i class="fas fa-info-circle text-4xl mb-3"></i>
            <p>Funcionalidade de melhores anúncios em desenvolvimento</p>
            <p class="text-sm mt-2">Será integrada com as APIs do Meta Ads e Google Ads</p>
        </div>
    `;
    
    // TODO: Implementar integração com APIs
    // - Buscar anúncios do período
    // - Filtrar por métrica selecionada
    // - Filtrar por conta selecionada
    // - Exibir imagens e métricas
}

// ==================== RESETAR FILTROS ====================
function resetFilters() {
    document.getElementById('projectFilter').value = '';
    document.getElementById('periodFilter').value = 'last7Days';
    document.getElementById('unitsFilter').value = 'all';
    document.getElementById('customDateStart').classList.add('hidden');
    document.getElementById('customDateEnd').classList.add('hidden');
    document.getElementById('specificUnitsSection').classList.add('hidden');
    
    currentFilters = {
        projectId: null,
        period: 'last7Days',
        startDate: null,
        endDate: null,
        units: 'all'
    };
    
    selectedUnits = [];
    allUnits = [];
    
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

// ==================== HELPERS ====================
function showLoading() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('loadingState').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatPercentage(value) {
    return value.toFixed(2) + '%';
}

