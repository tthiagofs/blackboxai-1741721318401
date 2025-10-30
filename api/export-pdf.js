// Vercel Serverless Function para gerar PDF com Puppeteer
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
    let browser = null;

    try {
        // Parâmetros da query string
        const { id, projectId } = req.query;

        if (!id || !projectId) {
            return res.status(400).json({ 
                error: 'Parâmetros id e projectId são obrigatórios' 
            });
        }

        console.log(`📄 Gerando PDF para apresentação ${id} do projeto ${projectId}`);

        // URL base do Vercel
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';
        
        const printUrl = `${baseUrl}/apresentacao-print.html?id=${id}&projectId=${projectId}`;

        console.log(`🌐 Acessando: ${printUrl}`);

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
                : await chromium.executablePath('/tmp/chromium'),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
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

