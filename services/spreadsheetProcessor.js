/**
 * Spreadsheet Processor
 * Clinicorp (C = status) e Sistema OC (C = Paciente)
 */

function excelDateToJSDate(excelDate) {
    const d = new Date((excelDate - 25569) * 86400 * 1000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Data civil local em YYYY-MM-DD (evita deslocar dia com toISOString/UTC). */
export function formatLocalDateYmd(date) {
    if (!date || isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
    if (!dateStr) return null;

    if (typeof dateStr === 'number') {
        return excelDateToJSDate(dateStr);
    }

    if (typeof dateStr === 'string') {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return new Date(year, month - 1, day);
        }
    }

    return null;
}

/** Normaliza texto de cabeçalho (trim, minúsculas, espaços). */
function normalizeHeaderLabel(text) {
    return (text ?? '')
        .toString()
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function parseMoney(cell) {
    if (cell === undefined || cell === null || cell === '') return 0;
    if (typeof cell === 'number') return cell;
    const valueStr = cell.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(valueStr) || 0;
}

function readRowsFromArrayBuffer(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 'A' });
}

/**
 * Identifica o CRM da planilha pelo cabeçalho da coluna C (linha 1).
 * @returns {'clinicorp'|'sistema_oc'|null}
 */
export function detectSpreadsheetTypeFromRows(rows) {
    if (!rows || rows.length === 0) return null;
    const headerC = normalizeHeaderLabel(rows[0]?.C);
    if (headerC === 'status') return 'clinicorp';
    if (headerC === 'paciente') return 'sistema_oc';
    return null;
}

export async function detectSpreadsheetType(file) {
    const buf = await file.arrayBuffer();
    const rows = readRowsFromArrayBuffer(buf);
    return detectSpreadsheetTypeFromRows(rows);
}

/**
 * @param {'clinicorp'|'sistema_oc'} fileType
 * @param {'clinicorp'|'sistema_oc'} unitCrm
 */
export function assertSpreadsheetMatchesUnitCrm(fileType, unitCrm) {
    const unit = unitCrm === 'sistema_oc' ? 'sistema_oc' : 'clinicorp';

    if (!fileType) {
        throw new Error(
            'Planilha não reconhecida.\n\n' +
                'A coluna C da primeira linha deve ser "status" (exportação Clinicorp) ou "Paciente" (exportação Sistema OC).'
        );
    }

    if (fileType === 'clinicorp' && unit === 'sistema_oc') {
        throw new Error(
            'Esta planilha é do Clinicorp (coluna C = status).\n\n' +
                'A unidade está configurada como Sistema OC. Altere o CRM da unidade e salve, ou envie a planilha do Sistema OC (coluna C = Paciente).'
        );
    }

    if (fileType === 'sistema_oc' && unit === 'clinicorp') {
        throw new Error(
            'Esta planilha é do Sistema OC (coluna C = Paciente).\n\n' +
                'A unidade está configurada como Clinicorp. Altere o CRM da unidade e salve, ou envie a planilha Clinicorp (coluna C = status).'
        );
    }
}

function matchesTrafficRules(row, trafficSources, customKeywords) {
    const colL = (row.L || '').toString().trim();
    const colLLower = colL.toLowerCase();
    const colK = (row.K || '').toString().toLowerCase();

    if (trafficSources.empty && colL === '') {
        return true;
    }

    if (trafficSources.dots && colL === '...') {
        return true;
    }

    const platforms = [];
    if (trafficSources.facebook) platforms.push('facebook');
    if (trafficSources.instagram) platforms.push('instagram');
    if (trafficSources.google) platforms.push('google');
    if (trafficSources.revista) platforms.push('revista');

    const matchesPlatform = platforms.some((platform) => colLLower.includes(platform));

    let matchesCustom = false;
    if (customKeywords && customKeywords.enabled && colLLower.includes('outros')) {
        matchesCustom = customKeywords.terms.some((term) => colK.includes(term.toLowerCase()));
    }

    return matchesPlatform || matchesCustom;
}

function isMaintenanceProcedure(row) {
    const colH = (row.H || '').toString().trim();
    const colHLower = colH.toLowerCase();

    const maintenanceTerms = [
        'manutenção aparelho móvel',
        'manutenção aparelho ortodôntico autoligado',
        'manutenção aparelho ortodôntico safira',
        'manutenção ortodôntica mensal',
        'manutenção ortodôntica'
    ];

    const hasMaintenance = maintenanceTerms.some((term) => colHLower.includes(term));

    if (!hasMaintenance) {
        return false;
    }

    if (colH.includes(',')) {
        return false;
    }

    return maintenanceTerms.some((term) => {
        const cleanedH = colHLower.replace(/\s+/g, ' ').trim();
        const cleanedTerm = term.replace(/\s+/g, ' ').trim();
        return cleanedH === cleanedTerm;
    });
}

function buildBudgetResult(fileName, rawData, allData) {
    const dates = allData.map((r) => r.date).filter(Boolean);
    const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    const result = {
        fileName,
        rawData,
        allData,
        periodStart: minDate,
        periodEnd: maxDate,
        totalBudgets: rawData.length,
        totalSales: rawData.filter((r) => r.status === 'APPROVED').length,
        totalRevenue: rawData
            .filter((r) => r.status === 'APPROVED')
            .reduce((sum, r) => sum + Number(r.value || 0), 0),
        uploadedAt: new Date().toISOString()
    };

    console.log('✅ Processamento concluído');
    console.log(`📋 ${result.totalBudgets} orçamentos (tráfego)`);
    console.log(`📋 ${result.allData.length} orçamentos (total na planilha)`);
    console.log(`✅ ${result.totalSales} vendas`);
    console.log(`💰 R$ ${result.totalRevenue.toFixed(2)}`);
    console.log(`📅 Período: ${result.periodStart} a ${result.periodEnd}`);

    return result;
}

/** Clinicorp: data B, status C, valor J, fonte L, procedimento H, observações K */
function processClinicorpRows(rows, fileName, trafficSources, customKeywords, excludeMaintenance) {
    const rawData = [];
    const allData = [];

    rows.forEach((row, index) => {
        if (index === 0) return;

        const date = parseDate(row.B);
        if (!date || isNaN(date.getTime())) return;

        const dateStr = formatLocalDateYmd(date);
        const value = parseMoney(row.J);

        const rowData = {
            date: dateStr,
            status: (row.C || '').toString().toUpperCase().trim(),
            value,
            source: (row.L || '').toString().trim(),
            observations: (row.K || '').toString().trim(),
            procedure: (row.H || '').toString().trim()
        };

        allData.push(rowData);

        if (matchesTrafficRules(row, trafficSources, customKeywords)) {
            if (excludeMaintenance && isMaintenanceProcedure(row)) {
                return;
            }
            rawData.push(rowData);
        }
    });

    if (allData.length === 0) {
        throw new Error(
            'Nenhum orçamento encontrado na planilha Clinicorp.\n\n' +
                'Confira se a coluna B tem datas no formato DD/MM/AAAA.'
        );
    }

    return buildBudgetResult(fileName, rawData, allData);
}

/** Sistema OC: data orçamento A, aprovação B, valor aprovado E, fonte I, procedimento J */
function ocRowIsSold(row) {
    const b = row.B;
    if (b === undefined || b === null) return false;
    if (typeof b === 'string' && b.trim() === '') return false;
    return true;
}

function processSistemaOcRows(rows, fileName, trafficSources, customKeywords, excludeMaintenance) {
    const rawData = [];
    const allData = [];

    rows.forEach((row, index) => {
        if (index === 0) return;

        const date = parseDate(row.A);
        if (!date || isNaN(date.getTime())) return;

        const dateStr = formatLocalDateYmd(date);
        const sold = ocRowIsSold(row);
        const status = sold ? 'APPROVED' : 'OPEN';
        const value = sold ? parseMoney(row.E) : 0;
        const source = (row.I || '').toString().trim();
        const procedure = (row.J || '').toString().trim();

        const rowData = {
            date: dateStr,
            status,
            value,
            source,
            observations: '',
            procedure
        };

        allData.push(rowData);

        const filterShape = { L: source, K: '', H: procedure };
        if (matchesTrafficRules(filterShape, trafficSources, customKeywords)) {
            if (excludeMaintenance && isMaintenanceProcedure(filterShape)) {
                return;
            }
            rawData.push(rowData);
        }
    });

    if (allData.length === 0) {
        throw new Error(
            'Nenhum orçamento encontrado na planilha Sistema OC.\n\n' +
                'Confira se a coluna A (Data Orçamento) tem datas no formato DD/MM/AAAA.'
        );
    }

    return buildBudgetResult(fileName, rawData, allData);
}

/**
 * Processar planilha Excel (detecta tipo, valida CRM da unidade, processa).
 * @param {File} file
 * @param {object} trafficSources
 * @param {object} customKeywords
 * @param {boolean} excludeMaintenance
 * @param {'clinicorp'|'sistema_oc'} unitCrmSource CRM salvo na unidade
 */
export async function processSpreadsheet(
    file,
    trafficSources,
    customKeywords,
    excludeMaintenance = false,
    unitCrmSource = 'clinicorp'
) {
    return new Promise((resolve, reject) => {
        console.log('📊 [processSpreadsheet] Iniciando...');
        console.log('📋 Arquivo:', file.name);
        console.log('🏷️ CRM da unidade:', unitCrmSource);

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const rows = readRowsFromArrayBuffer(e.target.result);
                console.log(`📄 ${rows.length} linhas na planilha`);

                const fileType = detectSpreadsheetTypeFromRows(rows);
                console.log('🔍 Tipo detectado (coluna C):', fileType);

                assertSpreadsheetMatchesUnitCrm(fileType, unitCrmSource);

                const unitCrm = unitCrmSource === 'sistema_oc' ? 'sistema_oc' : 'clinicorp';
                const ocCrm = unitCrm === 'sistema_oc';
                const keywords = ocCrm ? { enabled: false, terms: [] } : customKeywords;

                const result =
                    fileType === 'clinicorp'
                        ? processClinicorpRows(rows, file.name, trafficSources, keywords, excludeMaintenance)
                        : processSistemaOcRows(rows, file.name, trafficSources, keywords, excludeMaintenance);

                resolve(result);
            } catch (error) {
                console.error('❌ [processSpreadsheet] Erro:', error);
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
 */
export function mergeSpreadsheetData(existingData, newData) {
    console.log('🔄 [mergeSpreadsheetData] Iniciando mesclagem...');
    console.log('📊 Dados existentes:', existingData?.rawData?.length || 0, 'linhas de tráfego');
    console.log('📊 Dados novos:', newData?.rawData?.length || 0, 'linhas de tráfego');

    if (!existingData || !existingData.rawData || existingData.rawData.length === 0) {
        console.log('✅ Sem dados existentes, usando dados novos');
        return newData;
    }

    if (!newData || !newData.rawData || newData.rawData.length === 0) {
        console.log('⚠️ Sem dados novos de tráfego, mantendo existentes');
        return existingData;
    }

    const existingMap = new Map();
    existingData.rawData.forEach((item) => {
        const key = `${item.date}_${item.status}_${item.value}`;
        existingMap.set(key, item);
    });

    const mergedRawData = [...existingData.rawData];
    let addedCount = 0;
    let updatedCount = 0;

    newData.rawData.forEach((newItem) => {
        const key = `${newItem.date}_${newItem.status}_${newItem.value}`;

        if (existingMap.has(key)) {
            return;
        }

        const existingIndex = mergedRawData.findIndex((item) => item.date === newItem.date);

        if (existingIndex >= 0) {
            mergedRawData[existingIndex] = newItem;
            updatedCount++;
        } else {
            mergedRawData.push(newItem);
            addedCount++;
        }
    });

    mergedRawData.sort((a, b) => a.date.localeCompare(b.date));

    const existingAllMap = new Map();
    (existingData.allData || []).forEach((item) => {
        const key = `${item.date}_${item.status}_${item.value}_${item.source}`;
        existingAllMap.set(key, item);
    });

    const mergedAllData = [...(existingData.allData || [])];

    (newData.allData || []).forEach((newItem) => {
        const key = `${newItem.date}_${newItem.status}_${newItem.value}_${newItem.source}`;

        if (existingAllMap.has(key)) {
            return;
        }

        const existingIndex = mergedAllData.findIndex(
            (item) =>
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

    const minDate = mergedRawData.reduce((min, item) => (!min || item.date < min ? item.date : min), null);
    const maxDate = mergedRawData.reduce((max, item) => (!max || item.date > max ? item.date : max), null);

    const totalBudgets = mergedRawData.length;
    const totalSales = mergedRawData.filter((r) => r.status === 'APPROVED').length;
    const totalRevenue = mergedRawData
        .filter((r) => r.status === 'APPROVED')
        .reduce((sum, r) => sum + Number(r.value || 0), 0);

    console.log('✅ Mesclagem concluída:');
    console.log(`   📊 Tráfego: ${mergedRawData.length} linhas`);
    console.log(`   📊 Total geral: ${mergedAllData.length} linhas`);

    return {
        fileName: newData.fileName,
        rawData: mergedRawData,
        allData: mergedAllData,
        periodStart: minDate,
        periodEnd: maxDate,
        totalBudgets,
        totalSales,
        totalRevenue,
        uploadedAt: new Date().toISOString()
    };
}

export function validateSpreadsheet(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();

    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
        throw new Error('Formato inválido. Use arquivos .xlsx ou .xls');
    }

    if (file.size > 10 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Tamanho máximo: 10MB');
    }

    return true;
}
