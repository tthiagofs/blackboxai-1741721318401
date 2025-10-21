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

    // Esconder o botão "Exportar para PDF" durante a captura
    const exportButton = reportElement.querySelector('#exportPDFBtn');
    if (exportButton) {
        exportButton.style.display = 'none';
    }

    // Ajustar o layout para exibir métricas lado a lado como no site
    const campaignSections = reportElement.querySelectorAll('.campaign-section');
    campaignSections.forEach(section => {
        const metricCards = section.querySelectorAll('.metric-card');
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-1 md:grid-cols-4 gap-4';
        metricCards.forEach(card => gridContainer.appendChild(card));
        section.innerHTML = '';
        section.appendChild(gridContainer);
    });

    // Capturar o relatório como imagem usando html2canvas
    const canvas = await html2canvas(reportElement, {
        scale: 2, // Aumentar a resolução para melhor qualidade
        useCORS: true, // Permitir carregar imagens externas (como as dos anúncios)
        logging: true, // Para depuração, pode desativar depois
    });

    // Restaurar o layout original após a captura
    campaignSections.forEach(section => {
        const metricCards = section.querySelectorAll('.metric-card');
        section.innerHTML = '';
        metricCards.forEach(card => section.appendChild(card));
    });

    // Restaurar o botão "Exportar para PDF"
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
    const xOffset = 0; // Alinhar à esquerda (0 mm de margem à esquerda)
    const yOffset = 10; // Começar a 10 mm do topo da página (margem superior mínima)

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