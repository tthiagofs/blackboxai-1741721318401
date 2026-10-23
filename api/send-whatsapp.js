// Serverless function para enviar mensagem de WhatsApp via Meta Cloud API Oficial
// Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api

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
    const { phone, message, templateName, templateParams } = req.body;

    if (!phone || (!message && !templateName)) {
      return res.status(400).json({ error: 'Telefone e conteúdo da mensagem são obrigatórios' });
    }

    // Limpar telefone (apenas números com DDI 55)
    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Credenciais da Meta Cloud API
    const metaToken = process.env.WHATSAPP_TOKEN || process.env.META_WA_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WA_PHONE_ID;
    const defaultTemplate = process.env.WHATSAPP_TEMPLATE_NAME || 'relatorio_diario';

    if (!metaToken || !phoneNumberId) {
      return res.status(400).json({
        error: 'Credenciais da Meta WhatsApp API não configuradas',
        details: 'Adicione WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID nas variáveis de ambiente da Vercel.'
      });
    }

    const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    // Montar payload: Se foi passado templateName ou usar Template padrão da Meta
    let bodyPayload = {};

    if (templateName || defaultTemplate) {
      const tName = templateName || defaultTemplate;
      
      // Montar parâmetros do template (ex: {{1}} = texto do relatório)
      const parameters = templateParams || [
        {
          type: 'text',
          text: message || 'Relatório Insightflow'
        }
      ];

      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: tName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: parameters
            }
          ]
        }
      };
    } else {
      // Envio de texto livre (para janelas de 24h ativas)
      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };
    }

    console.log(`📡 [WhatsApp Meta API] Enviando para ${cleanPhone}...`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${metaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro Meta Cloud API:', data);

      // Se falhou por template inexistente, tentar envio de texto direto como fallback
      if (data.error?.code === 132000 || data.error?.code === 100) {
        console.log('⚠️ Tentando fallback de texto livre...');
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: message }
          })
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok) {
          return res.status(200).json({ success: true, data: fallbackData, fallback: true });
        }
      }

      return res.status(response.status).json({
        error: 'Falha no envio via Meta WhatsApp Cloud API',
        details: data.error?.message || data
      });
    }

    console.log('✅ Mensagem entregue com sucesso via Meta Cloud API!');
    return res.status(200).json({
      success: true,
      messageId: data.messages?.[0]?.id,
      data
    });

  } catch (error) {
    console.error('❌ Erro interno no disparo:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar disparo',
      message: error.message
    });
  }
}
