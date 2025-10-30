const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event, context) => {
    let browser = null;

    try {
        // Parâmetros da query string
        const { id, projectId } = event.queryStringParameters || {};

        if (!id || !projectId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Parâmetros id e projectId são obrigatórios' })
            };
        }

        console.log(`📄 Gerando PDF para apresentação ${id} do projeto ${projectId}`);

        // URL base (Netlify automaticamente fornece)
        const baseUrl = process.env.URL || 'http://localhost:8888';
        const printUrl = `${baseUrl}/apresentacao-print.html?id=${id}&projectId=${projectId}`;

        console.log(`🌐 Acessando: ${printUrl}`);

        // Inicializar Chromium headless
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // Navegar para a página print
        await page.goto(printUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000 // 60 segundos
        });

        console.log('✅ Página carregada');

        // Aguardar fontes carregarem
        await page.evaluateHandle('document.fonts.ready');
        console.log('✅ Fontes carregadas');

        // Aguardar sinal que a apresentação está pronta
        await page.waitForFunction(
            () => window.isPrintReady === true,
            { timeout: 30000 }
        );
        console.log('✅ Apresentação pronta');

        // Pequeno delay para garantir renderização completa
        await page.waitForTimeout(1000);

        // Gerar PDF
        const pdf = await page.pdf({
            printBackground: true,
            preferCSSPageSize: true,
            landscape: true,
            format: 'A4'
        });

        console.log('✅ PDF gerado com sucesso');

        await browser.close();

        // Retornar PDF
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename="apresentacao.pdf"',
                'Cache-Control': 'no-cache'
            },
            body: pdf.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);

        if (browser) {
            await browser.close();
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Erro ao gerar PDF',
                message: error.message
            })
        };
    }
};

