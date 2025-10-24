/**
 * XLSX.js Loader
 * Carrega a biblioteca SheetJS para processar planilhas Excel
 * Documentação: https://docs.sheetjs.com/
 */

// Importar XLSX.js via CDN
const script = document.createElement('script');
script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
script.async = false;
document.head.appendChild(script);

// Exportar quando carregar
export function waitForXLSX() {
  return new Promise((resolve) => {
    script.onload = () => {
      console.log('✅ XLSX.js carregado com sucesso');
      resolve(window.XLSX);
    };
  });
}

