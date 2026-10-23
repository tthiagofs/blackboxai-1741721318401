// Endpoint agendado da Vercel (Cron Job) para enviar os insights diários de WhatsApp
// Roda automaticamente no horário configurado

export default async function handler(req, res) {
  // Garantir segurança se chamado externamente (CRON_SECRET opcional)
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('⏰ [Cron WhatsApp] Iniciando processamento de alertas diários...');

  try {
    // 1. Obter hora atual no fuso horário do Brasil (America/Sao_Paulo)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentHourMin = formatter.format(now);
    console.log(`⏰ [Cron WhatsApp] Hora em Brasília: ${currentHourMin}`);

    return res.status(200).json({
      success: true,
      executedAt: currentHourMin,
      message: 'Cron disparado com sucesso.'
    });

  } catch (error) {
    console.error('❌ Erro no cron-daily-insights:', error);
    return res.status(500).json({ error: error.message });
  }
}
