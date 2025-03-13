// Import the report template
import { generateReportHTML } from './report_template.js';

// Initialize variables and check imports
console.log('RelatorioCompleto.js carregado');
if (typeof generateReportHTML !== 'function') {
    console.error('generateReportHTML não foi importado corretamente');
}

let lastFocusedElement = null;

// Create bound event handlers for each modal
const modalHandlers = new Map();

// Focus trap function
function createTabHandler(modal) {
    return function handleTabKey(e) {
        if (e.key === 'Tab') {
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        }
    };
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

// Add event listeners for modal close buttons
closeCampaignsModalBtn.addEventListener('click', () => {
    toggleModal(campaignsModal, false, true);
});

closeAdSetsModalBtn.addEventListener('click', () => {
    toggleModal(adSetsModal, false, false);
});

// Add click outside listeners for modals
[campaignsModal, adSetsModal, comparisonModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            toggleModal(modal, false, modal === campaignsModal);
        }
    });
});

// Add keyboard listener for Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const visibleModal = [campaignsModal, adSetsModal, comparisonModal].find(
            modal => modal.style.display !== 'none'
        );
        if (visibleModal) {
            toggleModal(visibleModal, false, visibleModal === campaignsModal);
        }
    }
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

const backToReportSelectionBtn = document.getElementById('backToReportSelectionBtn');

backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?screen=reportSelection';
});

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

// Event listeners para botões de filtro
if (filterCampaignsBtn) {
    filterCampaignsBtn.addEventListener('click', () => {
        console.log('Clique no botão de filtro de campanhas');
        if (isFilterActivated && selectedAdSets.size > 0) {
            console.log('Filtro já ativado com conjuntos selecionados');
            return;
        }
        isCampaignFilterActive = true;
        toggleModal(campaignsModal, true, true);
    });
} else {
    console.error('Botão de filtro de campanhas não encontrado');
}

if (filterAdSetsBtn) {
    filterAdSetsBtn.addEventListener('click', () => {
        console.log('Clique no botão de filtro de conjuntos');
        if (isFilterActivated && selectedCampaigns.size > 0) {
            console.log('Filtro já ativado com campanhas selecionadas');
            return;
        }
        isAdSetFilterActive = true;
        toggleModal(adSetsModal, true, false);
    });
} else {
    console.error('Botão de filtro de conjuntos não encontrado');
}

// Event listeners para comparação de períodos
if (comparePeriodsBtn) {
    comparePeriodsBtn.addEventListener('click', () => {
        console.log('Iniciando comparação de períodos');
        if (comparisonModal) {
            console.log('Abrindo modal de comparação de períodos');
            toggleModal(comparisonModal, true, false);
        } else {
            console.error('Modal de comparação não encontrado');
        }
    });
} else {
    console.error('Botão de comparação de períodos não encontrado');
}

if (confirmComparisonBtn) {
    confirmComparisonBtn.addEventListener('click', async () => {
        console.log('Confirmando comparação de períodos');
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
            alert('Por favor, preencha as datas do período principal primeiro.');
            return;
        }

        try {
            if (option === 'custom') {
                const compareStartDate = document.getElementById('compareStartDate')?.value;
                const compareEndDate = document.getElementById('compareEndDate')?.value;
                if (!compareStartDate || !compareEndDate) {
                    alert('Por favor, preencha as datas do período de comparação.');
                    return;
                }
                if (new Date(compareStartDate) > new Date(compareEndDate)) {
                    alert('A data inicial do período de comparação deve ser anterior à data final.');
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
            toggleModal(comparisonModal, false, false);

            // Trigger report generation immediately after setting comparison data
            if (form) {
                await generateReport();
            }
        } catch (error) {
            console.error('Erro ao configurar período de comparação:', error);
            alert('Erro ao configurar período de comparação. Por favor, tente novamente.');
        }
    });
} else {
    console.error('Botão de confirmar comparação não encontrado');
}

if (cancelComparisonBtn) {
    cancelComparisonBtn.addEventListener('click', () => {
        console.log('Cancelando comparação de períodos');
        comparisonData = null;
        console.log('Dados de comparação limpos:', comparisonData);
        toggleModal(comparisonModal, false, false);
    });
} else {
    console.error('Botão de cancelar comparação não encontrado');
}

// Funções auxiliares
function calculatePreviousPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - diffDays);

    return {
        start: previousStart.toISOString().split('T')[0],
        end: previousEnd.toISOString().split('T')[0]
    };
}

