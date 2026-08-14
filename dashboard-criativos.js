// Dashboard - Análise de Criativos
import { extractAllMessagesAndLeads } from './utils/messagesExtractor.js';
// Busca e analisa performance de criativos (anúncios) do Meta Ads

import { auth } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { fbAuth } from './auth.js';
import { FacebookInsightsService } from './services/facebookInsights.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';

let currentUser = null;
let currentProject = null;
let allCreatives = [];

// Inicialização
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadCreativeProjects();
    // Aguardar um pouco para garantir que o DOM esteja pronto
    setTimeout(() => {
      setupCreativeEventListeners();
    }, 100);
  }
});

// Carregar projetos no select (usando projectsService que filtra por isActive)
async function loadCreativeProjects() {
  try {
    const projectSelect = document.getElementById('creativeProjectSelect');
    projectSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    
    // Usar projectsService que já filtra projetos deletados (isActive = true)
    const projects = await projectsService.listProjects();
    
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || 'Sem nome';
      projectSelect.appendChild(option);
    });
    
    console.log(`✅ ${projects.length} projeto(s) ativo(s) carregado(s) para Análise de Criativos`);
    
    // Se houver apenas 1 projeto, selecionar automaticamente (igual Visão Geral)
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      console.log('🎯 Apenas 1 projeto encontrado, selecionando automaticamente:', projects[0].name);
      // Carregar unidades desse projeto
      await loadCreativeUnits(projects[0].id);
    } else if (projects.length > 1) {
      // Se houver mais de 1, tentar pegar do localStorage
      const savedProjectId = localStorage.getItem('currentProject');
      if (savedProjectId && projects.find(p => p.id === savedProjectId)) {
        projectSelect.value = savedProjectId;
        console.log('🎯 Projeto salvo encontrado, selecionando:', savedProjectId);
        // Carregar unidades desse projeto
        await loadCreativeUnits(savedProjectId);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar projetos:', error);
  }
}

// Carregar unidades do projeto selecionado (apenas com contas vinculadas)
async function loadCreativeUnits(projectId) {
  try {
    if (!projectId) {
      const unitsSelect = document.getElementById('creativeUnitsSelect');
      unitsSelect.innerHTML = '<option value="all" selected>Selecione um projeto primeiro</option>';
      return;
    }

    console.log('📋 Carregando unidades do projeto:', projectId);
    
    // Usar unitsService que busca da subcoleção correta: projects/{projectId}/units
    const allUnits = await unitsService.listUnits(projectId);
    
    // Filtrar apenas unidades que têm Meta Ads OU Google Ads vinculado
    const unitsWithAccounts = allUnits.filter(unit => {
      const linkedAccounts = unit.linkedAccounts || {};
      return linkedAccounts.meta?.id || linkedAccounts.google?.id;
    });
    
    const unitsSelect = document.getElementById('creativeUnitsSelect');
    unitsSelect.innerHTML = '<option value="all" selected>Todas as unidades</option>';
    
    if (!unitsWithAccounts || unitsWithAccounts.length === 0) {
      console.log('ℹ️ Nenhuma unidade com contas de anúncios vinculadas');
      unitsSelect.innerHTML = '<option value="">Nenhuma unidade com contas vinculadas</option>';
      showError('Nenhuma unidade possui contas de anúncios vinculadas. Por favor, vincule contas em Unidades.');
      return;
    }
    
    unitsWithAccounts.forEach(unit => {
      const option = document.createElement('option');
      option.value = unit.id;
      // Mostrar quais contas estão vinculadas
      const badges = [];
      if (unit.linkedAccounts?.meta?.id) badges.push('Meta');
      if (unit.linkedAccounts?.google?.id) badges.push('Google');
      option.textContent = `${unit.name || 'Sem nome'} (${badges.join(', ')})`;
      // Salvar dados da unidade no option para uso posterior
      option.dataset.unit = JSON.stringify(unit);
      unitsSelect.appendChild(option);
    });
    
    console.log(`✅ ${unitsWithAccounts.length} unidades com contas vinculadas (de ${allUnits.length} totais)`);
  } catch (error) {
    console.error('❌ Erro ao carregar unidades:', error);
  }
}

