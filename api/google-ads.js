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
        return await listAccounts(accessToken, res, loginCustomerId);
      
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
async function listAccounts(accessToken, res, loginCustomerId = null) {
  try {
    if (!accessToken) {
      throw new Error('Access token é obrigatório para listar contas');
    }

    if (!getDeveloperToken()) {
      throw new Error('DEVELOPER_TOKEN_INVALID');
    }

    console.log(`🔍 Listando contas via Google Ads API ${GOOGLE_ADS_API_VERSION}...`, {
      loginCustomerId: loginCustomerId || 'nenhum'
    });

    const response = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
      method: 'GET',
      headers: buildGoogleAdsHeaders(accessToken, loginCustomerId)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro listAccessibleCustomers:', response.status, errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // resourceNames vem como: "customers/1234567890"
    const resourceNames = new Set(data.resourceNames || []);
    const debugLogs = [];
    debugLogs.push({ step: 'listAccessibleCustomers_initial', status: response.status, snippet: JSON.stringify(data).substring(0, 2000) });

    // Se não foi passado um loginCustomerId específico, tentar reconsultar usando cada customerId
    if (!loginCustomerId) {
      const initialCustomerIds = Array.from(resourceNames).map(name => name.split('/').pop());
      console.log(`📋 ${initialCustomerIds.length} IDs acessíveis inicialmente: ${initialCustomerIds.join(', ')}`);

      // Tentar expandir a lista chamando listAccessibleCustomers com cada customerId como login-customer-id
      for (const cid of initialCustomerIds.slice(0, 10)) { // limitar a 10 tentativas para segurança
        try {
          console.log(`🔄 Tentando listar accounts usando login-customer-id=${cid}...`);
          const resp = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
            method: 'GET',
            headers: buildGoogleAdsHeaders(accessToken, cid)
          });
          if (!resp.ok) {
            const errText = await resp.text();
            debugLogs.push({ step: 'listAccessibleCustomers_try', login: cid, status: resp.status, error: errText.substring(0,2000) });
            console.warn(`⚠️ listAccessibleCustomers com login ${cid} falhou: ${resp.status} - ${errText.substring(0,200)}`);
            continue;
          }
          const d2 = await resp.json();
          debugLogs.push({ step: 'listAccessibleCustomers_try', login: cid, status: resp.status, found: (d2.resourceNames||[]).length, snippet: JSON.stringify(d2).substring(0,2000) });
          (d2.resourceNames || []).forEach(rn => resourceNames.add(rn));
          console.log(`✅ listAccessibleCustomers com login ${cid} retornou ${ (d2.resourceNames||[]).length } entradas`);
        } catch (err) {
          console.warn(`⚠️ Erro ao tentar listAccessibleCustomers com login ${cid}:`, err.message || err);
        }
      }
    }

    const customerIds = Array.from(resourceNames).map((name) => name.split('/').pop());
    console.log(`📋 IDs finais acessíveis: ${customerIds.join(', ')}`);

    const allAccounts = [];
    const seenIds = new Set();

    const addAccount = (account) => {
      if (!account?.customerId || seenIds.has(account.customerId)) return;
      seenIds.add(account.customerId);
      allAccounts.push(account);
    };

    for (const customerId of customerIds) {
      let info = null;
      try {
        info = await getAccountInfo(customerId, accessToken);
        console.log(
          `   • ${info.customerId} — ${info.name}${info.isManager ? ' (MCC - não será listada como conta de anúncio)' : ''}`
        );
        // ✅ Apenas adicionar contas de anúncio (NÃO MCCs)
        // MCCs servem apenas para descobrir contas filhas
        if (!info.isManager) {
          addAccount(info);
        } else {
          // Marcar o ID como visto para evitar re-processamento, mas NÃO adicionar à lista
          seenIds.add(info.customerId);
        }
      } catch (error) {
        console.warn(`⚠️ Info da conta ${customerId}:`, error.message);
        // Se não conseguimos obter info, adicionar como conta normal (pode ser conta de anúncio)
        addAccount({
          customerId,
          name: `Conta ${customerId}`,
          currency: 'BRL',
          isManager: null
        });
      }

      // Expandir MCC (direta ou aninhada) — contas filhas com managedBy = MCC acessível
      if (info?.isManager !== false) {
        try {
          console.log(`🔍 Tentando expandir MCC ${customerId} para listar contas filhas...`);
          const managedAccounts = await collectManagedClientAccounts(
            customerId,
            customerId,
            accessToken,
            seenIds
          );
          debugLogs.push({ step: 'collectManagedClientAccounts', manager: customerId, found: managedAccounts.length });
          if (managedAccounts.length > 0) {
            console.log(
              `📂 MCC ${customerId}: ${managedAccounts.length} contas filhas encontradas`
            );
            managedAccounts.forEach(addAccount);
          } else {
            console.log(`ℹ️ MCC ${customerId}: nenhuma conta filha encontrada`);
          }
        } catch (error) {
          console.error(`❌ Erro ao expandir MCC ${customerId}:`, error.message);
          console.error(`❌ Stack:`, error.stack?.substring(0, 500));
          if (String(error.message).includes('UNSUPPORTED_VERSION')) {
            throw error;
          }
        }
      }
    }

    console.log(`✅ Total: ${allAccounts.length} contas de anúncio (MCCs filtradas)`);

    // ===== Varredura agressiva: tentar expandir MCCs mesmo quando não detectados explicitamente
    try {
      console.log('🔎 Iniciando varredura agressiva por MCCs (limitado) ...');
      const scanLimit = 30;
      const scanned = new Set();
      for (const cid of customerIds.slice(0, scanLimit)) {
        if (scanned.has(cid)) continue;
        scanned.add(cid);
        try {
          console.log(`🔍 [aggressivo] tentando expandir ${cid}...`);
          const more = await collectManagedClientAccounts(cid, cid, accessToken, seenIds);
          debugLogs.push({ step: 'aggressive_collect', manager: cid, found: more.length });
          if (more && more.length) {
            console.log(`📂 [agressivo] ${cid}: ${more.length} contas filhas encontradas`);
            more.forEach(addAccount);
          }
        } catch (err) {
          console.warn(`⚠️ [aggressivo] falha expandindo ${cid}:`, err.message || err);
        }
      }
      console.log(`🔎 Varredura agressiva finalizada. Total agora: ${allAccounts.length}`);
    } catch (err) {
      console.warn('⚠️ Erro durante varredura agressiva:', err.message || err);
    }

    return res.status(200).json({ accounts: allAccounts, debug: debugLogs });
  } catch (error) {
    console.error('❌ Erro ao listar contas:', error.message);
    throw error;
  }
}

