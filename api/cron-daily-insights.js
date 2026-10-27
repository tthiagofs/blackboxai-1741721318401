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
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'cron.bot@insightflow.internal',
          password: 'CronPass123!@#',
          returnSecureToken: true
        })
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
        const aRes = await fetch(alertsUrl, { headers: authHeaders });
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
          const fRes = await fetch(firestoreUrl, { headers: authHeaders });
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
          // Dispara se estiver exatamente no minuto (diff === 0) ou no máximo 1 minuto de tolerância para o cron (diff === 1)
          // NUNCA dispara antes (diff < 0) e nunca após a janela de 1 minuto
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
      const is7Days = alert.reportPeriod === 'last_7_days';
      const yesterday = new Date(spDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let startDate = yesterdayStr;
      let endDate = yesterdayStr;
      let dateTitle = yesterdayStr.split('-').reverse().join('/');

      if (is7Days) {
        const d7 = new Date(yesterday);
        d7.setDate(d7.getDate() - 6);
        startDate = d7.toISOString().split('T')[0];
        dateTitle = `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} (Últimos 7 dias)`;
      }

      const projName = alert.projectName || 'Oral Centter';
      const managerName = alert.managerName || 'Thiago Felipe';
      let units = alert.unitsSnapshot || [];

      // Fallback: se unitsSnapshot estiver vazio, carregar unidades do projeto via Firestore REST
      if ((!units || units.length === 0) && alert.projectId) {
        try {
          const unitsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/projects/${alert.projectId}/units?key=${firebaseApiKey}&pageSize=100`;
          const uRes = await fetch(unitsUrl, { headers: authHeaders });
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
          const usrRes = await fetch(userUrl, { headers: authHeaders });
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

      for (const unit of units) {
        const unitName = unit.name || 'Unidade';
        reportMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        reportMsg += `🏢 *${unitName.toUpperCase()}*\n`;

        const hasMeta = !!unit?.linkedAccounts?.meta?.id;
        const hasGoogle = !!unit?.linkedAccounts?.google?.id;

        // Meta Ads
        if (hasMeta && metaToken) {
          const actId = unit.linkedAccounts.meta.id.startsWith('act_') 
            ? unit.linkedAccounts.meta.id 
            : `act_${unit.linkedAccounts.meta.id}`;
          
          let metaSpend = 0;
          let metaLeads = 0;
          let metaClicks = 0;
          let metaTopAd = null;
          let metaBalanceVal = null;
          let metaDaysLeft = null;

          try {
            const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }));
            const insRes = await fetch(`https://graph.facebook.com/v22.0/${actId}/insights?fields=spend,impressions,clicks,cpc,actions&time_range=${timeRange}&access_token=${metaToken}`);
            const insData = await insRes.json();
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

            // Top Criativo
            if (metaMod.topAd !== false) {
              const adsRes = await fetch(`https://graph.facebook.com/v22.0/${actId}/insights?fields=ad_name,spend,actions&time_range=${timeRange}&level=ad&limit=25&access_token=${metaToken}`);
              const adsData = await adsRes.json();
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
            }

            // Saldo e Previsão
            if (metaMod.balance !== false) {
              const accRes = await fetch(`https://graph.facebook.com/v22.0/${actId}?fields=balance,spend_cap,amount_spent,is_prepay_account&access_token=${metaToken}`);
              const accData = await accRes.json();
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
                // Estimativa de dias restantes com média dos últimos 3 dias
                const d3 = new Date(yesterday);
                d3.setDate(d3.getDate() - 3);
                const tr3 = encodeURIComponent(JSON.stringify({ since: d3.toISOString().split('T')[0], until: endDate }));
                const ins3Res = await fetch(`https://graph.facebook.com/v22.0/${actId}/insights?fields=spend&time_range=${tr3}&access_token=${metaToken}`);
                const ins3Data = await ins3Res.json();
                if (ins3Data?.data && ins3Data.data[0]) {
                  const sp3 = parseFloat(ins3Data.data[0].spend || 0);
                  const avg = sp3 / 3;
                  if (avg > 0) {
                    metaDaysLeft = (metaBalanceVal / avg).toFixed(1);
                    if (parseFloat(metaDaysLeft) <= 3) {
                      lowBalanceUnits.push({ name: `${unitName} (Meta Ads)`, balance: metaBalanceVal, daysLeft: metaDaysLeft });
                    }
                  }
                }
              }
            }
          } catch (mErr) {
            console.warn(`Erro Meta Ads ${unitName}:`, mErr.message);
          }

          const cpl = metaLeads > 0 ? metaSpend / metaLeads : 0;
          const cpc = metaClicks > 0 ? metaSpend / metaClicks : 0;

          reportMsg += `\n🔹 *Meta Ads:*\n`;
          if (metaMod.spend !== false) reportMsg += `💰 *Gasto:* ${formatBRL(metaSpend)}\n`;
          if (metaMod.messages !== false) reportMsg += `🎯 *Mensagens (Leads):* ${metaLeads}\n`;
          if (metaMod.cpl !== false) reportMsg += `📉 *CPL:* ${formatBRL(cpl)}\n`;
          if (metaMod.cpc !== false) reportMsg += `🖱️ *CPC:* ${formatBRL(cpc)}\n`;
          if (metaMod.topAd !== false) {
            reportMsg += metaTopAd ? `🏆 *Criativo Destaque:* "${metaTopAd.name}" (${metaTopAd.messages} msgs)\n` : `🏆 *Criativo Destaque:* Sem mensagens no período\n`;
          }
          if (metaMod.balance !== false) {
            reportMsg += metaBalanceVal !== null 
              ? `💳 *Saldo Atual:* ${formatBRL(metaBalanceVal)}\n⏳ *Previsão de Saldo:* ~${metaDaysLeft || 'N/A'} dias restantes\n`
              : `💳 *Saldo Atual:* Pós-pago / Cartão de Crédito\n`;
          }
        }

        // Google Ads
        if (hasGoogle && googleToken) {
          const gRawId = unit.linkedAccounts.google.id;
          const gCustId = String(gRawId).replace(/\D/g, '');
          const gLoginCustId = unit.linkedAccounts.google.loginCustomerId 
            ? String(unit.linkedAccounts.google.loginCustomerId).replace(/\D/g, '')
            : null;

          let gSpend = 0;
          let gClicks = 0;
          let gConversions = 0;

          try {
            const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'XJMJTE6x6lU7zbtl8oNFXA';
            const gHeaders = {
              Authorization: `Bearer ${googleToken}`,
              'developer-token': devToken,
              'Content-Type': 'application/json'
            };
            if (gLoginCustId) {
              gHeaders['login-customer-id'] = gLoginCustId;
            }

            const gQuery = `
              SELECT
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.cost_micros
              FROM customer
              WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            `;

            const gRes = await fetch(`https://googleads.googleapis.com/v23/customers/${gCustId}/googleAds:searchStream`, {
              method: 'POST',
              headers: gHeaders,
              body: JSON.stringify({ query: gQuery })
            });

            if (gRes.ok) {
              const gData = await gRes.json();
              const gRows = flattenSearchStreamResults(gData);
              for (const row of gRows) {
                if (row.metrics) {
                  gSpend += (parseFloat(row.metrics.costMicros || 0) / 1000000);
                  gClicks += parseInt(row.metrics.clicks || 0, 10);
                  gConversions += parseFloat(row.metrics.conversions || 0);
                }
              }
            }
          } catch (gErr) {
            console.warn(`Erro Google Ads ${unitName}:`, gErr.message);
          }

          const gCpc = gClicks > 0 ? gSpend / gClicks : 0;
          const gCpa = gConversions > 0 ? gSpend / gConversions : 0;

          reportMsg += `\n🔸 *Google Ads:*\n`;
          if (googleMod.spend !== false) reportMsg += `💰 *Gasto:* ${formatBRL(gSpend)}\n`;
          if (googleMod.conversions !== false) reportMsg += `🎯 *Conversões:* ${gConversions}\n`;
          if (googleMod.cpa !== false) reportMsg += `📉 *Custo/Conv.:* ${formatBRL(gCpa)}\n`;
          if (googleMod.cpc !== false) reportMsg += `🖱️ *CPC Médio:* ${formatBRL(gCpc)}\n`;
          if (googleMod.balance !== false) {
            reportMsg += `💳 *Saldo Atual:* Pós-pago / Cartão de Crédito\n`;
          }
        }

        if (!hasMeta && !hasGoogle) {
          reportMsg += `_(Nenhuma conta vinculada nesta unidade)_\n`;
        }
      }

      // Alerta de Saldo Geral
      if (lowBalanceUnits.length > 0) {
        reportMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        reportMsg += `⚠️ *Unidades com saldo previsto para acabar em até 3 dias:*\n`;
        lowBalanceUnits.forEach(u => {
          reportMsg += `• *${u.name}:* ${formatBRL(u.balance)} (~${u.daysLeft} dias restantes - 🚨 Recarga Necessária!)\n`;
        });
      }

      // Enviar via Gateway WhatsApp da Oracle Cloud
      try {
        const sendRes = await fetch(`${gatewayUrl}/message/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': gatewayApiKey
          },
          body: JSON.stringify({
            number: phone,
            text: reportMsg
          })
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
            await fetch(patchUrl, {
              method: 'PATCH',
              headers: { ...authHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  lastSentKey: { stringValue: todayDateKey }
                }
              })
            });

            // 2. Se o alerta tiver userId, atualizar também em users/{userId}
            if (alert.userId) {
              const uUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${alert.userId}?key=${firebaseApiKey}`;
              const uRes = await fetch(uUrl, { headers: authHeaders });
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
                  await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${alert.userId}?updateMask.fieldPaths=whatsappAlerts&key=${firebaseApiKey}`, {
                    method: 'PATCH',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fields: {
                        whatsappAlerts: { arrayValue: { values: arr } }
                      }
                    })
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
        if (item.mapValue !== undefined) return parseFirestoreMap(item.mapValue.fields || {});
        return null;
      });
    } else if (valObj.mapValue !== undefined) {
      result[key] = parseFirestoreMap(valObj.mapValue.fields || {});
    }
  }
  return result;
}
