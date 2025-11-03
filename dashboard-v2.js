import { auth } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';
import { fbAuth } from './auth.js';
import { googleAuth } from './authGoogle.js';
import { FacebookInsightsService } from './services/facebookInsights.js';
import { GoogleAdsService } from './services/googleAds.js';

let currentProjectId = null;
let currentPeriod = 'last7days';
let allUnits = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

function formatCurrency(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

function calculatePeriodDates(period) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  switch(period) {
    case 'today':
      return { start: todayStr, end: todayStr };
      
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: start.toISOString().split('T')[0], end: todayStr };
    }
    
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: todayStr };
    }
    
    case 'lastMonth': {
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
      const end = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    
    case 'custom': {
      const startInput = document.getElementById('customStartDate').value;
      const endInput = document.getElementById('customEndDate').value;
      if (!startInput || !endInput) {
        alert('Selecione as datas de início e fim');
        return null;
      }
      return { start: startInput, end: endInput };
    }
    
    default:
      return { start: todayStr, end: todayStr };
  }
}

onAuthStateChanged(auth, async (user) => { 
  if (!user) { 
    window.location.href = '/login.html'; 
    return; 
  } 
  await bootstrap(); 
});

async function bootstrap() {
  try {
    await populateProjects();
    setupPeriodControls();
    document.getElementById('generateBtn').addEventListener('click', generateDashboard);
  } catch (error) {
    console.error('Erro ao inicializar dashboard:', error);
  }
}

async function populateProjects() {
  try {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    const projects = await projectsService.listProjects();
    projects.forEach(p => { 
      const o = document.createElement('option'); 
      o.value = p.id; 
      o.textContent = p.name; 
      select.appendChild(o); 
    });
    
    const saved = localStorage.getItem('currentProject');
    if (saved && projects.find(p => p.id === saved)) {
      select.value = saved;
    }
    
    currentProjectId = select.value || null;
    select.addEventListener('change', e => { 
      currentProjectId = e.target.value; 
      localStorage.setItem('currentProject', currentProjectId || ''); 
    });
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    document.getElementById('projectSelect').innerHTML = '<option value="">Erro ao carregar projetos</option>';
  }
}

function setupPeriodControls() {
  try {
    const periodSelect = document.getElementById('periodSelect');
    const customPeriodDiv = document.getElementById('customPeriodDiv');
    const customStartDate = document.getElementById('customStartDate');
    const customEndDate = document.getElementById('customEndDate');
    
    // Definir data de hoje como padrão para campos personalizados
    const today = new Date().toISOString().split('T')[0];
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);
    customStartDate.value = last7Days.toISOString().split('T')[0];
    customEndDate.value = today;
    
    // Event listener para mostrar/ocultar campos personalizados
    periodSelect.addEventListener('change', (e) => {
      currentPeriod = e.target.value;
      if (currentPeriod === 'custom') {
        customPeriodDiv.classList.remove('hidden');
      } else {
        customPeriodDiv.classList.add('hidden');
      }
    });
    
    currentPeriod = periodSelect.value;
  } catch (error) {
    console.error('Erro ao configurar controles de período:', error);
  }
}