// Buscar linhas customer_client de uma MCC (para expansão recursiva)
// rootManagerId = MCC raiz acessível pelo usuário (usado como login-customer-id)
async function queryCustomerClients(managerCustomerId, accessToken, rootManagerId = null) {
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

  // ✅ Usar rootManagerId como login-customer-id (a MCC raiz que o usuário tem acesso)
  // Para sub-MCCs, precisamos autenticar via a MCC raiz, não pela sub-MCC diretamente
  const loginId = rootManagerId || managerCustomerId;

  console.log(`🔍 [queryCustomerClients] Buscando filhas de ${managerCustomerId} (login-customer-id: ${loginId})`);

  const response = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${managerCustomerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: buildGoogleAdsHeaders(accessToken, loginId),
      body: JSON.stringify({ query })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [queryCustomerClients] Erro ${response.status} para MCC ${managerCustomerId}:`);
    console.error(`❌ [queryCustomerClients] Detalhes: ${errorText.substring(0, 1000)}`);

    if (
      response.status === 403 &&
      (errorText.includes('USER_PERMISSION_DENIED') ||
        errorText.includes("doesn't have permission") ||
        errorText.includes('PERMISSION_DENIED'))
    ) {
      console.warn(`⚠️ [queryCustomerClients] ${managerCustomerId} sem permissão para listar filhas (login-customer-id: ${loginId})`);

      // ✅ FALLBACK: Se falhou com rootManagerId, tentar com managerCustomerId diretamente
      if (rootManagerId && rootManagerId !== managerCustomerId) {
        console.log(`🔄 [queryCustomerClients] Tentando fallback com login-customer-id: ${managerCustomerId}`);
        const fallbackResponse = await fetch(
          `${GOOGLE_ADS_BASE}/customers/${managerCustomerId}/googleAds:searchStream`,
          {
            method: 'POST',
            headers: buildGoogleAdsHeaders(accessToken, managerCustomerId),
            body: JSON.stringify({ query })
          }
        );
        if (fallbackResponse.ok) {
          console.log(`✅ [queryCustomerClients] Fallback com login-customer-id ${managerCustomerId} funcionou!`);
          const fallbackData = await fallbackResponse.json();
          return flattenSearchStreamResults(fallbackData);
        } else {
          console.warn(`⚠️ [queryCustomerClients] Fallback também falhou para ${managerCustomerId}`);
        }
      }

      return [];
    }

    // ✅ Para erros que não são 403, também tentar fallback antes de lançar exceção
    if (rootManagerId && rootManagerId !== managerCustomerId) {
      console.log(`🔄 [queryCustomerClients] Tentando fallback para erro ${response.status}...`);
      try {
        const fallbackResponse = await fetch(
          `${GOOGLE_ADS_BASE}/customers/${managerCustomerId}/googleAds:searchStream`,
          {
            method: 'POST',
            headers: buildGoogleAdsHeaders(accessToken, managerCustomerId),
            body: JSON.stringify({ query })
          }
        );
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          return flattenSearchStreamResults(fallbackData);
        }
      } catch (fbErr) {
        // Fallback falhou, lançar erro original
      }
    }

    throw new Error(`${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rows = flattenSearchStreamResults(data);
  console.log(`✅ [queryCustomerClients] ${rows.length} registros encontrados para MCC ${managerCustomerId}`);
  return rows;
}

/**
 * Contas cliente sob MCC (recursivo para sub-MCC).
 * managedBy = MCC raiz acessível (login-customer-id nas consultas posteriores).
 */
async function collectManagedClientAccounts(
  rootManagerId,
  managerCustomerId,
  accessToken,
  seenIds,
  depth = 0
) {
  if (depth > 8) {
    console.warn(`⚠️ [collectManagedClientAccounts] Profundidade máxima (8) atingida para MCC ${managerCustomerId}`);
    return [];
  }

  console.log(`📂 [collectManagedClientAccounts] Nível ${depth}: buscando filhas de ${managerCustomerId} (root: ${rootManagerId})`);

  // ✅ Passar rootManagerId para queryCustomerClients usar como login-customer-id
  const rows = await queryCustomerClients(managerCustomerId, accessToken, rootManagerId);
  const accounts = [];

  console.log(`📋 [collectManagedClientAccounts] ${rows.length} registros retornados para ${managerCustomerId}`);

  for (const row of rows) {
    const cc = row.customerClient;
    if (!cc?.id) continue;

    const id = String(cc.id);
    const isManager = cc.manager === true;
    const level = cc.level || 0;

    // Pular a própria MCC (level 0 = ela mesma)
    if (id === String(managerCustomerId)) {
      continue;
    }

    if (isManager) {
      console.log(`   📂 Sub-MCC encontrada: ${id} — ${cc.descriptiveName || 'Sem nome'} (level: ${level})`);
      // Expandir sub-MCC recursivamente
      const nested = await collectManagedClientAccounts(
        rootManagerId,
        id,
        accessToken,
        seenIds,
        depth + 1
      );
      accounts.push(...nested);
      continue;
    }

    if (seenIds.has(id)) {
      console.log(`   ⏭️ Conta ${id} já vista, pulando`);
      continue;
    }
    seenIds.add(id);

    const accountName = cc.descriptiveName || `Conta ${id}`;
    console.log(`   ✅ Conta filha: ${id} — ${accountName} (level: ${level})`);

    accounts.push({
      customerId: id,
      name: accountName,
      currency: cc.currencyCode || 'BRL',
      managedBy: String(rootManagerId),
      isManager: false
    });
  }

  console.log(`📊 [collectManagedClientAccounts] ${accounts.length} contas coletadas de ${managerCustomerId}`);
  return accounts;
}

/** @deprecated Use collectManagedClientAccounts — mantido para compatibilidade interna */
async function getManagedAccounts(managerCustomerId, accessToken) {
  const seen = new Set();
  return collectManagedClientAccounts(
    managerCustomerId,
    managerCustomerId,
    accessToken,
    seen
  );
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