function calculateVariation(currentValue, previousValue) {
    if (!previousValue || previousValue === 0) return { percentage: 0, icon: '' };
    const percentage = ((currentValue - previousValue) / previousValue) * 100;
    return { percentage: Math.abs(percentage).toFixed(2) };
}

// Funções de API do Facebook
async function getAdInsights(adId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${adId}/insights`,
            { fields: ['spend', 'actions'], time_range: { since: startDate, until: endDate }, access_token: currentAccessToken },
            function(response) {
                if (response && !response.error && response.data && response.data.length > 0) {
                    console.log(`Insights para anúncio ${adId}:`, response.data[0]);
                    resolve(response.data[0]);
                } else {
                    console.warn(`Nenhum insight válido para anúncio ${adId}:`, response.error || 'Dados ausentes');
                    resolve({ spend: '0', actions: [] });
                }
            }
        );
    });
}

async function getCampaignInsights(campaignId, startDate, endDate) {
    return new Promise((resolve) => {
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

async function getAdSetInsights(adSetId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${adSetId}/insights`,
            { fields: ['spend', 'actions', 'reach'], time_range: { since: startDate, until: endDate }, access_token: currentAccessToken },
            function(response) {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

async function getCreativeData(creativeId) {
    return new Promise((resolve) => {
        FB.api(
            `/${creativeId}`,
            { fields: 'object_story_spec,thumbnail_url,effective_object_story_id,image_hash', access_token: currentAccessToken },
            async function(response) {
                if (response && !response.error) {
                    console.log('Resposta da API para criativo:', response);
                    let imageUrl = 'https://dummyimage.com/600x600/ccc/fff';

                    if (response.image_hash) {
                        const imageResponse = await new Promise((imageResolve) => {
                            FB.api(
                                `/adimages`,
                                { hashes: [response.image_hash], fields: 'url', access_token: currentAccessToken },
                                function(imageResponse) {
                                    imageResolve(imageResponse);
                                }
                            );
                        });
                        if (imageResponse && !imageResponse.error && imageResponse.data && imageResponse.data.length > 0) {
                            imageUrl = imageResponse.data[0].url;
                            console.log('Imagem de alta resolução via image_hash:', imageUrl);
                        }
                    }
                    if (imageUrl.includes('dummyimage') && response.object_story_spec) {
                        const { photo_data, video_data, link_data } = response.object_story_spec;
                        if (photo_data && photo_data.images && photo_data.images.length > 0) {
                            const largestImage = photo_data.images.reduce((prev, current) => 
                                (prev.width > current.width) ? prev : current, photo_data.images[0]);
                            imageUrl = largestImage.original_url || largestImage.url || photo_data.url;
                        } else if (video_data && video_data.picture) {
                            imageUrl = video_data.picture;
                        } else if (link_data && link_data.picture) {
                            imageUrl = link_data.picture;
                        }
                    }
                    if (imageUrl.includes('dummyimage') && response.effective_object_story_id) {
                        try {
                            const storyResponse = await new Promise((storyResolve) => {
                                FB.api(
                                    `/${response.effective_object_story_id}`,
                                    { fields: 'full_picture', access_token: currentAccessToken },
                                    function(storyResponse) {
                                        storyResolve(storyResponse);
                                    }
                                );
                            });
                            if (storyResponse && !storyResponse.error && storyResponse.full_picture) {
                                imageUrl = storyResponse.full_picture;
                            }
                        } catch (error) {
                            console.error('Erro ao buscar full_picture:', error);
                        }
                    }
                    if (imageUrl.includes('dummyimage') && response.thumbnail_url) {
                        imageUrl = response.thumbnail_url;
                    }

                    resolve({ imageUrl: imageUrl });
                } else {
                    console.error(`Erro ao carregar criativo ${creativeId}:`, response.error);
                    resolve({ imageUrl: 'https://dummyimage.com/600x600/ccc/fff' });
                }
            }
        );
    });
}

// Funções de carregamento de dados
async function loadAds(unitId, startDate, endDate, filteredCampaigns = null, filteredAdSets = null) {
    const startTime = performance.now();
    console.log(`Iniciando carregamento de anúncios para unitId: ${unitId}, período: ${startDate} a ${endDate}`);
    
    let adsMap = {};
    let apiEndpoint = filteredAdSets && filteredAdSets.size > 0 
        ? null
        : filteredCampaigns && filteredCampaigns.size > 0 
        ? `/${unitId}/ads` 
        : `/${unitId}/ads`;

    if (filteredAdSets && filteredAdSets.size > 0) {
        const adPromises = Array.from(filteredAdSets).map(adSetId => 
            new Promise((resolve) => {
                FB.api(
                    `/${adSetId}/ads`,
                    { fields: 'id,creative', access_token: currentAccessToken },
                    async function(adResponse) {
                        if (adResponse && !adResponse.error) {
                            const adIds = adResponse.data.map(ad => ad.id);
                            const insightPromises = adIds.map(adId => getAdInsights(adId, startDate, endDate));
                            const creativePromises = adResponse.data.map(ad => getCreativeData(ad.creative.id));
                            const [insights, creatives] = await Promise.all([
                                Promise.all(insightPromises),
                                Promise.all(creativePromises)
                            ]);
                            adIds.forEach((adId, index) => {
                                adsMap[adId] = {
                                    insights: insights[index],
                                    creative: creatives[index]
                                };
                            });
                            resolve();
                        } else {
                            console.error(`Erro ao carregar anúncios do ad set ${adSetId}:`, adResponse.error);
                            resolve();
                        }
                    }
                );
            })
        );
        await Promise.all(adPromises);
    } else {
        const adResponse = await new Promise(resolve => {
            FB.api(
                apiEndpoint,
                { fields: 'id,creative', limit: 100, access_token: currentAccessToken },
                resolve
            );
        });

        if (adResponse && !adResponse.error) {
            console.log(`Resposta da API para anúncios:`, adResponse);
            const adIds = adResponse.data.map(ad => ad.id);
            const insightPromises = adIds.map(adId => getAdInsights(adId, startDate, endDate));
            const creativePromises = adResponse.data.map(ad => getCreativeData(ad.creative.id));
            const [insights, creatives] = await Promise.all([
                Promise.all(insightPromises),
                Promise.all(creativePromises)
            ]);

            adIds.forEach((adId, index) => {
                adsMap[adId] = {
                    insights: insights[index],
                    creative: creatives[index]
                };
            });
        } else {
            console.error('Erro ao carregar anúncios:', adResponse.error);
        }
    }

    const endTime = performance.now();
    console.log(`Carregamento de anúncios concluído em ${(endTime - startTime) / 1000} segundos`);
    return adsMap;
}

async function loadCampaigns(unitId, startDate, endDate) {
    const startTime = performance.now();
    FB.api(
        `/${unitId}/campaigns`,
        { fields: 'id,name', access_token: currentAccessToken },
        async function(campaignResponse) {
            if (campaignResponse && !campaignResponse.error) {
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
            } else {
                console.error('Erro ao carregar campanhas:', campaignResponse.error);
            }
        }
    );
}

async function loadAdSets(unitId, startDate, endDate) {
    if (adSetsMap[unitId] && Object.keys(adSetsMap[unitId]).length > 0) {
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
                adSetsMap[unitId] = {};
                const adSetIds = adSetResponse.data.map(set => set.id);
                const insightPromises = adSetIds.map(adSetId => getAdSetInsights(adSetId, startDate, endDate));
                const insights = await Promise.all(insightPromises);

                adSetIds.forEach((adSetId, index) => {
                    let spend = 0;
                    if (insights[index].spend !== undefined && insights[index].spend !== null) {
                        spend = parseFloat(insights[index].spend) || 0;
                    }
                    if (spend > 0) {
                        const adSet = adSetResponse.data.find(set => set.id === adSetId);
                        adSetsMap[unitId][adSetId] = {
                            name: adSet.name.toLowerCase(),
                            insights: { spend: spend, actions: insights[index].actions || [], reach: insights[index].reach || 0 }
                        };
                    }
                });

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
            } else {
                console.error('Erro ao carregar ad sets:', adSetResponse.error);
                const adSetsList = document.getElementById('adSetsList');
                if (adSetsList) {
                    adSetsList.innerHTML = '<p>Erro ao carregar os conjuntos de anúncios. Tente novamente ou faça login novamente.</p>';
                }
            }
        }
    );
}

