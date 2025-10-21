// Netlify Function para Google Ads API (usando REST API diretamente)
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action, customerId, startDate, endDate, accessToken } = JSON.parse(event.body || '{}');

    console.log('📥 Ação recebida:', action);

    switch (action) {
      case 'listAccounts':
        return await listAccounts(accessToken, headers);
      
      case 'getAccountInsights':
        return await getAccountInsights(customerId, startDate, endDate, accessToken, headers);
      
      case 'getComparison':
        return await getComparison(customerId, startDate, endDate, accessToken, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ação inválida' }),
        };
    }
  } catch (error) {
    console.error('❌ Erro na função:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
    };
  }
};

// Listar contas Google Ads acessíveis
async function listAccounts(accessToken, headers) {
  try {
    if (!accessToken) {
      throw new Error('Access token é obrigatório para listar contas');
    }

    console.log('🔍 Listando contas acessíveis via Google Ads API...');
    console.log(`🔑 Developer Token: ${process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'Presente' : 'AUSENTE'}`);
    console.log(`🎫 Access Token: ${accessToken ? 'Presente (primeiros 20 chars): ' + accessToken.substring(0, 20) + '...' : 'AUSENTE'}`);
    
    // CORREÇÃO: O método HTTP deve ser POST, não GET!
    // URL: https://googleads.googleapis.com/v17/customers:listAccessibleCustomers
    const url = 'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers';
    
    const response = await fetch(url, {
      method: 'POST',  // <-- MUDADO DE GET PARA POST
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),  // Corpo vazio para POST
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API do Google Ads - Status:', response.status);
      console.error('❌ Erro na API do Google Ads - Response:', errorText);
      throw new Error(`Erro na API do Google Ads: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta da API:', data);

    // resourceNames vem como: "customers/1234567890"
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        accounts: validAccounts
      }),
    };
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
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
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
async function getAccountInsights(customerId, startDate, endDate, accessToken, headers) {
  try {
    if (!customerId || !startDate || !endDate) {
      throw new Error('customerId, startDate e endDate são obrigatórios');
    }

    // Usar access token do parâmetro ou variável de ambiente
    const finalAccessToken = accessToken;

    if (!finalAccessToken) {
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
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalAccessToken}`,
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

    const totalCost = totalCostMicros / 1000000; // Converter de micros para reais

    const insights = {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      cost: totalCost,
      costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
    };

    console.log('📊 Insights processados:', insights);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ insights }),
    };
  } catch (error) {
    console.error('❌ Erro ao buscar insights:', error);
    throw error;
  }
}

// Buscar dados de comparação
async function getComparison(customerId, startDate, endDate, accessToken, headers) {
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
      getAccountInsights(customerId, startDate, endDate, accessToken, headers),
      getAccountInsights(customerId, previousStartDate, previousEndDate, accessToken, headers),
    ]);

    const current = JSON.parse(currentData.body).insights;
    const previous = JSON.parse(previousData.body).insights;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        current,
        previous,
      }),
    };
  } catch (error) {
    console.error('❌ Erro ao buscar comparação:', error);
    throw error;
  }
}
