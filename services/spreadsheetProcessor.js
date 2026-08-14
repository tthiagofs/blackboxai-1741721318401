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
    if (dateStr === undefined || dateStr === null || dateStr === '') return null;

    if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? null : dateStr;
    }

    if (typeof dateStr === 'number') {
        // Serial Excel plausível (~2010–2035); evita tratar IDs/números pequenos como data
        if (dateStr < 38000 || dateStr > 55000) return null;
        return excelDateToJSDate(dateStr);
    }

    if (typeof dateStr === 'string') {
        const cleaned = dateStr.trim().split(/\s+/)[0];
        const parts = cleaned.split(/[\/\-\.]/);
        if (parts.length === 3) {
            let [day, month, year] = parts;
            if (year.length === 2) year = `20${year}`;
            const d = parseInt(day, 10);
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
                return new Date(y, m - 1, d);
            }
        }
    }

    return null;
}

function daysBetweenYmd(ymd1, ymd2) {
    const a = new Date(`${ymd1}T12:00:00`);
    const b = new Date(`${ymd2}T12:00:00`);
    return Math.round(Math.abs(b - a) / 86400000);
}

/** Se a planilha importada concentra-se em um único mês civil (upload típico mensal). */
function getUniformImportMonth(budgetData) {
    const items = budgetData?.allData || budgetData?.rawData || [];
    const dates = items.map((r) => r.date).filter(Boolean);
    if (!dates.length) return null;

    const months = new Set(dates.map((d) => d.slice(0, 7)));
    if (months.size !== 1) return null;

    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    if (daysBetweenYmd(min, max) > 40) return null;

    return [...months][0];
}

function removeBudgetMonth(data, yyyyMm) {
    const drop = (items) => (items || []).filter((r) => (r.date || '').slice(0, 7) !== yyyyMm);
    return {
        ...data,
        rawData: drop(data.rawData),
        allData: drop(data.allData)
    };
}

/** Remove meses com pouquíssimos registros (datas espúrias de import antigo). */
function pruneSparseMonths(data, minRows, keepMonth) {
    const all = data.allData || data.rawData || [];
    const counts = {};
    for (const r of all) {
        const m = (r.date || '').slice(0, 7);
        if (!m) continue;
        counts[m] = (counts[m] || 0) + 1;
    }

    const monthsToRemove = Object.keys(counts).filter((m) => m !== keepMonth && counts[m] < minRows);
    if (!monthsToRemove.length) return data;

    const dropSet = new Set(monthsToRemove);
    const filt = (items) => (items || []).filter((r) => !dropSet.has((r.date || '').slice(0, 7)));

    console.log('🧹 Removendo meses esparsos (provável lixo de data):', monthsToRemove);

    return {
        ...data,
        rawData: filt(data.rawData),
        allData: filt(data.allData)
    };
}

function prepareExistingForMerge(existingData, newData) {
    const uniformMonth = getUniformImportMonth(newData);
    if (!uniformMonth) return existingData;

    let base = removeBudgetMonth(existingData, uniformMonth);
    base = pruneSparseMonths(base, 5, uniformMonth);

    const hasRaw = base.rawData && base.rawData.length > 0;
    const hasAll = base.allData && base.allData.length > 0;
    if (!hasRaw && !hasAll) return null;

    return base;
}

/**
 * Lacunas entre dias com orçamento (não preenche calendário dia a dia).
 * Só alerta quando há intervalo real sem dados entre dois blocos de datas.
 */
export function findSignificantMissingPeriods(dataToCheck, minGapDays = 5) {
    const dates = [...new Set((dataToCheck || []).map((i) => i.date).filter(Boolean))].sort();
    if (dates.length < 2) return [];

    const span = daysBetweenYmd(dates[0], dates[dates.length - 1]);
    if (span <= 45) return [];

    const periods = [];

    for (let i = 1; i < dates.length; i++) {
        const prev = new Date(`${dates[i - 1]}T12:00:00`);
        const curr = new Date(`${dates[i]}T12:00:00`);
        const gap = Math.round((curr - prev) / 86400000);

        if (gap <= minGapDays) continue;

        const gapStart = new Date(prev);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(curr);
        gapEnd.setDate(gapEnd.getDate() - 1);

        if (gapStart > gapEnd) continue;

        periods.push({
            start: formatLocalDateYmd(gapStart),
            end: formatLocalDateYmd(gapEnd)
        });
    }

    return periods.filter((period) => {
        const start = new Date(`${period.start}T12:00:00`);
        const end = new Date(`${period.end}T12:00:00`);
        const days = Math.round((end - start) / 86400000) + 1;
        return days >= minGapDays;
    });
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
    const s = cell.toString().trim();
    if (!s) return 0;
    // Formato BR: 1.234,56
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // Número simples (ex.: 1500 ou 1500.50)
    return parseFloat(s) || 0;
}

