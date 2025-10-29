/**
 * Gerar HTML da Apresentação
 * Este arquivo gera o HTML completo da apresentação baseado no template
 * e nos dados processados
 */

import { formatCurrency, formatNumber, formatDate } from './processar-apresentacao.js';

/**
 * Gerar HTML completo da apresentação
 * @param {Object} params - Parâmetros da apresentação
 * @returns {String} - HTML completo
 */
export function generatePresentationHTML(params) {
    const {
        unitName,
        startDate,
        endDate,
        hasMeta,
        hasGoogle,
        metaMetrics,
        googleMetrics,
        metaTop3Ads,
        performanceAnalysis,
        budgetsCompleted,
        salesCount,
        revenue
    } = params;

    console.log('📄 Gerando apresentação com dados:', {
        unitName,
        hasMeta,
        hasGoogle,
        metaMetrics: metaMetrics ? 'Presente' : 'Ausente',
        googleMetrics: googleMetrics ? 'Presente' : 'Ausente',
        adsCount: metaTop3Ads?.length || 0
    });

    const pages = [];

    // PÁGINA 1: Capa
    pages.push(generateCoverPage(unitName, startDate, endDate));

    // PÁGINA 2: Resultados Meta (se disponível)
    if (hasMeta && metaMetrics) {
        pages.push(generateResultsPage(metaMetrics, 'Meta Ads', budgetsCompleted, salesCount, revenue));
    }

    // PÁGINA 3: Ranking de Anúncios Meta (se disponível)
    if (hasMeta && metaTop3Ads && metaTop3Ads.length > 0) {
        pages.push(generateRankingPage(metaTop3Ads));
    }

    // PÁGINA 4: Resultados Google (se disponível)
    if (hasGoogle && googleMetrics) {
        pages.push(generateResultsPage(googleMetrics, 'Google Ads', budgetsCompleted, salesCount, revenue));
    }

    // PÁGINA 5: Próximos Passos
    pages.push(generateNextStepsPage(performanceAnalysis));

    // PÁGINA 6: Obrigado
    pages.push(generateThankYouPage());

    return generateFullHTML(pages);
}

/**
 * Gerar página de capa
 */
function generateCoverPage(unitName, startDate, endDate) {
    return `
    <div class="page capa">
        <!-- Logo Horizontal -->
        <svg class="capa-logo-horizontal" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
            <text x="10" y="35" font-size="32" font-weight="700" fill="#2563A8" font-family="Poppins, sans-serif">
                Oral Centter
            </text>
        </svg>

        <div class="capa-content">
            <h1 class="capa-title">
                RELATÓRIO DE<br/>
                <span class="destaque">RESULTADOS</span>
            </h1>

            <div class="capa-unidade">
                <svg class="capa-unidade-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
                ${unitName}
            </div>

            <div class="capa-periodo">
                ${formatDate(startDate)} a ${formatDate(endDate)}
            </div>
        </div>

        <!-- Foguete -->
        <div class="capa-rocket" style="background: url('./assets/images/foguete.png') no-repeat center/contain;"></div>

        <!-- Rodapé -->
        <div class="capa-footer"></div>
    </div>
    `;
}

/**
 * Gerar página de resultados
 */