async function generateDashboard() {
  if (!currentProjectId) { 
    alert('Selecione um projeto'); 
    return; 
  }
  
  const periodDates = calculatePeriodDates(currentPeriod);
  if (!periodDates) {
    return; // calculatePeriodDates já mostra o alert
  }
  
  const empty = document.getElementById('emptyState');
  document.getElementById('cardsSection').classList.add('hidden');
  document.getElementById('tableSection').classList.add('hidden');
  empty.classList.remove('hidden');
  empty.querySelector('h3').textContent = 'Gerando dashboard...';
  empty.querySelector('p').textContent = 'Calculando métricas...';

  try {
    allUnits = await unitsService.listUnits(currentProjectId);
    const { start, end } = periodDates;
    
    // ⭐ Passar currentProjectId para a função computeUnitMetricsFromSpreadsheet
    dashboardProjectId = currentProjectId;

    // Calcula métricas da planilha por unidade
    const rows = await Promise.all(allUnits.map(async u => {
      const plan = await computeUnitMetricsFromSpreadsheet(u, start, end);
      
      // Calcula ROI: (faturamento * 0.25) / investimento
      let roi = 0;
      if (plan.revenue > 0 && plan.invested > 0) {
        roi = (plan.revenue * 0.25) / plan.invested;
      }
      
      // Calcula CPA: investido / mensagens
      let cpa = 0;
      if (plan.messages > 0 && plan.invested > 0) {
        cpa = plan.invested / plan.messages;
      }
      
      return {
        id: u?.id || '',
        name: u?.name || '-',
        invested: plan.invested,
        messages: plan.messages,
        cpa: cpa,
        sales: plan.sales,
        revenue: plan.revenue,
        roi: roi
      };
    }));

    const totals = rows.reduce((a, r) => ({
      units: a.units + 1, 
      invested: a.invested + r.invested,
      messages: a.messages + r.messages,
      sales: a.sales + r.sales, 
      revenue: a.revenue + r.revenue 
    }), { units: 0, invested: 0, messages: 0, sales: 0, revenue: 0 });
    
    // Calcula ROI geral
    totals.roi = 0;
    if (totals.revenue > 0 && totals.invested > 0) {
      totals.roi = (totals.revenue * 0.25) / totals.invested;
    }
    
    // Calcula CPA geral
    totals.cpa = 0;
    if (totals.messages > 0 && totals.invested > 0) {
      totals.cpa = totals.invested / totals.messages;
    }

    renderCards(totals); 
    renderTable(rows);
    
    empty.classList.add('hidden'); 
    document.getElementById('cardsSection').classList.remove('hidden'); 
    document.getElementById('tableSection').classList.remove('hidden');
  } catch (error) {
    console.error('Erro ao gerar dashboard:', error);
    empty.querySelector('h3').textContent = 'Erro ao gerar dashboard';
    empty.querySelector('p').textContent = 'Tente novamente ou verifique sua conexão.';
  }
}

function normalizeStr(v) { 
  return String(v ?? '').trim().toLowerCase(); 
}

