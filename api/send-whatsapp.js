// Serverless function para enviar mensagem de WhatsApp
// Conecta com Z-API, Evolution API ou provedor configurado

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios' });
    }

    // Limpar telefone (apenas números)
    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Provedor configurado: Evolution API (100% grátis) ou Z-API
    const evolutionUrl = process.env.EVOLUTION_API_URL; // Ex: https://sua-evolution.railway.app
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;
    const evolutionInstance = process.env.EVOLUTION_INSTANCE_NAME || 'insightflow';

    const zapiInstanceId = process.env.ZAPI_INSTANCE_ID;
    const zapiToken = process.env.ZAPI_TOKEN;
    const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN;

    let endpoint = '';
    let headers = { 'Content-Type': 'application/json' };
    let bodyPayload = {};

    if (evolutionUrl && evolutionApiKey) {
      // Formato da Evolution API (Open Source e Grátis)
      endpoint = `${evolutionUrl.replace(/\/$/, '')}/message/sendText/${evolutionInstance}`;
      headers['apikey'] = evolutionApiKey;
      bodyPayload = {
        number: cleanPhone,
        text: message
      };
    } else if (zapiInstanceId && zapiToken) {
      // Formato da Z-API
      endpoint = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
      if (zapiClientToken) headers['Client-Token'] = zapiClientToken;
      bodyPayload = {
        phone: cleanPhone,
        message: message
      };
    } else {
      return res.status(400).json({
        error: 'Instância WhatsApp não configurada',
        details: 'Configure Evolution API (gratuita) ou Z-API no painel de Robô WhatsApp Admin.'
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro no envio WhatsApp:', data);
      return res.status(response.status).json({
        error: 'Falha ao enviar mensagem pelo WhatsApp',
        details: data
      });
    }

    console.log('✅ Mensagem WhatsApp enviada com sucesso para:', cleanPhone);
    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('❌ Erro interno no disparo de WhatsApp:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar disparo de WhatsApp',
      message: error.message
    });
  }
}
