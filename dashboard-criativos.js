// Dashboard - Análise de Criativos
// Busca e analisa performance de criativos (anúncios) do Meta Ads

import { auth, db } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { FacebookInsightsService } from './services/facebookInsights.js';

let currentUser = null;
let currentProject = null;
let allCreatives = [];

// Inicialização
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadCreativeProjects();
    setupCreativeEventListeners();
  }
});

// Carregar projetos no select
async function loadCreativeProjects() {
  try {
    const projectsQuery = query(
      collection(db, 'projects'),
      where('userId', '==', currentUser.uid)
    );
    const snapshot = await getDocs(projectsQuery);
    
    const projectSelect = document.getElementById('creativeProjectSelect');
    projectSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.name || 'Sem nome';
      projectSelect.appendChild(option);
    });
    
    console.log(`✅ ${snapshot.size} projetos carregados para Análise de Criativos`);
  } catch (error) {
    console.error('❌ Erro ao carregar projetos:', error);
  }
}

// Carregar unidades do projeto selecionado
async function loadCreativeUnits(projectId) {
  try {
    if (!projectId) {
      const unitsSelect = document.getElementById('creativeUnitsSelect');
      unitsSelect.innerHTML = '<option value="all">Selecione um projeto primeiro</option>';
      return;
    }

    console.log('📋 Carregando unidades do projeto:', projectId);
    
    // Buscar unidades do projeto selecionado
    const unitsQuery = query(
      collection(db, 'units'),
      where('projectId', '==', projectId)
    );
    const snapshot = await getDocs(unitsQuery);
    
    const unitsSelect = document.getElementById('creativeUnitsSelect');
    unitsSelect.innerHTML = '<option value="all">Todas as unidades</option>';
    
    if (snapshot.empty) {
      console.log('ℹ️ Nenhuma unidade encontrada para este projeto');
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.name || 'Sem nome';
      unitsSelect.appendChild(option);
    });
    
    console.log(`✅ ${snapshot.size} unidades carregadas`);
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
        alert('Por favor, selecione as datas de início e fim.');
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
    const unitId = document.getElementById('creativeUnitsSelect').value;

    // Validar projeto
    if (!projectId) {
      alert('Por favor, selecione um projeto primeiro.');
      loadingEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    // Calcular período
    const dates = calculateCreativePeriod(period);
    if (!dates) {
      throw new Error('Período inválido');
    }

    console.log('🔍 Buscando criativos:', { projectId, period, orderBy, unitId, dates });

    // Buscar dados do Meta Ads
    const creatives = await fetchCreativesFromMetaAds(unitId, dates);

    if (!creatives || creatives.length === 0) {
      loadingEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    // Ordenar
    sortCreatives(creatives, orderBy);

    // Limitar aos top 10
    allCreatives = creatives.slice(0, 10);

    // Renderizar
    renderCreatives(allCreatives);
    renderTypeComparison(allCreatives);
    renderInsights(allCreatives);

    // Mostrar conteúdo
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

  } catch (error) {
    console.error('Erro ao buscar criativos:', error);
    alert('Erro ao buscar criativos: ' + error.message);
    loadingEl.classList.add('hidden');
    emptyStateEl.classList.remove('hidden');
  }
}

// Buscar criativos do Meta Ads
async function fetchCreativesFromMetaAds(unitId, dates) {
  try {
    // Buscar contas conectadas
    const accountsQuery = query(
      collection(db, 'connections'),
      where('userId', '==', currentUser.uid),
      where('platform', '==', 'meta')
    );
    const accountsSnapshot = await getDocs(accountsQuery);

    if (accountsSnapshot.empty) {
      throw new Error('Nenhuma conta Meta Ads conectada');
    }

    let allAds = [];

    // Para cada conta conectada
    for (const accountDoc of accountsSnapshot.docs) {
      const connection = accountDoc.data();
      const fbService = new FacebookInsightsService(connection.accessToken);
      
      // Se filtrou por unidade específica, verificar se é essa conta
      if (unitId !== 'all') {
        // Aqui você precisa ter uma forma de associar a conta com a unidade
        // Por enquanto, vamos buscar de todas
      }

      try {
        // Buscar anúncios com insights usando o método existente
        // Ele retorna ads com insights e creative info
        const adsData = await fbService.getBestPerformingAds(
          connection.adAccountId,
          dates.start,
          dates.end,
          50 // Top 50 para ter dados suficientes
        );

        // Buscar TODOS os anúncios com dados (não só os top)
        const url = `/${connection.adAccountId}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions&time_range={'since':'${dates.start}','until':'${dates.end}'}&limit=100&access_token=${connection.accessToken}`;
        const allAdsData = await fbService.fetchWithPagination(url, [], true);

        // Processar e adicionar (async)
        const processedAds = await processAdsData(allAdsData, fbService, connection.accessToken);
        allAds = allAds.concat(processedAds);

      } catch (error) {
        console.error(`Erro ao buscar ads da conta ${connection.adAccountId}:`, error);
      }
    }

    return allAds;

  } catch (error) {
    console.error('Erro ao buscar do Meta Ads:', error);
    throw error;
  }
}

// Processar dados dos anúncios
async function processAdsData(adsData, fbService, accessToken) {
  const processed = [];
  
  for (const ad of adsData) {
    // O ad já vem com os dados do insights quando usamos level=ad
    const actions = ad.actions || [];
    
    // Extrair leads (mensagens)
    const leads = extractLeads(actions);
    
    // Calcular CPL
    const spend = parseFloat(ad.spend || 0);
    const cpl = leads > 0 ? spend / leads : 0;

    // Buscar dados do criativo para determinar tipo e imagem
    let thumbnailUrl = 'https://via.placeholder.com/200x200?text=Sem+Imagem';
    let type = 'image';
    
    try {
      const creativeData = await fbService.getCreativeData(ad.ad_id);
      thumbnailUrl = creativeData.imageUrl || thumbnailUrl;
      
      // Determinar tipo baseado nos dados do criativo
      // Por enquanto vamos assumir image como padrão
      // Você pode expandir isso buscando mais dados do creative
      type = 'image';
    } catch (error) {
      console.warn(`Erro ao buscar creative do ad ${ad.ad_id}:`, error);
    }

    const impressions = parseInt(ad.impressions || 0);
    
    // Só adicionar se tiver impressões
    if (impressions > 0) {
      processed.push({
        id: ad.ad_id,
        name: ad.ad_name || 'Sem nome',
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

// Extrair leads das actions
function extractLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  
  const leadActions = actions.find(a => 
    a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
    a.action_type === 'onsite_conversion.lead_grouped'
  );
  
  return leadActions ? parseInt(leadActions.value || 0) : 0;
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
  
  countEl.textContent = `${creatives.length} criativos encontrados`;
  
  listEl.innerHTML = creatives.map((creative, index) => {
    // Determinar badges
    let badge = '';
    const bestCPL = Math.min(...creatives.filter(c => c.cpl > 0).map(c => c.cpl));
    const mostLeads = Math.max(...creatives.map(c => c.leads));
    const mostImpressions = Math.max(...creatives.map(c => c.impressions));
    
    if (creative.cpl > 0 && creative.cpl === bestCPL) {
      badge = '<span class="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded ml-2">⭐ MELHOR CPL</span>';
    } else if (creative.leads === mostLeads) {
      badge = '<span class="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded ml-2">🔥 MAIS LEADS</span>';
    } else if (creative.impressions === mostImpressions) {
      badge = '<span class="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded ml-2">👁️ MAIS VISTO</span>';
    }

    // Ícone do tipo
    let typeIcon = '📷';
    if (creative.type === 'video') typeIcon = '🎬';
    if (creative.type === 'carousel') typeIcon = '🎠';

    return `
      <div class="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
        <div class="flex-shrink-0">
          <img src="${creative.thumbnailUrl}" alt="${creative.name}" class="w-32 h-32 object-cover rounded-lg border border-gray-200" onerror="this.src='https://via.placeholder.com/200x200?text=Sem+Imagem'">
          <span class="text-xs text-gray-500 mt-1 block text-center">${typeIcon} ${creative.type === 'video' ? 'Vídeo' : creative.type === 'carousel' ? 'Carrossel' : 'Imagem'}</span>
        </div>
        <div class="flex-1">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-1">${creative.name}${badge}</h3>
              <p class="text-xs text-gray-500">ID: ${creative.id}</p>
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

