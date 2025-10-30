// Vercel Serverless Function para gerar PDF com Puppeteer
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

        // Configuração específica para Vercel
        const isDev = process.env.NODE_ENV !== 'production';
        
        // Inicializar Chromium headless
        browser = await puppeteer.launch({
            args: isDev ? [] : [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: isDev 
                ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // local
                : await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

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

