// Script para obter Refresh Token do Google Ads
// Execute: node get-refresh-token.js

const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('\n🔐 SCRIPT PARA OBTER REFRESH TOKEN DO GOOGLE ADS\n');
    console.log('Você precisará do Client ID e Client Secret do Google Cloud Console.\n');

    const clientId = await ask('1. Cole seu Client ID: ');
    const clientSecret = await ask('2. Cole seu Client Secret: ');

    console.log('\n📋 PASSO 3: Autorizar o aplicativo\n');
    
    const redirectUri = 'http://localhost:8888/.netlify/functions/google-ads-callback';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent`;
    
    console.log('Abra este link no seu navegador:\n');
    console.log(authUrl);
    console.log('\n');
    console.log('⚠️  IMPORTANTE: Após autorizar, você será redirecionado para uma página que não vai carregar.');
    console.log('    Isso é NORMAL! Copie o CÓDIGO que aparece na URL depois de "code=".\n');

    const authCode = await ask('4. Cole o código de autorização (da URL): ');

    console.log('\n⏳ Obtendo refresh token...\n');

    // Trocar authorization code por refresh token
    const postData = JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
    });

    const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                
                if (response.refresh_token) {
                    console.log('✅ SUCESSO! Seu Refresh Token:\n');
                    console.log(response.refresh_token);
                    console.log('\n📝 Adicione este token ao arquivo .env como:');
                    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${response.refresh_token}`);
                    console.log('\n');
                } else {
                    console.error('❌ Erro ao obter refresh token:', response);
                }
            } catch (error) {
                console.error('❌ Erro ao processar resposta:', error.message);
                console.log('Resposta completa:', data);
            }
            rl.close();
        });
    });

    req.on('error', (error) => {
        console.error('❌ Erro na requisição:', error.message);
        rl.close();
    });

    req.write(postData);
    req.end();
}

main().catch(error => {
    console.error('❌ Erro:', error.message);
    rl.close();
});