// Event listeners
function setupCreativeEventListeners() {
  // Mostrar/ocultar datas personalizadas
  const periodSelect = document.getElementById('creativePeriodSelect');
  const customPeriodDiv = document.getElementById('creativeCustomPeriodDiv');
  
  periodSelect.addEventListener('change', () => {
    if (periodSelect.value === 'custom') {
      customPeriodDiv.classList.remove('hidden');
    } else {
      customPeriodDiv.classList.add('hidden');
    }
  });

  // Quando o projeto mudar, carregar unidades
  const creativeProjectSelect = document.getElementById('creativeProjectSelect');
  if (creativeProjectSelect) {
    creativeProjectSelect.addEventListener('change', () => {
      const projectId = creativeProjectSelect.value;
      console.log('🔄 Projeto selecionado:', projectId);
      loadCreativeUnits(projectId);
    });
  }

  // Botão de buscar
  document.getElementById('searchCreativesBtn').addEventListener('click', searchCreatives);

  // Botão de exportar PDF - verificar se existe antes de adicionar listener
  const exportPDFBtn = document.getElementById('exportCreativesPDFBtn');
  if (exportPDFBtn) {
    exportPDFBtn.addEventListener('click', exportCreativesToPDF);
    console.log('✅ Botão de exportar PDF configurado');
  } else {
    console.warn('⚠️ Botão exportCreativesPDFBtn não encontrado na inicialização');
    // Tentar configurar quando o conteúdo for exibido
  }
}

