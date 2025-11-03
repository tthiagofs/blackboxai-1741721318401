// Dashboard - Análise Temporal
// Análise de performance por dia da semana e comparação de períodos

import { auth } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { fbAuth } from './auth.js';
import { googleAuth } from './authGoogle.js';
import { FacebookInsightsService } from './services/facebookInsights.js';
import { GoogleAdsService } from './services/googleAds.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';

let currentUser = null;
let currentProject = null;
let allUnits = [];
let barChart = null;
let lineChart = null;
let currentDataByDay = [];
let currentPeriodData = [];
let previousPeriodData = [];

// Nomes dos dias da semana
const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_OF_WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Inicialização
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadTemporalProjects();
    setupTemporalEventListeners();
  } else {
    window.location.href = '/login.html';
  }
});

// Carregar projetos
async function loadTemporalProjects() {
  try {
    const projectSelect = document.getElementById('temporalProjectSelect');
    projectSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    
    const projects = await projectsService.listProjects();
    
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || 'Sem nome';
      projectSelect.appendChild(option);
    });
    
    // Auto-selecionar se houver apenas 1 projeto
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      await loadTemporalUnits(projects[0].id);
    } else {
      const savedProjectId = localStorage.getItem('currentProject');
      if (savedProjectId && projects.find(p => p.id === savedProjectId)) {
        projectSelect.value = savedProjectId;
        await loadTemporalUnits(savedProjectId);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar projetos:', error);
  }
}

// Carregar unidades
async function loadTemporalUnits(projectId) {
  try {
    if (!projectId) {
      const unitsSelect = document.getElementById('temporalUnitsSelect');
      unitsSelect.innerHTML = '<option value="all" selected>Todas as unidades</option>';
      return;
    }

    const allUnitsList = await unitsService.listUnits(projectId);
    allUnits = allUnitsList;
    
    const unitsSelect = document.getElementById('temporalUnitsSelect');
    unitsSelect.innerHTML = '<option value="all" selected>Todas as unidades</option>';
    
    allUnitsList.forEach(unit => {
      const option = document.createElement('option');
      option.value = unit.id;
      option.textContent = unit.name || 'Sem nome';
      unitsSelect.appendChild(option);
    });
  } catch (error) {
    console.error('❌ Erro ao carregar unidades:', error);
  }
}

// Configurar event listeners
function setupTemporalEventListeners() {
  // Projeto selecionado
  document.getElementById('temporalProjectSelect').addEventListener('change', async (e) => {
    const projectId = e.target.value;
    if (projectId) {
      currentProject = projectId;
      localStorage.setItem('currentProject', projectId);
      await loadTemporalUnits(projectId);
    }
  });

  // Período personalizado
  document.getElementById('temporalPeriodSelect').addEventListener('change', (e) => {
    const customDiv = document.getElementById('temporalCustomPeriodDiv');
    if (e.target.value === 'custom') {
      customDiv.classList.remove('hidden');
    } else {
      customDiv.classList.add('hidden');
    }
  });

  // Gerar análise
  document.getElementById('temporalGenerateBtn').addEventListener('click', generateTemporalAnalysis);

  // Tabs de visualização
  document.getElementById('temporalTabDiaSemana').addEventListener('click', () => switchTemporalTab('DiaSemana'));
  document.getElementById('temporalTabComparacao').addEventListener('click', () => switchTemporalTab('Comparacao'));

  // Seletores de métrica
  document.getElementById('temporalMetricSelect').addEventListener('change', updateBarChart);
  document.getElementById('temporalComparisonMetricSelect').addEventListener('change', updateLineChart);

  // Exportação
  document.getElementById('temporalExportBtn').addEventListener('click', exportToExcel);

  // Ordenação de tabela
  document.querySelectorAll('#temporalTableBody').forEach(() => {
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => sortTable(th.dataset.sort));
    });
  });
}