function generateResultsPage(metrics, platformName, budgetsCompleted, salesCount, revenue) {
    // Usar dados da API de anúncios
    const invested = metrics?.spend || 0;
    const clicks = metrics?.clicks || 0;
    const leads = metrics?.conversions || 0;
    
    // Usar dados manuais da planilha
    const sales = salesCount || 0;
    const faturamento = revenue || 0;
    const orcamentos = budgetsCompleted || 0;
    
    // Calcular métricas derivadas
    const ticketMedio = sales > 0 ? faturamento / sales : 0;
    const roi = invested > 0 ? (faturamento * 0.25) / invested : 0;
    
    console.log('📊 Dados da página de resultados:', {
        platformName,
        invested,
        faturamento,
        ticketMedio,
        roi,
        clicks,
        leads,
        orcamentos,
        sales
    });
    
    return `
    <div class="page resultados">
        <!-- Logo Horizontal -->
        <svg class="resultados-logo" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
            <text x="10" y="35" font-size="28" font-weight="700" fill="#2563A8" font-family="Poppins, sans-serif">
                Oral Centter
            </text>
        </svg>

        <h2 class="resultados-title">RESULTADOS TRÁFEGO PAGO</h2>
        <p class="resultados-subtitle">${platformName}</p>

        <div class="resultados-grid">
            <!-- Cards Brancos (Esquerda) -->
            <div class="resultados-column">
                <div class="card-white">
                    <div class="card-label">Investimento</div>
                    <div class="card-value">${formatCurrency(invested)}</div>
                </div>
                <div class="card-white">
                    <div class="card-label">Faturamento</div>
                    <div class="card-value">${formatCurrency(faturamento)}</div>
                </div>
                <div class="card-white">
                    <div class="card-label">Ticket Médio</div>
                    <div class="card-value">${formatCurrency(ticketMedio)}</div>
                </div>
                <div class="card-white">
                    <div class="card-label">ROI</div>
                    <div class="card-value">${roi.toFixed(2)}</div>
                </div>
            </div>

            <!-- Cards Roxos (Direita) -->
            <div class="resultados-column">
                <div class="card-purple">
                    <div class="card-label">Cliques</div>
                    <div class="card-value">${formatNumber(clicks)}</div>
                </div>
                <div class="card-purple">
                    <div class="card-label">Leads</div>
                    <div class="card-value">${formatNumber(leads)}</div>
                </div>
                <div class="card-purple">
                    <div class="card-label">Orçamentos</div>
                    <div class="card-value">${formatNumber(orcamentos)}</div>
                </div>
                <div class="card-purple">
                    <div class="card-label">Fechamentos</div>
                    <div class="card-value">${formatNumber(sales)}</div>
                </div>
            </div>
        </div>

        <!-- Rodapé -->
        <div class="resultados-footer"></div>
    </div>
    `;
}

/**
 * Gerar página de ranking de anúncios
 */
