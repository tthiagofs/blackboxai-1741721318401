// Utilidades de DOM
export function debounce(fn, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export function setSelectedStyles(element, isSelected) {
    if (!element) return;
    element.classList.toggle('selected', !!isSelected);
    // Remover estilos inline; classes CSS já tratam o visual
    element.style.background = '';
    element.style.color = '';
}


