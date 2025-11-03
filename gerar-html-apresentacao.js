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
        // ⭐ DADOS SEPARADOS POR PLATAFORMA
        metaBudgetsCompleted,
        metaSalesCount,
        metaRevenue,
        googleBudgetsCompleted,
        googleSalesCount,
        googleRevenue,
        // Dados globais (fallback para compatibilidade)
        budgetsCompleted,
        salesCount,
        revenue,
        branding = {}
    } = params;

    console.log('📄 Gerando apresentação com dados:', {
        unitName,
        hasMeta,
        hasGoogle,
        metaMetrics: metaMetrics ? 'Presente' : 'Ausente',
        googleMetrics: googleMetrics ? 'Presente' : 'Ausente',
        adsCount: metaTop3Ads?.length || 0,
        metaSpreadsheet: { budgets: metaBudgetsCompleted, sales: metaSalesCount, revenue: metaRevenue },
        googleSpreadsheet: { budgets: googleBudgetsCompleted, sales: googleSalesCount, revenue: googleRevenue },
        branding: branding ? {
            hasLogoHorizontal: !!branding.logoHorizontalUrl,
            hasLogoSquare: !!branding.logoSquareUrl,
            usage: branding.usage
        } : 'não fornecido'
    });

    const pages = [];

    // PÁGINA 1: Capa
    pages.push(generateCoverPage(unitName, startDate, endDate, branding));

    // PÁGINA 2: Resultados Meta (se disponível)
    if (hasMeta && metaMetrics) {
        // ⭐ Usar dados específicos do Meta ou fallback
        const metaBudgets = metaBudgetsCompleted !== undefined ? metaBudgetsCompleted : budgetsCompleted || 0;
        const metaSales = metaSalesCount !== undefined ? metaSalesCount : salesCount || 0;
        const metaRev = metaRevenue !== undefined ? metaRevenue : revenue || 0;
        pages.push(generateResultsPage(metaMetrics, 'Meta Ads', metaBudgets, metaSales, metaRev, branding));
    }

    // PÁGINA 3: Ranking de Anúncios (logo após Resultados Meta)
    if (hasMeta && metaTop3Ads && metaTop3Ads.length > 0) {
        pages.push(generateRankingPage(metaTop3Ads, branding));
    }

    // PÁGINA 4: Resultados Google (se disponível)
    if (hasGoogle && googleMetrics) {
        // ⭐ Usar dados específicos do Google ou fallback
        const googleBudgets = googleBudgetsCompleted !== undefined ? googleBudgetsCompleted : budgetsCompleted || 0;
        const googleSales = googleSalesCount !== undefined ? googleSalesCount : salesCount || 0;
        const googleRev = googleRevenue !== undefined ? googleRevenue : revenue || 0;
        pages.push(generateResultsPage(googleMetrics, 'Google Ads', googleBudgets, googleSales, googleRev, branding));
    }

    // PÁGINA 5: Próximos Passos
    pages.push(generateNextStepsPage(performanceAnalysis, branding));

    // PÁGINA 6: Obrigado
    pages.push(generateThankYouPage(branding));

    return generateFullHTML(pages);
}

