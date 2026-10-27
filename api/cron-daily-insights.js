// Endpoint de disparo automático agendado (Cron Job) para enviar os relatórios diários de WhatsApp
// Pode ser executado pela Vercel, por cron da Oracle VPS (crontab), cron-job.org ou manualmente com ?force=true

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificação de segurança opcional
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const isForce = req.query?.force === 'true' || req.body?.force === true;
  console.log(`⏰ [Cron WhatsApp] Iniciando processamento de alertas (force: ${isForce})...`);

  try {
    // 1. Data e Hora atual em Brasília (America/Sao_Paulo)
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
    const todayDateStr = formatterDate.format(now); // Ex: "2026-10-27"

    const spDateStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const spDate = new Date(spDateStr);
    const currentDayOfWeek = spDate.getDay(); // 0: Dom, 1: Seg, ..., 6: Sab

    console.log(`⏰ [Cron WhatsApp] Hora em Brasília: ${currentHourMin} | Data: ${todayDateStr} | Dia da semana: ${currentDayOfWeek}`);

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
    } catch (eAuth) {}

    // 2. Coletar alertas a serem processados
    let alertsToProcess = [];

    // Se vierem alertas diretamente no corpo da requisição (disparo manual ou teste do app)
    if (req.body?.alerts && Array.isArray(req.body.alerts)) {
      alertsToProcess = req.body.alerts;
    } else {
      // 1. Tentar buscar da coleção whatsapp_alerts
      try {
        const alertsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsapp_alerts?key=${firebaseApiKey}&pageSize=100`;
        const aRes = await fetchWithTimeout(alertsUrl, { headers: authHeaders, timeout: 4500 });
        if (aRes.ok) {
          const aData = await aRes.json();
          const docs = aData.documents || [];
          for (const doc of docs) {
            const alertObj = parseFirestoreMap(doc.fields || {});
            alertObj.id = alertObj.id || doc.name.split('/').pop();
            alertObj._docPath = doc.name;
            if (alertObj && (alertObj.active !== false)) {
              alertsToProcess.push(alertObj);
            }
          }
        }
      } catch (errAlerts) {
        console.warn('⚠️ Erro ao consultar whatsapp_alerts:', errAlerts.message);
      }

      // 2. Fallback: tentar listar users se whatsapp_alerts estiver vazia
      if (alertsToProcess.length === 0) {
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?key=${firebaseApiKey}&pageSize=100`;
          const fRes = await fetchWithTimeout(firestoreUrl, { headers: authHeaders, timeout: 4500 });
          if (fRes.ok) {
            const fData = await fRes.json();
            const documents = fData.documents || [];

            for (const doc of documents) {
              const userId = doc.name.split('/').pop();
              const fields = doc.fields || {};
              if (fields.whatsappAlerts && fields.whatsappAlerts.arrayValue) {
                const rawAlerts = fields.whatsappAlerts.arrayValue.values || [];
                for (const aVal of rawAlerts) {
                  const aMap = aVal.mapValue?.fields;
                  if (!aMap) continue;

                  const alertObj = parseFirestoreMap(aMap);
                  alertObj.userId = alertObj.userId || userId;
                  if (alertObj && (alertObj.active !== false)) {
                    alertsToProcess.push(alertObj);
                  }
                }
              }
            }
          }
        } catch (fErr) {
          console.warn('⚠️ Não foi possível listar users via Firestore REST:', fErr.message);
        }
      }
    }

    console.log(`📋 [Cron WhatsApp] Total de alertas encontrados para avaliação: ${alertsToProcess.length}`);

    const results = [];
    const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || 'http://163.176.13.42:8080';
    const gatewayApiKey = process.env.WHATSAPP_GATEWAY_API_KEY || 'insightflow123';

    for (const alert of alertsToProcess) {
      const alertId = alert.id || 'sem-id';
      const phone = (alert.phone || '').replace(/\D/g, '');
      if (!phone) {
        results.push({ alertId, status: 'skipped', reason: 'Telefone inválido ou ausente' });
        continue;
      }

      let matchedSchedule = null;

      // Checagem de agendamento se não for forçado
      if (!isForce) {
        // Checagem de data de ativação (iniciar a partir de data futura)
        if (alert.startActivationDate && alert.startActivationDate > todayDateStr) {
          results.push({ alertId, status: 'skipped', reason: `Alerta configurado para iniciar apenas a partir de ${alert.startActivationDate}` });
          continue;
        }

        const days = alert.daysOfWeek || [1, 2, 3, 4, 5];
        if (!days.includes(currentDayOfWeek)) {
          results.push({ alertId, status: 'skipped', reason: `Hoje não é dia de envio configurado (dia ${currentDayOfWeek})` });
          continue;
        }

        const schedules = alert.schedules || ['08:00'];
        const [cHour, cMin] = currentHourMin.split(':').map(Number);
        const currentTotalMinutes = cHour * 60 + cMin;
        
        for (const s of schedules) {
          const [sHour, sMin] = s.split(':').map(Number);
          const schedTotalMinutes = sHour * 60 + sMin;
          const diff = currentTotalMinutes - schedTotalMinutes;
          // Dispara se estiver no minuto exato (diff === 0) ou tolerância de no máximo 1 minuto de atraso do cron (diff === 1)
          // NUNCA dispara antes (diff < 0) e nunca após 1 minuto
          if (diff >= 0 && diff <= 1) {
            matchedSchedule = s;
            break;
          }
        }

        if (!matchedSchedule) {
          results.push({ alertId, status: 'skipped', reason: `Horário ${currentHourMin} fora da janela de ${schedules.join(', ')}` });
          continue;
        }

        const todayDateKey = `${todayDateStr}_${matchedSchedule}`;
        const uniqueSendKey = `${alertId}_${todayDateKey}`;

        // 1. Verificação anti-duplicidade em memória (mesmo processo node)
        global._sentCronAlerts = global._sentCronAlerts || new Set();
        if (global._sentCronAlerts.has(uniqueSendKey)) {
          results.push({ alertId, status: 'skipped', reason: `Alerta já disparado em memória para o horário ${matchedSchedule}` });
          continue;
        }

        // 2. Verificação anti-duplicidade persistida no Firestore
        if (alert.lastSentKey === todayDateKey) {
          results.push({ alertId, status: 'skipped', reason: `Alerta já enviado hoje para o horário ${matchedSchedule}` });
          continue;
        }
      }

      console.log(`🚀 [Cron WhatsApp] Processando envio para ${phone} (Projeto: ${alert.projectName})...`);

      // 3. Montar datas do relatório
      const yesterday = new Date(spDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let startDate = yesterdayStr;
      let endDate = yesterdayStr;
      let dateTitle = yesterdayStr.split('-').reverse().join('/');

      if (alert.reportPeriod === 'last_7_days') {
        const d7 = new Date(yesterday);
        d7.setDate(d7.getDate() - 6);
        startDate = d7.toISOString().split('T')[0];
        dateTitle = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} (Últimos 7 dias)`;
      } else if (alert.reportPeriod === 'custom_days') {
        const daysCount = Math.max(1, parseInt(alert.customDays || 1, 10));
        const incToday = !!alert.includeToday;

        if (incToday) {
          endDate = todayDateStr;
          const sDate = new Date(spDate);
          sDate.setDate(sDate.getDate() - (daysCount - 1));
          startDate = sDate.toISOString().split('T')[0];
          dateTitle = daysCount === 1 
            ? `${todayDateStr.split('-').reverse().join('/')} (Hoje até agora)`
            : `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} (Últimos ${daysCount} dias incluindo hoje)`;
        } else {
          endDate = yesterdayStr;
          const sDate = new Date(yesterday);
          sDate.setDate(sDate.getDate() - (daysCount - 1));
          startDate = sDate.toISOString().split('T')[0];
          dateTitle = daysCount === 1 
            ? yesterdayStr.split('-').reverse().join('/')
            : `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} (Últimos ${daysCount} dias fechados)`;
        }
      }

      const projName = alert.projectName || 'Oral Centter';
      const managerName = alert.managerName || 'Thiago Felipe';
      let units = alert.unitsSnapshot || [];

      // Fallback: se unitsSnapshot estiver vazio, carregar unidades do projeto via Firestore REST
      if ((!units || units.length === 0) && alert.projectId) {
        try {
          const unitsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/projects/${alert.projectId}/units?key=${firebaseApiKey}&pageSize=100`;
          const uRes = await fetchWithTimeout(unitsUrl, { headers: authHeaders, timeout: 4500 });
          if (uRes.ok) {
            const uData = await uRes.json();
            const fetchedUnits = (uData.documents || []).map(d => {
              const uObj = parseFirestoreMap(d.fields || {});
              uObj.id = d.name.split('/').pop();
              return uObj;
            });
            if (alert.selectedUnits && alert.selectedUnits.length > 0) {
              units = fetchedUnits.filter(u => alert.selectedUnits.includes(u.id));
            } else {
              units = fetchedUnits;
            }
            console.log(`🏢 [Cron WhatsApp] Restauradas ${units.length} unidades do projeto ${alert.projectId}`);
          }
        } catch (eU) {
          console.warn('⚠️ Erro ao buscar unidades do projeto no Firestore:', eU.message);
        }
      }

      // Fallback: se tokens estiverem ausentes, buscar do usuário no Firestore
      let metaToken = alert.metaToken || process.env.META_ACCESS_TOKEN || '';
      let googleToken = alert.googleToken || '';

      if ((!metaToken || !googleToken) && alert.userId) {
        try {
          const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${alert.userId}?key=${firebaseApiKey}`;
          const usrRes = await fetchWithTimeout(userUrl, { headers: authHeaders, timeout: 4000 });
          if (usrRes.ok) {
            const usrDoc = await usrRes.json();
            const usrData = parseFirestoreMap(usrDoc.fields || {});
            if (!metaToken && usrData.connections?.meta?.accessToken) {
              metaToken = usrData.connections.meta.accessToken;
            }
            if (!googleToken && usrData.connections?.google?.accessToken) {
              googleToken = usrData.connections.google.accessToken;
            }
          }
        } catch (eTok) {
          console.warn('⚠️ Erro ao buscar tokens do usuário no Firestore:', eTok.message);
        }
      }

      const modules = alert.modules || {};
      const metaMod = modules.meta || modules;
      const googleMod = modules.google || modules;

      let reportMsg = `Olá, *${managerName}*! Segue o relatório diário das suas unidades.\n\n`;
      reportMsg += `📊 *INSIGHTFLOW - BRIEFING DIÁRIO*\n`;
      reportMsg += `📅 *Dados:* ${dateTitle} | ⏰ *Envio Automático*\n`;
      reportMsg += `📁 *Projeto:* ${projName}\n\n`;

      const lowBalanceUnits = [];

      // Processar todas as unidades em PARALELO para máxima velocidade (evita timeout de 10s na Vercel)
      const unitResults = await Promise.all(units.map(async (unit) => {
        const unitName = unit.name || 'Unidade';
        let unitText = `━━━━━━━━━━━━━━━━━━━━\n🏢 *${unitName.toUpperCase()}*\n`;
        const unitLowBalances = [];
        const unitZeroBalances = [];
        const unitRejectedAds = [];
        let histMetaSpend = 0;
        let histMetaLeads = 0;
        let histGoogleSpend = 0;
        let histGoogleConversions = 0;

        let metaSpend = 0;
        let metaLeads = 0;
        let metaClicks = 0;
        let metaTopAd = null;
        let metaBalanceVal = null;
        let metaDaysLeft = null;

        let gSpend = 0;
        let gClicks = 0;
        let gConversions = 0;
        let gBalanceVal = null;
        let gDaysLeftVal = null;
        let isGooglePostpaid = false;

        const hasMeta = !!unit?.linkedAccounts?.meta?.id;
        const hasGoogle = !!unit?.linkedAccounts?.google?.id;

        // 1. Meta Ads
        if (hasMeta && metaToken) {
          const actId = unit.linkedAccounts.meta.id.startsWith('act_') 
            ? unit.linkedAccounts.meta.id 
            : `act_${unit.linkedAccounts.meta.id}`;

          try {
            const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }));
            
            // Disparar requisições Meta em paralelo
            const promises = [
              fetchWithTimeout(`https://graph.facebook.com/v22.0/${actId}/insights?fields=spend,impressions,clicks,cpc,actions&time_range=${timeRange}&access_token=${metaToken}`, { timeout: 4500 })
                .then(r => r.json()).catch(() => null)
            ];

            if (metaMod.topAd !== false) {
              promises.push(
                fetchWithTimeout(`https://graph.facebook.com/v22.0/${actId}/insights?fields=ad_name,spend,actions&time_range=${timeRange}&level=ad&limit=20&access_token=${metaToken}`, { timeout: 4500 })
                  .then(r => r.json()).catch(() => null)
              );
            } else {
              promises.push(Promise.resolve(null));
            }

            if (metaMod.balance !== false) {
              promises.push(
                fetchWithTimeout(`https://graph.facebook.com/v22.0/${actId}?fields=balance,spend_cap,amount_spent,is_prepay_account&access_token=${metaToken}`, { timeout: 4000 })
                  .then(r => r.json()).catch(() => null)
              );
            } else {
              promises.push(Promise.resolve(null));
            }

            // Histórico para Semáforo de Metas / Otimização (se ativo)
            if (alert.optimizationRules?.enabled && alert.optimizationRules.cplIncreaseEnabled) {
              const cmpDays = Math.max(2, parseInt(alert.optimizationRules.cplCompareDays || 30, 10));
              const dComp = new Date(spDate);
              dComp.setDate(dComp.getDate() - cmpDays);
              const sinceComp = dComp.toISOString().split('T')[0];
              const trComp = encodeURIComponent(JSON.stringify({ since: sinceComp, until: yesterdayStr }));
              promises.push(
                fetchWithTimeout(`https://graph.facebook.com/v22.0/${actId}/insights?fields=spend,actions&time_range=${trComp}&access_token=${metaToken}`, { timeout: 4500 })
                  .then(r => r.json()).catch(() => null)
              );
            } else {
              promises.push(Promise.resolve(null));
            }

            // Checar anúncios reprovados / rejeitados no Meta Ads
            promises.push(
              fetchWithTimeout(`https://graph.facebook.com/v22.0/${actId}/ads?fields=name,effective_status,issues_info&limit=30&access_token=${metaToken}`, { timeout: 4000 })
                .then(r => r.json()).catch(() => null)
            );

            const [insData, adsData, accData, histData, rejData] = await Promise.all(promises);

            // Processar métricas gerais
            if (insData?.data && insData.data.length > 0) {
              const r = insData.data[0];
              metaSpend = parseFloat(r.spend || 0);
              metaClicks = parseInt(r.clicks || 0);
              if (r.actions && Array.isArray(r.actions)) {
                const conv = r.actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                if (conv && conv.value) metaLeads = parseInt(conv.value, 10);
                else {
                  const lead = r.actions.find(a => a.action_type === 'lead');
                  if (lead && lead.value) metaLeads = parseInt(lead.value, 10);
                }
              }
            }

            // Processar histórico Meta para Semáforo de Metas
            if (histData?.data && histData.data.length > 0) {
              const hr = histData.data[0];
              histMetaSpend = parseFloat(hr.spend || 0);
              if (hr.actions && Array.isArray(hr.actions)) {
                const conv = hr.actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                if (conv && conv.value) histMetaLeads = parseInt(conv.value, 10);
                else {
                  const lead = hr.actions.find(a => a.action_type === 'lead');
                  if (lead && lead.value) histMetaLeads = parseInt(lead.value, 10);
                }
              }
            }

            // Processar Top Criativo
            if (adsData?.data && Array.isArray(adsData.data)) {
              let maxMsgs = 0;
              adsData.data.forEach(ad => {
                let msgs = 0;
                if (ad.actions) {
                  const c = ad.actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                  if (c) msgs = parseInt(c.value, 10);
                }
                if (msgs > maxMsgs) {
                  maxMsgs = msgs;
                  metaTopAd = { name: ad.ad_name, messages: msgs };
                }
              });
            }

            // Processar Anúncios Rejeitados do Meta
            if (rejData?.data && Array.isArray(rejData.data)) {
              const disapproved = rejData.data.filter(a => a.effective_status === 'DISAPPROVED' || a.effective_status === 'WITH_ISSUES');
              if (disapproved.length > 0) {
                unitRejectedAds.push({
                  unitName,
                  platform: 'Meta Ads',
                  count: disapproved.length,
                  ads: disapproved.map(a => `"${a.name || 'Criativo'}"`)
                });
              }
            }

            // Processar Saldo
            if (accData) {
              let rawBal = null;
              const spendCap = parseFloat(accData.spend_cap || 0);
              const amountSpent = parseFloat(accData.amount_spent || 0);
              if (spendCap > 0 && spendCap > amountSpent) {
                rawBal = (spendCap - amountSpent) / 100;
              } else if (accData.is_prepay_account && parseFloat(accData.balance || 0) > 0) {
                rawBal = parseFloat(accData.balance) / 100;
              }

              if (rawBal !== null && rawBal > 0) {
                metaBalanceVal = Math.round((rawBal / (1 - 0.11765)) * 100) / 100;
                // Estimativa de dias restantes
                if (metaSpend > 0) {
                  metaDaysLeft = (metaBalanceVal / metaSpend).toFixed(1);
                  if (parseFloat(metaDaysLeft) <= 3) {
                    unitLowBalances.push({ name: `${unitName} (Meta Ads)`, balance: metaBalanceVal, daysLeft: metaDaysLeft });
                  }
                }
              } else if ((spendCap > 0 && spendCap <= amountSpent) || (accData.is_prepay_account && parseFloat(accData.balance || 0) <= 0)) {
                unitZeroBalances.push({ name: `${unitName} (Meta Ads)`, balance: 0 });
              }
            }

          } catch (mErr) {
            console.warn(`Erro Meta Ads ${unitName}:`, mErr.message);
          }

          const cpl = metaLeads > 0 ? metaSpend / metaLeads : 0;
          const cpc = metaClicks > 0 ? metaSpend / metaClicks : 0;

          unitText += `\n🔹 *Meta Ads:*\n`;
          if (metaMod.spend !== false) unitText += `💰 *Gasto:* ${formatBRL(metaSpend)}\n`;
          if (metaMod.messages !== false) unitText += `🎯 *Mensagens (Leads):* ${metaLeads}\n`;
          if (metaMod.cpl !== false) unitText += `📉 *CPL:* ${formatBRL(cpl)}\n`;
          if (metaMod.cpc !== false) unitText += `🖱️ *CPC:* ${formatBRL(cpc)}\n`;
          if (metaMod.topAd !== false) {
            unitText += metaTopAd ? `🏆 *Criativo Destaque:* "${metaTopAd.name}" (${metaTopAd.messages} msgs)\n` : `🏆 *Criativo Destaque:* Sem mensagens no período\n`;
          }
          if (metaMod.balance !== false) {
            unitText += metaBalanceVal !== null 
              ? `💳 *Saldo Atual:* ${formatBRL(metaBalanceVal)}\n⏳ *Previsão de Saldo:* ~${metaDaysLeft || 'N/A'} dias restantes\n`
              : `💳 *Saldo Atual:* Pós-pago / Cartão de Crédito\n`;
          }
        }

        // 2. Google Ads
        if (hasGoogle && googleToken) {
          const gRawId = unit.linkedAccounts.google.id;
          const gCustId = String(gRawId).replace(/\D/g, '');
          const gRawLoginId = unit.linkedAccounts.google.managedBy || unit.linkedAccounts.google.loginCustomerId;
          const gLoginCustId = gRawLoginId ? String(gRawLoginId).replace(/\D/g, '') : null;

          let gSpend = 0;
          let gClicks = 0;
          let gConversions = 0;

          const tryQueryGoogle = async (loginId, qStart = startDate, qEnd = endDate, customQuery = null) => {
            const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'XJMJTE6x6lU7zbtl8oNFXA';
            const gHeaders = {
              Authorization: `Bearer ${googleToken}`,
              'developer-token': devToken,
              'Content-Type': 'application/json'
            };
            if (loginId) {
              gHeaders['login-customer-id'] = loginId;
            }

            const gQuery = customQuery || `
              SELECT
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.cost_micros
              FROM customer
              WHERE segments.date BETWEEN '${qStart}' AND '${qEnd}'
            `;

            const gRes = await fetchWithTimeout(`https://googleads.googleapis.com/v23/customers/${gCustId}/googleAds:searchStream`, {
              method: 'POST',
              headers: gHeaders,
              body: JSON.stringify({ query: gQuery }),
              timeout: 4500
            });

            if (!gRes.ok) {
              const errTxt = await gRes.text();
              throw new Error(`Google Ads HTTP ${gRes.status}: ${errTxt}`);
            }

            const gData = await gRes.json();
            return flattenSearchStreamResults(gData);
          };

          try {
            let gRows = [];
            try {
              gRows = await tryQueryGoogle(gLoginCustId);
            } catch (firstErr) {
              // Se falhou e tem o MCC padrão Oral Centter (1872453947), tenta com ele
              const defaultMcc = '1872453947';
              if (gLoginCustId !== defaultMcc) {
                try {
                  gRows = await tryQueryGoogle(defaultMcc);
                } catch (secErr) {
                  throw firstErr;
                }
              } else {
                throw firstErr;
              }
            }

            for (const row of gRows) {
              if (row.metrics) {
                gSpend += (parseFloat(row.metrics.costMicros || 0) / 1000000);
                gClicks += parseInt(row.metrics.clicks || 0, 10);
                gConversions += parseFloat(row.metrics.conversions || 0);
              }
            }

            // Histórico Google Ads para Semáforo de Metas (se ativo)
            if (alert.optimizationRules?.enabled && alert.optimizationRules.cplIncreaseEnabled) {
              try {
                const cmpDays = Math.max(2, parseInt(alert.optimizationRules.cplCompareDays || 30, 10));
                const dComp = new Date(spDate);
                dComp.setDate(dComp.getDate() - cmpDays);
                const sinceComp = dComp.toISOString().split('T')[0];
                let gHistRows = [];
                try {
                  gHistRows = await tryQueryGoogle(gLoginCustId, sinceComp, yesterdayStr);
                } catch (eH1) {
                  const defaultMcc = '1872453947';
                  if (gLoginCustId !== defaultMcc) {
                    try { gHistRows = await tryQueryGoogle(defaultMcc, sinceComp, yesterdayStr); } catch (eH2) {}
                  }
                }
                for (const row of gHistRows) {
                  if (row.metrics) {
                    histGoogleSpend += (parseFloat(row.metrics.costMicros || 0) / 1000000);
                    histGoogleConversions += parseFloat(row.metrics.conversions || 0);
                  }
                }
              } catch (eGHist) {}
            }

            // Checar anúncios reprovados / rejeitados no Google Ads
            try {
              const qRej = `
                SELECT
                  ad_group_ad.ad.name,
                  ad_group_ad.policy_summary.approval_status
                FROM ad_group_ad
                WHERE ad_group_ad.status = 'ENABLED'
                  AND ad_group_ad.policy_summary.approval_status = 'DISAPPROVED'
                LIMIT 5
              `;
              let gRejRows = [];
              try {
                gRejRows = await tryQueryGoogle(gLoginCustId, null, null, qRej);
              } catch (eR1) {
                const defaultMcc = '1872453947';
                if (gLoginCustId !== defaultMcc) {
                  try { gRejRows = await tryQueryGoogle(defaultMcc, null, null, qRej); } catch (eR2) {}
                }
              }
              if (gRejRows && gRejRows.length > 0) {
                unitRejectedAds.push({
                  unitName,
                  platform: 'Google Ads',
                  count: gRejRows.length,
                  ads: gRejRows.map(r => `"${r.adGroupAd?.ad?.name || 'Anúncio Google'}"`)
                });
              }
            } catch (eGRej) {}

          } catch (gErr) {
            console.warn(`Erro Google Ads ${unitName}:`, gErr.message);
          }

          // Consultar saldo/orçamento da conta Google (account_budget)
          if (googleMod.balance !== false) {
            const bQuery = `
              SELECT
                account_budget.id,
                account_budget.name,
                account_budget.status,
                account_budget.approved_spending_limit_micros,
                account_budget.approved_spending_limit_type,
                account_budget.amount_served_micros,
                account_budget.total_adjustments_micros
              FROM account_budget
              WHERE account_budget.status = 'APPROVED'
            `;

            const tryQueryBudget = async (loginId) => {
              const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'XJMJTE6x6lU7zbtl8oNFXA';
              const bHeaders = {
                Authorization: `Bearer ${googleToken}`,
                'developer-token': devToken,
                'Content-Type': 'application/json'
              };
              if (loginId) {
                bHeaders['login-customer-id'] = loginId;
              }

              const bRes = await fetchWithTimeout(`https://googleads.googleapis.com/v23/customers/${gCustId}/googleAds:searchStream`, {
                method: 'POST',
                headers: bHeaders,
                body: JSON.stringify({ query: bQuery }),
                timeout: 4000
              });

              if (!bRes.ok) {
                throw new Error(`Budget HTTP ${bRes.status}`);
              }
              const bData = await bRes.json();
              return flattenSearchStreamResults(bData);
            };

            try {
              let bRows = [];
              try {
                bRows = await tryQueryBudget(gLoginCustId);
              } catch (bErr1) {
                if (gLoginCustId && gLoginCustId !== '1872453947') {
                  try { bRows = await tryQueryBudget('1872453947'); } catch (e) {}
                } else if (!gLoginCustId) {
                  try { bRows = await tryQueryBudget('1872453947'); } catch (e) {}
                }
              }

              if (bRows && bRows.length > 0) {
                const bObj = bRows[0].accountBudget;
                if (bObj) {
                  if (bObj.approvedSpendingLimitType === 'INFINITE') {
                    isGooglePostpaid = true;
                  } else {
                    const limit = parseInt(bObj.approvedSpendingLimitMicros || 0, 10) / 1000000;
                    const served = parseInt(bObj.amountServedMicros || 0, 10) / 1000000;
                    const adjustments = parseInt(bObj.totalAdjustmentsMicros || 0, 10) / 1000000;
                    const bal = (limit + adjustments) - served;
                    if (bal > 0) {
                      gBalanceVal = Math.round(bal * 100) / 100;
                      if (gSpend > 0) {
                        gDaysLeftVal = (gBalanceVal / gSpend).toFixed(1);
                        if (parseFloat(gDaysLeftVal) <= 3) {
                          unitLowBalances.push({
                            name: `${unitName} (Google Ads)`,
                            balance: gBalanceVal,
                            daysLeft: gDaysLeftVal
                          });
                        }
                      }
                    } else {
                      unitZeroBalances.push({
                        name: `${unitName} (Google Ads)`,
                        balance: 0
                      });
                    }
                  }
                }
              } else {
                isGooglePostpaid = true;
              }
            } catch (bErr) {
              isGooglePostpaid = true;
            }
          }

          const gCpc = gClicks > 0 ? gSpend / gClicks : 0;
          const gCpa = gConversions > 0 ? gSpend / gConversions : 0;

          unitText += `\n🔸 *Google Ads:*\n`;
          if (googleMod.spend !== false) unitText += `💰 *Gasto:* ${formatBRL(gSpend)}\n`;
          if (googleMod.conversions !== false) unitText += `🎯 *Conversões:* ${gConversions}\n`;
          if (googleMod.cpa !== false) unitText += `📉 *Custo/Conv.:* ${formatBRL(gCpa)}\n`;
          if (googleMod.cpc !== false) unitText += `🖱️ *CPC Médio:* ${formatBRL(gCpc)}\n`;
          if (googleMod.balance !== false) {
            if (gBalanceVal !== null) {
              unitText += `💳 *Saldo Atual:* ${formatBRL(gBalanceVal)}\n`;
              if (gDaysLeftVal !== null) {
                unitText += `⏳ *Previsão de Saldo:* ~${gDaysLeftVal} dias restantes\n`;
              }
            } else if (isGooglePostpaid) {
              unitText += `💳 *Saldo Atual:* Pós-pago (Recarga automática ativada)\n`;
            } else {
              unitText += `💳 *Saldo Atual:* Pós-pago / Cartão de Crédito\n`;
            }
          }
        }

        if (!hasMeta && !hasGoogle) {
          unitText += `_(Nenhuma conta vinculada nesta unidade)_\n`;
        }

        // Avaliação de Semáforo de Metas & Alerta de Otimização por Unidade
        const unitOptWarnings = [];
        if (alert.optimizationRules && alert.optimizationRules.enabled) {
          const opt = alert.optimizationRules;
          const totalUnitLeads = metaLeads + gConversions;
          const totalUnitSpend = metaSpend + gSpend;
          const currentUnitCpl = totalUnitLeads > 0 ? (totalUnitSpend / totalUnitLeads) : 0;

          // Critério 1: Mínimo de Leads no Período
          if (opt.minLeadsEnabled) {
            const minL = Math.max(1, parseInt(opt.minLeadsValue || 5, 10));
            if (totalUnitLeads < minL) {
              unitOptWarnings.push(`Poucos leads no período (${totalUnitLeads} lead(s) gerados / Meta mínima: ${minL})`);
            }
          }

          // Critério 2: Aumento no Custo por Lead (CPL)
          if (opt.cplIncreaseEnabled) {
            const totalHistSpend = histMetaSpend + histGoogleSpend;
            const totalHistLeads = histMetaLeads + histGoogleConversions;
            const baselineCpl = totalHistLeads > 0 ? (totalHistSpend / totalHistLeads) : 0;
            const thresholdPct = Math.max(1, parseFloat(opt.cplIncreasePercent || 30));
            const cmpDays = Math.max(2, parseInt(opt.cplCompareDays || 30, 10));

            if (currentUnitCpl > 0 && baselineCpl > 0) {
              const diffPct = ((currentUnitCpl - baselineCpl) / baselineCpl) * 100;
              if (diffPct >= thresholdPct) {
                unitOptWarnings.push(`CPL subiu +${diffPct.toFixed(0)}% (${formatBRL(currentUnitCpl)} vs média ${formatBRL(baselineCpl)} dos últimos ${cmpDays}d) ⚠️`);
              }
            }
          }
        }

        // Checagem de gasto R$ 0,00 e Termômetro de Saldo
        const totalUnitSpend = metaSpend + gSpend;
        const isZeroSpend = (hasMeta || hasGoogle) && (totalUnitSpend === 0);

        const thermometerItem = {
          unitName,
          metaText: metaBalanceVal !== null ? `${formatBRL(metaBalanceVal)} (~${metaDaysLeft || 'N/A'} dias restantes)` : (hasMeta ? 'Pós-pago / Cartão de Crédito' : null),
          googleText: gBalanceVal !== null ? `${formatBRL(gBalanceVal)} (~${gDaysLeftVal || 'N/A'} dias restantes)` : (isGooglePostpaid ? 'Pós-pago (Recarga automática ativada)' : (hasGoogle ? 'Pós-pago / Cartão de Crédito' : null))
        };

        return { 
          unitName,
          text: unitText, 
          thermometer: (hasMeta || hasGoogle) ? thermometerItem : null,
          lowBalances: unitLowBalances,
          zeroBalances: unitZeroBalances,
          zeroSpend: isZeroSpend ? { unitName } : null,
          rejectedAds: unitRejectedAds,
          optAlert: unitOptWarnings.length > 0 ? { unitName, warnings: unitOptWarnings } : null
        };
      }));

      // Consolidar resultados das unidades
      const allUnitTexts = [];
      const allThermometerItems = [];
      const allLowBalances = [];
      const allZeroBalances = [];
      const allZeroSpend = [];
      const allRejectedAds = [];
      const allOptAlerts = [];

      for (const res of unitResults) {
        if (res.text) allUnitTexts.push(res.text);
        if (res.thermometer) allThermometerItems.push(res.thermometer);
        if (res.lowBalances && res.lowBalances.length > 0) allLowBalances.push(...res.lowBalances);
        if (res.zeroBalances && res.zeroBalances.length > 0) allZeroBalances.push(...res.zeroBalances);
        if (res.zeroSpend) allZeroSpend.push(res.zeroSpend);
        if (res.rejectedAds && res.rejectedAds.length > 0) allRejectedAds.push(...res.rejectedAds);
        if (res.optAlert) allOptAlerts.push(res.optAlert);
      }

      // Mapeador dinâmico de blocos baseado na ordem e ativação escolhida pelo usuário
      const blockContentMap = {
        metrics_meta_google: () => {
          return allUnitTexts.join('');
        },

        balance_thermometer: () => {
          if (allThermometerItems.length === 0) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n💳 *TERMÔMETRO DE SALDO & PREVISÃO:*\n`;
          allThermometerItems.forEach(t => {
            text += `• *${t.unitName.toUpperCase()}:*\n`;
            if (t.metaText) text += `  🔹 Meta: ${t.metaText}\n`;
            if (t.googleText) text += `  🔸 Google: ${t.googleText}\n`;
          });
          return text;
        },

        low_balance: () => {
          if (allLowBalances.length === 0) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n⚠️ *ALERTA DE SALDO BAIXO (< 3 DIAS):*\n`;
          allLowBalances.forEach(u => {
            text += `• *${u.name}:* ${formatBRL(u.balance)} (~${u.daysLeft} dias restantes - 🚨 Recarga Necessária!)\n`;
          });
          return text;
        },

        zero_balance: () => {
          if (allZeroBalances.length === 0) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n🛑 *ALERTA DE FALTA DE SALDO (SALDO ZERADO):*\n`;
          allZeroBalances.forEach(u => {
            text += `• *${u.name}:* Saldo esgotado (R$ 0,00) - Anúncios prestes a pausar!\n`;
          });
          return text;
        },

        optimization: () => {
          if (!alert.optimizationRules?.enabled) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n`;
          if (allOptAlerts.length > 0) {
            text += `🚨 *ALERTA DE OTIMIZAÇÃO (SEMÁFORO DE METAS):*\n`;
            allOptAlerts.forEach(item => {
              text += `• *${item.unitName.toUpperCase()}:*\n`;
              item.warnings.forEach(w => {
                text += `  ⚠️ ${w}\n`;
              });
            });
          } else {
            text += `🟢 *SEMÁFORO DE METAS:* Todas as unidades monitoradas estão dentro das metas de volume e CPL!\n`;
          }
          return text;
        },

        zero_spend: () => {
          if (allZeroSpend.length === 0) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n❄️ *ALERTA DE CONTA PARADA (GASTO R$ 0,00):*\n`;
          allZeroSpend.forEach(u => {
            text += `• *${u.unitName}:* Gasto total de R$ 0,00 no período! Verifique se as campanhas foram pausadas ou o saldo esgotou.\n`;
          });
          return text;
        },

        rejected_ads: () => {
          if (allRejectedAds.length === 0) return '';
          let text = `━━━━━━━━━━━━━━━━━━━━\n🚫 *ALERTA DE ANÚNCIO REJEITADO / REPROVADO:*\n`;
          allRejectedAds.forEach(item => {
            text += `• *${item.unitName}:* ${item.count} anúncio(s) reprovado(s) no ${item.platform} (${item.ads.join(', ')})\n`;
          });
          return text;
        }
      };

      const defaultBlocksOrder = [
        { id: 'metrics_meta_google', enabled: true },
        { id: 'balance_thermometer', enabled: true },
        { id: 'low_balance', enabled: true },
        { id: 'zero_balance', enabled: true },
        { id: 'optimization', enabled: true },
        { id: 'zero_spend', enabled: true },
        { id: 'rejected_ads', enabled: true }
      ];

      const activeOrder = (alert.blockOrder && Array.isArray(alert.blockOrder) && alert.blockOrder.length > 0)
        ? alert.blockOrder
        : defaultBlocksOrder;

      activeOrder.forEach(b => {
        if (b.enabled !== false && blockContentMap[b.id]) {
          const content = blockContentMap[b.id]();
          if (content) {
            reportMsg += content;
            if (!content.endsWith('\n')) reportMsg += '\n';
          }
        }
      });

      // Enviar via Gateway WhatsApp da Oracle Cloud
      try {
        const sendRes = await fetchWithTimeout(`${gatewayUrl}/message/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': gatewayApiKey
          },
          body: JSON.stringify({
            number: phone,
            text: reportMsg
          }),
          timeout: 8000
        });

        const sendData = await sendRes.json();
        console.log(`✅ Disparo concluído para ${phone}:`, sendData);
        results.push({ alertId, phone, status: 'sent', messageId: sendData.messageId });

        // Registrar anti-duplicidade em memória e no Firestore para este horário
        if (matchedSchedule) {
          const todayDateKey = `${todayDateStr}_${matchedSchedule}`;
          const uniqueSendKey = `${alertId}_${todayDateKey}`;
          global._sentCronAlerts = global._sentCronAlerts || new Set();
          global._sentCronAlerts.add(uniqueSendKey);

          try {
            // 1. Atualizar em whatsapp_alerts
            const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsapp_alerts/${alertId}?updateMask.fieldPaths=lastSentKey&key=${firebaseApiKey}`;
            await fetchWithTimeout(patchUrl, {
              method: 'PATCH',
              headers: { ...authHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  lastSentKey: { stringValue: todayDateKey }
                }
              }),
              timeout: 4000
            });

            // 2. Se o alerta tiver userId, atualizar também em users/{userId}
            if (alert.userId) {
              const uUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${alert.userId}?key=${firebaseApiKey}`;
              const uRes = await fetchWithTimeout(uUrl, { headers: authHeaders, timeout: 4000 });
              if (uRes.ok) {
                const uDoc = await uRes.json();
                const uFields = uDoc.fields || {};
                if (uFields.whatsappAlerts?.arrayValue?.values) {
                  const arr = uFields.whatsappAlerts.arrayValue.values.map(val => {
                    const m = val.mapValue?.fields;
                    if (m && (m.id?.stringValue === alertId || (!m.id && alertId === 'sem-id'))) {
                      m.lastSentKey = { stringValue: todayDateKey };
                    }
                    return val;
                  });
                  await fetchWithTimeout(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${alert.userId}?updateMask.fieldPaths=whatsappAlerts&key=${firebaseApiKey}`, {
                    method: 'PATCH',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fields: {
                        whatsappAlerts: { arrayValue: { values: arr } }
                      }
                    }),
                    timeout: 4000
                  });
                }
              }
            }
          } catch (errPatch) {
            console.warn('⚠️ Falha ao persistir lastSentKey no Firestore:', errPatch.message);
          }
        }

      } catch (sendErr) {
        console.error(`❌ Erro no envio WhatsApp para ${phone}:`, sendErr);
        results.push({ alertId, phone, status: 'error', error: sendErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      executedAt: currentHourMin,
      totalAlertsEvaluated: alertsToProcess.length,
      results
    });

  } catch (error) {
    console.error('❌ Erro no cron-daily-insights:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4500 } = options;
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

function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function flattenSearchStreamResults(data) {
  if (data && !Array.isArray(data)) {
    if (data.results?.length) return data.results;
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

function parseFirestoreMap(mapFields) {
  const result = {};
  for (const key of Object.keys(mapFields)) {
    const valObj = mapFields[key];
    if (valObj.stringValue !== undefined) result[key] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) result[key] = parseInt(valObj.integerValue, 10);
    else if (valObj.doubleValue !== undefined) result[key] = parseFloat(valObj.doubleValue);
    else if (valObj.booleanValue !== undefined) result[key] = valObj.booleanValue;
    else if (valObj.arrayValue !== undefined) {
      result[key] = (valObj.arrayValue.values || []).map(item => {
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.integerValue !== undefined) return parseInt(item.integerValue, 10);
        if (item.booleanValue !== undefined) return item.booleanValue;
        if (item.doubleValue !== undefined) return parseFloat(item.doubleValue);
        if (item.mapValue !== undefined) return parseFirestoreMap(item.mapValue.fields || {});
        return null;
      });
    } else if (valObj.mapValue !== undefined) {
      result[key] = parseFirestoreMap(valObj.mapValue.fields || {});
    }
  }
  return result;
}