// Funções de UI
function toggleModal(modal, show, isCampaign) {
    if (show && isFilterActivated && ((isCampaign && selectedCampaigns.size === 0) || (!isCampaign && selectedAdSets.size === 0))) {
        return;
    }

    if (show) {
        // Store the currently focused element
        lastFocusedElement = document.activeElement;
        document.body.classList.add('modal-open');
        
        // Set up keyboard trap
        if (!modalHandlers.has(modal)) {
            const handler = createTabHandler(modal);
            modalHandlers.set(modal, handler);
        }
        modal.addEventListener('keydown', modalHandlers.get(modal));
        
        // Show modal with transition
        modal.style.visibility = 'visible';
        modal.style.display = 'flex';
        // Use double RAF to ensure the transition works
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('show');
                // Focus the first focusable element
                const focusable = modal.querySelector('input, button, [tabindex="-1"]');
                if (focusable) {
                    focusable.focus();
                }
            });
        });
        
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

        if (modal === comparisonModal && comparisonData) {
            if (comparisonData.startDate && comparisonData.endDate) {
                document.querySelector('input[name="comparisonOption"][value="custom"]').checked = true;
                document.getElementById('compareStartDate').value = comparisonData.startDate;
                document.getElementById('compareEndDate').value = comparisonData.endDate;
            } else if (comparisonData.isPrevious) {
                document.querySelector('input[name="comparisonOption"][value="previous"]').checked = true;
            } else {
                document.querySelector('input[name="comparisonOption"][value="none"]').checked = true;
            }
        }
    } else {
        modal.classList.remove('show');
        // Wait for transition to complete before hiding
        setTimeout(() => {
            modal.style.visibility = 'hidden';
            modal.style.display = 'none';
            // Remove keyboard trap and clean up
            const handler = modalHandlers.get(modal);
            if (handler) {
                modal.removeEventListener('keydown', handler);
                modalHandlers.delete(modal);
            }
            
            // Only remove modal-open if no other modals are visible
            const anyModalVisible = [campaignsModal, adSetsModal, comparisonModal].some(
                m => m !== modal && m.classList.contains('show')
            );
            if (!anyModalVisible) {
                document.body.classList.remove('modal-open');
                // Restore focus to the last focused element
                if (lastFocusedElement) {
                    lastFocusedElement.focus();
                    lastFocusedElement = null;
                }
            }
        }, 300); // Match the transition duration from CSS

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
            // Não limpar os campos ou comparisonData aqui
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

function renderOptions(containerId, options, selectedSet, isCampaign) {
    const container = document.getElementById(containerId);
    const searchInput = document.getElementById(isCampaign ? 'campaignSearch' : 'adSetSearch');
    container.innerHTML = options.length === 0 ? '<p>Carregando dados, por favor aguarde...</p>' : '';

    if (options.length > 0) {
        // Create a wrapper div for the scrollable content
        const optionsWrapper = document.createElement('div');
        optionsWrapper.id = isCampaign ? 'campaignsList' : 'adSetsList';
        optionsWrapper.className = 'options-wrapper';
        container.appendChild(optionsWrapper);

        function filterOptions(searchText) {
            const filteredOptions = options.filter(option => 
                option.label.toLowerCase().includes(searchText.toLowerCase())
            );
            renderFilteredOptions(filteredOptions, selectedSet, isCampaign);
        }

        function renderFilteredOptions(filteredOptions, set, isCampaignParam) {
            optionsWrapper.innerHTML = '';
            filteredOptions.forEach(option => {
                const div = document.createElement('div');
                div.className = `filter-option ${set.has(option.value) ? 'selected' : ''}`;
                const spend = option.spend !== undefined && option.spend !== null ? parseFloat(option.spend) : 0;
                const spendColor = spend > 0 ? 'green' : 'gray';
                div.innerHTML = `${option.label} <span style="margin-left: 10px; color: ${spendColor};">R$ ${spend.toFixed(2).replace('.', ',')}</span>`;
                div.dataset.value = option.value;
                
                // Create a clickable button for better interaction
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'w-full text-left';
                button.innerHTML = div.innerHTML;
                div.innerHTML = '';
                div.appendChild(button);

                button.addEventListener('click', (e) => {
                    e.preventDefault();
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
                optionsWrapper.appendChild(div);
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

// Event listener para o formulário
form.addEventListener('input', async function(e) {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        if (isCampaignFilterActive && campaignSearchText) {
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

// Geração do relatório
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            console.log('Iniciando geração do relatório');
            await generateReport();
            console.log('Relatório gerado com sucesso');
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            reportContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao gerar relatório. Por favor, tente novamente.</p>';
        }
    });
} else {
    console.error('Formulário de relatório não encontrado');
}

// Função principal de geração do relatório
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

        console.log('Dados iniciais validados:', { unitId, unitName, startDate, endDate });

        let totalSpend = 0;
        let totalConversations = 0;
        let totalReach = 0;
        let comparisonMetrics = null;
        let topAds = [];

        console.log('Carregando dados dos anúncios...');
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
                    imageUrl: ad.creative.imageUrl,
                    messages: messages,
                    costPerMessage: messages > 0 ? (spend / messages).toFixed(2) : '0'
                });
            }
        });

        topAds.sort((a, b) => b.messages - a.messages);
        const topTwoAds = topAds.slice(0, 2).filter(ad => {
            return ad.imageUrl && !ad.imageUrl.includes('dummyimage');
        });

        // Calculate comparison metrics if needed
        if (comparisonData && comparisonData.startDate && comparisonData.endDate) {
            comparisonMetrics = await calculateComparisonMetrics(unitId, comparisonData.startDate, comparisonData.endDate);
        }

        const costPerConversation = totalConversations > 0 ? (totalSpend / totalConversations).toFixed(2) : '0';

        console.log('Gerando relatório com os dados:', {
            totalSpend,
            totalConversations,
            totalReach,
            costPerConversation,
            comparisonMetrics,
            topTwoAds
        });

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

        shareWhatsAppBtn.style.display = 'block';
    } catch (error) {
        console.error('Erro durante a geração do relatório:', error);
        reportContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao gerar relatório. Por favor, tente novamente.</p>';
    }
}

