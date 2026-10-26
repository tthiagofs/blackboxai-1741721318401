// Serverless function para enviar mensagem de WhatsApp via Robô Próprio na Oracle Cloud (ou Meta Cloud API como fallback)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
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

    // Configuração do Robô Central Oracle Cloud
    const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || 'http://163.176.13.42:8080';
    const gatewayApiKey = process.env.WHATSAPP_GATEWAY_API_KEY || 'insightflow123';

    console.log(`📡 [InsightFlow WhatsApp] Enviando para ${phone} via Oracle Gateway (${gatewayUrl})...`);

    // Chamar robô da Oracle Cloud
    const response = await fetch(`${gatewayUrl}/message/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': gatewayApiKey
      },
      body: JSON.stringify({
        number: phone,
        text: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro no robô WhatsApp:', data);
      return res.status(response.status).json({
        error: 'Falha no envio via Robô WhatsApp',
        details: data.error || data
      });
    }

    console.log('✅ Mensagem entregue com sucesso via Robô WhatsApp:', data);
    return res.status(200).json({
      success: true,
      messageId: data.messageId,
      to: data.to,
      provider: 'oracle-vps'
    });

  } catch (error) {
    console.error('❌ Erro inesperado em send-whatsapp:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar envio de WhatsApp',
      details: error.message
    });
  }
}
