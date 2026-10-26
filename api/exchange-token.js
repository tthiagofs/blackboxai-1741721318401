// Endpoint para troca e renovação automática de tokens (Meta Ads e Google Ads)
// Meta: Troca token curto (2h) por Long-Lived Token (60 dias)
// Google: Troca authorization code ou refresh_token por access_token válido

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

  const { platform, shortLivedToken, refreshToken, code, redirectUri } = req.body;

  try {
    // ==========================================
    // 1. META ADS (FACEBOOK / INSTAGRAM)
    // ==========================================
    if (platform === 'meta') {
      if (!shortLivedToken) {
        return res.status(400).json({ error: 'shortLivedToken é obrigatório para Meta' });
      }

      const appId = process.env.META_APP_ID || '1595817924411708';
      const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

      if (!appSecret) {
        // Se ainda não configurado appSecret nas variáveis de ambiente, retornar o token atual
        console.warn('⚠️ META_APP_SECRET não encontrado nas env vars. Mantendo token de sessão.');
        return res.status(200).json({
          accessToken: shortLivedToken,
          expiresIn: 5184000,
          isLongLived: false,
          warning: 'Configure META_APP_SECRET para gerar tokens oficiais de 60 dias.'
        });
      }

      // Trocar por Long-Lived Token oficial de 60 dias da Meta
      const url = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
      
      const metaRes = await fetch(url);
      const metaData = await metaRes.json();

      if (!metaRes.ok || metaData.error) {
        console.error('❌ Erro Meta Token Exchange:', metaData);
        return res.status(400).json({ error: metaData.error?.message || 'Falha ao trocar token Meta' });
      }

      console.log('✅ Token Meta de 60 dias gerado com sucesso!');
      return res.status(200).json({
        accessToken: metaData.access_token,
        expiresIn: metaData.expires_in || 5184000, // 60 dias em segundos
        isLongLived: true
      });
    }

    // ==========================================
    // 2. GOOGLE ADS
    // ==========================================
    if (platform === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID || '73361857075-qoqd61imivlju9l83dd6fevvh8e8ppsf.apps.googleusercontent.com';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      // Cenário A: Renovar access_token usando refresh_token permanente
      if (refreshToken) {
        if (!clientSecret) {
          return res.status(400).json({ error: 'GOOGLE_CLIENT_SECRET não configurado nas env vars' });
        }

        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });

        const gRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        const gData = await gRes.json();
        if (!gRes.ok || gData.error) {
          console.error('❌ Erro Google Refresh Token:', gData);
          return res.status(400).json({ error: gData.error_description || gData.error });
        }

        console.log('✅ Access Token do Google Ads renovado com sucesso!');
        return res.status(200).json({
          accessToken: gData.access_token,
          expiresIn: gData.expires_in || 3600
        });
      }

      // Cenário B: Trocar authorization code inicial por access_token + refresh_token
      if (code && redirectUri) {
        if (!clientSecret) {
          return res.status(400).json({ error: 'GOOGLE_CLIENT_SECRET não configurado nas env vars' });
        }

        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const params = new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        });

        const gRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        const gData = await gRes.json();
        if (!gRes.ok || gData.error) {
          console.error('❌ Erro Google Auth Code:', gData);
          return res.status(400).json({ error: gData.error_description || gData.error });
        }

        return res.status(200).json({
          accessToken: gData.access_token,
          refreshToken: gData.refresh_token,
          expiresIn: gData.expires_in || 3600
        });
      }

      return res.status(400).json({ error: 'refreshToken ou code/redirectUri são obrigatórios para Google' });
    }

    return res.status(400).json({ error: 'Plataforma inválida. Use "meta" ou "google".' });

  } catch (error) {
    console.error('❌ Erro no exchange-token:', error);
    return res.status(500).json({ error: error.message });
  }
}
