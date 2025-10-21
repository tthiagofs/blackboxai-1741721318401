// Utilidades de formatação
export function formatCurrencyBRL(value) {
    const number = typeof value === 'number' ? value : parseFloat(value || '0');
    if (!isFinite(number)) return 'R$ 0,00';
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateISOToBR(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    return `${d}/${m}/${y}`;
}

export function encodeWhatsAppText(text) {
    return encodeURIComponent(text || '');
}


