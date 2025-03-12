// Import the report template
import { generateReportHTML } from './report_template.js';

// Initialize variables and check imports
console.log('RelatorioCompleto.js carregado');
if (typeof generateReportHTML !== 'function') {
    console.error('generateReportHTML não foi importado corretamente');
}

const mainContent = document.getElementById('mainContent');
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
const filterCampaignsBtn = document.getElementById('filterCampaigns');
const filterAdSetsBtn = document.getElementById('filterAdSets');
const comparePeriodsBtn = document.getElementById('comparePeriods');
const campaignsModal = document.getElementById('campaignsModal');
const adSetsModal = document.getElementById('adSetsModal');
const comparisonModal = document.getElementById('comparisonModal');
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
const confirmComparisonBtn = document.getElementById('confirmComparison');
const cancelComparisonBtn = document.getElementById('cancelComparison');

const backToReportSelectionBtn = document.getElementById('backToReportSelectionBtn');

backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?screen=reportSelection';
});

// Mapa para armazenar os nomes das contas, IDs dos ad sets e campanhas
const adAccountsMap = JSON.parse(localStorage.getItem('adAccountsMap')) || {};
const adSetsMap = {};
const campaignsMap = {};
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let isCampaignFilterActive = false;
let isAdSetFilterActive = false;
let isFilterActivated = false;
let campaignSearchText = '';
let adSetSearchText = '';
let currentAccessToken = localStorage.getItem('fbAccessToken') || null;
let comparisonData = null;

// Verificar token de acesso
if (!currentAccessToken) {
    console.log('Token de acesso não encontrado. Redirecionando para a página de login.');
    alert('Você precisa fazer login com o Facebook primeiro. Redirecionando para a página inicial.');
    setTimeout(() => {
        window.location.replace('index.html');
    }, 100);
    throw new Error('Token de acesso não encontrado. Redirecionamento iniciado.');
}