// Trocar aba de visualização
function switchTemporalTab(tabName) {
  // Atualizar tabs
  document.querySelectorAll('.temporal-tab').forEach(tab => {
    tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
    tab.classList.add('border-transparent', 'text-gray-500');
  });

  // Ocultar conteúdo
  document.querySelectorAll('.temporal-content').forEach(content => {
    content.classList.add('hidden');
  });

  // Ativar tab selecionada
  const activeTab = document.getElementById(`temporalTab${tabName}`);
  if (activeTab) {
    activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }

  // Mostrar conteúdo
  const activeContent = document.getElementById(`temporalContent${tabName}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }
}

// Calcular datas do período
function calculatePeriodDates(period) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  switch(period) {
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
      const startInput = document.getElementById('temporalCustomStartDate').value;
      const endInput = document.getElementById('temporalCustomEndDate').value;
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

// Gerar análise temporal
async function generateTemporalAnalysis() {
  try {
    const projectId = document.getElementById('temporalProjectSelect').value;
    const period = document.getElementById('temporalPeriodSelect').value;
    const unitId = document.getElementById('temporalUnitsSelect').value;
    
    if (!projectId) {
      alert('Selecione um projeto');
      return;
    }

    const dates = calculatePeriodDates(period);
    if (!dates) return;

    // Mostrar loading
    const loadingEl = document.getElementById('temporalLoading');
    const contentDiaSemana = document.getElementById('temporalContentDiaSemana');
    const contentComparacao = document.getElementById('temporalContentComparacao');
    
    loadingEl.classList.remove('hidden');
    contentDiaSemana.classList.add('hidden');
    contentComparacao.classList.add('hidden');
    document.getElementById('temporalInsightsSection').classList.add('hidden');

    console.log('📊 Gerando análise temporal...', { projectId, period, unitId, dates });

    // Determinar unidades a processar
    const unitsToProcess = unitId === 'all' 
      ? allUnits 
      : allUnits.filter(u => u.id === unitId);

    if (unitsToProcess.length === 0) {
      alert('Nenhuma unidade encontrada');
      loadingEl.classList.add('hidden');
      return;
    }

    // Calcular período anterior (mesmo número de dias)
    const startDate = new Date(dates.start);
    const endDate = new Date(dates.end);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const previousEndDate = new Date(startDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysDiff + 1);

    const previousDates = {
      start: previousStartDate.toISOString().split('T')[0],
      end: previousEndDate.toISOString().split('T')[0]
    };

    console.log('📅 Períodos:', { atual: dates, anterior: previousDates });

    // Processar dados do período atual
    console.log('🔄 Processando dados do período atual...');
    currentPeriodData = await processPeriodData(unitsToProcess, dates.start, dates.end);
    console.log('✅ Dados do período atual:', currentPeriodData.length, 'registros');
    
    // Processar dados do período anterior
    console.log('🔄 Processando dados do período anterior...');
    previousPeriodData = await processPeriodData(unitsToProcess, previousDates.start, previousDates.end);
    console.log('✅ Dados do período anterior:', previousPeriodData.length, 'registros');

    // Agregar por dia da semana
    console.log('🔄 Agregando por dia da semana...');
    currentDataByDay = aggregateByDayOfWeek(currentPeriodData);
    console.log('✅ Dados agregados por dia:', currentDataByDay);

    // Renderizar visualizações
    console.log('🔄 Renderizando visualizações...');
    renderDayOfWeekAnalysis();
    renderComparisonAnalysis();
    generateInsights();

    // Ocultar loading e mostrar conteúdo
    loadingEl.classList.add('hidden');
    contentDiaSemana.classList.remove('hidden');
    
    // Mostrar seção de insights
    document.getElementById('temporalInsightsSection').classList.remove('hidden');
    
    console.log('✅ Análise temporal gerada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao gerar análise temporal:', error);
    document.getElementById('temporalLoading').classList.add('hidden');
    alert('Erro ao gerar análise. Verifique o console para mais detalhes.');
  }
}

// Processar dados de um período
async function processPeriodData(units, startDate, endDate) {
  const allData = [];

  for (const unit of units) {
    console.log(`📊 Processando unidade: ${unit.name}`);
    
    // Dados de tráfego (Meta/Google)
    const trafficData = await getTrafficData(unit, startDate, endDate);
    if (trafficData && trafficData.length > 0) {
      console.log(`  ✅ Tráfego: ${trafficData.length} registros`);
      allData.push(...trafficData);
    } else {
      console.log(`  ⚠️ Sem dados de tráfego`);
    }

    // Dados de planilha
    const spreadsheetData = getSpreadsheetData(unit, startDate, endDate);
    if (spreadsheetData && spreadsheetData.length > 0) {
      console.log(`  ✅ Planilha: ${spreadsheetData.length} registros`);
      allData.push(...spreadsheetData);
    } else {
      console.log(`  ⚠️ Sem dados de planilha`);
    }
  }

  console.log(`📊 Total de registros processados: ${allData.length}`);
  return allData;
}

// Obter dados de tráfego (Meta/Google) - com breakdown diário
async function getTrafficData(unit, startDate, endDate) {
  const data = [];
  const linkedAccounts = unit.linkedAccounts || {};

  try {
    // Meta Ads - buscar com breakdown diário
    if (linkedAccounts.meta?.id && fbAuth?.getAccessToken && fbAuth.getAccessToken()) {
      const token = fbAuth.getAccessToken();
      if (token) {
        try {
          // Buscar insights com breakdown diário
          const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }));
          const url = `https://graph.facebook.com/v21.0/${linkedAccounts.meta.id}/insights?fields=spend,impressions,clicks,actions&time_range=${timeRange}&breakdowns=day&access_token=${token}`;
          
          const response = await fetch(url);
          const result = await response.json();
          
          if (result.data && Array.isArray(result.data)) {
            result.data.forEach(dayData => {
              const date = dayData.date_start; // Formato YYYY-MM-DD
              
              // Extrair mensagens das actions
              const messages = dayData.actions?.find(action => 
                action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
              )?.value || 0;
              
              data.push({
                date: date,
                invested: parseFloat(dayData.spend || 0),
                messages: parseInt(messages),
                sales: 0,
                revenue: 0,
                source: 'meta'
              });
            });
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar dados diários do Meta:', error);
          // Fallback: usar dados agregados e distribuir uniformemente
          const fbService = new FacebookInsightsService(token);
          const insights = await fbService.getAccountInsights(
            linkedAccounts.meta.id,
            startDate,
            endDate
          );
          
          if (insights) {
            const messages = insights.actions?.find(action => 
              action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            )?.value || 0;
            
            // Distribuir uniformemente pelos dias
            const days = getDaysBetween(startDate, endDate);
            const dailySpend = insights.spend / days.length;
            const dailyMessages = Math.round(messages / days.length);
            
            days.forEach(day => {
              data.push({
                date: day,
                invested: dailySpend,
                messages: dailyMessages,
                sales: 0,
                revenue: 0,
                source: 'meta'
              });
            });
          }
        }
      }
    }

    // Google Ads - buscar dados diários
    if (linkedAccounts.google?.id) {
      try {
        await googleAuth.initialize();
        const googleAccessToken = googleAuth?.getAccessToken && googleAuth.getAccessToken();
        
        if (googleAccessToken) {
          const managedBy = linkedAccounts.google.managedBy || null;
          const googleService = new GoogleAdsService(
            linkedAccounts.google.id,
            googleAccessToken,
            managedBy
          );
          
          // Buscar insights
          const insights = await googleService.getAccountInsights(
            startDate,
            endDate
          );
          
          console.log('📊 Insights do Google recebidos:', insights);
          
          if (insights && !insights.error) {
            // A estrutura pode ser insights.metrics ou insights diretamente
            const metrics = insights.metrics || insights;
            const cost = parseFloat(metrics.cost || 0);
            const conversions = parseInt(metrics.conversions || 0);
            
            console.log('📊 Métricas do Google:', { cost, conversions });
            
            if (cost > 0 || conversions > 0) {
              // Se não houver dados diários, distribuir uniformemente
              const days = getDaysBetween(startDate, endDate);
              const dailyCost = cost / days.length;
              const dailyConversions = Math.round(conversions / days.length);
              
              console.log(`📊 Distribuindo dados do Google: ${cost} de custo e ${conversions} conversões em ${days.length} dias`);
              
              days.forEach(day => {
                data.push({
                  date: day,
                  invested: dailyCost,
                  messages: dailyConversions,
                  sales: 0,
                  revenue: 0,
                  source: 'google'
                });
              });
              
              console.log(`✅ ${data.length} registros do Google adicionados`);
            } else {
              console.log('⚠️ Google retornou dados mas sem custo ou conversões');
            }
          } else {
            console.log('⚠️ Google retornou erro ou sem dados:', insights?.error);
          }
        } else {
          console.log('⚠️ Google não autenticado');
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar dados do Google:', error);
      }
    } else {
      console.log('⚠️ Unidade sem conta Google vinculada');
    }
  } catch (error) {
    console.warn('⚠️ Erro ao buscar dados de tráfego:', error);
  }

  return data;
}

