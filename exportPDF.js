const { jsPDF } = window.jspdf;

async function exportToPDF() {
    const reportContainer = window.currentReport?.container;
    if (!reportContainer) {
        alert('Nenhum relatório disponível para exportar.');
        return;
    }

    try {
        const canvas = await html2canvas(reportContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: reportContainer.scrollWidth,
            windowHeight: reportContainer.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 190;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 10;

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight + 10;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const startDate = window.currentReport.startDate;
        const endDate = window.currentReport.endDate;
        const includeMonthly = window.currentReport.includeMonthly;
        const monthlyMonth = window.currentReport.monthlyMonth;
        const monthlyYear = window.currentReport.monthlyYear;

        let fileName = `Relatorio_${startDate}_a_${endDate}.pdf`;
        if (includeMonthly && monthlyMonth && monthlyYear) {
            const monthName = {
                '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
                '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
                '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
            }[monthlyMonth];
            fileName = `Relatorio_Completo_e_Mensal_${monthName}_${monthlyYear}.pdf`;
        }

        pdf.save(fileName);
    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        alert('Erro ao gerar o PDF. Tente novamente.');
    }
}