// Preencher dropdown de unidades
const unitSelect = document.getElementById('unitId');
unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
const sortedAccounts = Object.keys(adAccountsMap)
    .map(accountId => ({
        id: accountId,
        name: adAccountsMap[accountId]
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
sortedAccounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = account.name;
    unitSelect.appendChild(option);
});

// Event listeners for buttons
filterCampaignsBtn.addEventListener('click', () => {
    console.log('Clique no botão de filtro de campanhas');
    if (isFilterActivated && selectedAdSets.size > 0) {
        console.log('Filtro já ativado com conjuntos selecionados');
        return;
    }
    isCampaignFilterActive = true;
    toggleModal(campaignsModal, true, true);
});

filterAdSetsBtn.addEventListener('click', () => {
    console.log('Clique no botão de filtro de conjuntos');
    if (isFilterActivated && selectedCampaigns.size > 0) {
        console.log('Filtro já ativado com campanhas selecionadas');
        return;
    }
    isAdSetFilterActive = true;
    toggleModal(adSetsModal, true, false);
});

comparePeriodsBtn.addEventListener('click', () => {
    console.log('Iniciando comparação de períodos');
    if (comparisonModal) {
        console.log('Abrindo modal de comparação de períodos');
        toggleModal(comparisonModal, true, false); // Show as popup
    } else {
        console.error('Modal de comparação não encontrado');
    }
});

confirmComparisonBtn.addEventListener('click', async () => {
    const option = document.querySelector('input[name="comparisonOption"]:checked')?.value;
    if (!option) {
        console.error('Nenhuma opção de comparação selecionada');
        alert('Por favor, selecione uma opção de comparação.');
        return;
    }

    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;

    if (!startDate || !endDate) {
        console.error('Datas do período principal não preenchidas');
        alert('Por favor, preencha as datas do período principal.');
        return;
    }

    if (option === 'custom') {
        const compareStartDate = document.getElementById('compareStartDate')?.value;
        const compareEndDate = document.getElementById('compareEndDate')?.value;
        if (!compareStartDate || !compareEndDate) {
            alert('Por favor, preencha as datas do período de comparação.');
            return;
        }
        comparisonData = { startDate: compareStartDate, endDate: compareEndDate, isPrevious: false };
    } else if (option === 'previous') {
        const previousPeriod = calculatePreviousPeriod(startDate, endDate);
        comparisonData = { startDate: previousPeriod.start, endDate: previousPeriod.end, isPrevious: true };
    } else {
        comparisonData = null;
    }

    console.log('Dados de comparação salvos:', comparisonData);
    toggleModal(comparisonModal, false, false); // Close the modal after confirmation
    await generateReport(); // Regenerate report with new comparison data
});

cancelComparisonBtn.addEventListener('click', () => {
    console.log('Cancelando comparação de períodos');
    comparisonData = null;
    console.log('Dados de comparação limpos:', comparisonData);
    toggleModal(comparisonModal, false, false); // Close the modal
});

// Toggle modal function
function toggleModal(modal, show, isCampaign) {
    if (show && isFilterActivated && ((isCampaign && selectedCampaigns.size === 0) || (!isCampaign && selectedAdSets.size === 0))) {
        return;
    }

    modal.style.display = show ? 'block' : 'none';
    if (show) {
        if (isCampaign) {
            isCampaignFilterActive = true;
            isAdSetFilterActive = false;
            filterAdSetsBtn.disabled = isFilterActivated;
            filterAdSetsBtn.style.cursor = isFilterActivated ? 'not-allowed' : 'pointer';
        } else {
            isAdSetFilterActive = true;
            isCampaignFilterActive = false;
            filterCampaignsBtn.disabled = isFilterActivated;
            filterCampaignsBtn.style.cursor = isFilterActivated ? 'not-allowed' : 'pointer';
        }
        if (modal === comparisonModal) {
            // Reset form fields based on comparisonData
            document.querySelector('input[name="comparisonOption"][value="none"]').checked = !comparisonData;
            if (comparisonData && comparisonData.startDate && comparisonData.endDate) {
                document.querySelector('input[name="comparisonOption"][value="custom"]').checked = true;
                document.getElementById('compareStartDate').value = comparisonData.startDate;
                document.getElementById('compareEndDate').value = comparisonData.endDate;
            } else if (comparisonData && comparisonData.isPrevious) {
                document.querySelector('input[name="comparisonOption"][value="previous"]').checked = true;
            }
        }
    } else {
        if (isCampaign) {
            isCampaignFilterActive = false;
            if (isFilterActivated && selectedCampaigns.size === 0) {
                isFilterActivated = false;
                filterAdSetsBtn.disabled = false;
                filterAdSetsBtn.style.cursor = 'pointer';
            } else {
                filterAdSetsBtn.disabled = isFilterActivated && selectedCampaigns.size > 0;
                filterAdSetsBtn.style.cursor = isFilterActivated && selectedCampaigns.size > 0 ? 'not-allowed' : 'pointer';
            }
            campaignSearchText = '';
            const campaignSearchInput = document.getElementById('campaignSearch');
            if (campaignSearchInput) campaignSearchInput.value = '';
        } else if (modal === comparisonModal) {
            // No need to clear fields unless cancelled
        } else {
            isAdSetFilterActive = false;
            if (isFilterActivated && selectedAdSets.size === 0) {
                isFilterActivated = false;
                filterCampaignsBtn.disabled = false;
                filterCampaignsBtn.style.cursor = 'pointer';
            } else {
                filterCampaignsBtn.disabled = isFilterActivated && selectedAdSets.size > 0;
                filterCampaignsBtn.style.cursor = isFilterActivated && selectedAdSets.size > 0 ? 'not-allowed' : 'pointer';
            }
            adSetSearchText = '';
            const adSetSearchInput = document.getElementById('adSetSearch');
            if (adSetSearchInput) adSetSearchInput.value = '';
        }
    }
    updateFilterButton();
}

// Update filter button states
function updateFilterButton() {
    const campaignsButton = campaignsModal.querySelector('.btn-filter-toggle');
    const adSetsButton = adSetsModal.querySelector('.btn-filter-toggle');

    if (campaignsButton) {
        campaignsButton.textContent = isFilterActivated && selectedCampaigns.size > 0 ? 'Desativar Seleção' : 'Ativar Seleções';
        campaignsButton.disabled = !isFilterActivated && selectedCampaigns.size === 0;
    }
    if (adSetsButton) {
        adSetsButton.textContent = isFilterActivated && selectedAdSets.size > 0 ? 'Desativar Seleção' : 'Ativar Seleções';
        adSetsButton.disabled = !isFilterActivated && selectedAdSets.size === 0;
    }
    filterCampaignsBtn.disabled = isFilterActivated && (selectedAdSets.size > 0 || (selectedCampaigns.size === 0 && !isCampaignFilterActive));
    filterAdSetsBtn.disabled = isFilterActivated && (selectedCampaigns.size > 0 || (selectedAdSets.size === 0 && !isAdSetFilterActive));
    filterCampaignsBtn.style.cursor = filterCampaignsBtn.disabled ? 'not-allowed' : 'pointer';
    filterAdSetsBtn.style.cursor = filterAdSetsBtn.disabled ? 'not-allowed' : 'pointer';
}

// Render options for campaigns and ad sets
function renderOptions(containerId, options, selectedSet, isCampaign) {
    const container = document.getElementById(containerId);
    const searchInput = document.getElementById(isCampaign ? 'campaignSearch' : 'adSetSearch');
    container.innerHTML = options.length === 0 ? '<p>Carregando dados, por favor aguarde...</p>' : '';
    console.log(`Renderizando opções para ${isCampaign ? 'campanhas' : 'conjuntos'} - Total de opções: ${options.length}`);

    if (options.length > 0) {
        function filterOptions(searchText) {
            const filteredOptions = options.filter(option => 
                option.label.toLowerCase().includes(searchText.toLowerCase())
            );
            renderFilteredOptions(filteredOptions, selectedSet, isCampaign);
        }

        function renderFilteredOptions(filteredOptions, set, isCampaignParam) {
            container.innerHTML = '';
            filteredOptions.forEach(option => {
                const div = document.createElement('div');
                div.className = `filter-option ${set.has(option.value) ? 'selected' : ''}`;
                const spend = option.spend !== undefined && option.spend !== null ? parseFloat(option.spend) : 0;
                const spendColor = spend > 0 ? 'green' : 'gray';
                div.innerHTML = `${option.label} <span style="margin-left: 10px; color: ${spendColor};">R$ ${spend.toFixed(2).replace('.', ',')}</span>`;
                div.dataset.value = option.value;
                div.addEventListener('click', () => {
                    const value = option.value;
                    if (set.has(value)) {
                        set.delete(value);
                        div.classList.remove('selected');
                    } else {
                        set.add(value);
                        div.classList.add('selected');
                    }
                    if (set.size === 0 && isFilterActivated) {
                        isFilterActivated = false;
                        if (isCampaignParam) {
                            isCampaignFilterActive = false;
                            filterAdSetsBtn.disabled = false;
                            filterAdSetsBtn.style.cursor = 'pointer';
                        } else {
                            isAdSetFilterActive = false;
                            filterCampaignsBtn.disabled = false;
                            filterCampaignsBtn.style.cursor = 'pointer';
                        }
                    }
                    updateFilterButton();
                });
                container.appendChild(div);
            });

            const existingButton = container.querySelector('.btn-filter-toggle');
            if (existingButton) existingButton.remove();

            const filterButton = document.createElement('button');
            filterButton.textContent = isFilterActivated && (isCampaignParam ? selectedCampaigns.size > 0 : selectedAdSets.size > 0) ? 'Desativar Seleção' : 'Ativar Seleções';
            filterButton.className = 'btn-filter-toggle';
            filterButton.disabled = (isCampaignParam ? selectedCampaigns.size === 0 : selectedAdSets.size === 0);
            filterButton.addEventListener('click', () => {
                if (isFilterActivated && (isCampaignParam ? selectedCampaigns.size > 0 : selectedAdSets.size > 0)) {
                    isFilterActivated = false;
                    if (isCampaignParam) {
                        selectedCampaigns.clear();
                        isCampaignFilterActive = false;
                    } else {
                        selectedAdSets.clear();
                        isAdSetFilterActive = false;
                    }
                    filterCampaignsBtn.disabled = false;
                    filterAdSetsBtn.disabled = false;
                    filterCampaignsBtn.style.cursor = 'pointer';
                    filterAdSetsBtn.style.cursor = 'pointer';
                } else if (isCampaignParam ? selectedCampaigns.size > 0 : selectedAdSets.size > 0) {
                    isFilterActivated = true;
                    if (isCampaignParam) {
                        isCampaignFilterActive = true;
                        isAdSetFilterActive = false;
                        filterAdSetsBtn.disabled = true;
                        filterAdSetsBtn.style.cursor = 'not-allowed';
                    } else {
                        isAdSetFilterActive = true;
                        isCampaignFilterActive = false;
                        filterCampaignsBtn.disabled = true;
                        filterCampaignsBtn.style.cursor = 'not-allowed';
                    }
                }
                renderFilteredOptions(filteredOptions, set, isCampaignParam);
                updateFilterButton();
            });
            container.appendChild(filterButton);
        }

        const currentSearchText = isCampaign ? campaignSearchText : adSetSearchText;
        if (currentSearchText) {
            filterOptions(currentSearchText);
        } else {
            renderFilteredOptions(options, selectedSet, isCampaign);
        }

        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            newSearchInput.addEventListener('input', (e) => {
                const searchText = e.target.value;
                if (isCampaign) {
                    campaignSearchText = searchText;
                } else {
                    adSetSearchText = searchText;
                }
                filterOptions(searchText);
            });
            newSearchInput.value = currentSearchText;
        }
    } else {
        console.warn(`Nenhuma opção disponível para renderizar em ${containerId}`);
        container.innerHTML = '<p>Nenhum dado encontrado para o período selecionado. Tente novamente ou faça login novamente.</p>';
    }
}