// Obter lista de dias entre duas datas
function getDaysBetween(startDate, endDate) {
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }
  
  return days;
}

// Obter dados de planilha
function getSpreadsheetData(unit, startDate, endDate) {
  if (!unit.budgetData || !unit.budgetData.rawData) {
    return [];
  }

  const data = unit.budgetData.rawData.filter(item => {
    const itemDate = item.date;
    return itemDate >= startDate && itemDate <= endDate;
  });

  return data.map(item => ({
    date: item.date,
    invested: item.budgetCompleted === 'Sim' ? parseFloat(item.budgetValue || 0) : 0,
    messages: 0,
    sales: item.status === 'APPROVED' ? 1 : 0,
    revenue: item.status === 'APPROVED' ? parseFloat(item.saleValue || 0) : 0,
    source: 'spreadsheet'
  }));
}

// Agregar dados por dia da semana
function aggregateByDayOfWeek(data) {
  console.log('🔄 Agregando dados por dia da semana. Total de registros:', data.length);
  
  const byDay = {};
  
  // Inicializar todos os dias
  DAYS_OF_WEEK.forEach((day, index) => {
    byDay[index] = {
      dayName: day,
      dayShort: DAYS_OF_WEEK_SHORT[index],
      invested: 0,
      messages: 0,
      sales: 0,
      revenue: 0
    };
  });

  // Agregar dados
  data.forEach(item => {
    try {
      const date = new Date(item.date + 'T00:00:00'); // Adicionar hora para evitar problemas de timezone
      const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      
      if (isNaN(dayOfWeek)) {
        console.warn('⚠️ Data inválida:', item.date);
        return;
      }
      
      byDay[dayOfWeek].invested += parseFloat(item.invested || 0);
      byDay[dayOfWeek].messages += parseInt(item.messages || 0);
      byDay[dayOfWeek].sales += parseInt(item.sales || 0);
      byDay[dayOfWeek].revenue += parseFloat(item.revenue || 0);
    } catch (error) {
      console.warn('⚠️ Erro ao processar item:', item, error);
    }
  });

  // Calcular CPA e ROI
  Object.values(byDay).forEach(day => {
    day.cpa = day.messages > 0 ? parseFloat((day.invested / day.messages).toFixed(2)) : 0;
    day.roi = day.invested > 0 ? parseFloat((day.revenue / day.invested).toFixed(2)) : 0;
  });

  // Converter para array e ordenar (Segunda = 1 primeiro)
  const result = Object.values(byDay);
  // Reordenar para começar na Segunda (1)
  const ordered = [
    result[1], // Segunda
    result[2], // Terça
    result[3], // Quarta
    result[4], // Quinta
    result[5], // Sexta
    result[6], // Sábado
    result[0]  // Domingo
  ];

  console.log('✅ Dados agregados:', ordered.map(d => ({
    dia: d.dayName,
    invested: d.invested,
    messages: d.messages,
    sales: d.sales,
    revenue: d.revenue
  })));

  return ordered;
}