// Função para calcular métricas de comparação
async function calculateComparisonMetrics(unitId, startDate, endDate) {
    let compareSpend = 0;
    let compareConversations = 0;
    let compareReach = 0;

    try {
        if (isFilterActivated) {
            if (selectedCampaigns.size > 0) {
                for (const campaignId of selectedCampaigns) {
                    const insights = await getCampaignInsights(campaignId, startDate, endDate);
                    if (insights && insights.spend) compareSpend += parseFloat(insights.spend) || 0;
                    if (insights && insights.reach) compareReach += parseInt(insights.reach) || 0;
                    (insights.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            compareConversations += parseInt(action.value) || 0;
                        }
                    });
                }
            } else if (selectedAdSets.size > 0) {
                for (const adSetId of selectedAdSets) {
                    const insights = await getAdSetInsights(adSetId, startDate, endDate);
                    if (insights && insights.spend) compareSpend += parseFloat(insights.spend) || 0;
                    if (insights && insights.reach) compareReach += parseInt(insights.reach) || 0;
                    (insights.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            compareConversations += parseInt(action.value) || 0;
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
                    if (data.spend) compareSpend += parseFloat(data.spend) || 0;
                    if (data.reach) compareReach += parseInt(data.reach) || 0;
                    (data.actions || []).forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            compareConversations += parseInt(action.value) || 0;
                        }
                    });
                });
            }
        }

        const compareCostPerConversation = compareConversations > 0 ? (compareSpend / compareConversations).toFixed(2) : '0';
        return {
            reach: compareReach,
            conversations: compareConversations,
            costPerConversation: parseFloat(compareCostPerConversation)
        };
    } catch (error) {
        console.error('Erro ao calcular métricas de comparação:', error);
        return null;
    }
}

// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const reportText = reportContainer.innerText;
    const encodedText = encodeURIComponent(reportText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
});
