import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js';

export function exportToPDF(unitId, unitName, startDate, endDate, metrics, blackMetrics, hasBlack, budgetsCompleted, salesCount, revenue, performanceAnalysis, bestAds) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = margin;

    // Função para formatar datas
    const formatDate = (date) => date ? date.split('-').reverse().join('/') : 'N/A';

    // Função para adicionar texto com verificação de espaço na página
    const addText = (text, x, y, options = {}) => {
        if (y > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.text(text, x, yPosition, options);
        yPosition += (options.lineHeight || 5);
    };

    // Função para adicionar uma linha horizontal
    const addLine = () => {
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
    };

    // Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    addText(`Relatório Completo - ${unitName}`, margin, yPosition, { lineHeight: 8 });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    addText(`Período Analisado: ${formatDate(startDate)} a ${formatDate(endDate)}`, margin, yPosition, { lineHeight: 6 });

    yPosition += 5;
    addLine();

    // Função para adicionar uma seção de métricas
    const addMetricsSection = (title, metricsData, isBlack = false) => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        addText(title.toUpperCase(), margin, yPosition, { lineHeight: 7 });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText(`Investimento: R$ ${metricsData.spend.toFixed(2).replace('.', ',')}`, margin, yPosition, { lineHeight: 5 });
        addText(`Alcance: ${metricsData.reach}`, margin, yPosition, { lineHeight: 5 });
        addText(`Conversas Iniciadas: ${metricsData.conversations}`, margin, yPosition, { lineHeight: 5 });
        addText(`Custo por Conversa: R$ ${metricsData.costPerConversation.toFixed(2).replace('.', ',')}`, margin, yPosition, { lineHeight: 5 });

        if (hasBlack && isBlack) {
            const totalLeads = (metrics.conversations || 0) + (blackMetrics.conversations || 0);
            yPosition += 5;
            addText(`Número total de leads: ${totalLeads}`, margin, yPosition, { lineHeight: 5 });
        }

        yPosition += 5;
        addLine();
    };

    // Adicionar métricas
    if (hasBlack) {
        addMetricsSection('Campanhas White', metrics);
        addMetricsSection('Campanhas Black', blackMetrics, true);
    } else {
        addMetricsSection('Campanhas', metrics);
    }

    // Resultados de Negócios
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    addText('Resultados de Negócios', margin, yPosition, { lineHeight: 7 });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    addText(`Orçamentos Realizados: ${budgetsCompleted.toLocaleString('pt-BR')}`, margin, yPosition, { lineHeight: 5 });
    addText(`Número de Vendas: ${salesCount.toLocaleString('pt-BR')}`, margin, yPosition, { lineHeight: 5 });
    addText(`Faturamento: R$ ${revenue.toFixed(2).replace('.', ',')}`, margin, yPosition, { lineHeight: 5 });

    yPosition += 5;
    addLine();

    // Análise de Desempenho e Pontos de Melhoria
    if (performanceAnalysis.trim()) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        addText('Análise de Desempenho e Pontos de Melhoria', margin, yPosition, { lineHeight: 7 });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
        paragraphs.forEach(paragraph => {
            const lines = doc.splitTextToSize(paragraph, pageWidth - 2 * margin);
            lines.forEach(line => {
                addText(`• ${line}`, margin, yPosition, { lineHeight: 5 });
            });
            yPosition += 2;
        });

        yPosition += 5;
        addLine();
    }

    // Anúncios em Destaque
    if (bestAds.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        addText('Anúncios em Destaque', margin, yPosition, { lineHeight: 7 });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        bestAds.forEach((ad, index) => {
            addText(`Anúncio ${index + 1}:`, margin, yPosition, { lineHeight: 5 });
            addText(`Leads: ${ad.messages}`, margin + 5, yPosition, { lineHeight: 5 });
            addText(`Investimento: R$ ${ad.spend.toFixed(2).replace('.', ',')}`, margin + 5, yPosition, { lineHeight: 5 });
            addText(`Custo por Lead: R$ ${ad.costPerMessage.replace('.', ',')}`, margin + 5, yPosition, { lineHeight: 5 });
            yPosition += 2;
        });

        yPosition += 5;
        addLine();
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText('Nenhum anúncio com dados (leads ou investimento) encontrado para este período.', margin, yPosition, { lineHeight: 5 });
    }

    // Salvar o PDF
    doc.save(`Relatorio_${unitName}_${formatDate(startDate)}_a_${formatDate(endDate)}.pdf`);
}