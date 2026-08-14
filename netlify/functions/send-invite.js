// Netlify Function para enviar convites por email usando SendGrid
const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { email, inviteLink } = JSON.parse(event.body || '{}');

    if (!email || !inviteLink) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email e link do convite são obrigatórios' }),
      };
    }

    // Configurar SendGrid
    if (!process.env.SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY não configurada');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Serviço de email não configurado' }),
      };
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!fromEmail) {
      console.error('❌ SENDGRID_FROM_EMAIL não configurado');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Remetente de email não configurado',
          details: 'Defina SENDGRID_FROM_EMAIL com um remetente verificado no SendGrid.',
        }),
      };
    }

    // Template do email
    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Você foi convidado para o Insightflow!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #f9fafb;
              padding: 40px 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 32px;">🎉 Você foi convidado!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Bem-vindo ao Insightflow</p>
          </div>
          
          <div class="content">
            <p style="font-size: 16px;">Olá!</p>
            
            <p style="font-size: 16px;">
              Você recebeu um convite para fazer parte do <strong>Insightflow</strong>, 
              a plataforma de relatórios de marketing digital.
            </p>
            
            <p style="text-align: center;">
              <a href="${inviteLink}" class="button">Criar Minha Conta</a>
            </p>
            
            <div class="warning">
              <strong>⏰ Atenção:</strong> Este convite expira em <strong>24 horas</strong>. 
              Clique no botão acima para criar sua conta antes que o link expire.
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Se você não esperava receber este email, pode ignorá-lo com segurança.
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Insightflow. Todos os direitos reservados.</p>
          </div>
        </body>
        </html>
      `,
      text: `
Você foi convidado para o Insightflow!

Você recebeu um convite para fazer parte do Insightflow, a plataforma de relatórios de marketing digital.

Clique no link abaixo para criar sua conta:
${inviteLink}

⏰ Atenção: Este convite expira em 24 horas.

Se você não esperava receber este email, pode ignorá-lo com segurança.

© ${new Date().getFullYear()} Insightflow. Todos os direitos reservados.
      `,
    };

    // Enviar email
    await sgMail.send(msg);

    console.log('✅ Email de convite enviado para:', email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Convite enviado com sucesso!' 
      }),
    };

  } catch (error) {
    const sendGridErrorBody = error?.response?.body;
    const sendGridError = sendGridErrorBody?.errors?.[0];
    const statusCode = error?.code || error?.response?.statusCode || 500;

    console.error('❌ Erro ao enviar email:', {
      message: error.message,
      statusCode,
      sendGridErrorBody,
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro ao enviar email de convite',
        details: sendGridError?.message || error.message,
        statusCode,
      }),
    };
  }
};