// Load campaigns
async function loadCampaigns(unitId, startDate, endDate) {
    const startTime = performance.now();
    console.log(`Iniciando carregamento de campanhas para unitId: ${unitId}, período: ${startDate} a ${endDate}`);
    FB.api(
        `/${unitId}/campaigns`,
        { fields: 'id,name', access_token: currentAccessToken },
        async function(campaignResponse) {
            if (campaignResponse && !campaignResponse.error) {
                console.log(`Resposta da API para campanhas:`, campaignResponse);
                campaignsMap[unitId] = {};
                const campaignIds = campaignResponse.data.map(camp => camp.id);
                const insightPromises = campaignIds.map(campaignId => getCampaignInsights(campaignId, startDate, endDate));

                const insights = await Promise.all(insightPromises);
                campaignIds.forEach((campaignId, index) => {
                    const spend = insights[index].spend !== undefined && insights[index].spend !== null ? parseFloat(insights[index].spend) : 0;
                    campaignsMap[unitId][campaignId] = {
                        name: campaignResponse.data.find(camp => camp.id === campaignId).name.toLowerCase(),
                        insights: { spend: spend }
                    };
                });

                if (!isAdSetFilterActive) {
                    const campaignOptions = campaignIds.map(id => ({
                        value: id,
                        label: campaignsMap[unitId][id].name,
                        spend: campaignsMap[unitId][id].insights.spend
                    }));
                    renderOptions('campaignsList', campaignOptions, selectedCampaigns, true);
                }

                const endTime = performance.now();
                console.log(`Carregamento de campanhas concluído em ${(endTime - startTime) / 1000} segundos`);
            } else {
                console.error('Erro ao carregar campanhas:', campaignResponse.error);
                const endTime = performance.now();
                console.log(`Carregamento de campanhas falhou após ${(endTime - startTime) / 1000} segundos`);
            }
        }
    );
}

