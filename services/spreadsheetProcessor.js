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
    const colL = (row.L || "").toString().trim();
    const colLLower = colL.toLowerCase();
    const colK = (row.K || "").toString().toLowerCase();
    
    // Regra 1: Células vazias (sem fonte definida)
    if (trafficSources.empty && colL === "") {
        return true;
    }
    
    // Regra 2: Células com "..."
    if (trafficSources.dots && colL === "...") {
        return true;
    }
    
    // Regra 3: Fontes de tráfego padrão (coluna L)
    const platforms = [];
    if (trafficSources.facebook) platforms.push("facebook");
    if (trafficSources.instagram) platforms.push("instagram");
    if (trafficSources.google) platforms.push("google");
    if (trafficSources.revista) platforms.push("revista");
    
    const matchesPlatform = platforms.some(platform => 
        colLLower.includes(platform)
    );
    
    // Regra 4: "Outros" + palavras-chave personalizadas
    let matchesCustom = false;
    if (customKeywords && customKeywords.enabled && colLLower.includes("outros")) {
        matchesCustom = customKeywords.terms.some(term => 
            colK.includes(term.toLowerCase())
        );
    }
    
    return matchesPlatform || matchesCustom;
}

/**
 * Verificar se linha é SOMENTE manutenção ortodôntica (para exclusão)
 * Exclui apenas se for SOMENTE manutenção, sem outros procedimentos
 */