async function computeUnitMetricsFromSpreadsheet(unit, startDate, endDate) {
  if (!unit.budgetData || !unit.budgetData.rawData) {
    return { invested: 0, messages: 0, sales: 0, revenue: 0 };
  }
  
  const filteredData = filterUnitDataByPeriod(unit.budgetData.rawData, startDate, endDate);
  
  // Calcular investido e mensagens se a unidade tem conta vinculada
  let invested = 0;
  let messages = 0;
  const linkedAccounts = unit.linkedAccounts || {};
  
  if (linkedAccounts.meta?.id || linkedAccounts.google?.id) {
    // Buscar gastos de anúncios se tem conta vinculada
    try {
      console.log(`🔍 Buscando dados para ${unit.name}:`, linkedAccounts);
      
      if (linkedAccounts.meta?.id && fbAuth?.getAccessToken && fbAuth.getAccessToken()) {
        console.log(`📱 Buscando dados Meta para conta ${linkedAccounts.meta.id}`);
        const token = fbAuth.getAccessToken();
        const fb = new FacebookInsightsService(token);
        if (fb?.getAccountInsights) {
          const metaInsights = await fb.getAccountInsights(linkedAccounts.meta.id, startDate, endDate);
          console.log(`💰 Gastos Meta: R$ ${metaInsights.spend}`);
          invested += Number(metaInsights.spend || 0);
          
          // Extrair mensagens das actions
          if (metaInsights.actions && Array.isArray(metaInsights.actions)) {
            const totalMessages = extractMessages(metaInsights.actions);
            console.log(`💬 Mensagens Meta: ${totalMessages}`);
            messages += totalMessages;
          }
        } else {
          console.warn(`⚠️ FacebookInsightsService.getAccountInsights não disponível`);
        }
      } else {
        console.warn(`⚠️ Meta não disponível para ${unit.name}:`, {
          hasId: !!linkedAccounts.meta?.id,
          hasAuth: !!fbAuth,
          hasToken: !!(fbAuth?.getAccessToken && fbAuth.getAccessToken())
        });
      }
      
      if (linkedAccounts.google?.id) {
        console.log(`🔍 Verificando Google para ${unit.name}:`, {
          hasId: !!linkedAccounts.google?.id,
          googleId: linkedAccounts.google.id
        });
        
        try {
          // ⭐ Inicializar Google Auth se ainda não foi inicializado
          if (!googleAuth || typeof googleAuth.initialize !== 'function') {
            console.warn(`⚠️ GoogleAuth não disponível`);
            return { invested, messages, sales: filteredData.totalSales, revenue: filteredData.totalRevenue };
          }
          
          await googleAuth.initialize();
          
          // Verificar autenticação após inicializar
          const isAuthenticated = googleAuth.isAuthenticated && googleAuth.isAuthenticated();
          console.log(`🔍 Google Auth inicializado para ${unit.name}, autenticado:`, isAuthenticated);
          
          if (isAuthenticated) {
            const googleAccessToken = googleAuth.getAccessToken();
            if (googleAccessToken) {
              let managedBy = linkedAccounts.google.managedBy || null;
              
              console.log(`🔍 Criando GoogleAdsService para ${unit.name}:`, {
                accountId: linkedAccounts.google.id,
                hasToken: !!googleAccessToken,
                managedBy: managedBy || 'não definido'
              });
              
              // ⭐ Se managedBy não estiver definido, tentar detectar automaticamente
              if (!managedBy) {
                try {
                  console.log(`🔍 Tentando detectar MCC ID automaticamente para ${unit.name}...`);
                  const accounts = await googleAuth.fetchAccessibleAccounts();
                  
                  // Procurar a conta nas contas retornadas para ver se tem managedBy
                  const accountInfo = accounts.find(acc => acc.customerId === linkedAccounts.google.id);
                  if (accountInfo && accountInfo.managedBy) {
                    managedBy = accountInfo.managedBy;
                    console.log(`✅ MCC ID detectado automaticamente: ${managedBy}`);
                    
                    // Salvar o managedBy na unidade para uso futuro
                    try {
                      const { updateUnit } = await import('./services/unitsService.js');
                      const updatedLinkedAccounts = {
                        ...linkedAccounts,
                        google: {
                          ...linkedAccounts.google,
                          managedBy: managedBy
                        }
                      };
                      // Usar dashboardProjectId capturado do escopo externo
                      if (dashboardProjectId && unit.id) {
                        await updateUnit(dashboardProjectId, unit.id, {
                          linkedAccounts: updatedLinkedAccounts
                        });
                        console.log(`✅ managedBy salvo na unidade para uso futuro`);
                      }
                    } catch (saveError) {
                      console.warn(`⚠️ Erro ao salvar managedBy (continuando):`, saveError);
                    }
                  } else {
                    console.log(`ℹ️ Conta não encontrada como gerenciada, tentando sem MCC ID`);
                  }
                } catch (detectError) {
                  console.warn(`⚠️ Erro ao detectar MCC ID automaticamente (continuando):`, detectError);
                }
              }
              
              const ga = new GoogleAdsService(linkedAccounts.google.id, googleAccessToken, managedBy);
              if (ga?.getAccountInsights) {
                console.log(`📊 Buscando insights do Google para ${unit.name}...`);
                console.log(`📅 Período: ${startDate} a ${endDate}`);
                const gInsightsData = await ga.getAccountInsights(startDate, endDate);
                
                // Verificar se há erro de permissão
                if (gInsightsData.error && gInsightsData.error.includes('PERMISSION_DENIED')) {
                  console.warn(`⚠️ Erro de permissão detectado. Tentando encontrar MCC ID...`);
                  
                  // Se ainda não temos managedBy e houve erro de permissão, tentar todas as contas MCC disponíveis
                  if (!managedBy) {
                    try {
                      const accounts = await googleAuth.fetchAccessibleAccounts();
                      // Contas MCC são aquelas que têm contas gerenciadas
                      const mccAccounts = accounts.filter(acc => !acc.managedBy); // Contas que não são gerenciadas (são MCCs ou diretas)
                      
                      console.log(`🔍 Tentando ${mccAccounts.length} contas MCC possíveis...`);
                      for (const mccAccount of mccAccounts.slice(0, 5)) { // Limitar a 5 tentativas
                        try {
                          const gaWithMCC = new GoogleAdsService(linkedAccounts.google.id, googleAccessToken, mccAccount.customerId);
                          const testData = await gaWithMCC.getAccountInsights(startDate, endDate);
                          if (!testData.error) {
                            managedBy = mccAccount.customerId;
                            console.log(`✅ MCC ID encontrado: ${managedBy}`);
                            // Usar os dados que funcionaram
                            const gInsights = testData.insights || testData;
                            const googleCost = Number(gInsights?.cost || 0);
                            console.log(`💰 Gastos Google encontrados: R$ ${googleCost}`);
                            invested += googleCost;
                            const googleConversions = Number(gInsights?.conversions || 0);
                            console.log(`💬 Conversões Google: ${googleConversions}`);
                            if (googleConversions > 0) {
                              messages += googleConversions;
                              console.log(`💬 Conversões Google adicionadas às mensagens: ${googleConversions}`);
                            }
                            break;
                          }
                        } catch (testError) {
                          // Continuar tentando
                          continue;
                        }
                      }
                    } catch (mccError) {
                      console.warn(`⚠️ Erro ao tentar encontrar MCC ID:`, mccError);
                    }
                  }
                  
                  if (managedBy && gInsightsData.error) {
                    // Tentar novamente com o MCC ID encontrado
                    console.log(`🔄 Tentando novamente com MCC ID: ${managedBy}`);
                    const gaWithMCC = new GoogleAdsService(linkedAccounts.google.id, googleAccessToken, managedBy);
                    const retryData = await gaWithMCC.getAccountInsights(startDate, endDate);
                    const gInsights = retryData.insights || retryData;
                    if (!gInsights.error) {
                      const googleCost = Number(gInsights?.cost || 0);
                      console.log(`💰 Gastos Google encontrados: R$ ${googleCost}`);
                      invested += googleCost;
                      const googleConversions = Number(gInsights?.conversions || 0);
                      console.log(`💬 Conversões Google: ${googleConversions}`);
                      if (googleConversions > 0) {
                        messages += googleConversions;
                        console.log(`💬 Conversões Google adicionadas às mensagens: ${googleConversions}`);
                      }
                    }
                  }
                } else {
                  // Sem erro, processar normalmente
                  console.log(`📊 Dados brutos retornados do getAccountInsights:`, JSON.stringify(gInsightsData, null, 2));
                  
                  // ⭐ getAccountInsights retorna diretamente { cost, conversions, ... } ou { insights: {...} }
                  // Verificar se vem aninhado ou não
                  const gInsights = gInsightsData.insights || gInsightsData;
                  
                  console.log(`📊 Insights processados (JSON):`, JSON.stringify(gInsights, null, 2));
                  console.log(`📊 Propriedades disponíveis:`, Object.keys(gInsights || {}));
                  
                  const googleCost = Number(gInsights?.cost || gInsights?.metrics?.cost || 0);
                  console.log(`💰 Gastos Google encontrados: R$ ${googleCost}`);
                  invested += googleCost;
                  
                  // ⭐ Calcular mensagens e CPA do Google
                  // Google não tem mensagens diretas do WhatsApp, mas tem conversões
                  // Para fins de cálculo, podemos considerar conversões como "mensagens"
                  const googleConversions = Number(gInsights?.conversions || gInsights?.metrics?.conversions || 0);
                  console.log(`💬 Conversões Google: ${googleConversions}`);
                  if (googleConversions > 0) {
                    messages += googleConversions;
                    console.log(`💬 Conversões Google adicionadas às mensagens: ${googleConversions}`);
                  }
                }
              } else {
                console.warn(`⚠️ GoogleAdsService.getAccountInsights não disponível`);
              }
            } else {
              console.warn(`⚠️ Token Google não disponível para ${unit.name}`);
            }
          } else {
            console.warn(`⚠️ Google não autenticado para ${unit.name}`);
          }
        } catch (error) {
          console.error(`❌ Erro ao buscar dados Google para ${unit.name}:`, error);
        }
      } else {
        console.log(`ℹ️ ${unit.name} não tem Google vinculado`);
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar dados de anúncios para ${unit.name}:`, error);
    }
  } else {
    console.log(`ℹ️ ${unit.name} não tem contas vinculadas`);
  }
  
  return {
    invested: invested,
    messages: messages,
    sales: filteredData.totalSales,
    revenue: filteredData.totalRevenue
  };
}

// Função para extrair mensagens das actions (mesma lógica do RelatorioCompleto.js)
function extractMessages(actions) {
  let totalMessages = 0;
  
  if (actions && Array.isArray(actions)) {
    // Contabilizar conversas iniciadas
    const conversationAction = actions.find(
      action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
    );
    if (conversationAction && conversationAction.value) {
      totalMessages += parseInt(conversationAction.value) || 0;
    }

    // Contabilizar conversões personalizadas
    const customConversions = actions.filter(
      action => action.action_type.startsWith('offsite_conversion.')
    );
    customConversions.forEach(action => {
      if (action.value) {
        totalMessages += parseInt(action.value) || 0;
      }
    });

    // Contabilizar cadastros do Facebook
    const leadActions = actions.filter(
      action => action.action_type === 'lead'
    );
    leadActions.forEach(action => {
      if (action.value) {
        totalMessages += parseInt(action.value) || 0;
      }
    });
  }

  return totalMessages;
}

// Filtrar dados da unidade por período (mesma lógica do RelatorioCompleto.js)
function filterUnitDataByPeriod(rawData, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const filtered = rawData.filter(item => {
    // Tentar diferentes campos de data
    const itemDateStr = item.date || item.budgetDate || item.data || item.createdAt;
    if (!itemDateStr) return false;
    
    const itemDate = new Date(itemDateStr);
    return itemDate >= start && itemDate <= end;
  });
  
  return {
    totalBudgets: filtered.length,
    totalSales: filtered.filter(r => {
      // Tentar diferentes campos de status
      const status = r.status || r.budgetCompleted || r.completed || r.concluido;
      return status === "APPROVED" || status === true || status === "sim" || status === "concluido" || status === "concluído";
    }).length,
    totalRevenue: filtered.filter(r => {
      const status = r.status || r.budgetCompleted || r.completed || r.concluido;
      return status === "APPROVED" || status === true || status === "sim" || status === "concluido" || status === "concluído";
    }).reduce((sum, r) => sum + (r.value || r.saleValue || r.revenue || r.faturamento || 0), 0)
  };
}

function renderCards(t) {
  document.getElementById('cardUnits').textContent = t.units;
  document.getElementById('cardInvested').textContent = formatCurrency(t.invested);
  document.getElementById('cardMessages').textContent = t.messages;
  document.getElementById('cardCPA').textContent = formatCurrency(t.cpa);
  document.getElementById('cardSales').textContent = t.sales;
  document.getElementById('cardRevenue').textContent = formatCurrency(t.revenue);
  document.getElementById('cardROI').textContent = t.roi > 0 ? `${t.roi.toFixed(2)}x` : '0x';
  
  // Colorir ROI baseado no valor
  const roiEl = document.getElementById('cardROI');
  if (t.roi >= 2) {
    roiEl.className = 'text-3xl font-bold text-green-600';
  } else if (t.roi >= 1) {
    roiEl.className = 'text-3xl font-bold text-yellow-600';
  } else {
    roiEl.className = 'text-3xl font-bold text-red-600';
  }
}

function renderTable(rows) {
  const tbody = document.getElementById('unitsTableBody'); 
  tbody.innerHTML = '';
  
  // Aplicar ordenação se houver
  if (currentSortColumn) {
    sortRows(rows, currentSortColumn, currentSortDirection);
  } else {
    // Ordenação padrão: ROI decrescente
    rows.sort((a, b) => b.roi - a.roi);
  }
  
  for (const r of rows) {
    // Determinar cor do ROI
    let roiClass = 'text-red-600';
    if (r.roi >= 2) roiClass = 'text-green-600';
    else if (r.roi >= 1) roiClass = 'text-yellow-600';
    
    const tr = document.createElement('tr'); 
    tr.innerHTML = `
      <td class="px-6 py-3 text-sm text-gray-900">${r.name}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.invested)}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${r.messages}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.cpa)}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${r.sales}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.revenue)}</td>
      <td class="px-6 py-3 text-sm text-right font-semibold ${roiClass}">${r.roi > 0 ? r.roi.toFixed(2) + 'x' : '0x'}</td>`; 
    tbody.appendChild(tr); 
  }
  
  // Configurar event listeners para ordenação
  setupTableSorting(rows);
}

function sortRows(rows, column, direction) {
  rows.sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];
    
    // Para strings (nome), usar localCompare
    if (column === 'name') {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      return direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    // Para números
    return direction === 'asc' 
      ? aVal - bVal 
      : bVal - aVal;
  });
}

function setupTableSorting(rows) {
  const headers = document.querySelectorAll('th[data-sort]');
  
  headers.forEach(th => {
    // Remover listener anterior se existir
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    
    newTh.addEventListener('click', () => {
      const column = newTh.getAttribute('data-sort');
      
      // Se clicar na mesma coluna, inverte direção
      if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = column;
        currentSortDirection = column === 'name' ? 'asc' : 'desc'; // Padrão: nome A-Z, números do maior ao menor
      }
      
      // Atualizar ícones
      document.querySelectorAll('th[data-sort] i').forEach(i => {
        i.className = 'fas fa-sort text-gray-400';
      });
      
      const icon = newTh.querySelector('i');
      if (currentSortDirection === 'asc') {
        icon.className = 'fas fa-sort-up text-blue-600';
      } else {
        icon.className = 'fas fa-sort-down text-blue-600';
      }
      
      // Re-renderizar tabela
      renderTable(rows);
    });
  });
}