// Import the report template
import { generateReportHTML } from './report_template.js';

// Initialize variables
const mainContent = document.getElementById('mainContent');
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const filterCampaignsBtn = document.getElementById('filterCampaigns');
const filterAdSetsBtn = document.getElementById('filterAdSets');
const campaignsModal = document.getElementById('campaignsModal');
const adSetsModal = document.getElementById('adSetsModal');

// State management
const adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
const adSetsMap = {};
const campaignsMap = {};
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let isFilterActivated = false;

// Render options in a modal
function renderOptions(containerId, options, selectedSet, isCampaign) {
    const container = document.getElementById(containerId);
    const wrapper = document.createElement('div');
    wrapper.className = 'options-wrapper';
    
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = `w-full text-left p-2 hover:bg-gray-100 ${selectedSet.has(option.value) ? 'bg-blue-100' : ''}`;
        button.innerHTML = `
            ${option.label}
            <span class="ml-2 ${parseFloat(option.spend) > 0 ? 'text-green-600' : 'text-gray-500'}">
                R$ ${parseFloat(option.spend).toFixed(2).replace('.', ',')}
            </span>
        `;
        
        button.addEventListener('click', () => {
            if (selectedSet.has(option.value)) {
                selectedSet.delete(option.value);
                button.classList.remove('bg-blue-100');
            } else {
                selectedSet.add(option.value);
                button.classList.add('bg-blue-100');
            }
            
            const activateBtn = container.querySelector('.activate-btn');
            if (activateBtn) {
                activateBtn.disabled = selectedSet.size === 0;
            }
        });
        
        wrapper.appendChild(button);
    });
    
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    const activateBtn = document.createElement('button');
    activateBtn.className = 'activate-btn mt-4 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50';
    activateBtn.textContent = 'Ativar Seleções';
    activateBtn.disabled = selectedSet.size === 0;
    container.appendChild(activateBtn);
    
    activateBtn.addEventListener('click', () => {
        isFilterActivated = !isFilterActivated;
        activateBtn.textContent = isFilterActivated ? 'Desativar Seleção' : 'Ativar Seleções';
        
        if (isCampaign) {
            filterAdSetsBtn.disabled = isFilterActivated;
        } else {
            filterCampaignsBtn.disabled = isFilterActivated;
        }
        
        if (!isFilterActivated) {
            selectedSet.clear();
            renderOptions(containerId, options, selectedSet, isCampaign);
        }
    });
}

// Event listeners
filterCampaignsBtn.addEventListener('click', () => {
    if (!isFilterActivated || selectedCampaigns.size === 0) {
        campaignsModal.style.display = 'block';
        const options = Object.entries(campaignsMap).map(([id, data]) => ({
            value: id,
            label: data.name,
            spend: data.spend || 0
        }));
        renderOptions('campaignsList', options, selectedCampaigns, true);
    }
});

filterAdSetsBtn.addEventListener('click', () => {
    if (!isFilterActivated || selectedAdSets.size === 0) {
        adSetsModal.style.display = 'block';
        const options = Object.entries(adSetsMap).map(([id, data]) => ({
            value: id,
            label: data.name,
            spend: data.spend || 0
        }));
        renderOptions('adSetsList', options, selectedAdSets, false);
    }
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === campaignsModal) campaignsModal.style.display = 'none';
    if (e.target === adSetsModal) adSetsModal.style.display = 'none';
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const unitSelect = document.getElementById('unitId');
    if (unitSelect) {
        Object.entries(adAccountsMap)
            .sort(([,a], [,b]) => a.localeCompare(b))
            .forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                unitSelect.appendChild(option);
            });
    }
});