function pickLogo(branding, screenKey, defaultType = 'horizontal', defaultColor = 'normal') {
    console.log(`🔍 pickLogo chamado para ${screenKey}:`, { 
        hasBranding: !!branding, 
        screenKey,
        brandingKeys: branding ? Object.keys(branding) : []
    });
    
    if (!branding) {
        console.warn(`⚠️ Branding vazio para ${screenKey}`);
        return null;
    }
    
    // Verificar se há alguma logo disponível
    const hasAnyLogo = branding.logoHorizontalUrl || branding.logoHorizontalWhiteUrl || 
                       branding.logoSquareUrl || branding.logoSquareWhiteUrl;
    
    if (!hasAnyLogo) {
        console.warn(`⚠️ Nenhuma logo disponível no branding para ${screenKey}`);
        return null;
    }
    
    const usage = branding?.usage?.apresentacao?.[screenKey] || { type: defaultType, color: defaultColor };
    const type = usage.type || defaultType;
    const color = usage.color || defaultColor;
    
    console.log(`📋 Configuração de uso para ${screenKey}:`, { type, color, usage });
    
    const map = {
        horizontal: color === 'white' ? branding?.logoHorizontalWhiteUrl : branding?.logoHorizontalUrl,
        square: color === 'white' ? branding?.logoSquareWhiteUrl : branding?.logoSquareUrl,
    };
    
    let logoUrl = map[type] || null;
    
    // Fallback: se não encontrou a logo configurada, tentar qualquer logo disponível
    if (!logoUrl) {
        console.warn(`⚠️ Logo configurada não encontrada para ${screenKey} (${type}, ${color}), tentando fallback...`);
        logoUrl = branding.logoHorizontalUrl || branding.logoSquareUrl || 
                  branding.logoHorizontalWhiteUrl || branding.logoSquareWhiteUrl || null;
        if (logoUrl) {
            console.log(`✅ Usando logo de fallback para ${screenKey}:`, logoUrl.substring(0, 50) + '...');
        }
    }
    
    console.log(`🎯 Logo encontrada para ${screenKey} (${type}, ${color}):`, logoUrl ? 'Sim' : 'Não', logoUrl ? logoUrl.substring(0, 50) + '...' : '');
    
    return logoUrl;
}