function isMaintenanceProcedure(row) {
    const colH = (row.H || "").toString().trim();
    const colHLower = colH.toLowerCase();
    
    const maintenanceTerms = [
        "manutenção aparelho móvel",
        "manutenção aparelho ortodôntico autoligado",
        "manutenção aparelho ortodôntico safira",
        "manutenção ortodôntica mensal",
        "manutenção ortodôntica"
    ];
    
    // Verificar se contém algum termo de manutenção
    const hasMaintenance = maintenanceTerms.some(term => colHLower.includes(term));
    
    if (!hasMaintenance) {
        return false; // Não tem manutenção, não excluir
    }
    
    // Verificar se tem vírgula (múltiplos procedimentos)
    if (colH.includes(',')) {
        return false; // Tem outros procedimentos junto, não excluir
    }
    
    // Verificar se o texto é exatamente igual a algum termo de manutenção (sem outros textos)
    const isOnlyMaintenance = maintenanceTerms.some(term => {
        // Remove espaços extras e compara
        const cleanedH = colHLower.replace(/\s+/g, ' ').trim();
        const cleanedTerm = term.replace(/\s+/g, ' ').trim();
        return cleanedH === cleanedTerm;
    });
    
    return isOnlyMaintenance;
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
                
                const rawData = []; // Apenas tráfego (para métricas)
                const allData = []; // Todos orçamentos (para análise de gaps)
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
                    
                    // Extrair valor da coluna J
                    let value = 0;
                    if (row.J) {
                        if (typeof row.J === 'number') {
                            value = row.J;
                        } else {
                            const valueStr = row.J.toString()
                                .replace(/\./g, '')
                                .replace(',', '.');
                            value = parseFloat(valueStr) || 0;
                        }
                    }
                    
                    const rowData = {
                        date: dateStr,
                        status: (row.C || "").toString().toUpperCase().trim(),
                        value: value,
                        source: (row.L || "").toString().trim(),
                        observations: (row.K || "").toString().trim(),
                        procedure: (row.H || "").toString().trim()
                    };
                    
                    // Adicionar em allData (TODOS os orçamentos)
                    allData.push(rowData);
                    
                    // Verificar se atende regras de tráfego (para rawData)
                    if (matchesTrafficRules(row, trafficSources, customKeywords)) {
                        // Excluir manutenções se opção estiver ativada
                        if (excludeMaintenance && isMaintenanceProcedure(row)) {
                            console.log('🚫 Excluindo manutenção:', row.H);
                            return;
                        }
                        
                        rawData.push(rowData);
                    }
                });
                
                const result = {
                    fileName: file.name,
                    rawData: rawData, // Apenas tráfego
                    allData: allData, // Todos orçamentos
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
 * Mesclar dados novos com existentes
 * Regra: Se a data já existe, SUBSTITUI. Se não existe, ADICIONA.
 */
export function mergeSpreadsheetData(existingData, newData) {
    console.log('🔄 [mergeSpreadsheetData] Iniciando mesclagem...');
    console.log('📊 Dados existentes:', existingData?.rawData?.length || 0, 'linhas de tráfego');
    console.log('📊 Dados novos:', newData?.rawData?.length || 0, 'linhas de tráfego');
    
    // Se não tem dados existentes, retorna os novos
    if (!existingData || !existingData.rawData || existingData.rawData.length === 0) {
        console.log('✅ Sem dados existentes, usando dados novos');
        return newData;
    }
    
    // Se não tem dados novos, retorna os existentes
    if (!newData || !newData.rawData || newData.rawData.length === 0) {
        console.log('⚠️ Sem dados novos, mantendo existentes');
        return existingData;
    }
    
    // ========== MESCLAR rawData (apenas tráfego) ==========
    const existingMap = new Map();
    existingData.rawData.forEach(item => {
        const key = `${item.date}_${item.status}_${item.value}`;
        existingMap.set(key, item);
    });
    
    const mergedRawData = [...existingData.rawData];
    let addedCount = 0;
    let updatedCount = 0;
    
    newData.rawData.forEach(newItem => {
        const key = `${newItem.date}_${newItem.status}_${newItem.value}`;
        
        if (existingMap.has(key)) {
            return;
        }
        
        const existingIndex = mergedRawData.findIndex(item => item.date === newItem.date);
        
        if (existingIndex >= 0) {
            mergedRawData[existingIndex] = newItem;
            updatedCount++;
        } else {
            mergedRawData.push(newItem);
            addedCount++;
        }
    });
    
    mergedRawData.sort((a, b) => a.date.localeCompare(b.date));
    
    // ========== MESCLAR allData (todos orçamentos) ==========
    const existingAllMap = new Map();
    (existingData.allData || []).forEach(item => {
        const key = `${item.date}_${item.status}_${item.value}_${item.source}`;
        existingAllMap.set(key, item);
    });
    
    const mergedAllData = [...(existingData.allData || [])];
    
    (newData.allData || []).forEach(newItem => {
        const key = `${newItem.date}_${newItem.status}_${newItem.value}_${newItem.source}`;
        
        if (existingAllMap.has(key)) {
            return;
        }
        
        const existingIndex = mergedAllData.findIndex(item => 
            item.date === newItem.date && 
            item.status === newItem.status && 
            item.value === newItem.value &&
            item.source === newItem.source
        );
        
        if (existingIndex >= 0) {
            mergedAllData[existingIndex] = newItem;
        } else {
            mergedAllData.push(newItem);
        }
    });
    
    mergedAllData.sort((a, b) => a.date.localeCompare(b.date));
    
    // ========== RECALCULAR ESTATÍSTICAS ==========
    const minDate = mergedRawData.reduce((min, item) => 
        !min || item.date < min ? item.date : min, null);
    const maxDate = mergedRawData.reduce((max, item) => 
        !max || item.date > max ? item.date : max, null);
    
    const totalBudgets = mergedRawData.length;
    const totalSales = mergedRawData.filter(r => r.status === "APPROVED").length;
    const totalRevenue = mergedRawData
        .filter(r => r.status === "APPROVED")
        .reduce((sum, r) => sum + r.value, 0);
    
    console.log(`✅ Mesclagem concluída:`);
    console.log(`   📊 Tráfego: ${mergedRawData.length} linhas`);
    console.log(`   📊 Total geral: ${mergedAllData.length} linhas`);
    console.log(`   ➕ Adicionadas: ${addedCount}`);
    console.log(`   🔄 Atualizadas: ${updatedCount}`);
    console.log(`   📅 Período: ${minDate} a ${maxDate}`);
    
    return {
        fileName: newData.fileName,
        rawData: mergedRawData,
        allData: mergedAllData,
        periodStart: minDate,
        periodEnd: maxDate,
        totalBudgets: totalBudgets,
        totalSales: totalSales,
        totalRevenue: totalRevenue,
        uploadedAt: new Date().toISOString()
    };
}

/**
 * Heurística: planilha no layout Clinicorp (colunas A–L, data em B, status em C, fonte em L).
 * Retorna 'clinicorp' | 'sistema_oc' | 'unknown' (unknown = poucas linhas válidas ou ambíguo).
 */
export function detectSpreadsheetCrmFormatFromArrayBuffer(arrayBuffer) {
    try {
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
        if (!rows || rows.length < 2) return 'unknown';

        const row0 = rows[0] || {};
        const headerBlob = Object.keys(row0)
            .map((k) => String(row0[k] ?? ''))
            .join(' ')
            .toLowerCase();
        if (/sistema\s*oc|planilha\s*oc|exporta(c|ç)(a|ã)o\s*oc/.test(headerBlob)) {
            return 'sistema_oc';
        }
        if (/clinicorp/.test(headerBlob)) {
            return 'clinicorp';
        }

        const statusRe = /^(APPROVED|REPROVED|REJECTED|PENDING|PENDENTE|APROVAD|REPROVAD|CANCELAD|CONVERTID|OPEN|CLOSED|ORÇAMENTO|ORCAMENTO|PROPOSTA)/i;

        function isLikelyClinicorpStatus(c) {
            const s = (c || '').toString().trim();
            if (!s) return false;
            if (statusRe.test(s)) return true;
            if (s.length > 35) return false;
            return /^[A-Z0-9_\s\-À-ú]+$/i.test(s);
        }

        function isLikelyTrafficCell(Lraw) {
            const L = (Lraw || '').toString().trim().toLowerCase();
            if (L === '' || L === '...' || L === '—' || L === '-') return true;
            const keys = [
                'facebook',
                'instagram',
                'google',
                'revista',
                'outros',
                'indicação',
                'indicacao',
                'orgânico',
                'organico',
                'tráfego',
                'trafego',
                'pago',
                'ads',
                'meta ',
                ' bonific',
                'parceiro'
            ];
            return keys.some((k) => L.includes(k));
        }

        let validDateRows = 0;
        let clinicorpLike = 0;
        const maxScan = Math.min(rows.length, 80);
        for (let i = 1; i < maxScan; i++) {
            const row = rows[i];
            const d = parseDate(row.B);
            if (!d || isNaN(d.getTime())) continue;
            validDateRows++;
            if (isLikelyClinicorpStatus(row.C) && isLikelyTrafficCell(row.L)) {
                clinicorpLike++;
            }
        }

        if (validDateRows < 4) return 'unknown';
        const ratio = clinicorpLike / validDateRows;
        if (ratio >= 0.55) return 'clinicorp';
        return 'sistema_oc';
    } catch (e) {
        console.warn('[detectSpreadsheetCrmFormatFromArrayBuffer]', e);
        return 'unknown';
    }
}

/**
 * Garante que o arquivo parece ser do mesmo CRM configurado na unidade.
 * @param {File} file
 * @param {'clinicorp'|'sistema_oc'} expectedCrm
 */
export async function assertSpreadsheetMatchesUnitCrm(file, expectedCrm) {
    const buf = await file.arrayBuffer();
    const detected = detectSpreadsheetCrmFormatFromArrayBuffer(buf);

    const msgOcInClinicorp =
        'Esta planilha não foi importada porque parece ser do Sistema OC (layout diferente do Clinicorp).\n\n' +
        'Altere o CRM da unidade para Sistema OC e salve, ou use uma planilha exportada no formato Clinicorp.';
    const msgClinicorpInOc =
        'Esta planilha não foi importada porque parece ser do Clinicorp (colunas A–L com fonte de tráfego na coluna L).\n\n' +
        'Altere o CRM da unidade para Clinicorp e salve, ou use uma planilha no formato Sistema OC.';
    const msgUnknown = (expected) =>
        `Não foi possível reconhecer esta planilha como formato ${expected === 'clinicorp' ? 'Clinicorp' : 'Sistema OC'}. ` +
        'Confira se exportou do CRM correto e tente novamente.';

    if (expectedCrm === 'clinicorp') {
        if (detected === 'sistema_oc') {
            throw new Error(msgOcInClinicorp);
        }
        if (detected === 'unknown') {
            throw new Error(msgUnknown('clinicorp'));
        }
        return;
    }

    if (expectedCrm === 'sistema_oc') {
        if (detected === 'clinicorp') {
            throw new Error(msgClinicorpInOc);
        }
        // 'unknown': ainda não há parser dedicado ao OC — não bloqueia para evitar falsos negativos
        return;
    }
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