// Load ad sets
async function loadAdSets(unitId, startDate, endDate) {
    const startTime = performance.now();
    console.log(`Iniciando carregamento de ad sets para unitId: ${unitId}, período: ${startDate} a ${endDate}`);
    
    if (adSetsMap[unitId] && Object.keys(adSetsMap[unitId]).length > 0) {
        console.log(`Ad sets já carregados para unitId: ${unitId}, reutilizando dados existentes.`);
        if (!isCampaignFilterActive) {
            const adSetOptions = Object.keys(adSetsMap[unitId])
                .filter(id => adSetsMap[unitId][id].insights.spend > 0)
                .map(id => ({
                    value: id,
                    label: adSetsMap[unitId][id].name,
                    spend: adSetsMap[unitId][id].insights.spend
                }));
            renderOptions('adSetsList', adSetOptions, selectedAdSets, false);
        }
        return;
    }

    FB.api(
        `/${unitId}/adsets`,
        { fields: 'id,name', limit: 50, access_token: currentAccessToken },
        async function(adSetResponse) {
            if (adSetResponse && !adSetResponse.error) {
                console.log(`Resposta da API para ad sets:`, adSetResponse);
                adSetsMap[unitId] = {};
                const adSetIds = adSetResponse.data.map(set => set.id);

                const insightPromises = adSetIds.map(adSetId => getAdSetInsights(adSetId, startDate, endDate));
                const insights = await Promise.all(insightPromises);

                adSetIds.forEach((adSetId, index) => {
                    let spend = 0;
                    if (insights[index].spend !== undefined && insights[index].spend !== null) {
                        spend = parseFloat(insights[index].spend) || 0;
                        if (isNaN(spend)) {
                            console.warn(`Valor inválido de spend para ad set ${adSetId}: ${insights[index].spend}`);
                            spend = 0;
                        }
                    }
                    console.log(`Spend para ad set ${adSetId}: ${spend}`);
                    if (spend > 0) {
                        const adSet = adSetResponse.data.find(set => set.id === adSetId);
                        adSetsMap[unitId][adSetId] = {
                            name: adSet.name.toLowerCase(),
                            insights: { spend: spend, actions: insights[index].actions || [], reach: insights[index].reach || 0 }
                        };
                    }
                });

                console.log(`adSetsMap[${unitId}] após carregamento:`, adSetsMap[unitId]);

                if (!isCampaignFilterActive) {
                    const adSetOptions = Object.keys(adSetsMap[unitId])
                        .filter(id => adSetsMap[unitId][id].insights.spend > 0)
                        .map(id => ({
                            value: id,
                            label: adSetsMap[unitId][id].name,
                            spend: adSetsMap[unitId][id].insights.spend
                        }));
                    renderOptions('adSetsList', adSetOptions, selectedAdSets, false);
                }

                const endTime = performance.now();
                console.log(`Carregamento de ad sets concluído em ${(endTime - startTime) / 1000} segundos`);
            } else {
                console.error('Erro ao carregar ad sets. Detalhes:', adSetResponse.error);
                const endTime = performance.now();
                console.log(`Carregamento de ad sets falhou após ${(endTime - startTime) / 1000} segundos`);
                const adSetsList = document.getElementById('adSetsList');
                if (adSetsList) {
                    adSetsList.innerHTML = '<p>Erro ao carregar os conjuntos de anúncios. Tente novamente ou faça login novamente.</p>';
                }
            }
        }
    );
}