function getLogoPlaceholderSVG(type = 'horizontal', color = 'normal') {
    const fillColor = color === 'white' ? '#ffffff' : '#2563A8';
    const strokeColor = color === 'white' ? '#ffffff' : '#2563A8';
    
    if (type === 'square') {
        return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
            <rect x="8" y="8" width="48" height="48" rx="4" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="4,4" opacity="0.5"/>
            <circle cx="32" cy="28" r="6" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.6"/>
            <path d="M22 42 Q32 36 42 42" stroke="${strokeColor}" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round"/>
        </svg>`;
    } else {
        return `<svg viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
            <rect x="10" y="10" width="180" height="30" rx="4" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="4,4" opacity="0.5"/>
            <text x="100" y="35" font-size="14" fill="${fillColor}" font-family="Poppins, sans-serif" text-anchor="middle" opacity="0.6">Sem Logo</text>
        </svg>`;
    }
}

/**
 * Gerar página de capa
 */
function generateCoverPage(unitName, startDate, endDate, branding) {
    const logoUrl = pickLogo(branding, 'capa', 'horizontal', 'normal');
    return `
    <div class="page slide capa">
        <!-- Logo Horizontal -->
        ${logoUrl ? `<img class="capa-logo-horizontal" src="${logoUrl}" alt="Logo" style="height:48px;object-fit:contain;"/>` : `<div class="capa-logo-horizontal" style="height:48px;opacity:0.5;">${getLogoPlaceholderSVG('horizontal', 'normal')}</div>`}

        <div class="capa-content">
            <h1 class="capa-title">
                RELATÓRIO DE<br/>
                <span class="destaque">RESULTADOS</span>
            </h1>

            <div class="capa-unidade">
                <svg class="capa-unidade-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#2563A8"/>
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
function generateResultsPage(metrics, platformName, budgetsCompleted, salesCount, revenue, branding = {}) {
    // Usar dados da API de anúncios
    const invested = metrics?.spend || 0;
    const clicks = metrics?.clicks || 0;
    const messages = metrics?.conversations || 0;
    
    // Usar dados manuais da planilha
    const sales = salesCount || 0;
    const faturamento = revenue || 0;
    const orcamentos = budgetsCompleted || 0;
    
    // Calcular métricas principais
    const ticketMedio = sales > 0 ? faturamento / sales : 0;
    const roi = invested > 0 ? (faturamento * 0.25) / invested : 0;
    
    // Calcular métricas de custo (CPC, CPL, CPO, CPV)
    const cpc = clicks > 0 ? invested / clicks : 0;
    const cpl = messages > 0 ? invested / messages : 0;  // CPL = Custo por Mensagem (não por lead)
    const cpo = orcamentos > 0 ? invested / orcamentos : 0;
    const cpv = sales > 0 ? invested / sales : 0;
    
    console.log('📊 Dados da página de resultados:', {
        platformName,
        invested,
        faturamento,
        ticketMedio,
        roi,
        clicks,
        messages,
        orcamentos,
        sales,
        cpc,
        cpl,
        cpo,
        cpv,
        metricsReceived: metrics
    });
    
    return `
    <div class="page slide resultados">
        <!-- Logo Horizontal -->
        ${(() => {
            const logoUrl = pickLogo(branding, 'resultados', 'horizontal', 'normal');
            return logoUrl ? `<img class="resultados-logo" src="${logoUrl}" alt="Logo" style="object-fit:contain;"/>` : `<div class="resultados-logo" style="opacity:0.5;">${getLogoPlaceholderSVG('horizontal', 'normal')}</div>`;
        })()}

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
                    <div class="card-label">Ticket médio</div>
                    <div class="card-value">${formatCurrency(ticketMedio)}</div>
                </div>
                <div class="card-white">
                    <div class="card-label">Roi</div>
                    <div class="card-value">${roi.toFixed(2)}</div>
                </div>
            </div>

            <!-- Cards Roxos (Direita) -->
            <div class="resultados-column">
                <div class="card-purple card-split">
                    <div class="card-split-left">
                        <div class="card-value">${formatNumber(clicks)} | Cliques</div>
                    </div>
                    <div class="card-split-right">
                        <div class="card-value">CPC | ${formatCurrency(cpc)}</div>
                    </div>
                </div>
                <div class="card-purple card-split">
                    <div class="card-split-left">
                        <div class="card-value">${formatNumber(messages)} | Leads</div>
                    </div>
                    <div class="card-split-right">
                        <div class="card-value">CPL | ${formatCurrency(cpl)}</div>
                    </div>
                </div>
                <div class="card-purple card-split">
                    <div class="card-split-left">
                        <div class="card-value">${formatNumber(orcamentos)} | Orçamentos</div>
                    </div>
                    <div class="card-split-right">
                        <div class="card-value">CPO | ${formatCurrency(cpo)}</div>
                    </div>
                </div>
                <div class="card-purple card-split">
                    <div class="card-split-left">
                        <div class="card-value">${formatNumber(sales)} | Vendas</div>
                    </div>
                    <div class="card-split-right">
                        <div class="card-value">CPV | ${formatCurrency(cpv)}</div>
                    </div>
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
function generateRankingPage(ads, branding = {}) {
    console.log('🏆 Gerando ranking com anúncios:', ads);
    
    const adsHTML = ads.slice(0, 3).map((ad, index) => {
        // Calcular métricas
        const leads = ad.leads || ad.messages || 0;
        const spend = ad.spend || 0;
        const costPerLead = leads > 0 ? spend / leads : 0;
        
        // Detectar tipo (vídeo ou imagem)
        const isVideo = ad.type === 'video' || ad.type === 'VIDEO';
        const imageUrl = ad.imageUrl || ad.thumbnailUrl;
        const adId = ad.id || `ad_${index}`;
        
        return `
        <div class="ranking-card" data-ad-id="${adId}" data-ad-index="${index}">
            <button class="ranking-card-delete" style="display:none;position:absolute;top:10px;right:10px;z-index:10;width:32px;height:32px;background:rgba(239,68,68,0.9);border:none;border-radius:50%;color:white;cursor:pointer;align-items:center;justify-content:center;display:none;" title="Remover anúncio">
                <i class="fas fa-trash" style="font-size:14px;"></i>
            </button>
            <div class="ranking-thumbnail ranking-thumbnail-editable" data-ad-image="${adId}" style="border:none;outline:none;">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="Anúncio" style="width:100%;height:100%;object-fit:cover;border:none;outline:none;box-shadow:none;margin:0;padding:0;" onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'">`
                    : `<div style="width:100%;height:100%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;border:none;outline:none;">Sem Imagem</div>`
                }
                ${isVideo ? `<div class="ranking-video-play"><i class="fas fa-play"></i></div>` : ''}
            </div>
            <div class="ranking-metrics-bar">
                <span class="ranking-metrics-leads" data-ad-leads="${adId}">${formatNumber(leads)} Leads</span>
                <span class="ranking-metrics-cost" data-ad-cost="${adId}">${formatCurrency(costPerLead)}</span>
            </div>
            <input type="file" accept="image/*" class="ranking-image-input" data-ad-input="${adId}" style="display:none;">
        </div>
        `;
    }).join('');
    
    // Adicionar placeholder para novo anúncio (opcional) - só aparece se tiver menos de 3 anúncios
    const shouldShowPlaceholder = ads.length < 3;
    const placeholderHTML = `
    <div class="ranking-card ranking-card-placeholder" data-ad-id="placeholder_new" style="display:${shouldShowPlaceholder ? 'flex' : 'none'};">
        <div class="ranking-thumbnail ranking-thumbnail-editable ranking-thumbnail-placeholder" data-ad-image="placeholder_new" style="border:2px dashed #9333EA;background:#f9fafb;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#9333EA;">
            <i class="fas fa-plus-circle" style="font-size:48px;margin-bottom:8px;"></i>
            <span style="font-size:14px;font-weight:500;">Clique ou arraste uma imagem</span>
        </div>
        <div class="ranking-metrics-bar">
            <span class="ranking-metrics-leads" data-ad-leads="placeholder_new">0 Leads</span>
            <span class="ranking-metrics-cost" data-ad-cost="placeholder_new">R$ 0,00</span>
        </div>
        <input type="file" accept="image/*" class="ranking-image-input" data-ad-input="placeholder_new" style="display:none;">
    </div>
    `;

    return `
    <div class="page slide ranking">
        <!-- Logo Quadrada -->
        ${(() => {
            const logoUrl = pickLogo(branding, 'ranking', 'square', 'white');
            return logoUrl ? `<img class="ranking-logo" src="${logoUrl}" alt="Logo" style="object-fit:contain;"/>` : `<div class="ranking-logo" style="opacity:0.6;">${getLogoPlaceholderSVG('square', 'white')}</div>`;
        })()}

        <h2 class="ranking-title">
            <span class="ranking-title-line1">RANKING</span><br>
            <span class="ranking-title-line2">ANÚNCIOS</span>
        </h2>

        <div class="ranking-grid">
            ${adsHTML}
            ${placeholderHTML}
        </div>
    </div>
    `;
}

/**
 * Gerar página de próximos passos
 */
function generateNextStepsPage(performanceAnalysis, branding = {}) {
    // Converter texto em lista com marcadores
    const analysisLines = performanceAnalysis ? performanceAnalysis.split('\n').filter(line => line.trim()) : [];
    const analysisHTML = analysisLines.length > 0 
        ? analysisLines.map(line => `<li>${line.trim()}</li>`).join('')
        : '<li>Nenhuma orientação fornecida.</li>';
    
    const logoUrl = pickLogo(branding, 'proximosPassos', 'horizontal', 'normal');
    
    return `
    <div class="page slide proximos-passos">
        <div class="proximos-left">
            <h2 class="proximos-title">PRÓXIMOS<br/>PASSOS</h2>
        </div>

        <div class="proximos-right">
            <h3 class="proximos-subtitle">Orientações</h3>
            <ul class="proximos-list">
                ${analysisHTML}
            </ul>
            <!-- Logo Horizontal no canto inferior direito da seção branca -->
            ${logoUrl ? `<img class="proximos-logo" src="${logoUrl}" alt="Logo" style="object-fit:contain;"/>` : `<div class="proximos-logo" style="opacity:0.5;">${getLogoPlaceholderSVG('horizontal', 'normal')}</div>`}
        </div>
    </div>
    `;
}

/**
 * Gerar página de obrigado
 */
function generateThankYouPage(branding = {}) {
    const logoUrl = pickLogo(branding, 'obrigado', 'square', 'white');
    
    return `
    <div class="page slide obrigado">
        <!-- Logo Quadrada -->
        ${logoUrl ? `<img class="obrigado-logo" src="${logoUrl}" alt="Logo" style="object-fit:contain;"/>` : `<div class="obrigado-logo" style="opacity:0.6;">${getLogoPlaceholderSVG('square', 'white')}</div>`}

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
      align-items: flex-start;
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
      margin-left: 0;
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
      position: absolute;
      top: 40px;
      right: 65px;
      height: 42px;
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
      gap: 20px;
    }

    .resultados-column {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .card-white {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .card-purple {
      background: linear-gradient(135deg, #7B4397 0%, #6B3387 100%);
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 12px rgba(123,67,151,0.3);
    }

    .card-label {
      font-size: 14px;
      color: #666;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .card-purple .card-label {
      color: rgba(255,255,255,0.8);
    }

    .card-value {
      font-size: 24px;
      font-weight: 700;
      color: #2563A8;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-purple .card-value {
      color: white;
      font-size: 18px;
    }

    .card-split {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
    }

    .card-split-left,
    .card-split-right {
      flex: 1;
      display: flex;
      align-items: center;
    }

    .card-split-left {
      justify-content: flex-start;
    }

    .card-split-right {
      justify-content: flex-end;
      text-align: right;
    }

    .card-split .card-label {
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin-bottom: 0;
      white-space: nowrap;
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
      background: #672E7B;
      padding: 50px 65px;
      position: relative;
    }

    .ranking-logo {
      position: absolute;
      top: 45px;
      right: 65px;
      width: 80px;
      height: 80px;
      z-index: 2;
    }

    .ranking-title {
      font-size: 54px;
      font-weight: 400;
      color: white;
      margin-bottom: 20px;
      margin-left: 0;
      line-height: 0.5;
      text-align: left;
    }

    .ranking-title-line1 {
      font-weight: 400;
      display: block;
    }

    .ranking-title-line2 {
      font-weight: 700;
      display: block;
    }

    .ranking-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
      position: relative;
      z-index: 2;
      margin-top: 80px;
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
      justify-items: stretch;
    }

    .ranking-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .ranking-card-delete {
      transition: all 0.2s;
    }
    
    .ranking-card-delete:hover {
      background: rgba(239,68,68,1) !important;
      transform: scale(1.1);
    }
    
    .ranking-thumbnail-editable {
      position: relative;
      transition: all 0.2s;
    }
    
    .ranking-thumbnail-editable.edit-mode {
      cursor: pointer;
    }
    
    .ranking-thumbnail-editable.edit-mode:hover {
      opacity: 0.9;
    }
    
    .ranking-thumbnail-editable::after {
      content: 'Clique para alterar';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(147, 51, 234, 0.85);
      color: white;
      font-size: 16px;
      font-weight: 600;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 5;
    }
    
    .ranking-thumbnail-editable.edit-mode::after {
      display: flex;
    }
    
    .ranking-thumbnail-editable.edit-mode:hover::after {
      opacity: 1;
    }
    
    .ranking-thumbnail-placeholder::after {
      content: 'Clique ou arraste para adicionar';
      background: rgba(147, 51, 234, 0.9);
    }
    
    .ranking-card-placeholder {
      border: 2px dashed #9333EA;
      background: #f9fafb;
    }

    .ranking-thumbnail {
      width: 100%;
      height: 300px;
      background: #f0f0f0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .ranking-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    .ranking-video-play {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    .ranking-video-play i {
      color: white;
      font-size: 24px;
      margin-left: 4px;
    }

    .ranking-metrics-bar {
      background: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e5e7eb;
    }

    .ranking-metrics-leads {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }

    .ranking-metrics-cost {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
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
      position: relative;
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
      position: absolute;
      bottom: 40px;
      right: 55px;
      height: 40px;
      z-index: 2;
    }

    /* === PÁGINA 5 - OBRIGADO === */
    .obrigado {
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 60px;
    }

    .obrigado-logo {
      width: 150px;
      height: 150px;
    }

    .obrigado-text {
      font-size: 96px;
      font-weight: 700;
      color: #0067D4;
      letter-spacing: 4px;
      margin: 0;
      text-align: center;
    }

    /* === ANTI-DISTORTION RULES === */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    
    .page, .page * {
      transform: none !important;
      filter: none !important;
      perspective: none !important;
      backface-visibility: visible !important;
      will-change: auto !important;
    }
    
    img {
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      transform: translateZ(0);
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
        transform: none !important;
      }
      .card-white, .card-purple {
        box-shadow: none !important;
        transform: none !important;
      }
    }
    `;
}