// Calcular datas do período
function calculateCreativePeriod(period) {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(todayDate);
      endDate = new Date(todayDate);
      break;
    
    case 'last7days':
      endDate = new Date(todayDate);
      endDate.setDate(endDate.getDate() - 1);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      break;
    
    case 'thisMonth':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(todayDate);
      break;
    
    case 'lastMonth':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    
    case 'custom':
      const customStart = document.getElementById('creativeCustomStartDate').value;
      const customEnd = document.getElementById('creativeCustomEndDate').value;
      
      if (!customStart || !customEnd) {
        showError('Por favor, selecione as datas de início e fim.');
        return null;
      }
      
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      break;
    
    default:
      return null;
  }

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Buscar criativos
async function searchCreatives() {
  const loadingEl = document.getElementById('creativesLoading');
  const emptyStateEl = document.getElementById('creativesEmptyState');
  const contentEl = document.getElementById('creativesContent');

  // Mostrar loading
  loadingEl.classList.remove('hidden');
  emptyStateEl.classList.add('hidden');
  contentEl.classList.add('hidden');

  try {
    // Pegar filtros
    const projectId = document.getElementById('creativeProjectSelect').value;
    const period = document.getElementById('creativePeriodSelect').value;
    const orderBy = document.getElementById('creativeOrderBy').value;
    const unitId = document.getElementById('creativeUnitsSelect').value || 'all';

    // Validar projeto
    if (!projectId) {
      showError('Por favor, selecione um projeto primeiro.');
      loadingEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    // Calcular período
    const dates = calculateCreativePeriod(period);
    if (!dates) {
      loadingEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    console.log('🔍 Iniciando busca de criativos...');

    // Buscar dados do Meta Ads (já retorna apenas TOP 10 com imagens)
    const creatives = await fetchCreativesFromMetaAds(projectId, unitId, dates);

    if (!creatives || creatives.length === 0) {
      loadingEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      showError('Não encontramos criativos com dados no período selecionado. Tente ajustar os filtros.');
      return;
    }

    // Já vem ordenado e limitado aos TOP 10 com imagens
    allCreatives = creatives;

    // Renderizar (isso já cria o botão se necessário)
    renderCreatives(allCreatives);
    renderTypeComparison(allCreatives);
    renderInsights(allCreatives);

    // Mostrar conteúdo
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

  } catch (error) {
    console.error('Erro ao buscar criativos:', error);
    showError(error.message || 'Erro ao buscar criativos. Verifique se as contas estão conectadas corretamente.');
    loadingEl.classList.add('hidden');
    emptyStateEl.classList.remove('hidden');
  }
}

// Mostrar erro inline (sem popup)
function showError(message) {
  const emptyStateEl = document.getElementById('creativesEmptyState');
  if (emptyStateEl) {
    emptyStateEl.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-4"></i>
        <h3 class="text-xl font-bold text-gray-900 mb-2">Atenção</h3>
        <p class="text-gray-600">${message}</p>
      </div>
    `;
    emptyStateEl.classList.remove('hidden');
  }
}

// Buscar criativos do Meta Ads (usando fbAuth do localStorage, igual à Visão Geral)
async function fetchCreativesFromMetaAds(projectId, unitId, dates) {
  try {
    // Verificar se tem token do Facebook (igual à Visão Geral)
    const fbToken = fbAuth?.getAccessToken && fbAuth.getAccessToken();
    if (!fbToken) {
      throw new Error('Nenhuma conta Meta Ads conectada. Por favor, conecte uma conta em Conexões.');
    }

    // Buscar unidades do projeto
    const allUnits = await unitsService.listUnits(projectId);
    
    // Filtrar unidades com contas Meta vinculadas
    let targetUnits = allUnits.filter(u => u.linkedAccounts?.meta?.id);
    
    // Se não for "all", filtrar pela unidade específica
    if (unitId !== 'all' && unitId) {
      targetUnits = targetUnits.filter(u => u.id === unitId);
    }

    if (targetUnits.length === 0) {
      throw new Error('Nenhuma unidade com Meta Ads vinculado encontrada.');
    }

    let allAds = [];

    // Criar serviço do Facebook com o token
    const fbService = new FacebookInsightsService(fbToken);

    // Para cada unidade com Meta vinculado
    for (const unit of targetUnits) {
      const metaAccountId = unit.linkedAccounts.meta.id;

      try {
        // Buscar TODOS os anúncios com dados (usando a API do Facebook)
        const url = `/${metaAccountId}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions&time_range={'since':'${dates.start}','until':'${dates.end}'}&limit=100&access_token=${fbToken}`;
        const adsData = await fbService.fetchWithPagination(url, [], true);

        // Processar APENAS métricas (SEM buscar creative ainda)
        const processedAds = processAdsDataFast(adsData, unit.name);
        allAds = allAds.concat(processedAds);

      } catch (error) {
        console.error(`❌ Erro ao buscar ads da conta ${metaAccountId}:`, error);
      }
    }

    // OTIMIZAÇÃO: Ordenar ANTES de buscar creatives
    const orderByElement = document.getElementById('creativeOrderBy');
    const orderBy = orderByElement ? orderByElement.value : 'impressions'; // Padrão: impressões
    sortCreatives(allAds, orderBy);
    
    // Buscar creative APENAS do TOP 10
    const top10 = allAds.slice(0, 10);
    console.log(`🎯 Buscando imagens dos TOP ${top10.length} criativos...`);
    
    for (const ad of top10) {
      try {
        const creativeData = await fbService.getCreativeData(ad.id);
        
        ad.thumbnailUrl = creativeData.imageUrl || ad.thumbnailUrl;
        ad.type = creativeData.type || ad.type;
      } catch (error) {
        console.error(`❌ Erro ao buscar creative do ad ${ad.id}:`, error);
      }
    }
    
    console.log(`✅ ${allAds.length} anúncios encontrados, retornando TOP ${top10.length} com preview em alta qualidade`);
    // IMPORTANTE: Retornar APENAS os TOP 10 que tiveram imagens buscadas
    return top10;

  } catch (error) {
    console.error('Erro ao buscar do Meta Ads:', error);
    throw error;
  }
}

// Função específica para extrair leads de criativos (apenas mensagens principais, sem duplicar)
function extractLeadsForCreatives(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  
  // Para análise de criativos, usar apenas a métrica principal de mensagens
  // Isso evita contar mensagens + cadastros + conversões separadamente (que podem ser a mesma pessoa)
  const messageAction = actions.find(action => 
    action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
  );
  
  if (messageAction && messageAction.value) {
    return parseInt(messageAction.value) || 0;
  }
  
  // Fallback: se não tiver a métrica principal, tentar lead_grouped
  const leadAction = actions.find(action => 
    action.action_type === 'onsite_conversion.lead_grouped'
  );
  
  if (leadAction && leadAction.value) {
    return parseInt(leadAction.value) || 0;
  }
  
  return 0;
}

// Processar dados dos anúncios (RÁPIDO - sem buscar creative)
function processAdsDataFast(adsData, unitName) {
  const processed = [];
  
  for (const ad of adsData) {
    const actions = ad.actions || [];
    // Para criativos, usar função específica que não duplica métricas
    const leads = extractLeadsForCreatives(actions);
    const spend = parseFloat(ad.spend || 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const impressions = parseInt(ad.impressions || 0);
    
    if (impressions > 0) {
      processed.push({
        id: ad.ad_id,
        name: ad.ad_name || 'Sem nome',
        unitName: unitName,
        thumbnailUrl: 'https://via.placeholder.com/200x200?text=Carregando...', // Placeholder
        impressions: impressions,
        leads: leads,
        cpl: cpl,
        spend: spend,
        type: 'image' // Padrão, será atualizado depois para o top 10
      });
    }
  }
  
  return processed;
}

// Processar dados dos anúncios (COMPLETO - com creative) - DEPRECATED
async function processAdsData(adsData, fbService, accessToken, unitName) {
  const processed = [];
  
  for (const ad of adsData) {
    // O ad já vem com os dados do insights quando usamos level=ad
    const actions = ad.actions || [];
    
    // Para criativos, usar função específica que não duplica métricas
    const leads = extractLeadsForCreatives(actions);
    
    // Calcular CPL
    const spend = parseFloat(ad.spend || 0);
    const cpl = leads > 0 ? spend / leads : 0;

    // Buscar dados do criativo para determinar tipo e imagem
    let thumbnailUrl = 'https://via.placeholder.com/200x200?text=Sem+Imagem';
    let type = 'image';
    
    try {
      console.log(`🔍 Buscando creative para anúncio: ${ad.ad_name} (ID: ${ad.ad_id})`);
      const creativeData = await fbService.getCreativeData(ad.ad_id);
      console.log(`   ✅ Creative recebido:`, { type: creativeData.type, imageUrl: creativeData.imageUrl?.substring(0, 60) + '...' });
      thumbnailUrl = creativeData.imageUrl || thumbnailUrl;
      type = creativeData.type || 'image';
    } catch (error) {
      console.error(`❌ Erro ao buscar creative do ad ${ad.ad_id}:`, error);
    }

    const impressions = parseInt(ad.impressions || 0);
    
    // Só adicionar se tiver impressões
    if (impressions > 0) {
      processed.push({
        id: ad.ad_id,
        name: ad.ad_name || 'Sem nome',
        unitName: unitName,
        thumbnailUrl: thumbnailUrl,
        impressions: impressions,
        leads: leads,
        cpl: cpl,
        spend: spend,
        type: type
      });
    }
  }
  
  return processed;
}

// Ordenar criativos
function sortCreatives(creatives, orderBy) {
  switch (orderBy) {
    case 'impressions':
      creatives.sort((a, b) => b.impressions - a.impressions);
      break;
    case 'leads':
      creatives.sort((a, b) => b.leads - a.leads);
      break;
    case 'cpl':
      // CPL: menor primeiro (mas zeros no final)
      creatives.sort((a, b) => {
        if (a.cpl === 0) return 1;
        if (b.cpl === 0) return -1;
        return a.cpl - b.cpl;
      });
      break;
  }
}

// Renderizar criativos
function renderCreatives(creatives) {
  const listEl = document.getElementById('creativesList');
  const countEl = document.getElementById('creativesCount');
  const contentEl = document.getElementById('creativesContent');
  
  countEl.textContent = `${creatives.length} criativos encontrados`;
  
  // Garantir que o botão de exportar PDF exista antes de renderizar
  if (contentEl) {
    const creativesHeader = contentEl.querySelector('.bg-white.border.border-gray-200.rounded-xl.p-5.mb-6');
    if (creativesHeader) {
      const headerDiv = creativesHeader.querySelector('.flex.items-center.justify-between.mb-4');
      if (headerDiv) {
        // Verificar se o botão já existe
        let exportPDFBtn = headerDiv.querySelector('#exportCreativesPDFBtn');
        if (!exportPDFBtn) {
          // Criar o botão se não existir
          exportPDFBtn = document.createElement('button');
          exportPDFBtn.id = 'exportCreativesPDFBtn';
          exportPDFBtn.className = 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2';
          exportPDFBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar PDF';
          
          // Adicionar o botão à direita do título (depois do span com creativesCount)
          const titleDiv = headerDiv.querySelector('.flex.items-center.gap-4');
          if (titleDiv) {
            // Adicionar após o titleDiv
            headerDiv.insertBefore(exportPDFBtn, titleDiv.nextSibling);
          } else {
            // Adicionar no final do headerDiv
            headerDiv.appendChild(exportPDFBtn);
          }
          
          // Configurar event listener
          exportPDFBtn.addEventListener('click', exportCreativesToPDF);
          console.log('✅ Botão de exportar PDF criado dinamicamente');
        }
      }
    }
  }
  
  listEl.innerHTML = creatives.map((creative, index) => {
    // Determinar badges (pode ter múltiplas)
    let badges = [];
    const bestCPL = Math.min(...creatives.filter(c => c.cpl > 0).map(c => c.cpl));
    const mostLeads = Math.max(...creatives.map(c => c.leads));
    const mostImpressions = Math.max(...creatives.map(c => c.impressions));
    
    if (creative.cpl > 0 && creative.cpl === bestCPL) {
      badges.push('<span class="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded ml-2">⭐ MELHOR CPL</span>');
    }
    if (creative.leads === mostLeads && creative.leads > 0) {
      badges.push('<span class="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded ml-2">🔥 MAIS LEADS</span>');
    }
    if (creative.impressions === mostImpressions && creative.impressions > 0) {
      badges.push('<span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded ml-2">👁️ MAIS VISTO</span>');
    }
    
    const badge = badges.join('');

    // Ícone do tipo
    let typeIcon = '📷';
    if (creative.type === 'video') typeIcon = '🎬';
    if (creative.type === 'carousel') typeIcon = '🎠';

    return `
      <div class="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
        <div class="flex-shrink-0">
          <img src="${creative.thumbnailUrl || 'https://via.placeholder.com/200x200?text=Sem+Imagem'}" alt="${creative.name}" class="w-32 h-32 object-cover rounded-lg border border-gray-200" 
               onerror="if(!this.hasAttribute('data-error-handled')){this.setAttribute('data-error-handled','true');this.src='https://via.placeholder.com/200x200?text=Sem+Imagem';}" 
               loading="lazy">
          <span class="text-xs text-gray-500 mt-1 block text-center">${typeIcon} ${creative.type === 'video' ? 'Vídeo' : creative.type === 'carousel' ? 'Carrossel' : 'Imagem'}</span>
        </div>
        <div class="flex-1">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-1">${creative.name}${badge}</h3>
              <p class="text-xs text-gray-500">ID: ${creative.id} · ${creative.unitName}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p class="text-xs text-gray-600 mb-1">👁️ Impressões</p>
              <p class="text-lg font-bold text-gray-900">${creative.impressions.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-600 mb-1">💬 Leads</p>
              <p class="text-lg font-bold text-blue-600">${creative.leads.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-600 mb-1">💰 Custo por Lead</p>
              <p class="text-lg font-bold ${creative.cpl === bestCPL ? 'text-green-600' : 'text-gray-900'}">
                ${creative.cpl > 0 ? `R$ ${creative.cpl.toFixed(2)}` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar comparação por tipo
function renderTypeComparison(creatives) {
  const types = {
    image: { leads: 0, spend: 0, count: 0 },
    video: { leads: 0, spend: 0, count: 0 },
    carousel: { leads: 0, spend: 0, count: 0 }
  };

  // Agregar dados por tipo
  creatives.forEach(c => {
    types[c.type].leads += c.leads;
    types[c.type].spend += c.spend;
    types[c.type].count++;
  });

  const totalLeads = creatives.reduce((sum, c) => sum + c.leads, 0);

  // Renderizar cada tipo
  Object.keys(types).forEach(type => {
    const data = types[type];
    if (data.count === 0) {
      document.getElementById(`type${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.add('hidden');
      return;
    }

    const percent = totalLeads > 0 ? (data.leads / totalLeads * 100) : 0;
    const avgCPL = data.leads > 0 ? data.spend / data.leads : 0;

    const typeEl = document.getElementById(`type${type.charAt(0).toUpperCase() + type.slice(1)}`);
    typeEl.classList.remove('hidden');
    
    document.getElementById(`type${type.charAt(0).toUpperCase() + type.slice(1)}Percent`).textContent = `${percent.toFixed(0)}%`;
    document.getElementById(`type${type.charAt(0).toUpperCase() + type.slice(1)}Bar`).style.width = `${percent}%`;
    document.getElementById(`type${type.charAt(0).toUpperCase() + type.slice(1)}Stats`).textContent = 
      `${data.leads.toLocaleString('pt-BR')} Leads · CPL médio: R$ ${avgCPL.toFixed(2)}`;
  });
}

// Exportar criativos para PDF
async function exportCreativesToPDF() {
  if (!allCreatives || allCreatives.length === 0) {
    alert('Não há criativos para exportar. Busque criativos primeiro.');
    return;
  }

  try {
    // Verificar se jsPDF está disponível
    // Verificar se html2canvas está disponível
    if (typeof html2canvas === 'undefined') {
      alert('Biblioteca html2canvas não está carregada. Por favor, recarregue a página.');
      return;
    }

    if (typeof window.jspdf === 'undefined') {
      alert('Biblioteca jsPDF não está carregada. Por favor, recarregue a página.');
      return;
    }

    // Ocultar botão durante exportação
    const exportBtn = document.getElementById('exportCreativesPDFBtn');
    const originalDisplay = exportBtn ? window.getComputedStyle(exportBtn).display : 'inline-flex';
    if (exportBtn) {
      exportBtn.style.display = 'none';
    }

    const { jsPDF } = window.jspdf;
    const contentEl = document.getElementById('creativesContent');
    
    if (!contentEl) {
      alert('Conteúdo não encontrado. Por favor, busque os criativos primeiro.');
      if (exportBtn) exportBtn.style.display = originalDisplay || 'inline-flex';
      return;
    }

    // Criar o PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const usableWidth = pdfWidth - (margin * 2);
    const usableHeight = pdfHeight - (margin * 2);
    
    let currentY = margin;
    let currentPage = 1;

    // Identificar as seções principais
    const sections = [];
    
    // 1. Header com título e informações (Top 10 Criativos)
    const headerSection = contentEl.querySelector('.bg-white.border.border-gray-200.rounded-xl.p-5.mb-6');
    if (headerSection) {
      sections.push(headerSection);
    }
    
    // 2. Lista de criativos
    const creativesList = document.getElementById('creativesList');
    if (creativesList) {
      // Encontrar o container pai que contém a lista completa
      const listParent = creativesList.parentElement;
      if (listParent) {
        sections.push(listParent);
      }
    }
    
    // 3. Comparação por tipo (se existir e não estiver oculto)
    const typeComparison = document.getElementById('typeComparison');
    if (typeComparison && !typeComparison.classList.contains('hidden')) {
      const typeContainer = typeComparison.closest('.bg-white');
      if (typeContainer) {
        sections.push(typeContainer);
      } else {
        sections.push(typeComparison);
      }
    }
    
    // 4. Insights (se existir e não estiver oculto)
    const insightsSection = document.getElementById('insightsSection');
    if (insightsSection && !insightsSection.classList.contains('hidden')) {
      const insightsContainer = insightsSection.closest('.bg-white');
      if (insightsContainer) {
        sections.push(insightsContainer);
      } else {
        sections.push(insightsSection);
      }
    }

    // Processar cada seção
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      // Capturar a seção como imagem com alta qualidade
      const canvas = await html2canvas(section, {
        scale: 2, // Alta resolução
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
        windowWidth: section.scrollWidth,
        windowHeight: section.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calcular dimensões para o PDF mantendo a proporção
      const ratio = usableWidth / (imgWidth * 0.264583); // 0.264583 mm per pixel at 96 DPI
      const scaledWidth = usableWidth;
      const scaledHeight = (imgHeight * 0.264583) * ratio;

      // Verificar se a seção cabe na página atual
      if (currentY + scaledHeight > pdfHeight - margin) {
        // Não cabe, criar nova página
        doc.addPage();
        currentPage++;
        currentY = margin;
      }

      // Adicionar a imagem na posição atual
      doc.addImage(imgData, 'PNG', margin, currentY, scaledWidth, scaledHeight);
      
      // Atualizar a posição Y para a próxima seção
      currentY += scaledHeight + 5; // 5mm de espaçamento entre seções
    }

    // Restaurar botão
    if (exportBtn) {
      exportBtn.style.display = originalDisplay || 'inline-flex';
    }

    // Gerar nome do arquivo
    const projectSelect = document.getElementById('projectSelect');
    const projectName = projectSelect?.options[projectSelect.selectedIndex]?.text || 'Criativos';
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Analise_Criativos_${projectName.replace(/\s+/g, '_')}_${dateStr}.pdf`;

    // Salvar PDF
    doc.save(fileName);
    
    console.log('✅ PDF exportado com sucesso usando html2canvas!');
  } catch (error) {
    console.error('❌ Erro ao exportar PDF:', error);
    alert('Erro ao exportar PDF. Tente novamente.');
  } finally {
    // Sempre restaurar botão no final
    const exportBtn = document.getElementById('exportCreativesPDFBtn');
    if (exportBtn) exportBtn.style.display = originalDisplay || 'inline-flex';
  }
}

// Renderizar insights
function renderInsights(creatives) {
  const insightsEl = document.getElementById('creativesInsights');
  const insights = [];

  // Calcular métricas
  const types = {
    image: { leads: 0, spend: 0, count: 0 },
    video: { leads: 0, spend: 0, count: 0 },
    carousel: { leads: 0, spend: 0, count: 0 }
  };

  creatives.forEach(c => {
    types[c.type].leads += c.leads;
    types[c.type].spend += c.spend;
    types[c.type].count++;
  });

  // Melhor criativo
  const bestCreative = [...creatives].sort((a, b) => {
    if (a.cpl === 0) return 1;
    if (b.cpl === 0) return -1;
    return a.cpl - b.cpl;
  })[0];

  if (bestCreative && bestCreative.cpl > 0) {
    insights.push(`🔥 Criativo "${bestCreative.name.substring(0, 40)}..." é o mais eficiente (CPL: R$ ${bestCreative.cpl.toFixed(2)})`);
  }

  // Comparação entre tipos
  const videoCPL = types.video.leads > 0 ? types.video.spend / types.video.leads : 0;
  const imageCPL = types.image.leads > 0 ? types.image.spend / types.image.leads : 0;
  
  if (videoCPL > 0 && imageCPL > 0) {
    const diff = ((imageCPL - videoCPL) / imageCPL * 100);
    if (diff > 10) {
      insights.push(`✅ Vídeos têm CPL ${diff.toFixed(0)}% menor que imagens (R$ ${videoCPL.toFixed(2)} vs R$ ${imageCPL.toFixed(2)})`);
    } else if (diff < -10) {
      insights.push(`✅ Imagens têm CPL ${Math.abs(diff).toFixed(0)}% menor que vídeos (R$ ${imageCPL.toFixed(2)} vs R$ ${videoCPL.toFixed(2)})`);
    }
  }

  // Alertas de CPL alto
  const avgCPL = creatives.reduce((sum, c) => sum + (c.cpl || 0), 0) / creatives.filter(c => c.cpl > 0).length;
  const highCPL = creatives.filter(c => c.cpl > avgCPL * 1.5 && c.cpl > 0);
  
  if (highCPL.length > 0) {
    insights.push(`⚠️ ${highCPL.length} criativo(s) com CPL ${((avgCPL * 1.5 - avgCPL) / avgCPL * 100).toFixed(0)}% acima da média (considere pausar ou otimizar)`);
  }

  // Renderizar
  if (insights.length === 0) {
    insightsEl.innerHTML = '<p class="text-sm text-gray-600">Nenhum insight disponível no momento.</p>';
  } else {
    insightsEl.innerHTML = insights.map(insight => 
      `<p class="text-sm text-gray-700 flex items-start">
        <span class="mr-2">•</span>
        <span>${insight}</span>
      </p>`
    ).join('');
  }
}

// Exportar funções
window.searchCreatives = searchCreatives;