/** Ex.: orcamentos_2026-05-01_2026-05-31.xlsx → "2026-05" */
export function extractImportMonthFromFileName(fileName) {
    const m = (fileName || '').match(/orcamentos?_(\d{4})-(\d{2})-\d{2}_(\d{4})-(\d{2})/i);
    if (!m) return null;
    const startYm = `${m[1]}-${m[2]}`;
    const endYm = `${m[3]}-${m[4]}`;
    return startYm === endYm ? startYm : null;
}

/**
 * Data usada em filtros de período: venda → data de aprovação; orçamento em aberto → data do orçamento.
 */
export function getEffectiveRowDate(row) {
    if (!row) return null;
    if (row.status === 'APPROVED' && row.approvalDate) return row.approvalDate;
    return row.date || null;
}

function rowInImportMonth(row, yyyyMm) {
    if (!yyyyMm || !row) return false;
    if ((row.date || '').slice(0, 7) === yyyyMm) return true;
    if ((row.approvalDate || '').slice(0, 7) === yyyyMm) return true;
    return false;
}

function filterRowsByMonth(items, yyyyMm) {
    if (!yyyyMm || !items?.length) return items || [];
    return items.filter((r) => rowInImportMonth(r, yyyyMm));
}

function getDominantMonth(items) {
    const counts = {};
    for (const r of items || []) {
        for (const d of [r.date, r.approvalDate]) {
            if (!d) continue;
            const m = d.slice(0, 7);
            counts[m] = (counts[m] || 0) + 1;
        }
    }
    let best = null;
    let bestN = 0;
    for (const [m, n] of Object.entries(counts)) {
        if (n > bestN) {
            bestN = n;
            best = m;
        }
    }
    if (!best || bestN < (items?.length || 0) * 0.7) return null;
    return best;
}

function resolveImportMonth(fileName, items) {
    return extractImportMonthFromFileName(fileName) || getDominantMonth(items);
}

function readRowsFromArrayBuffer(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName =
        workbook.SheetNames.find((n) => normalizeHeaderLabel(n) === 'orcamentos') ||
        workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { header: 'A', raw: true, defval: '' });
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

