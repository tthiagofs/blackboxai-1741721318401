// Vercel Serverless Function para Google Ads API (usando REST API diretamente)

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
    const { action, customerId, startDate, endDate, accessToken } = req.body;

    console.log('📥 Ação recebida:', action);

    switch (action) {
      case 'listAccounts':
        return await listAccounts(accessToken, res);
      
      case 'getAccountInsights':
        return await getAccountInsights(customerId, startDate, endDate, accessToken, res);
      
      case 'getComparison':
        return await getComparison(customerId, startDate, endDate, accessToken, res);
      
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

// Listar contas Google Ads acessíveis
async function listAccounts(accessToken, res) {
  try {
    if (!accessToken) {
      throw new Error('Access token é obrigatório para listar contas');
    }

    console.log('🔍 Listando contas acessíveis via Google Ads API...');
    console.log(`🔑 Developer Token: ${process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'Presente' : 'AUSENTE'}`);
    console.log(`🎫 Access Token: ${accessToken ? 'Presente (primeiros 20 chars): ' + accessToken.substring(0, 20) + '...' : 'AUSENTE'}`);
    
    const url = 'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API do Google Ads - Status:', response.status);
      console.error('❌ Erro na API do Google Ads - Response:', errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta da API:', data);

    const customerIds = (data.resourceNames || []).map(name => {
      const parts = name.split('/');
      return parts[parts.length - 1];
    });

    console.log(`📋 Customer IDs encontrados: ${customerIds.join(', ')}`);

    // Buscar informações detalhadas de cada conta
    const accountsDetails = await Promise.all(
      customerIds.map(async (customerId) => {
        try {
          return await getAccountInfo(customerId, accessToken);
        } catch (error) {
          console.warn(`⚠️ Erro ao buscar info da conta ${customerId}:`, error.message);
          return {
            customerId,
            name: `Conta ${customerId}`,
            error: error.message
          };
        }
      })
    );

    const validAccounts = accountsDetails.filter(acc => !acc.error);
    console.log(`✅ ${validAccounts.length} contas válidas encontradas`);

    return res.status(200).json({ 
      accounts: validAccounts
    });
  } catch (error) {
    console.error('❌ Erro ao listar contas:', error.message);
    throw error;
  }
}

// Buscar informações de uma conta específica
async function getAccountInfo(customerId, accessToken) {
  try {
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code
      FROM customer
      LIMIT 1
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0 && data[0].results && data[0].results.length > 0) {
      const customer = data[0].results[0].customer;
      return {
        customerId: customerId,
        name: customer.descriptiveName || `Conta ${customerId}`,
        currency: customer.currencyCode || 'BRL',
      };
    }

    return {
      customerId,
      name: `Conta ${customerId}`,
      currency: 'BRL',
    };
  } catch (error) {
    throw error;
  }
}

// Buscar insights da conta
async function getAccountInsights(customerId, startDate, endDate, accessToken, res) {
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

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        },
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

    // Processar resultados
    if (data && Array.isArray(data)) {
      data.forEach(batch => {
        if (batch.results) {
          batch.results.forEach(row => {
            if (row.metrics) {
              totalImpressions += parseInt(row.metrics.impressions || 0);
              totalClicks += parseInt(row.metrics.clicks || 0);
              totalConversions += parseFloat(row.metrics.conversions || 0);
              totalCostMicros += parseInt(row.metrics.costMicros || 0);
            }
          });
        }
      });
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

// Buscar dados de comparação
async function getComparison(customerId, startDate, endDate, accessToken, res) {
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
      getAccountInsights(customerId, startDate, endDate, accessToken, null),
      getAccountInsights(customerId, previousStartDate, previousEndDate, accessToken, null),
    ]);

    const current = currentData.insights;
    const previous = previousData.insights;

    return res.status(200).json({
      current,
      previous,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar comparação:', error);
    throw error;
  }
}

