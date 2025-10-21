// Netlify Function para Google Ads API
const { GoogleAdsApi } = require('google-ads-api');

// Inicializar cliente Google Ads
let client;

function getClient() {
  if (!client) {
    client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
  }
  return client;
}

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
    const { action, customerId, startDate, endDate, refreshToken } = JSON.parse(event.body || '{}');

    if (!customerId || !refreshToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'customerId e refreshToken são obrigatórios' }),
      };
    }

    const client = getClient();
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });

    switch (action) {
      case 'getCampaigns':
        return await getCampaigns(customer, startDate, endDate, headers);
      
      case 'getAccountInsights':
        return await getAccountInsights(customer, startDate, endDate, headers);
      
      case 'getComparison':
        return await getComparison(customer, startDate, endDate, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ação inválida' }),
        };
    }
  } catch (error) {
    console.error('Erro na função:', error);
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

// Buscar campanhas com métricas
async function getCampaigns(customer, startDate, endDate, headers) {
  try {
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status = 'ENABLED'
    `;

    const campaigns = await customer.query(query);
    
    // Agrupar por campanha e somar métricas
    const campaignsMap = {};
    
    campaigns.forEach(row => {
      const id = row.campaign.id.toString();
      if (!campaignsMap[id]) {
        campaignsMap[id] = {
          id,
          name: row.campaign.name,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          cost: 0,
        };
      }
      
      campaignsMap[id].impressions += row.metrics.impressions || 0;
      campaignsMap[id].clicks += row.metrics.clicks || 0;
      campaignsMap[id].conversions += row.metrics.conversions || 0;
      campaignsMap[id].cost += (row.metrics.cost_micros || 0) / 1000000; // Converter de micros para reais
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ campaigns: Object.values(campaignsMap) }),
    };
  } catch (error) {
    throw new Error(`Erro ao buscar campanhas: ${error.message}`);
  }
}

// Buscar insights da conta
async function getAccountInsights(customer, startDate, endDate, headers) {
  try {
    const query = `
      SELECT 
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    const results = await customer.query(query);
    
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalCost = 0;
    
    results.forEach(row => {
      totalImpressions += row.metrics.impressions || 0;
      totalClicks += row.metrics.clicks || 0;
      totalConversions += row.metrics.conversions || 0;
      totalCost += (row.metrics.cost_micros || 0) / 1000000;
    });

    const insights = {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      cost: totalCost,
      costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ insights }),
    };
  } catch (error) {
    throw new Error(`Erro ao buscar insights: ${error.message}`);
  }
}

// Buscar dados de comparação
async function getComparison(customer, startDate, endDate, headers) {
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
      getAccountInsights(customer, startDate, endDate, headers),
      getAccountInsights(customer, previousStartDate, previousEndDate, headers),
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
    throw new Error(`Erro ao buscar comparação: ${error.message}`);
  }
}