/** Normaliza texto do canal (acentos, espaços especiais). */
export function normalizeTrafficSourceText(text) {
    return (text || '')
        .toString()
        .replace(/\u00a0/g, ' ')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/** Verifica se o canal da planilha corresponde à plataforma do filtro. */
export function sourceMatchesPlatform(sourceText, platform) {
    const s = normalizeTrafficSourceText(sourceText);
    if (!s) return false;

    switch (platform) {
        case 'facebook':
            return (
                s.includes('facebook') ||
                s.includes('face book') ||
                /\bfb\b/.test(s) ||
                /\bmeta\b/.test(s) ||
                s.includes('trafego face') ||
                s.includes('trafego pago face')
            );
        case 'instagram':
            return s.includes('instagram') || s.includes('insta') || /\binsta\b/.test(s);
        case 'google':
            return s.includes('google') || s.includes('adwords') || s.includes('google ads');
        case 'revista':
            return s.includes('revista') || s.includes('black');
        default:
            return false;
    }
}

export function matchesTrafficRules(row, trafficSources, customKeywords) {
    const colL = (row.source ?? row.L ?? '').toString().trim();
    const colLLower = normalizeTrafficSourceText(colL);
    const colK = normalizeTrafficSourceText(row.observations ?? row.K ?? '');

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

    const matchesPlatform = platforms.some((platform) => sourceMatchesPlatform(colL, platform));

    let matchesCustom = false;
    if (customKeywords && customKeywords.enabled && colLLower.includes('outros')) {
        matchesCustom = customKeywords.terms.some((term) =>
            colK.includes(normalizeTrafficSourceText(term))
        );
    }

    return matchesPlatform || matchesCustom;
}

const MAINTENANCE_TERMS = [
    'manutenção aparelho móvel',
    'manutenção aparelho ortodôntico autoligado',
    'manutenção aparelho ortodôntico safira',
    'manutenção ortodôntica mensal',
    'manutenção ortodôntica'
];

function isMaintenanceProcedureText(text) {
    const colH = (text || '').toString().trim();
    const colHLower = colH.toLowerCase();

    const hasMaintenance = MAINTENANCE_TERMS.some((term) => colHLower.includes(term));
    if (!hasMaintenance) return false;
    if (colH.includes(',')) return false;

    return MAINTENANCE_TERMS.some((term) => {
        const cleanedH = colHLower.replace(/\s+/g, ' ').trim();
        const cleanedTerm = term.replace(/\s+/g, ' ').trim();
        return cleanedH === cleanedTerm;
    });
}

function isMaintenanceProcedure(row) {
    return isMaintenanceProcedureText((row.H || '').toString());
}

function isMaintenanceProcedureOc(row) {
    return (
        isMaintenanceProcedureText((row.J || '').toString()) ||
        isMaintenanceProcedureText((row.K || '').toString())
    );
}

/** Linha já normalizada (Firestore) ou linha bruta da planilha OC. */
export function isMaintenanceBudgetRow(row, isOc = false) {
    if (isOc) {
        return (
            isMaintenanceProcedureText(row.procedure) ||
            isMaintenanceProcedureText(row.procedurePending)
        );
    }
    return isMaintenanceProcedureText(row.procedure || row.H);
}

/** Detecta colunas pelo cabeçalho (exportações OC podem deslocar letras). */
function detectOcColumnMap(headerRow) {
    const map = {
        date: 'A',
        approval: 'B',
        valueApproved: 'E',
        procedureApproved: 'J',
        procedurePending: 'K',
        source: 'I'
    };

    if (!headerRow) return map;

    for (const [col, rawLabel] of Object.entries(headerRow)) {
        const label = normalizeHeaderLabel(rawLabel);
        if (!label) continue;
        if (label.includes('data') && label.includes('orc')) map.date = col;
        else if (label.includes('data') && (label.includes('apro') || label.includes('aprov')))
            map.approval = col;
        else if (label.includes('valor') && label.includes('aprov')) map.valueApproved = col;
        else if (label.includes('proced') && (label.includes('aprov') || label.includes('apro')))
            map.procedureApproved = col;
        else if (label.includes('proced') && (label.includes('pend') || label.includes('pen')))
            map.procedurePending = col;
        else if (label.includes('canal')) map.source = col;
    }

    return map;
}

function buildBudgetResult(fileName, rawData, allData) {
    const importMonth = resolveImportMonth(fileName, allData);
    if (importMonth) {
        const before = allData.length;
        allData = filterRowsByMonth(allData, importMonth);
        rawData = filterRowsByMonth(rawData, importMonth);
        if (before !== allData.length) {
            console.log(
                `📅 Filtrado ao mês ${importMonth}: ${before} → ${allData.length} linhas (fora do mês na data do orçamento ou da aprovação)`
            );
        }
    }

    const dates = rawData.flatMap((r) => [r.date, r.approvalDate, getEffectiveRowDate(r)].filter(Boolean));
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

/** Sistema OC: data de aprovação preenchida = venda */
function ocRowIsSold(approvalCell) {
    return !!parseDate(approvalCell);
}

function processSistemaOcRows(rows, fileName, trafficSources, customKeywords, excludeMaintenance) {
    const rawData = [];
    const allData = [];
    const cols = detectOcColumnMap(rows[0]);
    console.log('📋 Sistema OC — colunas detectadas:', cols);

    rows.forEach((row, index) => {
        if (index === 0) return;

        const budgetDate = parseDate(row[cols.date]);
        const approvalCell = row[cols.approval];
        const approvalDate = parseDate(approvalCell);

        if (
            (!budgetDate || isNaN(budgetDate.getTime())) &&
            (!approvalDate || isNaN(approvalDate.getTime()))
        ) {
            return;
        }

        const dateStr = budgetDate && !isNaN(budgetDate.getTime())
            ? formatLocalDateYmd(budgetDate)
            : formatLocalDateYmd(approvalDate);
        const approvalDateStr =
            approvalDate && !isNaN(approvalDate.getTime()) ? formatLocalDateYmd(approvalDate) : null;

        const sold = ocRowIsSold(approvalCell);
        const status = sold ? 'APPROVED' : 'OPEN';
        const value = sold ? parseMoney(row[cols.valueApproved]) : 0;
        const source = (row[cols.source] ?? '').toString().trim();
        const procedure = (row[cols.procedureApproved] ?? '').toString().trim();
        const procedurePending = (row[cols.procedurePending] ?? '').toString().trim();

        const rowData = {
            date: dateStr,
            approvalDate: approvalDateStr,
            status,
            value,
            source,
            observations: '',
            procedure,
            procedurePending
        };

        allData.push(rowData);

        if (matchesTrafficRules(rowData, trafficSources, customKeywords)) {
            if (
                excludeMaintenance &&
                (isMaintenanceProcedureText(procedure) || isMaintenanceProcedureText(procedurePending))
            ) {
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

    const sourceCounts = {};
    rawData.forEach((r) => {
        const key = r.source || '(vazio)';
        sourceCounts[key] = (sourceCounts[key] || 0) + 1;
    });
    console.log('📊 Sistema OC — canais em rawData (após filtros):', sourceCounts);

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

    const prepared = prepareExistingForMerge(existingData, newData);
    if (prepared === null) {
        console.log('✅ Importação mensal — substituindo dados anteriores');
        return newData;
    }
    existingData = prepared;

    if (!existingData.rawData || existingData.rawData.length === 0) {
        console.log('✅ Base vazia após preparar mês — usando dados novos');
        return newData;
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
