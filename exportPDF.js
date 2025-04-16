import jsPDF from 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.es.min.js';

export async function exportReportToPDF() {
    const reportContainer = document.getElementById('reportContainer');
    if (!reportContainer) {
        alert('Relatório não encontrado. Por favor, gere o relatório primeiro.');
        return;
    }

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const unitId = document.getElementById('unitId').value;
    const unitName = document.getElementById('unitId').options[document.getElementById('unitId').selectedIndex].text;
    const startDate = document.getElementById('startDate').value.split('-').reverse().join('/');
    const endDate = document.getElementById('endDate').value.split('-').reverse().join('/');

    // Título
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(30, 60, 114); // Cor primary (#1e3c72)
    pdf.text(`Relatório Completo - ${unitName}`, 20, 20);

    // Período
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Período Analisado: ${startDate} a ${endDate}`, 20, 30);

    let yOffset = 40;

    // Função auxiliar para adicionar seção
    const addSection = (title, metrics, y) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.setFillColor(30, 60, 114); // Cor primary
        pdf.rect(20, y, 170, 10, 'F');
        pdf.text(title.toUpperCase(), 25, y + 7);

        y += 15;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);

        const metricsData = [
            { label: 'Investimento', value: `R$ ${metrics.spend.toFixed(2).replace('.', ',')}` },
            { label: 'Alcance', value: metrics.reach.toLocaleString('pt-BR') },
            { label: 'Conversas Iniciadas', value: metrics.conversations.toLocaleString('pt-BR') },
            { label: 'Custo por Conversa', value: `R$ ${metrics.costPerConversation.toFixed(2).replace('.', ',')}` }
        ];

        metricsData.forEach((metric, index) => {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(20, y + index * 10, 170, 8, 'F');
            pdf.text(`${metric.label}: ${metric.value}`, 25, y + index * 10 + 6);
        });

        return y + metricsData.length * 10 + 10;
    };

    // Capturar métricas do relatório
    const report = reportContainer.querySelector('.bg-white');
    const hasBlack = document.getElementById('blackFilters').classList.contains('hidden') ? false : true;

    if (hasBlack) {
        // Campanhas White
        const whiteMetricsElements = report.querySelectorAll('.metric-card')[0].parentElement.querySelectorAll('.metric-card');
        const whiteMetrics = {
            spend: parseFloat(whiteMetricsElements[0].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.')),
            reach: parseInt(whiteMetricsElements[1].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            conversations: parseInt(whiteMetricsElements[2].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            costPerConversation: parseFloat(whiteMetricsElements[3].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.'))
        };
        yOffset = addSection('Campanhas White', whiteMetrics, yOffset);

        // Campanhas Black
        const blackMetricsElements = report.querySelectorAll('.metric-card')[4].parentElement.querySelectorAll('.metric-card');
        const blackMetrics = {
            spend: parseFloat(blackMetricsElements[0].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.')),
            reach: parseInt(blackMetricsElements[1].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            conversations: parseInt(blackMetricsElements[2].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            costPerConversation: parseFloat(blackMetricsElements[3].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.'))
        };
        yOffset = addSection('Campanhas Black', blackMetrics, yOffset);

        // Total de Leads
        const totalLeads = report.querySelector('p.text-lg.font-semibold span').textContent;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Número total de leads:', 20, yOffset);
        pdf.setFont('helvetica', 'normal');
        pdf.text(totalLeads, 60, yOffset);
        yOffset += 15;
    } else {
        // Campanhas Gerais
        const metricsElements = report.querySelectorAll('.metric-card');
        const metrics = {
            spend: parseFloat(metricsElements[0].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.')),
            reach: parseInt(metricsElements[1].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            conversations: parseInt(metricsElements[2].querySelector('p.text-lg').textContent.replace(/\./g, '')),
            costPerConversation: parseFloat(metricsElements[3].querySelector('p.text-lg').textContent.replace('R$ ', '').replace(',', '.'))
        };
        yOffset = addSection('Campanhas', metrics, yOffset);
    }

    // Resultados de Negócios
    const businessResults = report.querySelectorAll('.metric-card').length > (hasBlack ? 8 : 4) ? report.querySelectorAll('.metric-card').slice(hasBlack ? 8 : 4, hasBlack ? 11 : 7) : null;
    if (businessResults) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 60, 114);
        pdf.text('Resultados de Negócios', 20, yOffset);
        yOffset += 10;

        const businessData = [
            { label: 'Orçamentos Realizados', value: businessResults[0].querySelector('p.text-lg').textContent },
            { label: 'Número de Vendas', value: businessResults[1].querySelector('p.text-lg').textContent },
            { label: 'Faturamento', value: businessResults[2].querySelector('p.text-lg').textContent }
        ];

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        businessData.forEach((item, index) => {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(20, yOffset + index * 10, 170, 8, 'F');
            pdf.text(`${item.label}: ${item.value}`, 25, yOffset + index * 10 + 6);
        });
        yOffset += businessData.length * 10 + 10;
    }

    // Análise de Desempenho
    const analysisSection = report.querySelector('ul.list-disc');
    if (analysisSection) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 60, 114);
        pdf.text('Análise de Desempenho e Pontos de Melhoria', 20, yOffset);
        yOffset += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        const analysisItems = analysisSection.querySelectorAll('li');
        analysisItems.forEach((item, index) => {
            const text = item.innerText.replace(/\n/g, ' ');
            const lines = pdf.splitTextToSize(text, 170);
            lines.forEach((line, lineIndex) => {
                if (yOffset + (lineIndex * 7) > 270) {
                    pdf.addPage();
                    yOffset = 20;
                }
                pdf.text(`• ${line}`, 25, yOffset + (lineIndex * 7));
            });
            yOffset += lines.length * 7 + 5;
        });
    }

    // Salvar o PDF
    pdf.save(`Relatorio_Completo_${unitName}_${startDate.replace(/\//g, '-')}_a_${endDate.replace(/\//g, '-')}.pdf`);
}