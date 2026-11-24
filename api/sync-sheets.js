// Endpoint Serverless para Sincronização Automática com o Google Sheets
// Pode ser executado via Vercel Cron, GitHub Actions, cron-job.org ou manualmente pela interface de Admin com ?force=true

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificação de segurança opcional com CRON_SECRET
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Se não for bearer secret e não for requisição force manual do admin, bloqueia
      if (!req.query?.force && !req.body?.force) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  const isForce = req.query?.force === 'true' || req.body?.force === true;
  console.log(`📊 [Sync Sheets] Iniciando rotina de sincronização (force: ${isForce})...`);

  try {
    const firebaseApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyB3-n3WIdEOhCxvpbigs_ogse7b3tggGGU';
    const projectId = process.env.FIREBASE_PROJECT_ID || 'insightflow-82cc4';

    // Autenticar com o bot de sistema
    let authHeaders = {};
    try {
      const authRes = await fetchWithTimeout(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'cron.bot@insightflow.internal',
          password: 'CronPass123!@#',
          returnSecureToken: true
        }),
        timeout: 4000
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.idToken) {
          authHeaders = { Authorization: `Bearer ${authData.idToken}` };
        }
      }
    } catch (eAuth) {
      console.warn('⚠️ [Sync Sheets] Fallback auth:', eAuth.message);
    }

    // 1. Ler configuração da automação do Firestore
    const configUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_automations/sheets_sync?key=${firebaseApiKey}`;
    const cfgRes = await fetchWithTimeout(configUrl, { headers: authHeaders, timeout: 4500 });
    
    if (!cfgRes.ok) {
      return res.status(400).json({
        success: false,
        error: 'Configuração de automação de planilha não encontrada no Firestore. Acesse o painel de Admin e salve as configurações.'
      });
    }

    const cfgDoc = await cfgRes.json();
    const config = parseFirestoreMap(cfgDoc.fields || {});

    // Se automação estiver pausada e não for forçada, abortar
    if (!isForce && config.active === false) {
      console.log('⏸️ [Sync Sheets] Automação pausada pelo administrador.');
      return res.status(200).json({ success: true, status: 'skipped', reason: 'Automação pausada no painel de controle' });
    }

    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'URL do Webhook do Google Apps Script não configurada.' });
    }

    // 2. Checagem de Horário em Brasília (se não for forçado)
    const now = new Date();
    const formatterHourMin = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentHourMin = formatterHourMin.format(now);

    const formatterDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayDateStr = formatterDate.format(now); // Ex: "2026-11-24"
    const [curYear, curMonth] = todayDateStr.split('-');
    const startOfMonthStr = `${curYear}-${curMonth}-01`; // Ex: "2026-11-01"

    if (!isForce) {
      const schedules = config.schedules || ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const [cHour, cMin] = currentHourMin.split(':').map(Number);
      const currentTotalMinutes = cHour * 60 + cMin;
      
      let matchedSchedule = false;
      for (const s of schedules) {
        const [sHour, sMin] = s.split(':').map(Number);
        const schedTotalMinutes = sHour * 60 + sMin;
        const diff = currentTotalMinutes - schedTotalMinutes;
        // Janela de tolerância de 2 minutos
        if (diff >= 0 && diff <= 2) {
          matchedSchedule = true;
          break;
        }
      }

      if (!matchedSchedule) {
        return res.status(200).json({
          success: true,
          status: 'skipped',
          reason: `Horário ${currentHourMin} fora da grade configurada (${schedules.join(', ')})`
        });
      }
    }

    console.log(`📅 [Sync Sheets] Período do mês atual: ${startOfMonthStr} até ${todayDateStr}`);

    // 3. Obter tokens de acesso para Meta Ads e Google Ads
    let metaToken = process.env.META_ACCESS_TOKEN || '';
    let googleRefreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
    let googleToken = '';

    // Buscar tokens salvos dos usuários no Firestore
    try {
      const alertsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsapp_alerts?key=${firebaseApiKey}&pageSize=50`;
      const aRes = await fetchWithTimeout(alertsUrl, { headers: authHeaders, timeout: 4000 });
      if (aRes.ok) {
        const aData = await aRes.json();
        for (const doc of (aData.documents || [])) {
          const aObj = parseFirestoreMap(doc.fields || {});
          if (!metaToken && aObj.metaToken) metaToken = aObj.metaToken;
          if (!googleRefreshToken && aObj.googleRefreshToken) googleRefreshToken = aObj.googleRefreshToken;
        }
      }
    } catch (eTok) {}

    // Fallback: buscar na coleção users
    if (!metaToken || !googleRefreshToken) {
      try {
        const usersUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?key=${firebaseApiKey}&pageSize=20`;
        const uRes = await fetchWithTimeout(usersUrl, { headers: authHeaders, timeout: 4000 });
        if (uRes.ok) {
          const uData = await uRes.json();
          for (const doc of (uData.documents || [])) {
            const uObj = parseFirestoreMap(doc.fields || {});
            const conn = uObj.connections || {};
            if (!metaToken && conn.meta?.accessToken) metaToken = conn.meta.accessToken;
            if (!googleRefreshToken && conn.google?.refreshToken) googleRefreshToken = conn.google.refreshToken;
          }
        }
      } catch (eU) {}
    }

    // Se temos googleRefreshToken, gerar access_token novo
    const gClientId = process.env.GOOGLE_ADS_CLIENT_ID || '1021481109968-3hvhv9m9b15i4g8d0b2f5c7a1e3g6h8j.apps.googleusercontent.com';
    const gClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
    const gDevToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'P936p-60qZ9nQW-bA71vAw';

    if (googleRefreshToken && gClientSecret) {
      try {
        const params = new URLSearchParams({
          client_id: gClientId,
          client_secret: gClientSecret,
          refresh_token: googleRefreshToken,
          grant_type: 'refresh_token'
        });
        const gRes = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          timeout: 4500
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.access_token) googleToken = gData.access_token;
        }
      } catch (eG) {
        console.warn('⚠️ [Sync Sheets] Erro ao renovar token Google Ads:', eG.message);
      }
    }

    const mappings = config.mappings || {};
    const unitsList = config.unitsList || Object.keys(mappings);
    const maxRow = config.maxRow || 86;
    const tabName = config.tabName || '';

    // 4. Mapear contas únicas para otimizar chamadas de API
    const metaCache = {};
    const googleCache = {};

    const metaIdsToFetch = new Set();
    const googleIdsToFetch = new Set();

    for (const unitName of unitsList) {
      const map = mappings[unitName];
      if (map) {
        if (map.metaId) metaIdsToFetch.add(map.metaId.trim());
        if (map.googleId) googleIdsToFetch.add(map.googleId.trim());
      }
    }

    console.log(`🔍 [Sync Sheets] Contas a consultar: ${metaIdsToFetch.size} no Meta, ${googleIdsToFetch.size} no Google`);

    // 5. Coletar métricas do Meta Ads (em lotes paralelos de 10)
    if (metaToken && metaIdsToFetch.size > 0) {
      const metaArray = Array.from(metaIdsToFetch);
      const batchSize = 10;
      for (let i = 0; i < metaArray.length; i += batchSize) {
        const batch = metaArray.slice(i, i + batchSize);
        await Promise.all(batch.map(async (accId) => {
          const cleanId = accId.startsWith('act_') ? accId : `act_${accId}`;
          try {
            const timeRangeParam = encodeURIComponent(JSON.stringify({ since: startOfMonthStr, until: todayDateStr }));
            const url = `https://graph.facebook.com/v19.0/${cleanId}/insights?time_range=${timeRangeParam}&fields=spend,actions&access_token=${metaToken}`;
            const res = await fetchWithTimeout(url, { timeout: 6000 });
            if (res.ok) {
              const resJson = await res.json();
              let spend = 0;
              let leads = 0;
              if (resJson.data && resJson.data.length > 0) {
                const row = resJson.data[0];
                spend = parseFloat(row.spend || 0);
                if (row.actions && Array.isArray(row.actions)) {
                  const conv = row.actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                  if (conv && conv.value) leads = parseInt(conv.value, 10);
                  else {
                    const l = row.actions.find(a => a.action_type === 'lead');
                    if (l && l.value) leads = parseInt(l.value, 10);
                  }
                }
              }
              metaCache[accId] = { spend, leads };
            }
          } catch (mErr) {
            console.warn(`⚠️ [Sync Sheets] Falha ao consultar Meta ${cleanId}:`, mErr.message);
          }
        }));
      }
    }

    // 6. Coletar métricas do Google Ads (em lotes paralelos de 5)
    if (googleToken && googleIdsToFetch.size > 0) {
      const gArray = Array.from(googleIdsToFetch);
      const batchSize = 5;
      for (let i = 0; i < gArray.length; i += batchSize) {
        const batch = gArray.slice(i, i + batchSize);
        await Promise.all(batch.map(async (accId) => {
          const cleanCustId = accId.replace(/\D/g, '');
          if (!cleanCustId) return;
          try {
            const gQuery = `SELECT metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date >= '${startOfMonthStr}' AND segments.date <= '${todayDateStr}'`;
            const gHeaders = {
              'Authorization': `Bearer ${googleToken}`,
              'developer-token': gDevToken,
              'Content-Type': 'application/json'
            };
            const defaultMcc = '1872453947';
            gHeaders['login-customer-id'] = defaultMcc;

            const gRes = await fetchWithTimeout(`https://googleads.googleapis.com/v23/customers/${cleanCustId}/googleAds:searchStream`, {
              method: 'POST',
              headers: gHeaders,
              body: JSON.stringify({ query: gQuery }),
              timeout: 6000
            });

            if (gRes.ok) {
              const streamData = await gRes.json();
              let spend = 0;
              let leads = 0;
              const rows = flattenSearchStreamResults(streamData);
              for (const r of rows) {
                if (r.metrics) {
                  spend += (parseFloat(r.metrics.costMicros || 0) / 1000000);
                  leads += parseFloat(r.metrics.conversions || 0);
                }
              }
              googleCache[accId] = { spend, leads };
            }
          } catch (gErr) {
            console.warn(`⚠️ [Sync Sheets] Falha ao consultar Google Ads ${cleanCustId}:`, gErr.message);
          }
        }));
      }
    }

    // 7. Montar lista de updates por Unidade
    const updates = [];
    for (const unitName of unitsList) {
      const map = mappings[unitName] || {};
      let totalSpend = 0;
      let totalLeads = 0;
      let hasData = false;

      if (map.metaId && metaCache[map.metaId]) {
        totalSpend += (metaCache[map.metaId].spend || 0);
        totalLeads += (metaCache[map.metaId].leads || 0);
        hasData = true;
      }

      if (map.googleId && googleCache[map.googleId]) {
        totalSpend += (googleCache[map.googleId].spend || 0);
        totalLeads += (googleCache[map.googleId].leads || 0);
        hasData = true;
      }

      if (hasData) {
        updates.push({
          unit: unitName,
          spend: Math.round(totalSpend * 100) / 100,
          leads: Math.round(totalLeads)
        });
      }
    }

    console.log(`📤 [Sync Sheets] Enviando ${updates.length} atualizações para o Google Apps Script...`);

    // 8. Fazer POST para o Webhook do Google Apps Script
    let sheetResult = {};
    try {
      const postRes = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabName: tabName,
          maxRow: maxRow,
          updates: updates
        }),
        timeout: 10000
      });

      if (postRes.ok) {
        sheetResult = await postRes.json();
      } else {
        const errTxt = await postRes.text();
        throw new Error(`Google Apps Script HTTP ${postRes.status}: ${errTxt}`);
      }
    } catch (postErr) {
      console.error('❌ [Sync Sheets] Erro ao enviar para o Apps Script:', postErr.message);
      return res.status(502).json({
        success: false,
        error: `Erro ao enviar dados para o Google Apps Script: ${postErr.message}`
      });
    }

    // 9. Atualizar Firestore com o log da execução
    const syncInfo = {
      timestamp: new Date().toISOString(),
      count: updates.length,
      updatedInSheet: sheetResult.updatedCount || updates.length,
      status: 'success'
    };

    try {
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/system_automations/sheets_sync?updateMask.fieldPaths=lastSync&key=${firebaseApiKey}`;
      await fetchWithTimeout(patchUrl, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            lastSync: {
              mapValue: {
                fields: {
                  timestamp: { stringValue: syncInfo.timestamp },
                  count: { integerValue: syncInfo.count.toString() },
                  updatedInSheet: { integerValue: syncInfo.updatedInSheet.toString() },
                  status: { stringValue: 'success' }
                }
              }
            }
          }
        }),
        timeout: 4000
      });
    } catch (ePatch) {}

    return res.status(200).json({
      success: true,
      message: 'Planilha sincronizada com sucesso!',
      updatedCount: updates.length,
      timestamp: syncInfo.timestamp,
      sheetResponse: sheetResult
    });

  } catch (err) {
    console.error('❌ [Sync Sheets] Erro fatal:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Helpers
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function parseFirestoreMap(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) out[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) {
      out[k] = (v.arrayValue.values || []).map(val => {
        if (val.stringValue !== undefined) return val.stringValue;
        if (val.mapValue) return parseFirestoreMap(val.mapValue.fields || {});
        return val;
      });
    } else if (v.mapValue !== undefined) {
      out[k] = parseFirestoreMap(v.mapValue.fields || {});
    }
  }
  return out;
}

function flattenSearchStreamResults(streamResults) {
  if (!Array.isArray(streamResults)) return [];
  const allRows = [];
  for (const batch of streamResults) {
    if (batch.results && Array.isArray(batch.results)) {
      allRows.push(...batch.results);
    }
  }
  return allRows;
}