// Renderizar análise por dia da semana
function renderDayOfWeekAnalysis() {
  renderBarChart();
  renderDayTable();
}

// Renderizar gráfico de barras
function renderBarChart() {
  const ctx = document.getElementById('temporalBarChart');
  if (!ctx) {
    console.warn('⚠️ Canvas do gráfico não encontrado');
    return;
  }

  if (!currentDataByDay || currentDataByDay.length === 0) {
    console.warn('⚠️ Nenhum dado para renderizar no gráfico');
    return;
  }

  const metric = document.getElementById('temporalMetricSelect').value;
  const labels = currentDataByDay.map(d => d.dayShort);
  
  const metricLabels = {
    invested: 'Investido (R$)',
    messages: 'Mensagens',
    sales: 'Vendas',
    revenue: 'Faturamento (R$)',
    cpa: 'CPA Médio (R$)',
    roi: 'ROI'
  };

  const metricValues = currentDataByDay.map(day => {
    switch(metric) {
      case 'invested': return parseFloat(day.invested || 0);
      case 'messages': return parseInt(day.messages || 0);
      case 'sales': return parseInt(day.sales || 0);
      case 'revenue': return parseFloat(day.revenue || 0);
      case 'cpa': return parseFloat(day.cpa || 0);
      case 'roi': return parseFloat(day.roi || 0);
      default: return 0;
    }
  });

  console.log('📊 Renderizando gráfico:', { labels, metricValues, metric });

  // Destruir gráfico anterior se existir
  if (barChart) {
    barChart.destroy();
  }

  // Atualizar título
  const titleEl = document.getElementById('temporalChartTitle');
  if (titleEl) {
    titleEl.textContent = `${metricLabels[metric]} por Dia da Semana`;
  }

  // Criar novo gráfico
  try {
    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: metricLabels[metric],
          data: metricValues,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    console.log('✅ Gráfico de barras renderizado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar gráfico:', error);
  }
}

