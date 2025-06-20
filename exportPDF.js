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

    // Clonar o elemento para manipulação temporária
    const tempReportElement = reportElement.cloneNode(true);
    document.body.appendChild(tempReportElement);

    // Pré-processar o texto da análise de desempenho para garantir espaços
    const analysisSection = tempReportElement.querySelector('.mt-8:last-of-type ul');
    if (analysisSection && performanceAnalysis.trim()) {
        const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
        let formattedText = paragraphs.map(paragraph => {
            return paragraph
                .replace(/\s+/g, ' ') // Substituir múltiplos espaços por um único espaço
                .replace(/([a-zA-Z])\s*([a-zA-Z])/g, '$1 $2') // Garantir espaço entre letras consecutivas
                .replace(/\n/g, '<br>') // Converter quebras de linha em <br>
                .trim();
        }).join('</li><li>');
        analysisSection.innerHTML = `<li>${formattedText}</li>`;
    }

    // Ajustar estilos para garantir captura correta
    tempReportElement.style.width = '210mm';
    tempReportElement.style.height = 'auto';
    tempReportElement.style.position = 'absolute';
    tempReportElement.style.top = '0';
    tempReportElement.style.left = '0';
    tempReportElement.style.overflow = 'hidden';

    // Esconder o botão "Exportar para PDF" durante a captura
    const exportButton = tempReportElement.querySelector('#exportPDFBtn');
    if (exportButton) {
        exportButton.style.display = 'none';
    }

    // Aguardar breve atualização do DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capturar o relatório como imagem usando html2canvas
    const canvas = await html2canvas(tempReportElement, {
        scale: 2,
        useCORS: true,
        logging: true,
    });

    // Remover o elemento temporário do DOM
    document.body.removeChild(tempReportElement);

    // Restaurar o botão "Exportar para PDF" no elemento original
    if (exportButton) {
        exportButton.style.display = 'block';
    }

    // Obter a imagem como data URL
    const imgData = canvas.toDataURL('image/png');

    // Dimensões do canvas
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Dimensões da página A4 em mm (210mm x 297mm)
    const pdfWidth = 210;
    const pdfHeight = 297;

    // Converter dimensões de pixels para mm (1 pixel = 0.0353 mm em 72 DPI)
    const imgWidthInMm = imgWidth * 0.0353;
    const imgHeightInMm = imgHeight * 0.0353;

    // Calcular a proporção para ajustar a imagem à largura da página A4
    const ratio = pdfWidth / imgWidthInMm;
    const scaledWidth = imgWidthInMm * ratio;
    const scaledHeight = imgHeightInMm * ratio;

    // Ajustar o posicionamento
    const xOffset = 0;
    const yOffset = 10;

    // Criar o PDF
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Adicionar a imagem ao PDF
    doc.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight);

    // Gerar o nome do arquivo
    const fileName = `Relatorio_CA - ${unitName}_${formattedStartDate}_a_${formattedEndDate}.pdf`;

    // Baixar o PDF
    doc.save(fileName);
}