// Update ad sets based on selected campaigns
function updateAdSets(selectedCampaigns) {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate && !isAdSetFilterActive) {
        let validAdSetIds = Object.keys(adSetsMap[unitId] || {});
        validAdSetIds = validAdSetIds.filter(id => {
            const adSetData = adSetsMap[unitId][id];
            return adSetData && adSetData.insights.spend > 0;
        });

        const adSetOptions = validAdSetIds.map(id => ({
            value: id,
            label: adSetsMap[unitId][id].name,
            spend: adSetsMap[unitId][id].insights.spend
        }));
        renderOptions('adSetsList', adSetOptions, selectedAdSets, false);
    }
}

// Get campaign insights
async function getCampaignInsights(campaignId, startDate, endDate) {
    return new Promise((resolve, reject) => {
        FB.api(
            `/${campaignId}/insights`,
            { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, level: 'campaign', access_token: currentAccessToken },
            function(response) {
                if (response && !response.error) {
                    resolve(response.data[0] || {});
                } else {
                    console.error(`Erro ao carregar insights para campanha ${campaignId}:`, response.error);
                    resolve({});
                }
            }
        );
    });
}

// Get ad set insights
async function getAdSetInsights(adSetId, startDate, endDate) {
    return new Promise((resolve, reject) => {
        FB.api(
            `/${adSetId}/insights`,
            { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, access_token: currentAccessToken },
            function(response) {
                if (response && !response.error && response.data && response.data.length > 0) {
                    console.log(`Insights para ad set ${adSetId}:`, response.data[0]);
                    resolve(response.data[0]);
                } else {
                    console.warn(`Nenhum insight válido retornado para ad set ${adSetId}:`, response.error || 'Dados ausentes');
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

// Load ads
async function loadAds(unitId, startDate, endDate, campaignFilter, adSetFilter) {
    const adsMap = {};
    try {
        let adsResponse;
        if (campaignFilter && campaignFilter.size > 0) {
            adsResponse = await Promise.all([...campaignFilter].map(campaignId =>
                new Promise(resolve => {
                    FB.api(
                        `/${campaignId}/ads`,
                        { fields: 'id,creative{image_url}', access_token: currentAccessToken },
                        resolve
                    );
                })
            ));
        } else if (adSetFilter && adSetFilter.size > 0) {
            adsResponse = await Promise.all([...adSetFilter].map(adSetId =>
                new Promise(resolve => {
                    FB.api(
                        `/${adSetId}/ads`,
                        { fields: 'id,creative{image_url}', access_token: currentAccessToken },
                        resolve
                    );
                })
            ));
        } else {
            adsResponse = await new Promise(resolve => {
                FB.api(
                    `/${unitId}/ads`,
                    { fields: 'id,creative{image_url}', access_token: currentAccessToken },
                    resolve
                );
            });
        }

        if (adsResponse && !adsResponse.error) {
            const adsData = Array.isArray(adsResponse) ? adsResponse.flatMap(r => r.data || []) : adsResponse.data || [];
            const adIds = adsData.map(ad => ad.id);
            const insightPromises = adIds.map(adId => getAdInsights(adId, startDate, endDate));
            const insights = await Promise.all(insightPromises);

            adIds.forEach((adId, index) => {
                const ad = adsData.find(ad => ad.id === adId);
                if (ad && ad.creative && ad.creative.image_url) {
                    adsMap[adId] = {
                        creative: ad.creative,
                        insights: insights[index] || { spend: '0', actions: [], reach: '0' }
                    };
                }
            });
        } else {
            console.error('Erro ao carregar anúncios:', adsResponse.error);
        }
    } catch (error) {
        console.error('Erro ao processar loadAds:', error);
    }
    return adsMap;
}

// Get ad insights
async function getAdInsights(adId, startDate, endDate) {
    return new Promise((resolve, reject) => {
        FB.api(
            `/${adId}/insights`,
            { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, access_token: currentAccessToken },
            function(response) {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    console.warn(`Nenhum insight válido retornado para anúncio ${adId}:`, response.error || 'Dados ausentes');
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

// Calculate previous period
function calculatePreviousPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    start.setDate(start.getDate() - diffDays - 1);
    end.setDate(end.getDate() - diffDays - 1);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

// Calculate comparison metrics
async function calculateComparisonMetrics(unitId, startDate, endDate) {
    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    const response = await new Promise(resolve => {
        FB.api(
            `/${unitId}/insights`,
            { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, level: 'account', access_token: currentAccessToken },
            resolve
        );
    });

    if (response && !response.error && response.data.length > 0) {
        response.data.forEach(data => {
            if (data.spend) totalSpend += parseFloat(data.spend) || 0;
            if (data.reach) totalReach += parseInt(data.reach) || 0;
            (data.actions || []).forEach(action => {
                if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                    totalConversations += parseInt(action.value) || 0;
                }
            });
        });
    } else {
        console.warn('Nenhum dado de comparação encontrado ou erro na requisição:', response.error);
    }

    const costPerConversation = totalConversations > 0 ? (totalSpend / totalConversations).toFixed(2) : '0';
    return { reach: totalReach, conversations: totalConversations, spend: totalSpend, costPerConversation: parseFloat(costPerConversation) };
}

// Generate report
async function generateReport() {
    try {
        console.log('Iniciando geração do relatório');
        const unitId = document.getElementById('unitId')?.value;
        const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        if (!unitId || !startDate || !endDate) {
            console.error('Campos obrigatórios não preenchidos:', { unitId, startDate, endDate });
            reportContainer.innerHTML = '<p class="text-red-500 text-center">Preencha todos os campos obrigatórios (Unidade e Período).</p>';
            return;
        }

        let totalSpend = 0;
        let totalConversations = 0;
        let totalReach = 0;
        let comparisonMetrics = null;
        let topAds = [];

        const adsMap = await loadAds(unitId, startDate, endDate, 
            selectedCampaigns.size > 0 ? selectedCampaigns : null, 
            selectedAdSets.size > 0 ? selectedAdSets : null
        );

        if (isFilterActivated) {
            if (selectedCampaigns.size > 0) {
                for (const campaignId of selectedCampaigns) {
                    const insights = await getCampaignInsights(campaignId, startDate, endDate);
                    if (insights && insights.spend) totalSpend += parseFloat(insights.spend) || 0;
                    if (insights && insights.reach) totalReach += parseInt(insights.reach) || 0;
                    (insights.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            totalConversations += parseInt(action.value) || 0;
                        }
                    });
                }
            } else if (selectedAdSets.size > 0) {
                for (const adSetId of selectedAdSets) {
                    const insights = await getAdSetInsights(adSetId, startDate, endDate);
                    if (insights && insights.spend) totalSpend += parseFloat(insights.spend) || 0;
                    if (insights && insights.reach) totalReach += parseInt(insights.reach) || 0;
                    (insights.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            totalConversations += parseInt(action.value) || 0;
                        }
                    });
                }
            }
        } else {
            const response = await new Promise(resolve => {
                FB.api(
                    `/${unitId}/insights`,
                    { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, level: 'account', access_token: currentAccessToken },
                    resolve
                );
            });

            if (response && !response.error && response.data.length > 0) {
                response.data.forEach(data => {
                    if (data.spend) totalSpend += parseFloat(data.spend) || 0;
                    if (data.reach) totalReach += parseInt(data.reach) || 0;
                    (data.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            totalConversations += parseInt(action.value) || 0;
                        }
                    });
                });
            } else {
                reportContainer.innerHTML = '<p class="text-red-500 text-center">Nenhum dado encontrado para os filtros aplicados ou erro na requisição.</p>';
                if (response.error) console.error('Erro da API:', response.error);
                shareWhatsAppBtn.style.display = 'none';
                return;
            }
        }

        // Process ads for top performers
        Object.keys(adsMap).forEach(adId => {
            const ad = adsMap[adId];
            let messages = 0;
            let spend = parseFloat(ad.insights.spend) || 0;
            (ad.insights.actions || []).forEach(action => {
                if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                    messages += parseInt(action.value) || 0;
                }
            });
            if (messages > 0) {
                topAds.push({
                    imageUrl: ad.creative.image_url,
                    messages: messages,
                    costPerMessage: messages > 0 ? (spend / messages).toFixed(2) : '0'
                });
            }
        });

        topAds.sort((a, b) => b.messages - a.messages);
        const topTwoAds = topAds.slice(0, 2).filter(ad => {
            return ad.imageUrl && !ad.imageUrl.includes('dummyimage');
        });

        // Calculate comparison if needed
        if (comparisonData && comparisonData.startDate && comparisonData.endDate) {
            comparisonMetrics = await calculateComparisonMetrics(unitId, comparisonData.startDate, comparisonData.endDate);
            console.log('Comparison metrics:', comparisonMetrics);
        }

        const costPerConversation = totalConversations > 0 ? (totalSpend / totalConversations).toFixed(2) : '0';

        reportContainer.innerHTML = generateReportHTML(
            unitName,
            startDate,
            endDate,
            totalReach,
            totalConversations,
            totalSpend,
            costPerConversation,
            comparisonData,
            comparisonMetrics,
            topTwoAds
        );

        if (comparisonMetrics) {
            const reachVariation = calculateVariation(totalReach, comparisonMetrics.reach);
            const conversationsVariation = calculateVariation(totalConversations, comparisonMetrics.conversations);
            const spendVariation = calculateVariation(totalSpend, comparisonMetrics.spend);

            reportContainer.innerHTML += `
                <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 class="text-lg font-semibold text-primary mb-2">Variação em Relação ao Período de Comparação</h3>
                    <p>Alcance: ${reachVariation.percentage}% ${reachVariation.percentage > 0 ? '↑' : '↓'}</p>
                    <p>Mensagens Iniciadas: ${conversationsVariation.percentage}% ${conversationsVariation.percentage > 0 ? '↑' : '↓'}</p>
                    <p>Investimento Total: ${spendVariation.percentage}% ${spendVariation.percentage > 0 ? '↑' : '↓'}</p>
                </div>
            `;
        }

        shareWhatsAppBtn.style.display = 'block';
    } catch (error) {
        console.error('Erro durante a geração do relatório:', error);
        reportContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao gerar relatório. Por favor, tente novamente.</p>';
    }
}

// Form submission
form.addEventListener('input', async function(e) {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        if (isCampaignFilterActive && campaignSearchText) {
            console.log('Modal de campanhas aberto com filtro ativo, evitando re-renderização.');
            return;
        }

        campaignsMap[unitId] = {};
        adSetsMap[unitId] = {};
        selectedCampaigns.clear();
        selectedAdSets.clear();
        isCampaignFilterActive = false;
        isAdSetFilterActive = false;
        isFilterActivated = false;
        filterCampaignsBtn.disabled = false;
        filterAdSetsBtn.disabled = false;
        filterCampaignsBtn.style.cursor = 'pointer';
        filterAdSetsBtn.style.cursor = 'pointer';
        await Promise.all([
            loadCampaigns(unitId, startDate, endDate),
            loadAdSets(unitId, startDate, endDate)
        ]);
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateReport();
});

// Close modal buttons
closeCampaignsModalBtn.addEventListener('click', () => {
    isCampaignFilterActive = false;
    toggleModal(campaignsModal, false, true);
    updateFilterButton();
});

closeAdSetsModalBtn.addEventListener('click', () => {
    isAdSetFilterActive = false;
    toggleModal(adSetsModal, false, false);
    updateFilterButton();
});

// Share on WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const reportText = reportContainer.innerText;
    const encodedText = encodeURIComponent(reportText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
});

// Ensure calculateVariation is defined
function calculateVariation(currentValue, previousValue) {
    if (!previousValue || previousValue === 0) return { percentage: 0 };
    const percentage = ((currentValue - previousValue) / previousValue) * 100;
    return { percentage: Math.abs(percentage).toFixed(2) };
}