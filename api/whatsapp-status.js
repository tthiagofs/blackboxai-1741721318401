// Serverless function para consultar status da conexão e QR Code do WhatsApp
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const instanceId = req.query.instanceId || process.env.ZAPI_INSTANCE_ID;
  const token = req.query.token || process.env.ZAPI_TOKEN;
  const clientToken = req.query.clientToken || process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token) {
    return res.status(200).json({
      connected: false,
      configured: false,
      message: 'Instância não configurada. Preencha os campos acima.'
    });
  }

  try {
    const headers = {};
    if (clientToken) headers['Client-Token'] = clientToken;

    // Checar status
    const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const statusRes = await fetch(statusUrl, { headers });
    const statusData = await statusRes.json();

    const isConnected = statusData.connected === true;

    let qrCode = null;
    if (!isConnected) {
      // Buscar QR Code em imagem base64
      const qrUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`;
      const qrRes = await fetch(qrUrl, { credentials: 'omit', headers });
      const qrData = await qrRes.json();
      qrCode = qrData.value || null;
    }

    return res.status(200).json({
      connected: isConnected,
      configured: true,
      phone: statusData.phone || null,
      qrCode: qrCode,
      raw: statusData
    });
  } catch (error) {
    console.error('❌ Erro ao consultar status WhatsApp:', error);
    return res.status(500).json({
      connected: false,
      error: error.message
    });
  }
}
