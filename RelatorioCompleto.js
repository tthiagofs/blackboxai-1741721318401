import { fbAuth } from './auth.js';

// Verificar autenticação
const currentAccessToken = fbAuth.getAccessToken();
if (!currentAccessToken) {
    alert('Você precisa fazer login com o Facebook primeiro. Redirecionando para a página inicial.');
    window.location.replace('index.html');
    throw new Error('Token de acesso não encontrado');
}

// Elementos do DOM
const form = document.getElementById('form');
const reportContainer = document.getElementById('reportContainer');
const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
const filterCampaignsBtn = document.getElementById('filterCampaigns');
const filterAdSetsBtn = document.getElementById('filterAdSets');
const comparePeriodsBtn = document.getElementById('comparePeriods');
const backToReportSelectionBtn = document.getElementById('backToReportSelectionBtn');

// Modais
const campaignsModal = document.getElementById('campaignsModal');
const adSetsModal = document.getElementById('adSetsModal');
const comparisonModal = document.getElementById('comparisonModal');
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
const applyCampaignsBtn = document.getElementById('applyCampaigns');
const applyAdSetsBtn = document.getElementById('applyAdSets');
const confirmComparisonBtn = document.getElementById('confirmComparison');
const cancelComparisonBtn = document.getElementById('cancelComparison');

// Estado
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let isCampaignFilterActive = false;
let isAdSetFilterActive = false;
let isFilterActivated = false;
let campaignSearchText = '';
let adSetSearchText = '';
let comparisonData = null;

// Mapas
const adAccountsMap = fbAuth.getAdAccounts();
const adSetsMap = {};
const campaignsMap = {};

// Preencher select de unidades
const unitSelect = document.getElementById('unitId');
const sortedAccounts = Object.entries(adAccountsMap)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
sortedAccounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = account.name;
    unitSelect.appendChild(option);
});

// Funções de Modal
function toggleModal(modal, show, isCampaign) {
    modal.style.display = show ? 'flex' : 'none';
    
    if (show) {
        if (isCampaign) {
            isCampaignFilterActive = true;
            isAdSetFilterActive = false;
            filterAdSetsBtn.disabled = isFilterActivated;
        } else if (modal === comparisonModal) {
            setupComparisonModal();
        } else {
            isAdSetFilterActive = true;
            isCampaignFilterActive = false;
            filterCampaignsBtn.disabled = isFilterActivated;
        }
    } else {
        if (isCampaign) {
            isCampaignFilterActive = false;
            campaignSearchText = '';
            document.getElementById('campaignSearch').value = '';
        } else if (modal === comparisonModal) {
            // Manter os dados de comparação
        } else {
            isAdSetFilterActive = false;
            adSetSearchText = '';
            document.getElementById('adSetSearch').value = '';
        }
    }
    updateFilterButtons();
}

function setupComparisonModal() {
    if (comparisonData) {
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
}

// Atualizar estado dos botões
function updateFilterButtons() {
    filterCampaignsBtn.disabled = isFilterActivated && selectedAdSets.size > 0;
    filterAdSetsBtn.disabled = isFilterActivated && selectedCampaigns.size > 0;
    
    filterCampaignsBtn.classList.toggle('opacity-50', filterCampaignsBtn.disabled);
    filterAdSetsBtn.classList.toggle('opacity-50', filterAdSetsBtn.disabled);
}

// Carregar dados quando o formulário é preenchido
form.addEventListener('input', async function(e) {
    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (unitId && startDate && endDate) {
        await Promise.all([
            loadCampaigns(unitId, startDate, endDate),
            loadAdSets(unitId, startDate, endDate)
        ]);
    }
});

// Funções para carregar dados do Facebook
async function loadAds(unitId, startDate, endDate, filteredCampaigns = null, filteredAdSets = null) {
    try {
        let adsMap = {};
        let apiEndpoint = filteredAdSets && filteredAdSets.size > 0 
            ? null 
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
            }
        }
        return adsMap;
    } catch (error) {
        console.error('Erro ao carregar anúncios:', error);
        return {};
    }
}

