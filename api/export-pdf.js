// Vercel Serverless Function para gerar PDF com Playwright em ambiente serverless
// Usamos CommonJS require por melhor compatibilidade no runtime do Vercel
const chromium = require('playwright-aws-lambda');

export default async function handler(req, res) {
    let browser = null;

    try {
        // Suporta dois modos:
        // 1) GET com id/projectId → carrega apresentacao-print.html
        // 2) POST com { html } → renderiza HTML diretamente (sem salvar)

        const method = (req.method || 'GET').toUpperCase();
        let mode = 'get-print-route';
        let htmlPayload = '';

        if (method === 'POST') {
            const bodyRaw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
            const body = typeof req.body === 'object' ? req.body : JSON.parse(bodyRaw || '{}');
            if (body && body.html) {
                mode = 'post-html';
                htmlPayload = String(body.html);
            }
        }

        // URL base do Vercel
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';
        
        // Parâmetros da query string (apenas para modo GET)
        const { id, projectId } = req.query;
        const printUrl = `${baseUrl}/apresentacao-print.html?id=${id || ''}&projectId=${projectId || ''}`;

        // Inicializar Chromium headless (Playwright AWS Lambda)
        // Em algumas versões, o helper expõe launchChromium()
        if (typeof chromium.launchChromium === 'function') {
            browser = await chromium.launchChromium();
        } else {
            // Fallback: usar API compatível
            browser = await chromium.launch({
                args: chromium.args || [],
                executablePath: (await chromium.executablePath()) || undefined,
                headless: true,
            });
        }

        const page = await browser.newPage();

        if (mode === 'post-html') {
            console.log('🌐 Renderizando HTML enviado via POST');
            await page.setContent(htmlPayload, { waitUntil: 'networkidle0' });
        } else {
            if (!id || !projectId) {
                await browser.close();
                return res.status(400).json({ error: 'Parâmetros id e projectId são obrigatórios' });
            }
            console.log(`🌐 Acessando: ${printUrl}`);
            await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            console.log('✅ Página carregada');
        }

        // Aguardar fontes carregarem
        await page.evaluateHandle('document.fonts.ready');
        console.log('✅ Fontes carregadas');

        // Aguardar sinal que a apresentação está pronta (apenas modo GET)
        if (mode === 'get-print-route') {
            await page.waitForFunction(() => window.isPrintReady === true, { timeout: 30000 });
            console.log('✅ Apresentação pronta');
        }

        // Pequeno delay para garantir renderização completa
        await new Promise(resolve => setTimeout(resolve, 1000));

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
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="apresentacao.pdf"');
        res.setHeader('Cache-Control', 'no-cache');
        
        return res.send(pdf);

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);

        if (browser) {
            await browser.close();
        }

        return res.status(500).json({
            error: 'Erro ao gerar PDF',
            message: error.message
        });
    }
}

