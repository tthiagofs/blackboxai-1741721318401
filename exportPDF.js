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
    const reportElement = document.querySelector('#reportContainer .max-w-4xl') || 
                          document.querySelector('#reportContainer .bg-white');
    if (!reportElement) {
        alert('Não foi possível encontrar o relatório para exportar. Por favor, gere o relatório primeiro.');
        return;
    }

    // Esconder o botão "Exportar para PDF" durante a captura
    const exportButton = reportElement.querySelector('#exportPDFBtn');
    if (exportButton) {
        exportButton.style.display = 'none';
    }

    // Capturar o relatório como imagem usando html2canvas
    const canvas = await html2canvas(reportElement, {
        scale: 2, // Aumentar a resolução para melhor qualidade
        useCORS: true, // Permitir carregar imagens externas (como as dos anúncios)
        logging: false,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight
    });

    // Restaurar o botão "Exportar para PDF"
    if (exportButton) {
        exportButton.style.display = 'block';
    }

    // Obter a imagem como data URL
    const imgData = canvas.toDataURL('image/png');

    // Dimensões da página A4 em mm (210mm x 297mm)
    const pdfWidth = 210;
    const pdfHeight = 297;
    
    // Margens
    const marginTop = 10;
    const marginBottom = 10;
    const usableHeight = pdfHeight - marginTop - marginBottom;

    // Converter dimensões de pixels para mm
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Calcular a escala para ajustar à largura da página
    const scale = pdfWidth / (imgWidth * 0.264583); // 0.264583 mm per pixel at 96 DPI
    const scaledWidth = pdfWidth;
    const scaledHeight = (imgHeight * 0.264583) * (pdfWidth / (imgWidth * 0.264583));

    // Criar o PDF
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Se o conteúdo cabe em uma página
    if (scaledHeight <= usableHeight) {
        doc.addImage(imgData, 'PNG', 0, marginTop, scaledWidth, scaledHeight);
    } else {
        // Conteúdo precisa de múltiplas páginas
        let heightLeft = scaledHeight;
        let position = 0;
        let pageNumber = 0;

        while (heightLeft > 0) {
            if (pageNumber > 0) {
                doc.addPage();
            }

            // Calcular quanto da imagem vai nesta página
            const pageHeight = Math.min(usableHeight, heightLeft);
            
            // Recortar a parte da imagem para esta página
            const sourceY = position * (imgHeight / scaledHeight);
            const sourceHeight = pageHeight * (imgHeight / scaledHeight);
            
            // Criar canvas temporário para a seção atual
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgWidth;
            tempCanvas.height = sourceHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Desenhar a seção da imagem
            tempCtx.drawImage(
                canvas,
                0, sourceY,           // Posição de origem
                imgWidth, sourceHeight,  // Tamanho de origem
                0, 0,                 // Posição de destino
                imgWidth, sourceHeight   // Tamanho de destino
            );
            
            // Adicionar ao PDF
            const sectionData = tempCanvas.toDataURL('image/png');
            doc.addImage(sectionData, 'PNG', 0, marginTop, scaledWidth, pageHeight);

            heightLeft -= usableHeight;
            position += usableHeight;
            pageNumber++;
        }
    }

    // Gerar o nome do arquivo
    const fileName = `${unitName}_${formattedStartDate.replace(/\//g, '-')}_${formattedEndDate.replace(/\//g, '-')}.pdf`;

    // Baixar o PDF
    doc.save(fileName);
}
