// Dashboard - Funil de Conversão
// Visualização completa do fluxo de conversão: Impressões → Cliques → Mensagens → Orçamentos → Vendas
import { extractAllMessagesAndLeads } from './utils/messagesExtractor.js';

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
let funilChart = null;
let funilChartMeta = null;
let funilChartGoogle = null;
let currentFunnelData = null;
let previousFunnelData = null;
let platformData = { meta: null, google: null };

// Inicialização
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadFunilProjects();
    setupFunilEventListeners();
  } else {
    window.location.href = '/login.html';
  }
});

// Carregar projetos
async function loadFunilProjects() {
  try {
    const projectSelect = document.getElementById('funilProjectSelect');
    projectSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    
    const projects = await projectsService.listProjects();
    
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || 'Sem nome';
      projectSelect.appendChild(option);
    });

    // Auto-selecionar se houver apenas um projeto
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      currentProject = projects[0];
      await loadFunilUnits(projects[0].id);
    }
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
  }
}

// Carregar unidades
async function loadFunilUnits(projectId) {
  try {
    const unitSelect = document.getElementById('funilUnitsSelect');
    unitSelect.innerHTML = '<option value="all" selected>Todas as unidades</option>';
    
    allUnits = await unitsService.listUnits(projectId);
    
    allUnits.forEach(unit => {
      const option = document.createElement('option');
      option.value = unit.id;
      option.textContent = unit.name || 'Sem nome';
      unitSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Erro ao carregar unidades:', error);
  }
}

// Configurar event listeners
function setupFunilEventListeners() {
  // Seleção de projeto
  document.getElementById('funilProjectSelect').addEventListener('change', async (e) => {
    const projectId = e.target.value;
    if (projectId) {
      const projects = await projectsService.listProjects();
      currentProject = projects.find(p => p.id === projectId);
      await loadFunilUnits(projectId);
    }
  });

  // Período personalizado
  document.getElementById('funilPeriodSelect').addEventListener('change', (e) => {
    const customPeriodDiv = document.getElementById('funilCustomPeriodDiv');
    if (e.target.value === 'custom') {
      customPeriodDiv.classList.remove('hidden');
    } else {
      customPeriodDiv.classList.add('hidden');
    }
  });

  // Botão Gerar Funil
  document.getElementById('funilGenerateBtn').addEventListener('click', generateFunnel);
  
  // Botões de exportação
  document.getElementById('funilExportPDFBtn').addEventListener('click', exportFunnelToPDF);
  document.getElementById('funilExportXLSXBtn').addEventListener('click', exportFunnelToXLSX);

  // Tabs de visualização
  document.getElementById('funilTabCompleto').addEventListener('click', () => switchFunilTab('Completo'));
  document.getElementById('funilTabPlataforma').addEventListener('click', () => switchFunilTab('Plataforma'));
}

// Trocar aba de visualização
function switchFunilTab(tabName) {
  // Remover classe active de todas as tabs
  document.querySelectorAll('.funil-tab').forEach(tab => {
    tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
    tab.classList.add('border-transparent', 'text-gray-500');
  });

  // Ocultar todo o conteúdo
  document.querySelectorAll('.funil-content').forEach(content => {
    content.classList.add('hidden');
  });

  // Ativar a tab clicada
  const activeTab = document.getElementById(`funilTab${tabName}`);
  if (activeTab) {
    activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }

  // Mostrar o conteúdo correspondente
  const activeContent = document.getElementById(`funilContent${tabName}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }

  // Renderizar gráficos específicos se necessário
  if (tabName === 'Plataforma' && platformData.meta && platformData.google) {
    renderPlatformFunnels();
    renderPlatformComparison();
  }
}

// Calcular datas do período
function calculateFunilPeriodDates(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate, endDate;
  
  switch (period) {
    case 'last7days':
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6); // Últimos 7 dias (incluindo hoje)
      break;
    case 'thisMonth':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today);
      break;
    case 'lastMonth':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'custom':
      const customStart = document.getElementById('funilCustomStartDate').value;
      const customEnd = document.getElementById('funilCustomEndDate').value;
      if (!customStart || !customEnd) {
        alert('Selecione as datas personalizadas');
        return null;
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      break;
    default:
      alert('Período inválido');
      return null;
  }
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Gerar funil
async function generateFunnel() {
  const projectId = document.getElementById('funilProjectSelect').value;
  const period = document.getElementById('funilPeriodSelect').value;
  const unitId = document.getElementById('funilUnitsSelect').value;

  if (!projectId) {
    alert('Selecione um projeto');
    return;
  }

  const dates = calculateFunilPeriodDates(period);
  if (!dates) return;

  // Mostrar loading
  const loadingEl = document.getElementById('funilLoading');
  const contentEl = document.getElementById('funilContent');
  
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');

  try {
    // Determinar unidades a processar
    const unitsToProcess = unitId === 'all' 
      ? allUnits 
      : allUnits.filter(u => u.id === unitId);

    if (unitsToProcess.length === 0) {
      alert('Nenhuma unidade encontrada');
      loadingEl.classList.add('hidden');
      return;
    }

    // Calcular período anterior para comparação
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

    console.log('📊 Gerando funil de conversão...', { projectId, period, dates, previousDates });

    // Buscar dados do período atual
    currentFunnelData = await aggregateFunnelData(unitsToProcess, dates.start, dates.end);
    console.log('✅ Dados do período atual:', currentFunnelData);

    // Buscar dados do período anterior
    previousFunnelData = await aggregateFunnelData(unitsToProcess, previousDates.start, previousDates.end);
    console.log('✅ Dados do período anterior:', previousFunnelData);

    // Buscar dados por plataforma
    platformData = await aggregateFunnelDataByPlatform(unitsToProcess, dates.start, dates.end);
    console.log('✅ Dados por plataforma:', platformData);

    // Renderizar funil completo
    renderFunnel();
    renderFunnelTable();
    renderBottlenecks();
    renderMetrics();

    // Renderizar funis por plataforma
    renderPlatformFunnels();
    renderPlatformComparison();

    // Ocultar loading e mostrar conteúdo
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    console.log('✅ Funil de conversão gerado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao gerar funil:', error);
    loadingEl.classList.add('hidden');
    alert('Erro ao gerar funil. Verifique o console para mais detalhes.');
  }
}

// Agregar dados do funil
async function aggregateFunnelData(units, startDate, endDate) {
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalMessages = 0;
  let totalOrcamentos = 0;
  let totalVendas = 0;
  let totalRevenue = 0;
  let totalInvested = 0;

  for (const unit of units) {
    console.log(`📊 Processando unidade: ${unit.name}`);

    // Dados de tráfego (Meta + Google)
    const trafficData = await getTrafficDataForFunnel(unit, startDate, endDate);
    totalImpressions += trafficData.impressions;
    totalClicks += trafficData.clicks;
    totalMessages += trafficData.messages;
    totalInvested += trafficData.invested;

    // Dados da planilha
    const spreadsheetData = getSpreadsheetDataForFunnel(unit, startDate, endDate);
    totalOrcamentos += spreadsheetData.orcamentos;
    totalVendas += spreadsheetData.vendas;
    totalRevenue += spreadsheetData.revenue;
  }

  return {
    impressions: totalImpressions,
    clicks: totalClicks,
    messages: totalMessages,
    orcamentos: totalOrcamentos,
    vendas: totalVendas,
    revenue: totalRevenue,
    invested: totalInvested
  };
}

// Buscar dados de tráfego para o funil
async function getTrafficDataForFunnel(unit, startDate, endDate) {
  let impressions = 0;
  let clicks = 0;
  let messages = 0;
  let invested = 0;

  const linkedAccounts = unit.linkedAccounts || {};

  try {
    // Meta Ads
    if (linkedAccounts.meta?.id && fbAuth?.getAccessToken && fbAuth.getAccessToken()) {
      const token = fbAuth.getAccessToken();
      if (token) {
        try {
          const fbService = new FacebookInsightsService(token);
          const insights = await fbService.getAccountInsights(
            linkedAccounts.meta.id,
            startDate,
            endDate
          );

          if (insights) {
            impressions += parseInt(insights.impressions || 0);
            clicks += parseInt(insights.clicks || 0);
            
            // Usar apenas métrica principal para evitar duplicação
            const messageAction = insights.actions?.find(action => 
              action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            );
            let messagesCount = 0;
            if (messageAction && messageAction.value) {
              messagesCount = parseInt(messageAction.value) || 0;
            } else {
              // Fallback: se não tiver a métrica principal, usar lead_grouped
              const leadAction = insights.actions?.find(action => 
                action.action_type === 'onsite_conversion.lead_grouped'
              );
              if (leadAction && leadAction.value) {
                messagesCount = parseInt(leadAction.value) || 0;
              }
            }
            messages += messagesCount;
            
            invested += parseFloat(insights.spend || 0);
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar dados do Meta:', error);
        }
      }
    }

    // Google Ads
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
          
          const insights = await googleService.getAccountInsights(startDate, endDate);
          
          if (insights && !insights.error) {
            const metrics = insights.metrics || insights;
            impressions += parseInt(metrics.impressions || 0);
            clicks += parseInt(metrics.clicks || 0);
            messages += parseInt(metrics.conversions || 0); // Conversões do Google = mensagens
            invested += parseFloat(metrics.cost || 0);
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar dados do Google:', error);
      }
    }
  } catch (error) {
    console.warn('⚠️ Erro ao buscar dados de tráfego:', error);
  }

  return { impressions, clicks, messages, invested };
}

// Buscar dados da planilha para o funil
function getSpreadsheetDataForFunnel(unit, startDate, endDate) {
  if (!unit.budgetData || !unit.budgetData.rawData) {
    return { orcamentos: 0, vendas: 0, revenue: 0 };
  }

  const data = unit.budgetData.rawData.filter(item => {
    const itemDate = item.date;
    return itemDate >= startDate && itemDate <= endDate;
  });

  const orcamentos = data.length;
  const vendas = data.filter(item => item.status === 'APPROVED').length;
  const revenue = data
    .filter(item => item.status === 'APPROVED')
    .reduce((sum, item) => sum + parseFloat(item.value || item.saleValue || item.revenue || item.faturamento || 0), 0);

  return { orcamentos, vendas, revenue };
}

// Agregar dados do funil por plataforma
async function aggregateFunnelDataByPlatform(units, startDate, endDate) {
  let metaData = {
    impressions: 0,
    clicks: 0,
    messages: 0,
    invested: 0
  };

  let googleData = {
    impressions: 0,
    clicks: 0,
    messages: 0,
    invested: 0
  };

  for (const unit of units) {
    const linkedAccounts = unit.linkedAccounts || {};

    // Meta Ads
    if (linkedAccounts.meta?.id && fbAuth?.getAccessToken && fbAuth.getAccessToken()) {
      const token = fbAuth.getAccessToken();
      if (token) {
        try {
          const fbService = new FacebookInsightsService(token);
          const insights = await fbService.getAccountInsights(
            linkedAccounts.meta.id,
            startDate,
            endDate
          );

          if (insights) {
            metaData.impressions += parseInt(insights.impressions || 0);
            metaData.clicks += parseInt(insights.clicks || 0);
            
            // Usar apenas métrica principal para evitar duplicação
            const messageAction = insights.actions?.find(action => 
              action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            );
            let messagesCount = 0;
            if (messageAction && messageAction.value) {
              messagesCount = parseInt(messageAction.value) || 0;
            } else {
              // Fallback: se não tiver a métrica principal, usar lead_grouped
              const leadAction = insights.actions?.find(action => 
                action.action_type === 'onsite_conversion.lead_grouped'
              );
              if (leadAction && leadAction.value) {
                messagesCount = parseInt(leadAction.value) || 0;
              }
            }
            metaData.messages += messagesCount;
            
            metaData.invested += parseFloat(insights.spend || 0);
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar dados do Meta:', error);
        }
      }
    }

    // Google Ads
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
          
          const insights = await googleService.getAccountInsights(startDate, endDate);
          
          if (insights && !insights.error) {
            const metrics = insights.metrics || insights;
            googleData.impressions += parseInt(metrics.impressions || 0);
            googleData.clicks += parseInt(metrics.clicks || 0);
            googleData.messages += parseInt(metrics.conversions || 0);
            googleData.invested += parseFloat(metrics.cost || 0);
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar dados do Google:', error);
      }
    }
  }

  // Adicionar dados da planilha (dividir proporcionalmente ou usar para ambas)
  // Por enquanto, vamos usar os mesmos dados de orçamentos/vendas para ambas as plataformas
  // (poderia ser melhorado com tracking de origem)
  const totalOrcamentos = units.reduce((sum, unit) => {
    const data = getSpreadsheetDataForFunnel(unit, startDate, endDate);
    return sum + data.orcamentos;
  }, 0);

  const totalVendas = units.reduce((sum, unit) => {
    const data = getSpreadsheetDataForFunnel(unit, startDate, endDate);
    return sum + data.vendas;
  }, 0);

  const totalRevenue = units.reduce((sum, unit) => {
    const data = getSpreadsheetDataForFunnel(unit, startDate, endDate);
    return sum + data.revenue;
  }, 0);

  // Dividir proporcionalmente pelo investimento
  const totalInvested = metaData.invested + googleData.invested;
  const metaRatio = totalInvested > 0 ? metaData.invested / totalInvested : 0.5;
  const googleRatio = totalInvested > 0 ? googleData.invested / totalInvested : 0.5;

  metaData.orcamentos = Math.round(totalOrcamentos * metaRatio);
  metaData.vendas = Math.round(totalVendas * metaRatio);
  metaData.revenue = totalRevenue * metaRatio;

  googleData.orcamentos = Math.round(totalOrcamentos * googleRatio);
  googleData.vendas = Math.round(totalVendas * googleRatio);
  googleData.revenue = totalRevenue * googleRatio;

  return { meta: metaData, google: googleData };
}

// Renderizar funis por plataforma
function renderPlatformFunnels() {
  if (!platformData.meta || !platformData.google) return;

  // Meta Ads
  renderPlatformFunnel('funilChartMeta', platformData.meta, 'Meta Ads');

  // Google Ads
  renderPlatformFunnel('funilChartGoogle', platformData.google, 'Google Ads');
}

// Renderizar funil de uma plataforma específica
function renderPlatformFunnel(containerId, data, platformName) {
  // Encontrar o container
  const chartContainer = document.getElementById(containerId);
  if (!chartContainer) return;

  // Limpar container (remover canvas anterior se existir)
  const canvasEl = chartContainer.querySelector('canvas');
  if (canvasEl) {
    canvasEl.remove();
  }

  // Limpar referências antigas
  if (containerId === 'funilChartMeta' && funilChartMeta) {
    funilChartMeta = null;
  } else if (containerId === 'funilChartGoogle' && funilChartGoogle) {
    funilChartGoogle = null;
  }

  // Criar canvas com alta resolução
  const canvas = document.createElement('canvas');
  canvas.id = containerId;
  
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = 650;
  const displayHeight = 350;
  
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  canvas.style.maxHeight = displayHeight + 'px';
  canvas.style.display = 'block';
  canvas.style.imageRendering = 'crisp-edges';
  chartContainer.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  const width = displayWidth;
  const height = displayHeight;

  // Definir etapas do funil
  const steps = [
    { 
      name: 'Cliques', 
      value: data.clicks,
      conversionRate: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Mensagens', 
      value: data.messages,
      conversionRate: data.clicks > 0 ? ((data.messages / data.clicks) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Orçamentos', 
      value: data.orcamentos || 0,
      conversionRate: data.messages > 0 ? ((data.orcamentos / data.messages) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Vendas', 
      value: data.vendas || 0,
      conversionRate: data.orcamentos > 0 ? ((data.vendas / data.orcamentos) * 100).toFixed(2) + '%' : '-'
    }
  ];

  // Configurações do funil (plataforma)
  const funnelTopWidth = 400;
  const funnelBottomWidth = 130;
  const barHeight = 55;
  const barSpacing = 20;
  const startY = 40;
  const leftMargin = 120;
  const rightMargin = 15;

  // Calcular larguras das barras (fixas)
  const totalSteps = steps.length;
  const widthDecrement = (funnelTopWidth - funnelBottomWidth) / (totalSteps - 1);

  steps.forEach((step, index) => {
    const barWidth = funnelTopWidth - (widthDecrement * index);
    // Todas as barras alinhadas à esquerda
    const x = leftMargin;
    const y = startY + (barHeight + barSpacing) * index;

    // Taxa de conversão à esquerda
    ctx.fillStyle = '#6B7280';
    ctx.font = '13px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      step.conversionRate,
      x - 12,
      y + barHeight / 2
    );

    // Desenhar barra
    drawFunnelBar(ctx, x, y, barWidth, barHeight, index);

    // Valor no centro
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const valueText = step.value.toLocaleString('pt-BR');
    const valueWidth = ctx.measureText(valueText).width;
    if (valueWidth < barWidth - 20) {
      ctx.fillText(
        valueText,
        x + barWidth / 2,
        y + barHeight / 2
      );
    } else {
      ctx.font = 'bold 15px Arial';
      ctx.fillText(
        valueText,
        x + barWidth / 2,
        y + barHeight / 2
      );
    }

    // Nome da métrica à direita (completo)
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      step.name,
      x + barWidth + 12,
      y + barHeight / 2
    );
  });

  // Salvar referência do canvas
  if (containerId === 'funilChartMeta') {
    funilChartMeta = canvas;
  } else if (containerId === 'funilChartGoogle') {
    funilChartGoogle = canvas;
  }
}

// Renderizar comparação de plataformas
function renderPlatformComparison() {
  const tbody = document.getElementById('funilComparisonTableBody');
  if (!tbody || !platformData.meta || !platformData.google) return;

  tbody.innerHTML = '';

  const metrics = [
    { key: 'clicks', label: 'Cliques' },
    { key: 'messages', label: 'Mensagens' },
    { key: 'orcamentos', label: 'Orçamentos' },
    { key: 'vendas', label: 'Vendas' },
    { key: 'invested', label: 'Investido', format: 'currency' }
  ];

  metrics.forEach(metric => {
    const metaValue = platformData.meta[metric.key] || 0;
    const googleValue = platformData.google[metric.key] || 0;
    const total = metaValue + googleValue;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${metric.label}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
        ${metric.format === 'currency' 
          ? formatCurrency(metaValue) 
          : metaValue.toLocaleString('pt-BR')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
        ${metric.format === 'currency' 
          ? formatCurrency(googleValue) 
          : googleValue.toLocaleString('pt-BR')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
        ${metric.format === 'currency' 
          ? formatCurrency(total) 
          : total.toLocaleString('pt-BR')}
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Formatar moeda
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// Renderizar funil visual com design fixo
function renderFunnel() {
  const container = document.getElementById('funilVisualization');
  if (!container || !currentFunnelData) return;

  // Limpar container anterior
  container.innerHTML = '';
  
  // Destruir gráfico Chart.js se existir
  if (funilChart) {
    if (typeof funilChart.destroy === 'function') {
      funilChart.destroy();
    }
    funilChart = null;
  }

  const data = currentFunnelData;
  
  // Definir etapas do funil
  const steps = [
    { 
      name: 'Cliques', 
      value: data.clicks,
      conversionRate: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Mensagens', 
      value: data.messages,
      conversionRate: data.clicks > 0 ? ((data.messages / data.clicks) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Orçamentos', 
      value: data.orcamentos,
      conversionRate: data.messages > 0 ? ((data.orcamentos / data.messages) * 100).toFixed(2) + '%' : '-'
    },
    { 
      name: 'Vendas', 
      value: data.vendas,
      conversionRate: data.orcamentos > 0 ? ((data.vendas / data.orcamentos) * 100).toFixed(2) + '%' : '-'
    }
  ];

  // Criar canvas para o funil com alta resolução (retina/high DPI)
  const canvas = document.createElement('canvas');
  canvas.id = 'funilChart';
  
  // Obter device pixel ratio para alta qualidade
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = 900;
  const displayHeight = 450;
  
  // Definir tamanho real do canvas (multiplicado pelo DPR)
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  // Definir tamanho de exibição
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  canvas.style.maxHeight = displayHeight + 'px';
  canvas.style.display = 'block';
  canvas.style.imageRendering = 'crisp-edges';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  
  // Escalar o contexto para alta resolução
  ctx.scale(dpr, dpr);
  
  const width = displayWidth;
  const height = displayHeight;

  // Configurações do funil
  const funnelTopWidth = 600;
  const funnelBottomWidth = 200;
  const barHeight = 70;
  const barSpacing = 25;
  const startY = 60;
  const leftMargin = 180; // Espaço para taxa de conversão
  const rightMargin = 20; // Espaço para nome da métrica

  // Calcular larguras das barras (fixas, não baseadas no valor)
  const totalSteps = steps.length;
  const widthDecrement = (funnelTopWidth - funnelBottomWidth) / (totalSteps - 1);

  steps.forEach((step, index) => {
    const barWidth = funnelTopWidth - (widthDecrement * index);
    // Todas as barras começam na mesma posição X (alinhadas à esquerda)
    const x = leftMargin;
    const y = startY + (barHeight + barSpacing) * index;

    // Desenhar taxa de conversão no lado esquerdo (antes da barra)
    ctx.fillStyle = '#6B7280'; // Cinza médio
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    // Medir texto para garantir que não corte
    const conversionText = step.conversionRate;
    const conversionWidth = ctx.measureText(conversionText).width;
    ctx.fillText(
      conversionText,
      x - 15,
      y + barHeight / 2
    );

    // Desenhar barra principal (funil 3D)
    drawFunnelBar(ctx, x, y, barWidth, barHeight, index);

    // Desenhar valor no centro da barra (fonte branca)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Verificar se o valor cabe na barra
    const valueText = step.value.toLocaleString('pt-BR');
    const valueWidth = ctx.measureText(valueText).width;
    if (valueWidth < barWidth - 20) {
      ctx.fillText(
        valueText,
        x + barWidth / 2,
        y + barHeight / 2
      );
    } else {
      // Se não couber, usar fonte menor
      ctx.font = 'bold 18px Arial';
      ctx.fillText(
        valueText,
        x + barWidth / 2,
        y + barHeight / 2
      );
    }

    // Desenhar nome da métrica no lado direito (completar o texto)
    ctx.fillStyle = '#1F2937'; // Cinza muito escuro
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Garantir que o nome completo seja exibido
    const metricName = step.name;
    ctx.fillText(
      metricName,
      x + barWidth + 15,
      y + barHeight / 2
    );
  });

  // Salvar referência do canvas
  funilChart = canvas;
}

// Desenhar barra do funil com efeito 3D melhorado e alta qualidade
function drawFunnelBar(ctx, x, y, width, height, index) {
  // Cor azul gradiente mais suave e moderna
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, '#60A5FA'); // Azul claro vibrante
  gradient.addColorStop(0.3, '#3B82F6'); // Azul médio
  gradient.addColorStop(0.7, '#2563EB'); // Azul escuro
  gradient.addColorStop(1, '#1E40AF'); // Azul muito escuro na base

  // Sombra externa para profundidade (mais suave)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  // Desenhar barra principal com bordas arredondadas
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.fill();

  // Resetar sombra
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Destaque no topo (brilho mais pronunciado)
  const highlightGradient = ctx.createLinearGradient(x, y, x, y + 25);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = highlightGradient;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, width - 4, 25, 10);
  ctx.fill();

  // Borda sutil no topo para definição
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.stroke();
}

// Polyfill para roundRect se não estiver disponível
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

// Renderizar tabela do funil
function renderFunnelTable() {
  const tbody = document.getElementById('funilTableBody');
  if (!tbody || !currentFunnelData) return;

  tbody.innerHTML = '';

  const data = currentFunnelData;
  // Remover Impressões da tabela (começar em Cliques)
  const steps = [
    { name: 'Cliques', value: data.clicks, color: 'bg-blue-200' },
    { name: 'Mensagens', value: data.messages, color: 'bg-green-100' },
    { name: 'Orçamentos', value: data.orcamentos, color: 'bg-yellow-100' },
    { name: 'Vendas', value: data.vendas, color: 'bg-green-200' }
  ];

  steps.forEach((step, index) => {
    // Taxa de conversão em relação à etapa anterior
    let conversionRate = '-';
    
    if (index > 0) {
      const previousValue = steps[index - 1].value;
      if (previousValue > 0) {
        conversionRate = ((step.value / previousValue) * 100).toFixed(2) + '%';
      }
    } else {
      // Primeira etapa (Cliques) - taxa de conversão em relação a impressões
      if (data.impressions > 0) {
        conversionRate = ((data.clicks / data.impressions) * 100).toFixed(2) + '%';
      }
    }

    const row = document.createElement('tr');
    row.className = step.color;
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${step.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${step.value.toLocaleString('pt-BR')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${conversionRate}</td>
    `;

    tbody.appendChild(row);
  });
}

// Renderizar métricas principais
function renderMetrics() {
  if (!currentFunnelData) return;

  const data = currentFunnelData;
  
    // Taxa de conversão geral (Cliques → Vendas)
    // Mostrar também taxa de Impressões → Vendas como informação adicional
    const conversionRate = data.clicks > 0 
      ? ((data.vendas / data.clicks) * 100).toFixed(2)
      : 0;
    
    // Taxa de Impressões → Vendas (para referência, mas não no card principal)
    const fullConversionRate = data.impressions > 0 
      ? ((data.vendas / data.impressions) * 100).toFixed(4)
      : 0;
  
  // CPA
  const cpa = data.vendas > 0 
    ? (data.invested / data.vendas).toFixed(2)
    : 0;
  
  // ROI
  const roi = data.invested > 0 
    ? ((data.revenue * 0.25) / data.invested).toFixed(2)
    : 0;

  // Comparação com período anterior
  let conversionRateChange = '';
  let cpaChange = '';
  let roiChange = '';

  if (previousFunnelData) {
    const prevConversionRate = previousFunnelData.clicks > 0 
      ? ((previousFunnelData.vendas / previousFunnelData.clicks) * 100).toFixed(2)
      : 0;
    const diff = (parseFloat(conversionRate) - parseFloat(prevConversionRate)).toFixed(2);
    conversionRateChange = diff > 0 
      ? `↑ +${diff}% vs período anterior`
      : diff < 0 
        ? `↓ ${diff}% vs período anterior`
        : 'Sem alteração';

    const prevCPA = previousFunnelData.vendas > 0 
      ? (previousFunnelData.invested / previousFunnelData.vendas).toFixed(2)
      : 0;
    const cpaDiff = (parseFloat(cpa) - parseFloat(prevCPA)).toFixed(2);
    cpaChange = cpaDiff > 0 
      ? `↑ +R$ ${cpaDiff} vs período anterior`
      : cpaDiff < 0 
        ? `↓ R$ ${Math.abs(cpaDiff)} vs período anterior`
        : 'Sem alteração';

    const prevROI = previousFunnelData.invested > 0 
      ? ((previousFunnelData.revenue * 0.25) / previousFunnelData.invested).toFixed(2)
      : 0;
    const roiDiff = (parseFloat(roi) - parseFloat(prevROI)).toFixed(2);
    roiChange = roiDiff > 0 
      ? `↑ +${roiDiff}x vs período anterior`
      : roiDiff < 0 
        ? `↓ ${roiDiff}x vs período anterior`
        : 'Sem alteração';
  }

  document.getElementById('funilConversionRate').textContent = `${conversionRate}%`;
  document.getElementById('funilConversionRateChange').textContent = conversionRateChange || 'vs período anterior';
  
  document.getElementById('funilCPA').textContent = `R$ ${parseFloat(cpa).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('funilCPAChange').textContent = cpaChange || 'vs período anterior';
  
  document.getElementById('funilROI').textContent = `${roi}x`;
  document.getElementById('funilROIChange').textContent = roiChange || 'vs período anterior';
}

// Renderizar análise de gargalos
function renderBottlenecks() {
  const container = document.getElementById('funilBottlenecks');
  if (!container || !currentFunnelData) return;

  container.innerHTML = '';

  const data = currentFunnelData;
  const previous = previousFunnelData;
  
  // Analisar apenas: Mensagens → Orçamentos e Orçamentos → Vendas
  // (remover Cliques → Mensagens da análise)
  const steps = [
    { name: 'Mensagens', value: data.messages, previousValue: previous?.messages || null },
    { name: 'Orçamentos', value: data.orcamentos, previousValue: previous?.orcamentos || null },
    { name: 'Vendas', value: data.vendas, previousValue: previous?.vendas || null }
  ];

  let maxLoss = 0;
  let maxLossStep = null;
  let maxLossPercentage = 0;

  // Analisar apenas as duas transições relevantes
  for (let i = 0; i < steps.length - 1; i++) {
    const loss = steps[i].value - steps[i + 1].value;
    const lossPercentage = steps[i].value > 0 ? (loss / steps[i].value * 100) : 0;
    
    if (loss > maxLoss) {
      maxLoss = loss;
      maxLossStep = steps[i].name;
      maxLossPercentage = lossPercentage;
    }
  }

  // Criar card de maior perda
  if (maxLossStep) {
    const lossCard = document.createElement('div');
    lossCard.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4';
    lossCard.innerHTML = `
      <div class="flex items-start gap-3">
        <i class="fas fa-exclamation-triangle text-yellow-600 text-xl mt-1"></i>
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900 mb-1">⚠️ Maior Perda</h3>
          <p class="text-sm text-gray-700 mb-2">
            <strong>${maxLossStep}</strong> → <strong>${steps[steps.findIndex(s => s.name === maxLossStep) + 1]?.name}</strong>
          </p>
          <p class="text-sm text-gray-600">
            Perda: <strong>${maxLoss.toLocaleString('pt-BR')}</strong> (${maxLossPercentage.toFixed(1)}% de abandono)
          </p>
          <div class="mt-3">
            <h4 class="text-sm font-medium text-gray-700 mb-1">💡 Recomendações:</h4>
            <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
              ${getRecommendations(maxLossStep)}
            </ul>
          </div>
        </div>
      </div>
    `;
    container.appendChild(lossCard);
  }

  // Encontrar melhor conversão (apenas entre Mensagens→Orçamentos e Orçamentos→Vendas)
  let bestConversion = 0;
  let bestConversionStep = null;

  for (let i = 0; i < steps.length - 1; i++) {
    if (steps[i].value > 0) {
      const conversionRate = (steps[i + 1].value / steps[i].value * 100);
      if (conversionRate > bestConversion) {
        bestConversion = conversionRate;
        bestConversionStep = steps[i].name;
      }
    }
  }

  // Adicionar análises de comparação com período anterior
  addPeriodComparison(container, steps, data, previous);

  // Criar card de melhor conversão
  if (bestConversionStep && bestConversion > 0) {
    const successCard = document.createElement('div');
    successCard.className = 'bg-green-50 border border-green-200 rounded-lg p-4';
    successCard.innerHTML = `
      <div class="flex items-start gap-3">
        <i class="fas fa-check-circle text-green-600 text-xl mt-1"></i>
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900 mb-1">✅ Ponto Forte</h3>
          <p class="text-sm text-gray-700 mb-2">
            <strong>${bestConversionStep}</strong> → <strong>${steps[steps.findIndex(s => s.name === bestConversionStep) + 1]?.name}</strong>
          </p>
          <p class="text-sm text-gray-600">
            Taxa de conversão: <strong>${bestConversion.toFixed(1)}%</strong> (acima da média)
          </p>
        </div>
      </div>
    `;
    container.appendChild(successCard);
  }
}

// Adicionar comparação com período anterior
function addPeriodComparison(container, steps, currentData, previousData) {
  if (!previousData) return;

  // Comparar Mensagens
  if (steps[0].previousValue !== null && steps[0].previousValue > 0) {
    const currentMessages = steps[0].value;
    const previousMessages = steps[0].previousValue;
    const change = ((currentMessages - previousMessages) / previousMessages * 100);
    const changeAbs = Math.abs(change).toFixed(1);

    if (Math.abs(change) > 5) { // Só mostrar se houver mudança significativa
      const comparisonCard = document.createElement('div');
      comparisonCard.className = change > 0 
        ? 'bg-blue-50 border border-blue-200 rounded-lg p-4'
        : 'bg-yellow-50 border border-yellow-200 rounded-lg p-4';
      
      const icon = change > 0 ? '📈' : '📉';
      const direction = change > 0 ? 'aumento' : 'queda';
      
      comparisonCard.innerHTML = `
        <div class="flex items-start gap-3">
          <span class="text-2xl">${icon}</span>
          <div>
            <h3 class="font-semibold text-gray-900 mb-1">Comparação com Período Anterior</h3>
            <p class="text-sm text-gray-700">
              Tivemos uma ${direction} de ${changeAbs}% no número de mensagens em comparação com o período anterior 
              (${previousMessages.toLocaleString('pt-BR')} → ${currentMessages.toLocaleString('pt-BR')}).
            </p>
          </div>
        </div>
      `;
      container.appendChild(comparisonCard);
    }
  }

  // Comparar taxa de conversão Mensagens → Orçamentos
  if (steps[0].value > 0 && steps[1].value > 0 && 
      steps[0].previousValue !== null && steps[0].previousValue > 0 && steps[1].previousValue > 0) {
    const currentRate = (steps[1].value / steps[0].value * 100);
    const previousRate = (steps[1].previousValue / steps[0].previousValue * 100);
    const rateChange = currentRate - previousRate;

    if (Math.abs(rateChange) > 5) { // Só mostrar se houver mudança significativa
      const comparisonCard = document.createElement('div');
      comparisonCard.className = rateChange > 0 
        ? 'bg-green-50 border border-green-200 rounded-lg p-4 mt-4'
        : 'bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4';
      
      const icon = rateChange > 0 ? '✅' : '⚠️';
      const direction = rateChange > 0 ? 'aumentou' : 'diminuiu';
      
      comparisonCard.innerHTML = `
        <div class="flex items-start gap-3">
          <span class="text-2xl">${icon}</span>
          <div>
            <h3 class="font-semibold text-gray-900 mb-1">Taxa de Conversão Mensagens → Orçamentos</h3>
            <p class="text-sm text-gray-700">
              A taxa de conversão de mensagens para orçamentos ${direction} consideravelmente neste período 
              (${previousRate.toFixed(2)}% → ${currentRate.toFixed(2)}%, ${rateChange > 0 ? '+' : ''}${rateChange.toFixed(2)} pontos percentuais).
            </p>
          </div>
        </div>
      `;
      container.appendChild(comparisonCard);
    }
  }

  // Comparar taxa de conversão Orçamentos → Vendas
  if (steps[1].value > 0 && steps[2].value > 0 &&
      steps[1].previousValue !== null && steps[1].previousValue > 0 && steps[2].previousValue > 0) {
    const currentRate = (steps[2].value / steps[1].value * 100);
    const previousRate = (steps[2].previousValue / steps[1].previousValue * 100);
    const rateChange = currentRate - previousRate;

    if (Math.abs(rateChange) > 5) { // Só mostrar se houver mudança significativa
      const comparisonCard = document.createElement('div');
      comparisonCard.className = rateChange > 0 
        ? 'bg-green-50 border border-green-200 rounded-lg p-4 mt-4'
        : 'bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4';
      
      const icon = rateChange > 0 ? '✅' : '⚠️';
      const direction = rateChange > 0 ? 'aumentou' : 'diminuiu';
      
      comparisonCard.innerHTML = `
        <div class="flex items-start gap-3">
          <span class="text-2xl">${icon}</span>
          <div>
            <h3 class="font-semibold text-gray-900 mb-1">Taxa de Conversão Orçamentos → Vendas</h3>
            <p class="text-sm text-gray-700">
              A taxa de conversão de orçamentos para vendas ${direction} consideravelmente neste período 
              (${previousRate.toFixed(2)}% → ${currentRate.toFixed(2)}%, ${rateChange > 0 ? '+' : ''}${rateChange.toFixed(2)} pontos percentuais).
            </p>
          </div>
        </div>
      `;
      container.appendChild(comparisonCard);
    }
  }
}

// Obter recomendações baseadas no gargalo
function getRecommendations(step) {
  const recommendations = {
    'Mensagens': [
      'Melhorar follow-up dos leads',
      'Otimizar tempo de resposta',
      'Personalizar mensagens iniciais',
      'Refinar qualificação de leads'
    ],
    'Orçamentos': [
      'Melhorar atendimento inicial',
      'Acelerar resposta a mensagens',
      'Oferecer proposta de valor mais clara'
    ],
    'Vendas': [
      'Melhorar processo de negociação',
      'Otimizar proposta comercial',
      'Acompanhar leads mais de perto'
    ]
  };

  return recommendations[step]?.map(rec => `<li>${rec}</li>`).join('') || '<li>Analisar dados específicos</li>';
}

// Exportar para PDF
async function exportFunnelToPDF() {
  if (!currentFunnelData) {
    alert('Não há dados para exportar. Gere o funil primeiro.');
    return;
  }

  try {
    // Verificar se jsPDF está disponível
    if (typeof window.jspdf === 'undefined') {
      alert('Biblioteca jsPDF não carregada. Adicione o script no HTML.');
      return;
    }

    const { jsPDF } = window.jspdf;

    // Verificar se html2canvas está disponível
    if (typeof html2canvas === 'undefined') {
      alert('Biblioteca html2canvas não carregada. Adicione o script no HTML.');
      return;
    }

    // Ocultar botões durante captura
    const exportButtons = document.querySelectorAll('#funilExportPDFBtn, #funilExportXLSXBtn');
    exportButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });

    // Capturar conteúdo principal
    const funilContent = document.getElementById('funilContent');
    if (!funilContent) {
      alert('Erro ao exportar PDF: Conteúdo não encontrado');
      return;
    }

    // Criar PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    let currentY = margin;

    // Título
    doc.setFontSize(18);
    doc.text('Funil de Conversão', pdfWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Data
    const periodSelect = document.getElementById('funilPeriodSelect').value;
    const dates = calculateFunilPeriodDates(periodSelect);
    doc.setFontSize(10);
    doc.text(`Período: ${dates.start} a ${dates.end}`, pdfWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // Métricas principais
    doc.setFontSize(14);
    doc.text('Métricas Principais', margin, currentY);
    currentY += 8;

    doc.setFontSize(10);
    const conversionRate = currentFunnelData.impressions > 0 
      ? ((currentFunnelData.vendas / currentFunnelData.impressions) * 100).toFixed(2)
      : 0;
    const cpa = currentFunnelData.vendas > 0 
      ? (currentFunnelData.invested / currentFunnelData.vendas).toFixed(2)
      : 0;
    const roi = currentFunnelData.invested > 0 
      ? ((currentFunnelData.revenue * 0.25) / currentFunnelData.invested).toFixed(2)
      : 0;

    doc.text(`Taxa de Conversão Geral: ${conversionRate}%`, margin + 5, currentY);
    currentY += 6;
    doc.text(`Custo por Venda (CPA): R$ ${parseFloat(cpa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 5, currentY);
    currentY += 6;
    doc.text(`ROI: ${roi}x`, margin + 5, currentY);
    currentY += 15;

    // Tabela do funil
    doc.setFontSize(14);
    doc.text('Detalhamento por Etapa', margin, currentY);
    currentY += 8;

    // Cabeçalho da tabela
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Etapa', margin, currentY);
    doc.text('Quantidade', margin + 60, currentY);
    doc.text('Taxa Conv.', margin + 130, currentY);
    currentY += 6;

    doc.setFont(undefined, 'normal');
    // Remover Impressões do PDF também
    const steps = [
      { name: 'Cliques', value: currentFunnelData.clicks },
      { name: 'Mensagens', value: currentFunnelData.messages },
      { name: 'Orçamentos', value: currentFunnelData.orcamentos },
      { name: 'Vendas', value: currentFunnelData.vendas }
    ];

    steps.forEach((step, index) => {
      if (currentY > pdfHeight - 20) {
        doc.addPage();
        currentY = margin;
      }

      let conversionRate = '-';
      
      if (index === 0) {
        // Primeira etapa (Cliques) - taxa em relação a impressões
        if (currentFunnelData.impressions > 0) {
          conversionRate = ((step.value / currentFunnelData.impressions) * 100).toFixed(2) + '%';
        }
      } else {
        const previousValue = steps[index - 1].value;
        if (previousValue > 0) {
          conversionRate = ((step.value / previousValue) * 100).toFixed(2) + '%';
        }
      }

      doc.text(step.name, margin, currentY);
      doc.text(step.value.toLocaleString('pt-BR'), margin + 60, currentY);
      doc.text(conversionRate, margin + 130, currentY);
      currentY += 6;
    });

    // Capturar gráfico como imagem (funil customizado)
    currentY += 10;
    if (currentY > pdfHeight - 80) {
      doc.addPage();
      currentY = margin;
    }

    try {
      const chartCanvas = document.getElementById('funilChart');
      if (chartCanvas) {
        const chartImg = chartCanvas.toDataURL('image/png');
        const imgWidth = 190;
        const imgHeight = 120;
        doc.addImage(chartImg, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao capturar gráfico:', error);
    }

    // Restaurar botões
    exportButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-flex';
    });

    // Salvar PDF
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Funil_Conversao_${dateStr}.pdf`);

    console.log('✅ PDF exportado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao exportar PDF:', error);
    alert('Erro ao exportar PDF. Tente novamente.');
    
    // Restaurar botões em caso de erro
    const exportButtons = document.querySelectorAll('#funilExportPDFBtn, #funilExportXLSXBtn');
    exportButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-flex';
    });
  }
}

// Exportar para XLSX
function exportFunnelToXLSX() {
  if (!currentFunnelData) {
    alert('Não há dados para exportar. Gere o funil primeiro.');
    return;
  }

  try {
    if (typeof XLSX === 'undefined') {
      alert('Biblioteca XLSX não carregada. Recarregue a página e tente novamente.');
      return;
    }

    const data = currentFunnelData;
    const exportData = [
      ['Etapa', 'Quantidade', 'Taxa de Conversão'],
      ['Cliques', data.clicks, data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : '-'],
      ['Mensagens', data.messages, data.clicks > 0 ? ((data.messages / data.clicks) * 100).toFixed(2) + '%' : '-'],
      ['Orçamentos', data.orcamentos, data.messages > 0 ? ((data.orcamentos / data.messages) * 100).toFixed(2) + '%' : '-'],
      ['Vendas', data.vendas, data.orcamentos > 0 ? ((data.vendas / data.orcamentos) * 100).toFixed(2) + '%' : '-'],
      [],
      ['Métricas', 'Valor'],
      ['Taxa de Conversão Geral', ((data.vendas / data.impressions) * 100).toFixed(2) + '%'],
      ['Custo por Venda (CPA)', `R$ ${(data.invested / data.vendas).toFixed(2)}`],
      ['ROI', `${((data.revenue * 0.25) / data.invested).toFixed(2)}x`],
      ['Investido Total', `R$ ${data.invested.toFixed(2)}`],
      ['Faturamento Total', `R$ ${data.revenue.toFixed(2)}`]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    const colWidths = [
      { wch: 20 }, // Etapa
      { wch: 15 }, // Quantidade
      { wch: 18 }  // Taxa de Conversão
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Funil de Conversão');

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Funil_Conversao_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);

    console.log('✅ Planilha exportada com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao exportar planilha:', error);
    alert('Erro ao exportar planilha. Tente novamente.');
  }
}

