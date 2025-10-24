/**
 * Spreadsheet Processor
 * Processa planilhas Excel e extrai dados de orçamentos
 */

/**
 * Converter data do Excel para JavaScript
 */
function excelDateToJSDate(excelDate) {
    // Excel armazena datas como número de dias desde 01/01/1900
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
}

/**
 * Parsear data de string DD/MM/YYYY
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    if (typeof dateStr === 'number') {
        return excelDateToJSDate(dateStr);
    }
    
    if (typeof dateStr === 'string') {
        // Formato DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return new Date(year, month - 1, day);
        }
    }
    
    return null;
}

/**
 * Verificar se linha atende regras de tráfego
 */
function matchesTrafficRules(row, trafficSources, customKeywords) {
    const colL = (row.L || "").toString().toLowerCase();
    const colK = (row.K || "").toString().toLowerCase();
    
    // Regra 1: Fontes de tráfego padrão (coluna L)
    const platforms = [];
    if (trafficSources.facebook) platforms.push("facebook");
    if (trafficSources.instagram) platforms.push("instagram");
    if (trafficSources.google) platforms.push("google");
    if (trafficSources.placa) platforms.push("placa");
    
    const matchesPlatform = platforms.some(platform => 
        colL.includes(platform)
    );
    
    // Regra 2: "Outros" + palavras-chave personalizadas
    let matchesCustom = false;
    if (customKeywords && customKeywords.enabled && colL.includes("outros")) {
        matchesCustom = customKeywords.terms.some(term => 
            colK.includes(term.toLowerCase())
        );
    }
    
    return matchesPlatform || matchesCustom;
}

/**
 * Verificar se linha é manutenção ortodôntica (para exclusão)
 */
function isMaintenanceProcedure(row) {
    const colH = (row.H || "").toString().toLowerCase();
    
    const maintenanceTerms = [
        "manutenção aparelho móvel",
        "manutenção aparelho ortodôntico autoligado",
        "manutenção aparelho ortodôntico safira",
        "manutenção ortodôntica mensal"
    ];
    
    return maintenanceTerms.some(term => colH.includes(term.toLowerCase()));
}

/**
 * Processar planilha Excel
 */
export async function processSpreadsheet(file, trafficSources, customKeywords, excludeMaintenance = false) {
    return new Promise((resolve, reject) => {
        console.log('📊 [processSpreadsheet] Iniciando processamento...');
        console.log('📋 Arquivo:', file.name);
        console.log('⚙️ Fontes de tráfego:', trafficSources);
        console.log('🔍 Palavras-chave:', customKeywords);
        console.log('🚫 Excluir manutenção:', excludeMaintenance);
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Pegar primeira aba
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // Converter para JSON (com cabeçalhos A, B, C...)
                const rows = XLSX.utils.sheet_to_json(sheet, {header: 'A'});
                
                console.log(`📄 ${rows.length} linhas encontradas`);
                
                const rawData = [];
                let minDate = null;
                let maxDate = null;
                
                // Processar cada linha (pular cabeçalho)
                rows.forEach((row, index) => {
                    if (index === 0) return; // Skip header
                    
                    // Extrair e validar data (coluna B)
                    const date = parseDate(row.B);
                    if (!date || isNaN(date.getTime())) return;
                    
                    const dateStr = date.toISOString().split('T')[0]; // "2025-10-17"
                    
                    // Atualizar período coberto
                    if (!minDate || date < minDate) minDate = date;
                    if (!maxDate || date > maxDate) maxDate = date;
                    
                    // Verificar se atende regras de tráfego
                    if (matchesTrafficRules(row, trafficSources, customKeywords)) {
                        // Excluir manutenções se opção estiver ativada
                        if (excludeMaintenance && isMaintenanceProcedure(row)) {
                            console.log('🚫 Excluindo manutenção:', row.H);
                            return;
                        }
                        
                        // Extrair valor da coluna J
                        // Pode estar como número direto do Excel ou string formatada
                        let value = 0;
                        if (row.J) {
                            if (typeof row.J === 'number') {
                                // Já é número (Excel)
                                value = row.J;
                            } else {
                                // É string: remover pontos (milhares) e trocar vírgula por ponto
                                const valueStr = row.J.toString()
                                    .replace(/\./g, '')  // Remove pontos (milhares)
                                    .replace(',', '.');  // Troca vírgula por ponto (decimal)
                                value = parseFloat(valueStr) || 0;
                            }
                        }
                        
                        rawData.push({
                            date: dateStr,
                            status: (row.C || "").toString().toUpperCase().trim(),
                            value: value,
                            source: (row.L || "").toString().trim(),
                            observations: (row.K || "").toString().trim(),
                            procedure: (row.H || "").toString().trim()
                        });
                    }
                });
                
                const result = {
                    fileName: file.name,
                    rawData: rawData,
                    periodStart: minDate ? minDate.toISOString().split('T')[0] : null,
                    periodEnd: maxDate ? maxDate.toISOString().split('T')[0] : null,
                    totalBudgets: rawData.length,
                    totalSales: rawData.filter(r => r.status === "APPROVED").length,
                    totalRevenue: rawData.filter(r => r.status === "APPROVED")
                                         .reduce((sum, r) => sum + r.value, 0),
                    uploadedAt: new Date().toISOString()
                };
                
                console.log('✅ [processSpreadsheet] Processamento concluído');
                console.log(`📋 ${result.totalBudgets} orçamentos`);
                console.log(`✅ ${result.totalSales} vendas`);
                console.log(`💰 R$ ${result.totalRevenue.toFixed(2)}`);
                console.log(`📅 Período: ${result.periodStart} a ${result.periodEnd}`);
                
                resolve(result);
            } catch (error) {
                console.error('❌ [processSpreadsheet] Erro ao processar:', error);
                reject(error);
            }
        };
        
        reader.onerror = (error) => {
            console.error('❌ [processSpreadsheet] Erro ao ler arquivo:', error);
            reject(error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Validar formato da planilha
 */
export function validateSpreadsheet(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
        throw new Error('Formato inválido. Use arquivos .xlsx ou .xls');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new Error('Arquivo muito grande. Tamanho máximo: 10MB');
    }
    
    return true;
}

