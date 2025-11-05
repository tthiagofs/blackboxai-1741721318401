/**
 * Utilitário para gerar preview da capa de apresentações
 */

/**
 * Gerar preview da capa de uma apresentação
 * @param {string} html - HTML completo da apresentação
 * @returns {Promise<string>} - Base64 da preview da capa
 */
export async function generateCoverPreview(html) {
    return new Promise(async (resolve, reject) => {
        try {
            // Verificar se html2canvas está disponível
            if (typeof html2canvas === 'undefined') {
                console.warn('⚠️ html2canvas não disponível, pulando preview');
                resolve(null);
                return;
            }

            // Criar elemento temporário para renderizar apenas a capa
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '1920px'; // Largura padrão para slides
            tempContainer.style.backgroundColor = '#ffffff';
            document.body.appendChild(tempContainer);

            // Extrair apenas a primeira página (capa) do HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Encontrar a primeira página (capa)
            const firstPage = doc.querySelector('.page.slide.capa, .page.capa, .slide.capa');
            
            if (!firstPage) {
                console.warn('⚠️ Página de capa não encontrada no HTML');
                document.body.removeChild(tempContainer);
                resolve(null);
                return;
            }

            // Criar container com estilos necessários
            const pageContainer = document.createElement('div');
            pageContainer.innerHTML = firstPage.outerHTML;
            
            // Adicionar estilos da apresentação (pode haver múltiplos tags style)
            const styles = doc.querySelectorAll('style');
            styles.forEach(style => {
                const styleTag = document.createElement('style');
                styleTag.textContent = style.textContent;
                pageContainer.appendChild(styleTag);
            });

            // Adicionar estilos inline para garantir renderização correta
            pageContainer.style.position = 'relative';
            pageContainer.style.width = '1920px';
            pageContainer.style.height = '1080px';
            pageContainer.style.overflow = 'hidden';

            tempContainer.appendChild(pageContainer);

            // Aguardar um pouco para garantir que imagens carregaram
            await new Promise(resolve => setTimeout(resolve, 500));

            // Capturar apenas a capa com html2canvas
            const canvas = await html2canvas(pageContainer, {
                scale: 0.5, // Reduzir escala para preview menor
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 1920,
                height: 1080,
                windowWidth: 1920,
                windowHeight: 1080
            });

            // Converter para base64 (JPEG com qualidade 0.8 para reduzir tamanho)
            const previewData = canvas.toDataURL('image/jpeg', 0.8);

            // Limpar elemento temporário
            document.body.removeChild(tempContainer);

            console.log('✅ Preview da capa gerada com sucesso');
            resolve(previewData);

        } catch (error) {
            console.error('❌ Erro ao gerar preview da capa:', error);
            resolve(null); // Retornar null em caso de erro, não quebrar o fluxo
        }
    });
}