async function getCreativeData(creativeId) {
    return new Promise((resolve) => {
        FB.api(
            `/${creativeId}`,
            { fields: 'object_story_spec,thumbnail_url,effective_object_story_id,image_hash', access_token: currentAccessToken },
            async function(response) {
                if (response && !response.error) {
                    let imageUrl = 'https://dummyimage.com/600x600/ccc/fff';

                    if (response.image_hash) {
                        const imageResponse = await new Promise((imageResolve) => {
                            FB.api(
                                `/adimages`,
                                { hashes: [response.image_hash], fields: 'url', access_token: currentAccessToken },
                                imageResolve
                            );
                        });
                        if (imageResponse && !imageResponse.error && imageResponse.data && imageResponse.data.length > 0) {
                            imageUrl = imageResponse.data[0].url;
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
                                    storyResolve
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

async function loadCampaigns(unitId, startDate, endDate) {
    try {
        campaignsMap[unitId] = {};
        let allCampaigns = [];
        let url = `/${unitId}/campaigns?fields=id,name&access_token=${currentAccessToken}`;

        // Paginação para buscar todas as campanhas
        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allCampaigns = allCampaigns.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                throw new Error(response.error?.message || 'Erro ao carregar campanhas');
            }
        }

        const campaignIds = allCampaigns.map(camp => camp.id);
        const insights = await Promise.all(
            campaignIds.map(id => getCampaignInsights(id, startDate, endDate))
        );

        campaignIds.forEach((id, index) => {
            const campaign = allCampaigns.find(c => c.id === id);
            const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
            campaignsMap[unitId][id] = {
                name: campaign.name.toLowerCase(),
                insights: { 
                    spend,
                    reach: insights[index].reach || 0,
                    actions: insights[index].actions || []
                }
            };
        });

        renderCampaignOptions();
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

async function loadAdSets(unitId, startDate, endDate) {
    try {
        adSetsMap[unitId] = {};
        let allAdSets = [];
        let url = `/${unitId}/adsets?fields=id,name&access_token=${currentAccessToken}`;

        // Paginação para buscar todos os ad sets
        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allAdSets = allAdSets.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                throw new Error(response.error?.message || 'Erro ao carregar ad sets');
            }
        }

        const adSetIds = allAdSets.map(set => set.id);
        const insights = await Promise.all(
            adSetIds.map(id => getAdSetInsights(id, startDate, endDate))
        );

        adSetIds.forEach((id, index) => {
            const adSet = allAdSets.find(s => s.id === id);
            const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
            adSetsMap[unitId][id] = {
                name: adSet.name.toLowerCase(),
                insights: {
                    spend,
                    reach: insights[index].reach || 0,
                    actions: insights[index].actions || []
                }
            };
        });

        renderAdSetOptions();
    } catch (error) {
        console.error('Erro ao carregar conjuntos:', error);
    }
}

// Funções para obter insights
async function getCampaignInsights(campaignId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${campaignId}/insights`,
            {
                fields: ['spend', 'actions', 'reach'],
                time_range: { since: startDate, until: endDate },
                level: 'campaign',
                access_token: currentAccessToken
            },
            (response) => {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
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
            {
                fields: ['spend', 'actions', 'reach'],
                time_range: { since: startDate, until: endDate },
                access_token: currentAccessToken
            },
            (response) => {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

async function getAdInsights(adId, startDate, endDate) {
    return new Promise((resolve) => {
        FB.api(
            `/${adId}/insights`,
            {
                fields: ['spend', 'actions', 'reach'],
                time_range: { since: startDate, until: endDate },
                access_token: currentAccessToken
            },
            (response) => {
                if (response && !response.error && response.data && response.data.length > 0) {
                    resolve(response.data[0]);
                } else {
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

// Funções de renderização
function renderCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('campaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .filter(campaign => {
            if (!campaignSearchText) return true;
            return campaign.name.toLowerCase().includes(campaignSearchText.toLowerCase());
        })
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = campaigns.map(campaign => `
        <div class="filter-option ${selectedCampaigns.has(campaign.id) ? 'selected' : ''}"
             data-id="${campaign.id}">
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        </div>
    `).join('');

    // Remover listener antigo se existir
    container.removeEventListener('click', container.clickHandler);
    
    // Adicionar novo listener usando event delegation
    container.clickHandler = (e) => {
        const option = e.target.closest('.filter-option');
        if (option) {
            const id = option.dataset.id;
            if (selectedCampaigns.has(id)) {
                selectedCampaigns.delete(id);
                option.classList.remove('selected');
            } else {
                selectedCampaigns.add(id);
                option.classList.add('selected');
            }
            updateFilterButtons();
        }
    };
    
    container.addEventListener('click', container.clickHandler);
}

function renderAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('adSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .filter(adSet => {
            if (!adSetSearchText) return true;
            return adSet.name.toLowerCase().includes(adSetSearchText.toLowerCase());
        })
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = adSets.map(adSet => `
        <div class="filter-option ${selectedAdSets.has(adSet.id) ? 'selected' : ''}"
             data-id="${adSet.id}">
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        </div>
    `).join('');

    // Remover listener antigo se existir
    container.removeEventListener('click', container.clickHandler);
    
    // Adicionar novo listener usando event delegation
    container.clickHandler = (e) => {
        const option = e.target.closest('.filter-option');
        if (option) {
            const id = option.dataset.id;
            if (selectedAdSets.has(id)) {
                selectedAdSets.delete(id);
                option.classList.remove('selected');
            } else {
                selectedAdSets.add(id);
                option.classList.add('selected');
            }
            updateFilterButtons();
        }
    };
    
    container.addEventListener('click', container.clickHandler);
}

// Event Listeners
filterCampaignsBtn.addEventListener('click', () => toggleModal(campaignsModal, true, true));
filterAdSetsBtn.addEventListener('click', () => toggleModal(adSetsModal, true, false));
comparePeriodsBtn.addEventListener('click', () => toggleModal(comparisonModal, true));

closeCampaignsModalBtn.addEventListener('click', () => toggleModal(campaignsModal, false, true));
closeAdSetsModalBtn.addEventListener('click', () => toggleModal(adSetsModal, false, false));
applyCampaignsBtn.addEventListener('click', () => toggleModal(campaignsModal, false, true));
applyAdSetsBtn.addEventListener('click', () => toggleModal(adSetsModal, false, false));
cancelComparisonBtn.addEventListener('click', () => toggleModal(comparisonModal, false));

document.getElementById('campaignSearch').addEventListener('input', (e) => {
    campaignSearchText = e.target.value;
    renderCampaignOptions();
});

document.getElementById('adSetSearch').addEventListener('input', (e) => {
    adSetSearchText = e.target.value;
    renderAdSetOptions();
});

// Funções de comparação
confirmComparisonBtn.addEventListener('click', () => {
    const option = document.querySelector('input[name="comparisonOption"]:checked').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (option === 'custom') {
        const compareStartDate = document.getElementById('compareStartDate').value;
        const compareEndDate = document.getElementById('compareEndDate').value;
        if (!compareStartDate || !compareEndDate) {
            alert('Por favor, preencha as datas do período de comparação.');
            return;
        }
        comparisonData = { startDate: compareStartDate, endDate: compareEndDate, isPrevious: false };
    } else if (option === 'previous') {
        const { start, end } = calculatePreviousPeriod(startDate, endDate);
        comparisonData = { startDate: start, endDate: end, isPrevious: true };
    } else {
        comparisonData = null;
    }

    toggleModal(comparisonModal, false);
});

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

// Geração do relatório
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const unitId = document.getElementById('unitId').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!unitId || !startDate || !endDate) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        // Desabilitar o botão de submit durante a geração
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        await generateReport();

        // Reabilitar o botão após a geração
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Ocorreu um erro ao gerar o relatório. Por favor, tente novamente.');
    }
});

async function generateReport() {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!unitId || !startDate || !endDate) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }

    // Load ads data first
    const adsData = await loadAds(unitId, startDate, endDate, 
        selectedCampaigns.size > 0 ? selectedCampaigns : null, 
        selectedAdSets.size > 0 ? selectedAdSets : null
    );

    // Process ads to find top performers
    const topAds = [];
    Object.entries(adsData).forEach(([adId, ad]) => {
        let messages = 0;
        let spend = parseFloat(ad.insights.spend) || 0;
        
        if (ad.insights && ad.insights.actions) {
            ad.insights.actions.forEach(action => {
                if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                    messages += parseInt(action.value) || 0;
                }
            });
        }

        if (messages > 0) {
            topAds.push({
                id: adId,
                imageUrl: ad.creative.imageUrl,
                messages: messages,
                spend: spend,
                costPerMessage: messages > 0 ? (spend / messages).toFixed(2) : '0'
            });
        }
    });

    // Sort and get top 2 ads
    topAds.sort((a, b) => b.messages - a.messages);
    const bestAds = topAds.slice(0, 2).filter(ad => {
        return ad.imageUrl && !ad.imageUrl.includes('dummyimage');
    });

    let currentMetrics = await calculateMetrics(unitId, startDate, endDate);
    let comparisonMetrics = null;

    if (comparisonData) {
        comparisonMetrics = await calculateMetrics(
            unitId,
            comparisonData.startDate,
            comparisonData.endDate
        );
    }

    renderReport(unitName, startDate, endDate, currentMetrics, comparisonMetrics, bestAds);
}

async function calculateMetrics(unitId, startDate, endDate) {
    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    if (selectedCampaigns.size > 0) {
        for (const campaignId of selectedCampaigns) {
            const insights = await getCampaignInsights(campaignId, startDate, endDate);
            if (insights.spend) totalSpend += parseFloat(insights.spend);
            if (insights.reach) totalReach += parseInt(insights.reach);
            if (insights.actions) {
                insights.actions.forEach(action => {
                    if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                        totalConversations += parseInt(action.value);
                    }
                });
            }
        }
    } else if (selectedAdSets.size > 0) {
        for (const adSetId of selectedAdSets) {
            const insights = await getAdSetInsights(adSetId, startDate, endDate);
            if (insights.spend) totalSpend += parseFloat(insights.spend);
            if (insights.reach) totalReach += parseInt(insights.reach);
            if (insights.actions) {
                insights.actions.forEach(action => {
                    if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                        totalConversations += parseInt(action.value);
                    }
                });
            }
        }
    } else {
        const response = await new Promise((resolve) => {
            FB.api(
                `/${unitId}/insights`,
                {
                    fields: ['spend', 'actions', 'reach'],
                    time_range: { since: startDate, until: endDate },
                    level: 'account',
                    access_token: currentAccessToken
                },
                resolve
            );
        });

        if (response && !response.error && response.data.length > 0) {
            response.data.forEach(data => {
                if (data.spend) totalSpend += parseFloat(data.spend);
                if (data.reach) totalReach += parseInt(data.reach);
                if (data.actions) {
                    data.actions.forEach(action => {
                        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                            totalConversations += parseInt(action.value);
                        }
                    });
                }
            });
        }
    }

    return {
        spend: totalSpend,
        conversations: totalConversations,
        reach: totalReach,
        costPerConversation: totalConversations > 0 ? totalSpend / totalConversations : 0
    };
}

function calculateVariation(current, previous) {
    if (!previous || previous === 0) return { percentage: 0, icon: '', direction: '' };
    const percentage = ((current - previous) / previous) * 100;
    const icon = percentage >= 0 ? '⬆️' : '⬇️';
    const direction = percentage >= 0 ? 'increase' : 'decrease';
    return { percentage: Math.abs(percentage).toFixed(2), icon, direction };
}

function renderReport(unitName, startDate, endDate, metrics, comparisonMetrics, bestAds) {
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');

    let comparisonPeriod = '';
    if (comparisonMetrics && comparisonData) {
        comparisonPeriod = `
            <p class="text-gray-600">
                <i class="fas fa-calendar-alt mr-2"></i>Comparação: 
                ${comparisonData.startDate.split('-').reverse().join('/')} a 
                ${comparisonData.endDate.split('-').reverse().join('/')}
            </p>
        `;
    }

    const variations = {
        reach: calculateVariation(metrics.reach, comparisonMetrics?.reach),
        conversations: calculateVariation(metrics.conversations, comparisonMetrics?.conversations),
        costPerConversation: calculateVariation(metrics.costPerConversation, comparisonMetrics?.costPerConversation)
    };

    reportContainer.innerHTML = `
        <div class="bg-gradient-to-br from-primary to-secondary text-white rounded-xl p-6 shadow-lg">
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold mb-2">
                    <i class="fas fa-chart-pie mr-2"></i>Relatório Completo - ${unitName}
                </h2>
                <p class="text-gray-200">
                    <i class="fas fa-calendar-alt mr-2"></i>${formattedStartDate} a ${formattedEndDate}
                </p>
                ${comparisonPeriod}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="metric-card bg-white/10 backdrop-blur">
                    <div class="text-lg font-semibold mb-2">
                        <i class="fas fa-bullhorn mr-2"></i>Alcance Total
                    </div>
                    <div class="text-2xl font-bold">
                        ${metrics.reach.toLocaleString('pt-BR')}
                    </div>
                    ${comparisonMetrics ? `
                        <div class="metric-comparison ${variations.reach.direction} mt-2">
                            ${variations.reach.icon} ${variations.reach.percentage}%
                        </div>
                    ` : ''}
                </div>

                <div class="metric-card bg-white/10 backdrop-blur">
                    <div class="text-lg font-semibold mb-2">
                        <i class="fas fa-comments mr-2"></i>Mensagens
                    </div>
                    <div class="text-2xl font-bold">
                        ${metrics.conversations.toLocaleString('pt-BR')}
                    </div>
                    ${comparisonMetrics ? `
                        <div class="metric-comparison ${variations.conversations.direction} mt-2">
                            ${variations.conversations.icon} ${variations.conversations.percentage}%
                        </div>
                    ` : ''}
                </div>

                <div class="metric-card bg-white/10 backdrop-blur">
                    <div class="text-lg font-semibold mb-2">
                        <i class="fas fa-dollar-sign mr-2"></i>Custo por Mensagem
                    </div>
                    <div class="text-2xl font-bold">
                        R$ ${metrics.costPerConversation.toFixed(2).replace('.', ',')}
                    </div>
                    ${comparisonMetrics ? `
                        <div class="metric-comparison ${variations.costPerConversation.direction} mt-2">
                            ${variations.costPerConversation.icon} ${variations.costPerConversation.percentage}%
                        </div>
                    ` : ''}
                </div>

                <div class="metric-card bg-white/10 backdrop-blur">
                    <div class="text-lg font-semibold mb-2">
                        <i class="fas fa-coins mr-2"></i>Investimento Total
                    </div>
                    <div class="text-2xl font-bold">
                        R$ ${metrics.spend.toFixed(2).replace('.', ',')}
                    </div>
                </div>
            </div>

            ${bestAds && bestAds.length > 0 ? `
                <div class="mt-8">
                    <h3 class="text-xl font-bold text-white mb-4">
                        <i class="fas fa-star mr-2"></i>Anúncios com Melhor Desempenho
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${bestAds.map(ad => `
                            <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                                <div class="aspect-video mb-4 rounded-lg overflow-hidden">
                                    <img src="${ad.imageUrl}" 
                                        alt="Anúncio" 
                                        class="w-full h-full object-cover"
                                        crossorigin="anonymous"
                                        loading="lazy">
                                </div>
                                <div class="space-y-2 text-white">
                                    <div class="flex justify-between items-center">
                                        <span>Mensagens:</span>
                                        <span class="font-bold">${ad.messages}</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span>Custo por Mensagem:</span>
                                        <span class="font-bold">R$ ${ad.costPerMessage.replace('.', ',')}</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span>Investimento:</span>
                                        <span class="font-bold">R$ ${ad.spend.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    shareWhatsAppBtn.style.display = 'block';
}

// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const reportText = reportContainer.innerText;
    const encodedText = encodeURIComponent(reportText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
});

// Navegação
backToReportSelectionBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.replace('index.html?screen=reportSelection');
});
