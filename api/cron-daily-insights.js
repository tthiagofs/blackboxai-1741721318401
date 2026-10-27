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
    // 1. Hora atual em Brasília (America/Sao_Paulo)
    const now = new Date();
    const formatterHourMin = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentHourMin = formatterHourMin.format(now);

    const formatterDayOfWeek = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'narrow'
    });
    // getDay() em SP
    const spDateStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const spDate = new Date(spDateStr);
    const currentDayOfWeek = spDate.getDay(); // 0: Dom, 1: Seg, ..., 6: Sab

    console.log(`⏰ [Cron WhatsApp] Hora em Brasília: ${currentHourMin} | Dia da semana: ${currentDayOfWeek}`);

    // 2. Coletar alertas a serem processados
    let alertsToProcess = [];

    // Se vierem alertas diretamente no corpo da requisição (disparo manual ou webhook do app)
    if (req.body?.alerts && Array.isArray(req.body.alerts)) {
      alertsToProcess = req.body.alerts;
    } else {
      // Buscar alertas salvos no Firestore via REST API
      const firebaseApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyB3-n3WIdEOhCxvpbigs_ogse7b3tggGGU';
      const projectId = process.env.FIREBASE_PROJECT_ID || 'insightflow-82cc4';

      // 1. Tentar buscar da coleção whatsapp_alerts (com autenticação)
      try {
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

        const alertsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whatsapp_alerts?key=${firebaseApiKey}&pageSize=100`;
        const aRes = await fetch(alertsUrl, { headers: authHeaders });
        if (aRes.ok) {
          const aData = await aRes.json();
          const docs = aData.documents || [];
          for (const doc of docs) {
            const alertObj = parseFirestoreMap(doc.fields || {});
            if (alertObj && (alertObj.active !== false)) {
              alertsToProcess.push(alertObj);
            }
          }
        }
      } catch (errAlerts) {
        console.warn('⚠️ Erro ao consultar whatsapp_alerts:', errAlerts.message);
      }

      // 2. Fallback: tentar listar users
      if (alertsToProcess.length === 0) {
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?key=${firebaseApiKey}&pageSize=100`;
          const fRes = await fetch(firestoreUrl);
        if (fRes.ok) {
          const fData = await fRes.json();
          const documents = fData.documents || [];

          for (const doc of documents) {
            const fields = doc.fields || {};
            // Procurar whatsappAlerts dentro do user
            if (fields.whatsappAlerts && fields.whatsappAlerts.arrayValue) {
              const rawAlerts = fields.whatsappAlerts.arrayValue.values || [];
              for (const aVal of rawAlerts) {
                const aMap = aVal.mapValue?.fields;
                if (!aMap) continue;

                const alertObj = parseFirestoreMap(aMap);
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

      // Checagem de agendamento se não for forçado
      if (!isForce) {
        const days = alert.daysOfWeek || [1, 2, 3, 4, 5];
        if (!days.includes(currentDayOfWeek)) {
          results.push({ alertId, status: 'skipped', reason: `Hoje não é dia de envio configurado (dia ${currentDayOfWeek})` });
          continue;
        }

        const schedules = alert.schedules || ['08:00'];
        const [cHour, cMin] = currentHourMin.split(':').map(Number);
        
        // Verifica se algum horário bate com a janela atual (+/- 3 minutos para precisão minuto a minuto)
        let matchedSchedule = null;
        for (const s of schedules) {
          const [sHour, sMin] = s.split(':').map(Number);
          const diffMinutes = Math.abs((cHour * 60 + cMin) - (sHour * 60 + sMin));
          if (diffMinutes <= 3) {
            matchedSchedule = s;
            break;
          }
        }

        if (!matchedSchedule) {
          results.push({ alertId, status: 'skipped', reason: `Horário ${currentHourMin} fora da janela de ${schedules.join(', ')}` });
          continue;
        }

        const todayDateKey = `${spDate.toISOString().split('T')[0]}_${matchedSchedule}`;
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
      const units = alert.unitsSnapshot || [];
      const modules = alert.modules || {};
      const metaMod = modules.meta || modules;
      const googleMod = modules.google || modules;

      let reportMsg = `Olá, *Thiago Felipe*! Segue o relatório diário das suas unidades.\n\n`;
      reportMsg += `📊 *INSIGHTFLOW - BRIEFING DIÁRIO*\n`;
      reportMsg += `📅 *Dados:* ${dateTitle} | ⏰ *Envio Automático*\n`;
      reportMsg += `📁 *Projeto:* ${projName}\n\n`;

      const lowBalanceUnits = [];
      const metaToken = alert.metaToken || process.env.META_ACCESS_TOKEN || '';

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
                let best = null;
                let bestM = -1;
                adsData.data.forEach(ad => {
                  let m = 0;
                  if (ad.actions) {
                    const c = ad.actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                    if (c) m = parseInt(c.value, 10);
                  }
                  if (m > bestM) {
                    bestM = m;
                    best = { name: ad.ad_name, messages: m };
                  }
                });
                if (best && best.messages > 0) metaTopAd = best;
              }
            }

            // Saldo Nominal
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
                // Estimativa de dias restantes
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
        if (hasGoogle && alert.googleToken) {
          reportMsg += `\n🔸 *Google Ads:*\n`;
          reportMsg += `_(Monitoramento Google Ads ativo)_\n`;
        }

        if (!hasMeta && !hasGoogle) {
          reportMsg += `_(Nenhuma conta vinculada nesta unidade)_\n`;
        }
      }

      // Alerta de Saldo
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
