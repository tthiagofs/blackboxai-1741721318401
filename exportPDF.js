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

    // Identificar as seções principais do relatório
    const sections = [];
    
    // 1. Header (logo + título)
    const header = reportElement.querySelector('.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-6.mb-6');
    if (header) sections.push(header);
    
    // 2. Conteúdo do relatório (todas as seções dentro do bg-white principal)
    const mainContent = reportElement.querySelector('.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-6:not(.mb-6)');
    if (mainContent) {
        // Pegar todas as seções filhas diretas
        const children = Array.from(mainContent.children);
        children.forEach(child => {
            // Cada seção (Meta Ads White, Black, Google, Total Leads, Anúncios, Resultados, Análise)
            if (child.classList.contains('bg-blue-600') || 
                child.classList.contains('bg-gray-900') || 
                child.classList.contains('bg-red-600') ||
                child.classList.contains('bg-gradient-to-r') || // Incluir gradientes (Total de Leads)
                child.classList.contains('mt-6') ||
                child.tagName === 'P') {
                sections.push(child);
            }
        });
    }

    // Criar o PDF
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const usableWidth = pdfWidth - (margin * 2);
    const usableHeight = pdfHeight - (margin * 2);
    
    let currentY = margin;
    let currentPage = 1;

    // Processar cada seção
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        // Capturar a seção como imagem
        const canvas = await html2canvas(section, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Calcular dimensões para o PDF mantendo a proporção
        const ratio = usableWidth / (imgWidth * 0.264583); // 0.264583 mm per pixel at 96 DPI
        const scaledWidth = usableWidth;
        const scaledHeight = (imgHeight * 0.264583) * ratio;

        // Verificar se a seção cabe na página atual
        if (currentY + scaledHeight > pdfHeight - margin) {
            // Não cabe, criar nova página
            doc.addPage();
            currentPage++;
            currentY = margin;
        }

        // Adicionar a imagem na posição atual
        doc.addImage(imgData, 'PNG', margin, currentY, scaledWidth, scaledHeight);
        
        // Atualizar a posição Y para a próxima seção
        currentY += scaledHeight + 5; // 5mm de espaçamento entre seções
    }

    // Restaurar o botão "Exportar para PDF"
    if (exportButton) {
        exportButton.style.display = 'block';
    }

    // Gerar o nome do arquivo (apenas o nome da conta)
    const fileName = `${unitName}.pdf`;

    // Baixar o PDF
    doc.save(fileName);
}
