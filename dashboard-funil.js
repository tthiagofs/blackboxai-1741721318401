// Dashboard - Funil de Conversão
// Visualização completa do fluxo de conversão: Impressões → Cliques → Mensagens → Orçamentos → Vendas

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
let currentFunnelData = null;
let previousFunnelData = null;

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

    // Renderizar funil
    renderFunnel();
    renderFunnelTable();
    renderBottlenecks();
    renderMetrics();

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
            
            const messagesCount = insights.actions?.find(action => 
              action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            )?.value || 0;
            messages += parseInt(messagesCount);
            
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

// Renderizar funil visual
function renderFunnel() {
  const ctx = document.getElementById('funilChart');
  if (!ctx || !currentFunnelData) return;

  // Destruir gráfico anterior
  if (funilChart) {
    funilChart.destroy();
  }

  const data = currentFunnelData;
  const labels = ['Impressões', 'Cliques', 'Mensagens', 'Orçamentos', 'Vendas'];
  const values = [
    data.impressions,
    data.clicks,
    data.messages,
    data.orcamentos,
    data.vendas
  ];

  // Calcular percentuais do topo
  const maxValue = data.impressions;
  const percentages = values.map(v => maxValue > 0 ? (v / maxValue * 100).toFixed(2) : 0);

  // Cores para cada etapa
  const colors = [
    'rgba(33, 150, 243, 0.6)',   // Azul - Impressões
    'rgba(33, 150, 243, 0.8)',   // Azul - Cliques
    'rgba(200, 230, 201, 0.8)',  // Verde claro - Mensagens
    'rgba(255, 249, 196, 0.8)',  // Amarelo - Orçamentos
    'rgba(76, 175, 80, 0.8)'     // Verde - Vendas
  ];

  funilChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Quantidade',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.6', '1').replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y', // Barras horizontais para criar efeito de funil
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              return [
                `Quantidade: ${values[index].toLocaleString('pt-BR')}`,
                `% do Topo: ${percentages[index]}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        }
      }
    }
  });
}

// Renderizar tabela do funil
function renderFunnelTable() {
  const tbody = document.getElementById('funilTableBody');
  if (!tbody || !currentFunnelData) return;

  tbody.innerHTML = '';

  const data = currentFunnelData;
  const steps = [
    { name: 'Impressões', value: data.impressions, color: 'bg-blue-100' },
    { name: 'Cliques', value: data.clicks, color: 'bg-blue-200' },
    { name: 'Mensagens', value: data.messages, color: 'bg-green-100' },
    { name: 'Orçamentos', value: data.orcamentos, color: 'bg-yellow-100' },
    { name: 'Vendas', value: data.vendas, color: 'bg-green-200' }
  ];

  const maxValue = data.impressions;

  steps.forEach((step, index) => {
    const percentage = maxValue > 0 ? ((step.value / maxValue) * 100).toFixed(2) : 0;
    
    // Taxa de conversão em relação à etapa anterior
    let conversionRate = '-';
    let loss = '-';
    
    if (index > 0) {
      const previousValue = steps[index - 1].value;
      if (previousValue > 0) {
        conversionRate = ((step.value / previousValue) * 100).toFixed(2) + '%';
        loss = (previousValue - step.value).toLocaleString('pt-BR');
      }
    }

    const row = document.createElement('tr');
    row.className = step.color;
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${step.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${step.value.toLocaleString('pt-BR')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${percentage}%</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${conversionRate}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${loss}</td>
    `;

    tbody.appendChild(row);
  });
}

// Renderizar métricas principais
function renderMetrics() {
  if (!currentFunnelData) return;

  const data = currentFunnelData;
  
  // Taxa de conversão geral
  const conversionRate = data.impressions > 0 
    ? ((data.vendas / data.impressions) * 100).toFixed(2)
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
    const prevConversionRate = previousFunnelData.impressions > 0 
      ? ((previousFunnelData.vendas / previousFunnelData.impressions) * 100).toFixed(2)
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
  const steps = [
    { name: 'Impressões', value: data.impressions },
    { name: 'Cliques', value: data.clicks },
    { name: 'Mensagens', value: data.messages },
    { name: 'Orçamentos', value: data.orcamentos },
    { name: 'Vendas', value: data.vendas }
  ];

  // Encontrar maior perda
  let maxLoss = 0;
  let maxLossStep = null;
  let maxLossPercentage = 0;

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

  // Encontrar melhor conversão
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

// Obter recomendações baseadas no gargalo
function getRecommendations(step) {
  const recommendations = {
    'Impressões': [
      'Aumentar investimento em anúncios',
      'Expandir público-alvo',
      'Melhorar targeting de campanhas'
    ],
    'Cliques': [
      'Melhorar copy e CTA dos anúncios',
      'Testar diferentes criativos',
      'Otimizar título e descrição'
    ],
    'Mensagens': [
      'Melhorar experiência na landing page',
      'Simplificar processo de contato',
      'Adicionar botão de WhatsApp mais visível'
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
function exportFunnelToPDF() {
  alert('Exportação para PDF será implementada em breve');
  // TODO: Implementar exportação PDF usando jsPDF
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
      ['Etapa', 'Quantidade', '% do Topo', 'Taxa de Conversão', 'Perda'],
      ['Impressões', data.impressions, '100.00%', '-', '-'],
      ['Cliques', data.clicks, ((data.clicks / data.impressions) * 100).toFixed(2) + '%', ((data.clicks / data.impressions) * 100).toFixed(2) + '%', data.impressions - data.clicks],
      ['Mensagens', data.messages, ((data.messages / data.impressions) * 100).toFixed(2) + '%', data.clicks > 0 ? ((data.messages / data.clicks) * 100).toFixed(2) + '%' : '-', data.clicks - data.messages],
      ['Orçamentos', data.orcamentos, ((data.orcamentos / data.impressions) * 100).toFixed(2) + '%', data.messages > 0 ? ((data.orcamentos / data.messages) * 100).toFixed(2) + '%' : '-', data.messages - data.orcamentos],
      ['Vendas', data.vendas, ((data.vendas / data.impressions) * 100).toFixed(2) + '%', data.orcamentos > 0 ? ((data.vendas / data.orcamentos) * 100).toFixed(2) + '%' : '-', data.orcamentos - data.vendas],
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
      { wch: 15 }, // % do Topo
      { wch: 18 }, // Taxa de Conversão
      { wch: 15 }  // Perda
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

