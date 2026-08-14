// Vercel Serverless Function para Google Ads API (usando REST API diretamente)

const GOOGLE_ADS_API_VERSION = 'v23';
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
function getDeveloperToken() {
  return process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
}

function buildGoogleAdsHeaders(accessToken, loginCustomerId = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': getDeveloperToken(),
    'Content-Type': 'application/json'
  };
  if (loginCustomerId) {
    headers['login-customer-id'] = String(loginCustomerId).replace(/-/g, '');
  }
  return headers;
}

/** Extrai todas as linhas de uma resposta searchStream (vários lotes). */
function flattenSearchStreamResults(data) {
  // Quando a API retorna um objeto único em vez de array (pode acontecer em algumas versões)
  if (data && !Array.isArray(data)) {
    if (data.results?.length) {
      return data.results;
    }
    return [];
  }
  if (!Array.isArray(data)) return [];
  const rows = [];
  for (const batch of data) {
    if (batch?.results?.length) {
      rows.push(...batch.results);
    }
  }
  return rows;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, customerId, startDate, endDate, accessToken, loginCustomerId } = req.body;

    console.log('📥 Ação recebida:', action);
    if (loginCustomerId) {
      console.log('🔐 Login Customer ID (MCC):', loginCustomerId);
    }

    switch (action) {
      case 'listAccounts':
        return await listAccounts(accessToken, res);
      
      case 'getAccountInsights':
        return await getAccountInsights(customerId, startDate, endDate, accessToken, res, loginCustomerId);
      
      case 'getAccountInsightsDaily':
        return await getAccountInsightsDaily(customerId, startDate, endDate, accessToken, res, loginCustomerId);
      
      case 'getComparison':
        return await getComparison(customerId, startDate, endDate, accessToken, res, loginCustomerId);
      
      default:
        return res.status(400).json({ error: 'Ação inválida' });
    }
  } catch (error) {
    console.error('❌ Erro na função:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
}

// Listar contas Google Ads acessíveis (diretas + filhas via MCC)
async function listAccounts(accessToken, res) {
  const debug = []; // Diagnóstico detalhado para retornar ao frontend
  try {
    if (!accessToken) {
      throw new Error('Access token é obrigatório para listar contas');
    }

    if (!getDeveloperToken()) {
      throw new Error('DEVELOPER_TOKEN_INVALID');
    }

    console.log(`🔍 Listando contas via Google Ads API ${GOOGLE_ADS_API_VERSION}...`);

    // 1. Obter todos os customer IDs que o usuário tem acesso direto
    const response = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
      method: 'GET',
      headers: buildGoogleAdsHeaders(accessToken)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro listAccessibleCustomers:', response.status, errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const customerIds = (data.resourceNames || []).map((name) => name.split('/').pop());
    debug.push({ step: 'listAccessibleCustomers', ids: customerIds });
    console.log(`📋 ${customerIds.length} IDs acessíveis: ${customerIds.join(', ')}`);

    const allAccounts = [];
    const seenIds = new Set();

    const addAccount = (account) => {
      if (!account?.customerId || seenIds.has(account.customerId)) return;
      seenIds.add(account.customerId);
      allAccounts.push(account);
    };

    // 2. Para cada ID: adicionar conta direta E sempre tentar expandir como MCC
    for (const customerId of customerIds) {
      // 2a. Obter info básica da conta
      let info = null;
      try {
        info = await getAccountInfo(customerId, accessToken);
        debug.push({ step: 'getAccountInfo', id: customerId, name: info.name, isManager: info.isManager });
        console.log(`   • ${info.customerId} — ${info.name}${info.isManager ? ' (MCC)' : ' (conta de anúncio)'}`);
      } catch (error) {
        debug.push({ step: 'getAccountInfo', id: customerId, error: error.message });
        console.warn(`⚠️ Não foi possível obter info de ${customerId}:`, error.message);
        info = { customerId, name: `Conta ${customerId}`, currency: 'BRL', isManager: null };
      }

      // 2b. Se for conta de anúncio direta, adicionar
      if (info.isManager === false) {
        addAccount(info);
      } else {
        // É MCC (ou desconhecido) — não adicionar como conta, apenas marcar como visto
        seenIds.add(customerId);
      }

      // 2c. SEMPRE tentar expandir via customer_client com esse ID como login-customer-id
      const expansion = await getAllClientsFromMCC(customerId, accessToken, debug);
      if (expansion.length > 0) {
        console.log(`📂 ${customerId}: ${expansion.length} contas filhas encontradas`);
        expansion.forEach(addAccount);
      }
    }

    console.log(`✅ Total: ${allAccounts.length} contas de anúncio`);
    return res.status(200).json({ accounts: allAccounts, debug });
  } catch (error) {
    console.error('❌ Erro ao listar contas:', error.message);
    return res.status(500).json({ error: error.message, debug });
  }
}

/**
 * Busca TODOS os clientes não-manager de uma MCC em uma única query plana.
 */
async function getAllClientsFromMCC(mccCustomerId, accessToken, debug = []) {
  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.manager,
      customer_client.level,
      customer_client.status
    FROM customer_client
    WHERE customer_client.status IN ('ENABLED', 'PAUSED')
  `;

  try {
    const response = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${mccCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: buildGoogleAdsHeaders(accessToken, mccCustomerId),
        body: JSON.stringify({ query })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      debug.push({
        step: 'getAllClientsFromMCC',
        id: mccCustomerId,
        status: response.status,
        error: errorBody.substring(0, 500)
      });
      console.error(`❌ getAllClientsFromMCC ${mccCustomerId}: HTTP ${response.status} — ${errorBody.substring(0, 400)}`);
      return [];
    }

    const data = await response.json();
    const rows = flattenSearchStreamResults(data);

    debug.push({
      step: 'getAllClientsFromMCC',
      id: mccCustomerId,
      status: 200,
      totalRows: rows.length,
      sample: rows.slice(0, 3).map(r => ({
        id: r.customerClient?.id,
        name: r.customerClient?.descriptiveName,
        manager: r.customerClient?.manager,
        level: r.customerClient?.level
      }))
    });

    console.log(`✅ customer_client de ${mccCustomerId}: ${rows.length} registros`);

    return rows
      .filter(row => {
        const cc = row.customerClient;
        if (!cc?.id) return false;
        if (String(cc.id) === String(mccCustomerId)) return false;
        if (cc.manager === true) return false;
        return true;
      })
      .map(row => ({
        customerId: String(row.customerClient.id),
        name: row.customerClient.descriptiveName || `Conta ${row.customerClient.id}`,
        currency: row.customerClient.currencyCode || 'BRL',
        managedBy: String(mccCustomerId),
        isManager: false
      }));

  } catch (err) {
    debug.push({ step: 'getAllClientsFromMCC', id: mccCustomerId, exception: err.message });
    console.error(`❌ getAllClientsFromMCC exception ${mccCustomerId}:`, err.message);
    return [];
  }
}

// Buscar informações de uma conta específica
async function getAccountInfo(customerId, accessToken, loginCustomerId = null) {
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.manager
    FROM customer
    LIMIT 1
  `;

  const response = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: buildGoogleAdsHeaders(accessToken, loginCustomerId || customerId),
      body: JSON.stringify({ query })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rows = flattenSearchStreamResults(data);

  if (rows.length > 0 && rows[0].customer) {
    const customer = rows[0].customer;
    return {
      customerId: String(customerId),
      name: customer.descriptiveName || `Conta ${customerId}`,
      currency: customer.currencyCode || 'BRL',
      isManager: customer.manager === true
    };
  }

  return {
    customerId: String(customerId),
    name: `Conta ${customerId}`,
    currency: 'BRL',
    isManager: false

  };
}

// Buscar insights da conta
async function getAccountInsights(customerId, startDate, endDate, accessToken, res, loginCustomerId = null) {
  try {
    if (!customerId || !startDate || !endDate) {
      throw new Error('customerId, startDate e endDate são obrigatórios');
    }

    if (!accessToken) {
      throw new Error('Access token não fornecido');
    }

    const query = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    console.log('🔍 Query:', query);
    console.log(`📊 Buscando insights para conta ${customerId}${loginCustomerId ? ` via MCC ${loginCustomerId}` : ''}`);

    const headers = buildGoogleAdsHeaders(accessToken, loginCustomerId);

    const response = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Dados recebidos:', JSON.stringify(data).substring(0, 500));

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalCostMicros = 0;

    for (const row of flattenSearchStreamResults(data)) {
      if (row.metrics) {
        totalImpressions += parseInt(row.metrics.impressions || 0);
        totalClicks += parseInt(row.metrics.clicks || 0);
        totalConversions += parseFloat(row.metrics.conversions || 0);
        totalCostMicros += parseInt(row.metrics.costMicros || 0);
      }
    }

    const totalCost = totalCostMicros / 1000000;

    const insights = {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      cost: totalCost,
      costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
    };

    console.log('📊 Insights processados:', insights);

    // Se chamado diretamente, retorna resposta; se chamado por outra função, retorna objeto
    if (res) {
      return res.status(200).json({ insights });
    } else {
      return { insights };
    }
  } catch (error) {
    console.error('❌ Erro ao buscar insights:', error);
    throw error;
  }
}

// Buscar insights diários da conta
async function getAccountInsightsDaily(customerId, startDate, endDate, accessToken, res, loginCustomerId = null) {
  try {
    if (!customerId || !startDate || !endDate) {
      throw new Error('customerId, startDate e endDate são obrigatórios');
    }

    if (!accessToken) {
      throw new Error('Access token não fornecido');
    }

    // Query com segments.date para obter dados diários
    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date
    `;

    console.log('🔍 Query diária:', query);
    console.log(`📊 Buscando insights diários para conta ${customerId}${loginCustomerId ? ` via MCC ${loginCustomerId}` : ''}`);

    const headers = buildGoogleAdsHeaders(accessToken, loginCustomerId);

    const response = await fetch(
      `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Dados diários recebidos:', JSON.stringify(data).substring(0, 500));

    const dataByDate = {};

    for (const row of flattenSearchStreamResults(data)) {
      if (row.segments?.date && row.metrics) {
        const date = row.segments.date;
        if (!dataByDate[date]) {
          dataByDate[date] = {
            date,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            costMicros: 0
          };
        }

        dataByDate[date].impressions += parseInt(row.metrics.impressions || 0);
        dataByDate[date].clicks += parseInt(row.metrics.clicks || 0);
        dataByDate[date].conversions += parseFloat(row.metrics.conversions || 0);
        const costMicros = row.metrics.costMicros || row.metrics.cost_micros || 0;
        dataByDate[date].costMicros += parseInt(costMicros || 0);
      }
    }

    const dailyData = Object.values(dataByDate).map((day) => ({
      date: day.date,
      cost: day.costMicros / 1000000,
      conversions: day.conversions,
      impressions: day.impressions,
      clicks: day.clicks
    }));

    // Ordenar por data
    dailyData.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`📊 Insights diários processados: ${dailyData.length} dias`);

    // Se chamado diretamente, retorna resposta; se chamado por outra função, retorna objeto
    if (res) {
      return res.status(200).json({ daily: dailyData });
    } else {
      return { daily: dailyData };
    }
  } catch (error) {
    console.error('❌ Erro ao buscar insights diários:', error);
    throw error;
  }
}

// Buscar dados de comparação
async function getComparison(customerId, startDate, endDate, accessToken, res, loginCustomerId = null) {
  try {
    // Calcular período anterior
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - diffDays + 1);
    
    const previousStartDate = previousStart.toISOString().split('T')[0];
    const previousEndDate = previousEnd.toISOString().split('T')[0];

    // Buscar dados dos dois períodos
    const [currentData, previousData] = await Promise.all([
      getAccountInsights(customerId, startDate, endDate, accessToken, null, loginCustomerId),
      getAccountInsights(customerId, previousStartDate, previousEndDate, accessToken, null, loginCustomerId),
    ]);

    const current = currentData.insights;
    const previous = previousData.insights;
    
    // Normalizar nomes para compatibilidade com renderização Meta
    const normalizedCurrent = {
      spend: current.cost,
      impressions: current.impressions,
      conversations: current.conversions,
      costPerConversation: current.costPerConversion
    };
    
    const normalizedPrevious = {
      spend: previous.cost,
      impressions: previous.impressions,
      conversations: previous.conversions,
      costPerConversation: previous.costPerConversion
    };

    return res.status(200).json({
      current: normalizedCurrent,
      previous: normalizedPrevious,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar comparação:', error);
    throw error;
  }
}

