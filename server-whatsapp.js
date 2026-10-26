import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const API_KEY = 'insightflow123';
let sock = null;
let currentQR = null;
let connectionStatus = 'DISCONNECTED'; // CONNECTING, CONNECTED, DISCONNECTED

const authFolder = path.join(__dirname, 'auth_info_baileys');

async function connectToWhatsApp() {
  connectionStatus = 'CONNECTING';
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      currentQR = await QRCode.toDataURL(qr);
      console.log('Novo QR Code gerado.');
    }
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'DISCONNECTED';
      currentQR = null;
      console.log('Conexao fechada (code: ' + statusCode + '). Reconectando?', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      } else {
        if (fs.existsSync(authFolder)) {
          fs.rmSync(authFolder, { recursive: true, force: true });
        }
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'CONNECTED';
      currentQR = null;
      console.log('WhatsApp Conectado com Sucesso!');
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Endpoint de status e QR Code visual
app.get('/', (req, res) => {
  const qrHtml = currentQR ? `<div><p style="margin-bottom:6px; font-weight:600;">Escaneie o QR Code abaixo com seu WhatsApp:</p><p style="font-size:12px; color:#cbd5e1; margin-top:0;">(O QR Code expira a cada 20 segundos e renova automaticamente)</p><img class="qr" src="${currentQR}"/></div>` : '';
  const connectedHtml = connectionStatus === 'CONNECTED' ? '<p style="color:#4ade80; font-size:16px; font-weight:600;">✅ WhatsApp conectado e pronto para envio!</p>' : '';
  const waitingHtml = (connectionStatus !== 'CONNECTED' && !currentQR) ? '<p>Iniciando sessão e gerando novo QR Code... aguarde alguns segundos.</p>' : '';

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Robô WhatsApp InsightFlow</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
      .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 440px; width: 100%; border: 1px solid #334155; }
      h2 { margin-top: 0; color: #38bdf8; font-size: 22px; }
      .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
      .badge.CONNECTED { background: #166534; color: #4ade80; }
      .badge.CONNECTING { background: #854d0e; color: #fde047; }
      .badge.DISCONNECTED { background: #991b1b; color: #f87171; }
      img.qr { background: white; padding: 12px; border-radius: 12px; margin: 16px 0; max-width: 260px; width: 100%; height: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
      p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
      .refresh-hint { font-size: 11px; color: #64748b; margin-top: 12px; }
    </style>
    <meta http-equiv="refresh" content="6">
  </head>
  <body>
    <div class="card">
      <h2>🤖 Robô WhatsApp InsightFlow</h2>
      <div class="badge ${connectionStatus}">Status: ${connectionStatus}</div>
      ${connectedHtml}
      ${qrHtml}
      ${waitingHtml}
      <div class="refresh-hint">Atualização automática da tela a cada 6s</div>
    </div>
  </body>
</html>`;
  res.send(html);
});

app.get('/reset', (req, res) => {
  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
  }
  connectToWhatsApp();
  res.send('Sessão resetada com sucesso. Redirecionando... <meta http-equiv="refresh" content="2;url=/">');
});

app.get('/instance/connectionState', (req, res) => {
  res.json({
    instance: {
      state: connectionStatus.toLowerCase() === 'connected' ? 'open' : connectionStatus.toLowerCase()
    }
  });
});

app.get('/instance/connect', (req, res) => {
  res.json({
    qrcode: currentQR,
    status: connectionStatus
  });
});

app.post('/message/sendText', async (req, res) => {
  const token = req.headers['apikey'] || req.headers['authorization'];
  if (token !== API_KEY && token !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }

  if (connectionStatus !== 'CONNECTED' || !sock) {
    return res.status(503).json({ error: 'WhatsApp is not connected', status: connectionStatus });
  }

  try {
    let { number, text } = req.body;
    if (!number || !text) {
      return res.status(400).json({ error: 'number and text are required' });
    }

    let cleanNumber = String(number).replace(/\D/g, '');
    if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }

    let targetJid = cleanNumber + '@s.whatsapp.net';

    // Se for número do Brasil com DDD (55 + DDD + número)
    if (cleanNumber.startsWith('55') && cleanNumber.length === 13) {
      // Tentar resolver se a conta do WhatsApp foi criada sem o 9º dígito (ex: 553884223393 em vez de 5538984223393)
      const sem9 = cleanNumber.slice(0, 4) + cleanNumber.slice(5) + '@s.whatsapp.net';
      try {
        const check = await sock.onWhatsApp(sem9);
        if (check && check[0]?.exists && check[0]?.jid) {
          targetJid = check[0].jid;
        }
      } catch (e) {
        console.warn('Erro ao verificar JID:', e);
      }
    }

    console.log(`Enviando mensagem para JID: ${targetJid}`);
    const sent = await sock.sendMessage(targetJid, { text });
    return res.json({ success: true, messageId: sent.key.id, to: targetJid });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor WhatsApp rodando na porta ${PORT}`);
  connectToWhatsApp();
});
