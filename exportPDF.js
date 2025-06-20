export async function exportToPDF(
    unitId,
    unitName,
    startDate,
    endDate,
    metrics,
    blackMetrics,
    hasBlack,
    budgetsCompleted,
    salesCount,
    revenue,
    performanceAnalysis,
    bestAds
) {
    // Acessar jsPDF do escopo global
    const { jsPDF } = window.jspdf;

    // Converter as datas para o formato dd/mm/aaaa
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');

    // Selecionar o elemento do relatório no DOM
    const reportElement = document.querySelector('#reportContainer .bg-white');
    if (!reportElement) {
        alert('Não foi possível encontrar o relatório para exportar. Por favor, gere o relatório primeiro.');
        return;
    }

    // Clonar o elemento e adicionar ao corpo temporariamente
    const tempReportElement = reportElement.cloneNode(true);
    document.body.appendChild(tempReportElement);

    // Pré-processar o texto da análise de desempenho para garantir espaços
    const analysisSection = tempReportElement.querySelector('.mt-8:last-of-type ul');
    if (analysisSection && performanceAnalysis.trim()) {
        const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
        let formattedText = paragraphs.map(paragraph => {
            return paragraph.replace(/\s+/g, ' ').replace(/\n/g, '<br>').trim();
        }).join('</li><li>');
        analysisSection.innerHTML = `<li>${formattedText}</li>`;
    }

    // Remover scroll e estilos que possam interferir
    tempReportElement.style.position = 'absolute';
    tempReportElement.style.top = '0';
    tempReportElement.style.left = '0';
    tempReportElement.style.overflow = 'hidden';
    tempReportElement.style.width = '210mm';
    tempReportElement.style.height = 'auto';
    tempReportElement.style.padding = '0';
    tempReportElement.style.margin = '0';

    // Esconder o botão "Exportar para PDF" durante a captura
    const exportButton = tempReportElement.querySelector('#exportPDFBtn');
    if (exportButton) {
        exportButton.style.display = 'none';
    }

    // Capturar o relatório como imagem usando html2canvas
    const canvas = await html2canvas(tempReportElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        windowWidth: 595, // Largura aproximada de A4 em pixels (210mm * 2.8346 pixels/mm)
        windowHeight: document.documentElement.scrollHeight,
    });

    // Remover o elemento temporário do DOM
    document.body.removeChild(tempReportElement);

    // Obter a imagem como data URL
    const imgData = canvas.toDataURL('image/png');

    // Dimensões do canvas
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Dimensões da página A4 em mm (210mm x 297mm)
    const pdfWidth = 210;
    const pdfHeight = 297;

    // Converter dimensões de pixels para mm (1 pixel = 0.3528 mm em 72 DPI)
    const imgWidthInMm = imgWidth / 2.8346; // Ajuste para escala 2
    const imgHeightInMm = imgHeight / 2.8346;

    // Calcular a proporção para ajustar a imagem à largura da página A4
    const ratio = pdfWidth / imgWidthInMm;
    const scaledWidth = pdfWidth;
    const scaledHeight = Math.min(imgHeightInMm * ratio, pdfHeight);

    // Ajustar o posicionamento e adicionar quebras de página se necessário
    const xOffset = 0;
    let yOffset = 10;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Adicionar a imagem ao PDF com quebras de página
    let remainingHeight = scaledHeight;
    let sourceY = 0;

    while (remainingHeight > 0) {
        const heightToAdd = Math.min(remainingHeight, pdfHeight - yOffset);
        if (heightToAdd > 0) {
            doc.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, heightToAdd, '', 'FAST', sourceY / 2);
        }
        remainingHeight -= heightToAdd;
        sourceY += heightToAdd * 2.8346; // Ajuste para escala 2
        if (remainingHeight > 0) {
            doc.addPage();
            yOffset = 10;
        }
    }

    // Gerar o nome do arquivo
    const fileName = `Relatorio_CA - ${unitName}_${formattedStartDate}_a_${formattedEndDate}.pdf`;

    // Baixar o PDF
    doc.save(fileName);
}