function generateRankingPage(ads) {
    console.log('🏆 Gerando ranking com anúncios:', ads);
    
    const adsHTML = ads.slice(0, 3).map((ad, index) => {
        // Calcular Custo por Mensagem (CPA)
        const messages = ad.messages || 0;
        const costPerMessage = messages > 0 ? ad.spend / messages : 0;
        
        return `
        <div class="ranking-card">
            <div class="ranking-badge">${index + 1}º</div>
            <div class="ranking-thumbnail">
                ${ad.imageUrl 
                    ? `<img src="${ad.imageUrl}" alt="${ad.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'">`
                    : `<div style="width:100%;height:100%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#9ca3af;">Sem Imagem</div>`
                }
            </div>
            <div class="ranking-info">
                <div class="ranking-name">${ad.name || 'Anúncio sem nome'}</div>
                <div class="ranking-stats">
                    <div class="ranking-stat">
                        <span class="ranking-stat-label">Mensagens</span>
                        <span class="ranking-stat-value">${formatNumber(messages)}</span>
                    </div>
                    <div class="ranking-stat">
                        <span class="ranking-stat-label">Custo por Mensagem</span>
                        <span class="ranking-stat-value">${formatCurrency(costPerMessage)}</span>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    return `
    <div class="page ranking">
        <!-- Logo Circular -->
        <svg class="ranking-logo" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="38" fill="white" stroke="#2563A8" stroke-width="2"/>
            <text x="40" y="50" font-size="14" font-weight="700" fill="#2563A8" font-family="Poppins, sans-serif" text-anchor="middle">
                OC
            </text>
        </svg>

        <h2 class="ranking-title">RANKING ANÚNCIOS</h2>

        <div class="ranking-grid">
            ${adsHTML}
        </div>

        <!-- Padrão Geométrico de Fundo -->
        <svg class="ranking-pattern" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="triangles" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                    <polygon points="50,10 90,90 10,90" fill="rgba(37,99,168,0.05)"/>
                </pattern>
            </defs>
            <rect width="1280" height="720" fill="url(#triangles)"/>
        </svg>
    </div>
    `;
}

/**
 * Gerar página de próximos passos
 */
function generateNextStepsPage(performanceAnalysis) {
    // Converter texto em lista com marcadores
    const analysisLines = performanceAnalysis ? performanceAnalysis.split('\n').filter(line => line.trim()) : [];
    const analysisHTML = analysisLines.length > 0 
        ? analysisLines.map(line => `<li>${line.trim()}</li>`).join('')
        : '<li>Nenhuma orientação fornecida.</li>';
    
    return `
    <div class="page proximos-passos">
        <div class="proximos-left">
            <h2 class="proximos-title">PRÓXIMOS<br/>PASSOS</h2>
        </div>

        <div class="proximos-right">
            <h3 class="proximos-subtitle">Orientações</h3>
            <ul class="proximos-list">
                ${analysisHTML}
            </ul>

            <!-- Logo -->
            <svg class="proximos-logo" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="35" font-size="28" font-weight="700" fill="#2563A8" font-family="Poppins, sans-serif">
                    Oral Centter
                </text>
            </svg>
        </div>
    </div>
    `;
}

/**
 * Gerar página de obrigado
 */
function generateThankYouPage() {
    return `
    <div class="page obrigado">
        <!-- Logo Circular -->
        <svg class="obrigado-logo" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="58" fill="#2563A8"/>
            <text x="60" y="75" font-size="28" font-weight="700" fill="white" font-family="Poppins, sans-serif" text-anchor="middle">
                OC
            </text>
        </svg>

        <h2 class="obrigado-text">OBRIGADO!</h2>
    </div>
    `;
}

/**
 * Gerar HTML completo com estilos
 */
function generateFullHTML(pages) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apresentação - Oral Centter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

/**
 * Obter estilos CSS
 */
function getStyles() {
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Poppins', sans-serif;
      background: #f0f0f0;
      overflow-x: hidden;
    }

    .page {
      width: 1280px;
      height: 720px;
      background: white;
      margin: 20px auto;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }

    /* === PÁGINA 1 - CAPA === */
    .capa {
      background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 50px 65px;
      position: relative;
    }

    .capa-logo-horizontal {
      position: absolute;
      top: 40px;
      left: 65px;
      height: 50px;
    }

    .capa-content {
      max-width: 600px;
      z-index: 2;
    }

    .capa-title {
      font-size: 62px;
      font-weight: 700;
      color: #1e5091;
      line-height: 1.05;
      margin-bottom: 50px;
      letter-spacing: -1px;
    }

    .capa-title .destaque {
      font-weight: 800;
      color: #2563A8;
    }

    .capa-unidade {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 32px;
      font-weight: 700;
      color: #2563A8;
      margin-bottom: 25px;
    }

    .capa-unidade-icon {
      width: 35px;
      height: 35px;
      fill: #2563A8;
    }

    .capa-periodo {
      display: inline-block;
      border: 3px solid #2563A8;
      border-radius: 8px;
      padding: 14px 35px;
      font-size: 24px;
      color: #2563A8;
      font-weight: 400;
      background: white;
    }

    .capa-rocket {
      position: absolute;
      bottom: -80px;
      right: -120px;
      width: 700px;
      height: 700px;
      z-index: 1;
    }

    .capa-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 15px;
      background: #2563A8;
    }

    /* === PÁGINA 2 - RESULTADOS === */
    .resultados {
      background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
      padding: 50px 65px;
    }

    .resultados-logo {
      height: 45px;
      margin-bottom: 25px;
    }

    .resultados-title {
      font-size: 42px;
      font-weight: 700;
      color: #1e5091;
      margin-bottom: 8px;
    }

    .resultados-subtitle {
      font-size: 20px;
      color: #7B4397;
      font-weight: 600;
      margin-bottom: 35px;
    }

    .resultados-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
    }

    .resultados-column {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card-white {
      background: white;
      border-radius: 12px;
      padding: 20px 25px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .card-purple {
      background: linear-gradient(135deg, #7B4397 0%, #6B3387 100%);
      border-radius: 12px;
      padding: 20px 25px;
      box-shadow: 0 4px 12px rgba(123,67,151,0.3);
    }

    .card-label {
      font-size: 16px;
      color: #666;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .card-purple .card-label {
      color: rgba(255,255,255,0.8);
    }

    .card-value {
      font-size: 32px;
      font-weight: 700;
      color: #2563A8;
    }

    .card-purple .card-value {
      color: white;
    }

    .resultados-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 15px;
      background: #7B4397;
    }

    /* === PÁGINA 3 - RANKING === */
    .ranking {
      background: linear-gradient(135deg, #7B4397 0%, #2563A8 100%);
      padding: 50px 65px;
      position: relative;
    }

    .ranking-logo {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
    }

    .ranking-title {
      font-size: 48px;
      font-weight: 700;
      color: white;
      margin-bottom: 40px;
    }

    .ranking-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
      position: relative;
      z-index: 2;
    }

    .ranking-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      position: relative;
    }

    .ranking-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      width: 45px;
      height: 45px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      color: white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 3;
    }

    .ranking-thumbnail {
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      border-radius: 12px;
      margin-bottom: 15px;
      overflow: hidden;
    }

    .ranking-info {
      padding: 10px 0;
    }

    .ranking-name {
      font-size: 16px;
      font-weight: 600;
      color: #1e5091;
      margin-bottom: 12px;
      line-height: 1.3;
      max-height: 2.6em;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .ranking-stats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ranking-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ranking-stat-label {
      font-size: 13px;
      color: #666;
      font-weight: 500;
    }

    .ranking-stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #2563A8;
    }

    .ranking-pattern {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.3;
      z-index: 1;
    }

    /* === PÁGINA 4 - PRÓXIMOS PASSOS === */
    .proximos-passos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: 720px;
      overflow: hidden;
    }

    .proximos-left {
      background: #2563A8;
      padding: 60px 50px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .proximos-title {
      font-size: 52px;
      font-weight: 700;
      color: white;
      line-height: 1.1;
      margin-bottom: 50px;
    }

    .proximos-stepper {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .proximos-step {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .proximos-step-number {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 700;
      color: #2563A8;
      flex-shrink: 0;
    }

    .proximos-step-text {
      font-size: 20px;
      color: white;
      font-weight: 500;
    }

    .proximos-right {
      background: white;
      padding: 60px 50px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .proximos-subtitle {
      font-size: 36px;
      font-weight: 700;
      color: #2563A8;
      margin-bottom: 25px;
    }

    .proximos-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-bottom: 40px;
    }

    .proximos-list li {
      font-size: 18px;
      color: #333;
      padding-left: 30px;
      position: relative;
    }

    .proximos-list li::before {
      content: '▸';
      position: absolute;
      left: 0;
      color: #7B4397;
      font-size: 20px;
    }

    .proximos-logo {
      height: 40px;
    }

    /* === PÁGINA 5 - OBRIGADO === */
    .obrigado {
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 40px;
    }

    .obrigado-logo {
      width: 120px;
      height: 120px;
    }

    .obrigado-text {
      font-size: 72px;
      font-weight: 700;
      background: linear-gradient(135deg, #2563A8 0%, #7B4397 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* === PRINT STYLES === */
    @media print {
      body {
        background: white;
      }
      .page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
      .ranking-card {
        box-shadow: none !important;
      }
      .card-white, .card-purple {
        box-shadow: none !important;
      }
    }
    `;
}