// Atualizar gráfico de barras
function updateBarChart() {
  if (currentDataByDay.length > 0) {
    renderBarChart();
  }
}

// Renderizar tabela por dia
function renderDayTable() {
  const tbody = document.getElementById('temporalTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Encontrar melhor e pior dia (baseado em CPA)
  const sortedByCPA = [...currentDataByDay].sort((a, b) => parseFloat(a.cpa) - parseFloat(b.cpa));
  const bestDay = sortedByCPA[0]?.dayShort;
  const worstDay = sortedByCPA[sortedByCPA.length - 1]?.dayShort;

  currentDataByDay.forEach(day => {
    const row = document.createElement('tr');
    
    const isBest = day.dayShort === bestDay && parseFloat(day.cpa) > 0;
    const isWorst = day.dayShort === worstDay && parseFloat(day.cpa) > 0 && bestDay !== worstDay;
    
    row.className = isBest ? 'bg-green-50' : isWorst ? 'bg-red-50' : '';

    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${day.dayName}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${formatCurrency(day.invested)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${day.messages}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${day.sales}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${formatCurrency(day.revenue)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${day.cpa > 0 ? formatCurrency(day.cpa) : '-'}</td>
    `;

    tbody.appendChild(row);
  });
}

// Renderizar análise de comparação
function renderComparisonAnalysis() {
  renderLineChart();
  renderComparisonTable();
}

// Renderizar gráfico de linha
function renderLineChart() {
  const ctx = document.getElementById('temporalLineChart');
  if (!ctx) return;

  const metric = document.getElementById('temporalComparisonMetricSelect').value;
  
  const metricLabels = {
    invested: 'Investido (R$)',
    messages: 'Mensagens',
    sales: 'Vendas',
    revenue: 'Faturamento (R$)',
    cpa: 'CPA Médio (R$)',
    roi: 'ROI'
  };

  // Agregar dados por data
  const currentByDate = aggregateByDate(currentPeriodData);
  const previousByDate = aggregateByDate(previousPeriodData);

  const dates = Object.keys(currentByDate).sort();
  const currentValues = dates.map(date => {
    const day = currentByDate[date];
    return getMetricValue(day, metric);
  });
  const previousValues = dates.map(date => {
    const day = previousByDate[date] || {};
    return getMetricValue(day, metric);
  });

  // Destruir gráfico anterior
  if (lineChart) {
    lineChart.destroy();
  }

  // Atualizar título
  document.getElementById('temporalComparisonChartTitle').textContent = `Evolução de ${metricLabels[metric]}`;

  // Criar novo gráfico
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => formatDateShort(d)),
      datasets: [
        {
          label: 'Período Atual',
          data: currentValues,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        },
        {
          label: 'Período Anterior',
          data: previousValues,
          borderColor: 'rgba(156, 163, 175, 1)',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Atualizar gráfico de linha
function updateLineChart() {
  if (currentPeriodData.length > 0 && previousPeriodData.length > 0) {
    renderLineChart();
  }
}

// Agregar dados por data
function aggregateByDate(data) {
  const byDate = {};
  
  data.forEach(item => {
    const date = item.date;
    if (!byDate[date]) {
      byDate[date] = {
        invested: 0,
        messages: 0,
        sales: 0,
        revenue: 0
      };
    }
    
    byDate[date].invested += item.invested || 0;
    byDate[date].messages += item.messages || 0;
    byDate[date].sales += item.sales || 0;
    byDate[date].revenue += item.revenue || 0;
  });

  // Calcular CPA e ROI
  Object.values(byDate).forEach(day => {
    day.cpa = day.messages > 0 ? (day.invested / day.messages) : 0;
    day.roi = day.invested > 0 ? (day.revenue / day.invested) : 0;
  });

  return byDate;
}

// Obter valor de métrica
function getMetricValue(day, metric) {
  switch(metric) {
    case 'invested': return parseFloat(day.invested || 0);
    case 'messages': return parseInt(day.messages || 0);
    case 'sales': return parseInt(day.sales || 0);
    case 'revenue': return parseFloat(day.revenue || 0);
    case 'cpa': return parseFloat(day.cpa || 0);
    case 'roi': return parseFloat(day.roi || 0);
    default: return 0;
  }
}

// Renderizar tabela de comparação
function renderComparisonTable() {
  const tbody = document.getElementById('temporalComparisonTableBody');
  if (!tbody) return;

  // Agregar totais
  const currentTotal = aggregateTotals(currentPeriodData);
  const previousTotal = aggregateTotals(previousPeriodData);

  const metrics = [
    { key: 'invested', label: 'Investido', format: 'currency' },
    { key: 'messages', label: 'Mensagens', format: 'number' },
    { key: 'sales', label: 'Vendas', format: 'number' },
    { key: 'revenue', label: 'Faturamento', format: 'currency' },
    { key: 'cpa', label: 'CPA Médio', format: 'currency' },
    { key: 'roi', label: 'ROI', format: 'roi' }
  ];

  tbody.innerHTML = '';

  metrics.forEach(metric => {
    const currentValue = getMetricValue(currentTotal, metric.key);
    const previousValue = getMetricValue(previousTotal, metric.key);
    
    const variation = previousValue > 0 
      ? ((currentValue - previousValue) / previousValue * 100).toFixed(1)
      : currentValue > 0 ? '100.0' : '0.0';
    
    const isPositive = parseFloat(variation) > 0;
    const variationClass = isPositive ? 'text-green-600' : 'text-red-600';
    const variationIcon = isPositive ? '↑' : '↓';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${metric.label}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${formatMetric(currentValue, metric.format)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatMetric(previousValue, metric.format)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${variationClass} font-medium">
        ${variationIcon} ${Math.abs(parseFloat(variation))}%
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Agregar totais
function aggregateTotals(data) {
  const total = {
    invested: 0,
    messages: 0,
    sales: 0,
    revenue: 0
  };

  data.forEach(item => {
    total.invested += item.invested || 0;
    total.messages += item.messages || 0;
    total.sales += item.sales || 0;
    total.revenue += item.revenue || 0;
  });

  total.cpa = total.messages > 0 ? (total.invested / total.messages) : 0;
  total.roi = total.invested > 0 ? (total.revenue / total.invested) : 0;

  return total;
}

// Gerar insights automáticos
function generateInsights() {
  const insightsContainer = document.getElementById('temporalInsights');
  if (!insightsContainer) return;

  insightsContainer.innerHTML = '';
  const insights = [];

  // Encontrar melhor e pior dia
  const sortedByCPA = [...currentDataByDay].sort((a, b) => parseFloat(a.cpa) - parseFloat(b.cpa));
  const bestDay = sortedByCPA[0];
  const worstDay = sortedByCPA[sortedByCPA.length - 1];

  if (bestDay && parseFloat(bestDay.cpa) > 0) {
    const avgCPA = currentDataByDay.reduce((sum, d) => sum + parseFloat(d.cpa), 0) / currentDataByDay.length;
    const diff = ((avgCPA - parseFloat(bestDay.cpa)) / avgCPA * 100).toFixed(1);
    insights.push({
      text: `${bestDay.dayName} é o dia mais eficiente da semana, com CPA ${diff}% menor que a média (${formatCurrency(bestDay.cpa)} vs ${formatCurrency(avgCPA)})`,
      type: 'positive'
    });
  }

  // Comparar fins de semana vs dias úteis
  const weekdays = currentDataByDay.slice(0, 5); // Segunda a Sexta
  const weekend = currentDataByDay.slice(5); // Sábado e Domingo
  
  const weekdayCPA = weekdays.reduce((sum, d) => sum + parseFloat(d.cpa), 0) / weekdays.length;
  const weekendCPA = weekend.reduce((sum, d) => sum + parseFloat(d.cpa), 0) / weekend.length;

  if (weekendCPA > 0 && weekdayCPA > 0) {
    const diff = ((weekdayCPA - weekendCPA) / weekdayCPA * 100).toFixed(1);
    if (parseFloat(diff) > 10) {
      insights.push({
        text: `Fins de semana têm menor volume de mensagens, mas apresentam CPA ${Math.abs(parseFloat(diff))}% ${parseFloat(diff) > 0 ? 'melhor' : 'pior'} que dias úteis`,
        type: parseFloat(diff) > 0 ? 'positive' : 'warning'
      });
    }
  }

  // Comparar períodos
  const currentTotal = aggregateTotals(currentPeriodData);
  const previousTotal = aggregateTotals(previousPeriodData);
  
  if (previousTotal.messages > 0) {
    const messagesDiff = ((currentTotal.messages - previousTotal.messages) / previousTotal.messages * 100).toFixed(1);
    if (Math.abs(parseFloat(messagesDiff)) > 10) {
      insights.push({
        text: `Mensagens ${parseFloat(messagesDiff) > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(parseFloat(messagesDiff))}% comparado ao período anterior`,
        type: parseFloat(messagesDiff) > 0 ? 'positive' : 'warning'
      });
    }
  }

  // Renderizar insights
  insights.forEach(insight => {
    const div = document.createElement('div');
    div.className = `p-3 rounded-lg ${insight.type === 'positive' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`;
    div.innerHTML = `<p class="text-sm text-gray-700">📌 ${insight.text}</p>`;
    insightsContainer.appendChild(div);
  });
}

// Formatar moeda
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// Formatar métrica
function formatMetric(value, format) {
  switch(format) {
    case 'currency':
      return formatCurrency(value);
    case 'roi':
      return parseFloat(value).toFixed(2) + 'x';
    default:
      return new Intl.NumberFormat('pt-BR').format(value || 0);
  }
}

// Formatar data curta
function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// Ordenar tabela
function sortTable(column) {
  // Implementar ordenação se necessário
  console.log('Ordenar por:', column);
}

// Exportar para Excel
function exportToExcel() {
  if (currentDataByDay.length === 0) {
    alert('Nenhum dado para exportar');
    return;
  }

  const data = currentDataByDay.map(day => ({
    'Dia da Semana': day.dayName,
    'Investido (R$)': day.invested,
    'Mensagens': day.messages,
    'Vendas': day.sales,
    'Faturamento (R$)': day.revenue,
    'CPA Médio (R$)': day.cpa > 0 ? day.cpa : 0,
    'ROI': day.roi > 0 ? day.roi.toFixed(2) + 'x' : '0x'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Análise Temporal');
  
  const fileName = `analise-temporal-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

