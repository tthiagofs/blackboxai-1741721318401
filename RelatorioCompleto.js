import { fbAuth } from './auth.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
const hasBlackYesBtn = document.getElementById('hasBlackYesBtn');
const hasBlackNoBtn = document.getElementById('hasBlackNoBtn');
const filterWhiteCampaignsBtn = document.getElementById('filterWhiteCampaigns');
const filterWhiteAdSetsBtn = document.getElementById('filterWhiteAdSets');
const filterBlackCampaignsBtn = document.getElementById('filterBlackCampaigns');
const filterBlackAdSetsBtn = document.getElementById('filterBlackAdSets');
const whiteFilters = document.getElementById('whiteFilters');
const blackFilters = document.getElementById('blackFilters');
const defaultFilters = document.getElementById('defaultFilters');
const comparisonFilter = document.getElementById('comparisonFilter');

// Modais
const closeCampaignsModalBtn = document.getElementById('closeCampaignsModal');
const closeAdSetsModalBtn = document.getElementById('closeAdSetsModal');
const applyCampaignsBtn = document.getElementById('applyCampaigns');
const applyAdSetsBtn = document.getElementById('applyAdSets');
const confirmComparisonBtn = document.getElementById('confirmComparison');
const cancelComparisonBtn = document.getElementById('cancelComparison');
const closeWhiteCampaignsModalBtn = document.getElementById('closeWhiteCampaignsModal');
const closeWhiteAdSetsModalBtn = document.getElementById('closeWhiteAdSetsModal');
const applyWhiteCampaignsBtn = document.getElementById('applyWhiteCampaigns');
const applyWhiteAdSetsBtn = document.getElementById('applyWhiteAdSets');
const closeBlackCampaignsModalBtn = document.getElementById('closeBlackCampaignsModal');
const closeBlackAdSetsModalBtn = document.getElementById('closeBlackAdSetsModal');
const applyBlackCampaignsBtn = document.getElementById('applyBlackCampaigns');
const applyBlackAdSetsBtn = document.getElementById('applyBlackAdSets');
const refreshBtn = document.getElementById('refreshBtn');

// Estado
let selectedCampaigns = new Set();
let selectedAdSets = new Set();
let selectedWhiteCampaigns = new Set();
let selectedWhiteAdSets = new Set();
let selectedBlackCampaigns = new Set();
let selectedBlackAdSets = new Set();
let isCampaignFilterActive = false;
let isAdSetFilterActive = false;
let isFilterActivated = false;
let comparisonData = null;
let hasBlack = null; // null (não respondido), true (Sim), false (Não)

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

// Desabilitar botões até que a pergunta "A unidade possui Black?" seja respondida
function disableButtons() {
    filterCampaignsBtn.disabled = true;
    filterAdSetsBtn.disabled = true;
    comparePeriodsBtn.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;

    filterWhiteCampaignsBtn.disabled = true;
    filterWhiteAdSetsBtn.disabled = true;
    filterBlackCampaignsBtn.disabled = true;
    filterBlackAdSetsBtn.disabled = true;

    filterCampaignsBtn.classList.add('opacity-50');
    filterAdSetsBtn.classList.add('opacity-50');
    comparePeriodsBtn.classList.add('opacity-50');
    form.querySelector('button[type="submit"]').classList.add('opacity-50');

    filterWhiteCampaignsBtn.classList.add('opacity-50');
    filterWhiteAdSetsBtn.classList.add('opacity-50');
    filterBlackCampaignsBtn.classList.add('opacity-50');
    filterBlackAdSetsBtn.classList.add('opacity-50');
}

// Habilitar botões após a resposta
function enableButtons() {
    if (hasBlack) {
        filterWhiteCampaignsBtn.disabled = false;
        filterWhiteAdSetsBtn.disabled = false;
        filterBlackCampaignsBtn.disabled = false;
        filterBlackAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;
        form.querySelector('button[type="submit"]').disabled = false;

        filterWhiteCampaignsBtn.classList.remove('opacity-50');
        filterWhiteAdSetsBtn.classList.remove('opacity-50');
        filterBlackCampaignsBtn.classList.remove('opacity-50');
        filterBlackAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
        form.querySelector('button[type="submit"]').classList.remove('opacity-50');
    } else {
        filterCampaignsBtn.disabled = false;
        filterAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;
        form.querySelector('button[type="submit"]').disabled = false;

        filterCampaignsBtn.classList.remove('opacity-50');
        filterAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
        form.querySelector('button[type="submit"]').classList.remove('opacity-50');
    }
}

// Inicialmente desabilitar os botões
disableButtons();

// Funções de Modal
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal com ID "${modalId}" não encontrado no DOM.`);
        return;
    }
    if (show) {
        modal.classList.remove('hidden');
        if (modalId === 'campaignsModal') {
            renderCampaignOptions();
        } else if (modalId === 'adSetsModal') {
            renderAdSetOptions();
        } else if (modalId === 'whiteCampaignsModal') {
            renderWhiteCampaignOptions();
        } else if (modalId === 'whiteAdSetsModal') {
            renderWhiteAdSetOptions();
        } else if (modalId === 'blackCampaignsModal') {
            renderBlackCampaignOptions();
        } else if (modalId === 'blackAdSetsModal') {
            renderBlackAdSetOptions();
        }
    } else {
        modal.classList.add('hidden');
    }
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
    if (hasBlack) {
        filterWhiteCampaignsBtn.disabled = isFilterActivated && selectedWhiteAdSets.size > 0;
        filterWhiteAdSetsBtn.disabled = isFilterActivated && selectedWhiteCampaigns.size > 0;
        filterBlackCampaignsBtn.disabled = isFilterActivated && selectedBlackAdSets.size > 0;
        filterBlackAdSetsBtn.disabled = isFilterActivated && selectedBlackCampaigns.size > 0;

        filterWhiteCampaignsBtn.classList.toggle('opacity-50', filterWhiteCampaignsBtn.disabled);
        filterWhiteAdSetsBtn.classList.toggle('opacity-50', filterWhiteAdSetsBtn.disabled);
        filterBlackCampaignsBtn.classList.toggle('opacity-50', filterBlackCampaignsBtn.disabled);
        filterBlackAdSetsBtn.classList.toggle('opacity-50', filterBlackAdSetsBtn.disabled);
    } else {
        filterCampaignsBtn.disabled = isFilterActivated && selectedAdSets.size > 0;
        filterAdSetsBtn.disabled = isFilterActivated && selectedCampaigns.size > 0;

        filterCampaignsBtn.classList.toggle('opacity-50', filterCampaignsBtn.disabled);
        filterAdSetsBtn.classList.toggle('opacity-50', filterAdSetsBtn.disabled);
    }
}

// Event Listeners para os botões "Sim" e "Não"
hasBlackYesBtn.addEventListener('click', () => {
    hasBlack = true;
    whiteFilters.classList.remove('hidden');
    blackFilters.classList.remove('hidden');
    defaultFilters.classList.add('hidden');
    comparisonFilter.classList.remove('hidden');
    enableButtons();
});

hasBlackNoBtn.addEventListener('click', () => {
    hasBlack = false;
    whiteFilters.classList.add('hidden');
    blackFilters.classList.add('hidden');
    defaultFilters.classList.remove('hidden');
    comparisonFilter.classList.remove('hidden');
    enableButtons();
});

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

        if (filteredAdSets && filteredAdSets.size > 0) {
            const adSetIds = Array.from(filteredAdSets);
            for (const adSetId of adSetIds) {
                let url = `/${adSetId}/ads?fields=id,creative&access_token=${currentAccessToken}&limit=50`;
                while (url) {
                    const adResponse = await new Promise((resolve) => {
                        FB.api(url, resolve);
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
                        url = adResponse.paging && adResponse.paging.next ? adResponse.paging.next : null;
                    } else {
                        console.error(`Erro ao carregar anúncios do ad set ${adSetId}:`, adResponse?.error);
                        url = null;
                    }
                    await delay(500);
                }
            }
        } else if (filteredCampaigns && filteredCampaigns.size > 0) {
            const campaignIds = Array.from(filteredCampaigns);
            for (const campaignId of campaignIds) {
                let url = `/${campaignId}/ads?fields=id,creative&access_token=${currentAccessToken}&limit=50`;
                while (url) {
                    const adResponse = await new Promise((resolve) => {
                        FB.api(url, resolve);
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
                        url = adResponse.paging && adResponse.paging.next ? adResponse.paging.next : null;
                    } else {
                        console.error(`Erro ao carregar anúncios da campanha ${campaignId}:`, adResponse?.error);
                        url = null;
                    }
                    await delay(500);
                }
            }
        } else {
            let url = `/${unitId}/ads?fields=id,creative&access_token=${currentAccessToken}&limit=50`;
            while (url) {
                const adResponse = await new Promise(resolve => {
                    FB.api(url, resolve);
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
                    url = adResponse.paging && adResponse.paging.next ? adResponse.paging.next : null;
                } else {
                    console.error(`Erro ao carregar anúncios da conta ${unitId}:`, adResponse?.error);
                    url = null;
                }
                await delay(500);
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
        let url = `/${unitId}/campaigns?fields=id,name&access_token=${currentAccessToken}&limit=50`;

        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allCampaigns = allCampaigns.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                console.error(`Erro ao carregar campanhas para a unidade ${unitId}:`, response?.error);
                url = null;
            }
            await delay(500);
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

        console.log('Campanhas carregadas:', campaignsMap[unitId]);

        if (hasBlack) {
            renderWhiteCampaignOptions();
            renderBlackCampaignOptions();
        } else {
            renderCampaignOptions();
        }
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

async function loadAdSets(unitId, startDate, endDate) {
    try {
        adSetsMap[unitId] = {};
        let allAdSets = [];
        let url = `/${unitId}/adsets?fields=id,name&access_token=${currentAccessToken}&limit=50`;

        while (url) {
            const response = await new Promise((resolve) => {
                FB.api(url, resolve);
            });

            if (response && !response.error) {
                allAdSets = allAdSets.concat(response.data);
                url = response.paging && response.paging.next ? response.paging.next : null;
            } else {
                console.error(`Erro ao carregar ad sets para a unidade ${unitId}:`, response?.error);
                url = null;
            }
            await delay(500);
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

        if (hasBlack) {
            renderWhiteAdSetOptions();
            renderBlackAdSetOptions();
        } else {
            renderAdSetOptions();
        }
    } catch (error) {
        console.error('Erro ao carregar conjuntos:', error);
    }
}

// Funções para obter insights
async function getCampaignInsights(campaignId, startDate, endDate) {
    await delay(200);
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
                    console.log(`Insights para campanha ${campaignId}:`, response.data[0]);
                    resolve(response.data[0]);
                } else {
                    console.error(`Erro ao buscar insights para campanha ${campaignId}:`, response?.error);
                    resolve({ spend: '0', actions: [], reach: '0' });
                }
            }
        );
    });
}

async function getAdSetInsights(adSetId, startDate, endDate) {
    await delay(200);
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
    await delay(200);
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
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedCampaigns.has(campaign.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedCampaigns.has(campaign.id)) {
                selectedCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedCampaigns.add(campaign.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
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
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedAdSets.has(adSet.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedAdSets.has(adSet.id)) {
                selectedAdSets.delete(adSet.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedAdSets.add(adSet.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderWhiteCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('whiteCampaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedWhiteCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedWhiteCampaigns.has(campaign.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedWhiteCampaigns.has(campaign.id)) {
                selectedWhiteCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedWhiteCampaigns.add(campaign.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderWhiteAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('whiteAdSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedWhiteAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedWhiteAdSets.has(adSet.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedWhiteAdSets.has(adSet.id)) {
                selectedWhiteAdSets.delete(adSet.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedWhiteAdSets.add(adSet.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderBlackCampaignOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('blackCampaignsList');
    const campaigns = Object.entries(campaignsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    campaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedBlackCampaigns.has(campaign.id) ? 'selected' : ''}`;
        option.dataset.id = campaign.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${campaign.name}</span>
                <span class="text-sm ${campaign.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${campaign.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedBlackCampaigns.has(campaign.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedBlackCampaigns.has(campaign.id)) {
                selectedBlackCampaigns.delete(campaign.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedBlackCampaigns.add(campaign.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

function renderBlackAdSetOptions() {
    const unitId = document.getElementById('unitId').value;
    const container = document.getElementById('blackAdSetsList');
    const adSets = Object.entries(adSetsMap[unitId] || {})
        .map(([id, data]) => ({
            id,
            name: data.name,
            spend: data.insights.spend
        }))
        .sort((a, b) => b.spend - a.spend);

    container.innerHTML = '';

    adSets.forEach(adSet => {
        const option = document.createElement('div');
        option.className = `filter-option ${selectedBlackAdSets.has(adSet.id) ? 'selected' : ''}`;
        option.dataset.id = adSet.id;
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${adSet.name}</span>
                <span class="text-sm ${adSet.spend > 0 ? 'text-green-600' : 'text-gray-500'}">
                    R$ ${adSet.spend.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;

        if (selectedBlackAdSets.has(adSet.id)) {
            option.style.background = '#2563eb';
            option.style.color = '#ffffff';
        } else {
            option.style.background = '#ffffff';
            option.style.color = '';
        }

        option.addEventListener('click', () => {
            if (selectedBlackAdSets.has(adSet.id)) {
                selectedBlackAdSets.delete(adSet.id);
                option.classList.remove('selected');
                option.style.background = '#ffffff';
                option.style.color = '';
            } else {
                selectedBlackAdSets.add(adSet.id);
                option.classList.add('selected');
                option.style.background = '#2563eb';
                option.style.color = '#ffffff';
            }
            updateFilterButtons();
        });

        container.appendChild(option);
    });
}

// Event Listeners
if (filterCampaignsBtn) {
    filterCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', true));
}
if (filterAdSetsBtn) {
    filterAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', true));
}
if (filterWhiteCampaignsBtn) {
    filterWhiteCampaignsBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', true));
}
if (filterWhiteAdSetsBtn) {
    filterWhiteAdSetsBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', true));
}
if (filterBlackCampaignsBtn) {
    filterBlackCampaignsBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', true));
}
if (filterBlackAdSetsBtn) {
    filterBlackAdSetsBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', true));
}
if (comparePeriodsBtn) {
    comparePeriodsBtn.addEventListener('click', () => toggleModal('comparisonModal', true));
}
if (closeCampaignsModalBtn) {
    closeCampaignsModalBtn.addEventListener('click', () => toggleModal('campaignsModal', false));
}
if (closeAdSetsModalBtn) {
    closeAdSetsModalBtn.addEventListener('click', () => toggleModal('adSetsModal', false));
}
if (applyCampaignsBtn) {
    applyCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', false));
}
if (applyAdSetsBtn) {
    applyAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', false));
}
if (closeWhiteCampaignsModalBtn) {
    closeWhiteCampaignsModalBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', false));
}
if (closeWhiteAdSetsModalBtn) {
    closeWhiteAdSetsModalBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', false));
}
if (applyWhiteCampaignsBtn) {
    applyWhiteCampaignsBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', false));
}
if (applyWhiteAdSetsBtn) {
    applyWhiteAdSetsBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', false));
}
if (closeBlackCampaignsModalBtn) {
    closeBlackCampaignsModalBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', false));
}
if (closeBlackAdSetsModalBtn) {
    closeBlackAdSetsModalBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', false));
}
if (applyBlackCampaignsBtn) {
    applyBlackCampaignsBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', false));
}
if (applyBlackAdSetsBtn) {
    applyBlackAdSetsBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', false));
}
if (cancelComparisonBtn) {
    cancelComparisonBtn.addEventListener('click', () => toggleModal('comparisonModal', false));
}

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

    toggleModal('comparisonModal', false);
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
        const unitName = unitSelect.options[unitSelect.selectedIndex].text;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        console.log(`Dados do formulário - unitId: ${unitId}, unitName: ${unitName}, startDate: ${startDate}, endDate: ${endDate}`);

        if (!unitId || !startDate || !endDate) {
            alert('Por favor, preencha todos os campos obrigatórios (unidade, data de início e data de fim).');
            return;
        }

        if (hasBlack === null) {
            alert('Por favor, responda se a unidade possui Black antes de gerar o relatório.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        // Corrigir a chamada para passar os parâmetros
        await generateReport(unitId, unitName, startDate, endDate);

        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Ocorreu um erro ao gerar o relatório. Por favor, tente novamente.');
    }
});


async function generateReport(unitId, unitName, startDate, endDate) {
    try {
        // Validações iniciais
        if (!unitId || !unitName) {
            throw new Error('Unidade ou nome da unidade não fornecidos.');
        }
        if (!startDate || !endDate) {
            throw new Error('Datas de início ou fim não fornecidas.');
        }
        if (!currentAccessToken) {
            throw new Error('Token de acesso do Facebook não encontrado. Por favor, faça login novamente.');
        }

        console.log(`Gerando relatório para unitId: ${unitId}, unitName: ${unitName}, startDate: ${startDate}, endDate: ${endDate}`);

        const today = new Date().toISOString().split('T')[0];
        if (startDate > today || endDate > today) {
            throw new Error('As datas selecionadas não podem ser futuras. Por favor, escolha um período passado ou até a data atual.');
        }

        // Limpar o container do relatório
        if (!reportContainer) {
            throw new Error('Container do relatório não encontrado no DOM.');
        }
        reportContainer.innerHTML = '<p class="text-center text-gray-600">Gerando relatório, por favor aguarde...</p>';

        if (!shareWhatsAppBtn) {
            throw new Error('Botão de compartilhamento do WhatsApp não encontrado no DOM.');
        }
        shareWhatsAppBtn.classList.add('hidden');

        let metrics, comparisonMetrics, blackMetrics, blackComparisonMetrics, comparisonTotalLeads;

        // Calcular métricas com base em hasBlack
        if (hasBlack === null) {
            throw new Error('Por favor, informe se a unidade possui Black antes de gerar o relatório.');
        }

        if (hasBlack) {
            console.log('Calculando métricas para White e Black...');
            metrics = await calculateMetrics(unitId, startDate, endDate, selectedWhiteCampaigns, selectedWhiteAdSets);
            blackMetrics = await calculateMetrics(unitId, startDate, endDate, selectedBlackCampaigns, selectedBlackAdSets);
        } else {
            console.log('Calculando métricas gerais...');
            metrics = await calculateMetrics(unitId, startDate, endDate, selectedCampaigns, selectedAdSets);
            blackMetrics = null;
        }

        // Calcular métricas de comparação, se aplicável
        if (comparisonData && comparisonData.option !== 'none') {
            const { startDate: compareStartDate, endDate: compareEndDate } = comparisonData;
            if (!compareStartDate || !compareEndDate) {
                throw new Error('Datas de comparação não fornecidas.');
            }
            if (compareStartDate > today || compareEndDate > today) {
                throw new Error('As datas de comparação não podem ser futuras.');
            }

            console.log(`Calculando métricas de comparação para o período: ${compareStartDate} a ${compareEndDate}`);
            if (hasBlack) {
                comparisonTotalLeads = await calculateTotalLeadsForAccount(unitId, compareStartDate, compareEndDate);
                comparisonMetrics = null;
                blackComparisonMetrics = null;
            } else {
                comparisonMetrics = await calculateMetrics(unitId, compareStartDate, compareEndDate, selectedCampaigns, selectedAdSets);
                blackComparisonMetrics = null;
            }
        } else {
            comparisonMetrics = null;
            blackComparisonMetrics = null;
            comparisonTotalLeads = null;
        }

        // Buscar melhores anúncios
        console.log('Buscando melhores anúncios...');
        const bestAds = await getBestAds(unitId, startDate, endDate);

        // Renderizar o relatório
        console.log('Renderizando relatório...');
        renderReport(unitName, startDate, endDate, metrics, comparisonMetrics, blackMetrics, blackComparisonMetrics, bestAds, comparisonTotalLeads);

        // Mostrar botão de compartilhamento
        shareWhatsAppBtn.classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        reportContainer.innerHTML = `<p class="text-center text-red-600">${error.message || 'Erro ao gerar o relatório. Por favor, tente novamente.'}</p>`;
    }
}

async function calculateMetrics(unitId, startDate, endDate, campaignsSet, adSetsSet) {
    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    // Validações
    if (!unitId) {
        throw new Error('ID da unidade não fornecido.');
    }
    if (!startDate || !endDate) {
        throw new Error('Período de análise não fornecido.');
    }
    if (!(campaignsSet instanceof Set) || !(adSetsSet instanceof Set)) {
        throw new Error('Conjuntos de campanhas ou ad sets inválidos.');
    }

    console.log(`Chamando API para unitId: ${unitId}, período: ${startDate} a ${endDate}`);
    console.log(`Campanhas selecionadas: ${Array.from(campaignsSet)}`);
    console.log(`Conjuntos selecionados: ${Array.from(adSetsSet)}`);

    const response = await new Promise((resolve) => {
        FB.api(
            `/${unitId}/insights`,
            {
                fields: ['spend', 'reach', 'actions'],
                time_range: { since: startDate, until: endDate },
                filtering: [
                    campaignsSet.size > 0 ? { field: 'campaign.id', operator: 'IN', value: Array.from(campaignsSet) } : {},
                    adSetsSet.size > 0 ? { field: 'adset.id', operator: 'IN', value: Array.from(adSetsSet) } : {}
                ].filter(filter => Object.keys(filter).length > 0),
                access_token: currentAccessToken
            },
            resolve
        );
    });

    console.log('Resposta da API:', response);

    if (response && !response.error && response.data && response.data.length > 0) {
        response.data.forEach(data => {
            console.log('Dados da campanha/conjunto:', data);
            totalSpend += parseFloat(data.spend) || 0;
            totalReach += parseInt(data.reach) || 0;
            if (data.actions && Array.isArray(data.actions)) {
                const conversationAction = data.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalConversations += parseInt(conversationAction.value) || 0;
                }
            }
        });
    } else {
        console.log('Nenhum dado retornado ou erro na API:', response?.error || 'Sem dados');
    }

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

    console.log(`Métricas calculadas - Investimento: ${totalSpend}, Alcance: ${totalReach}, Conversas: ${totalConversations}`);
    return { spend: totalSpend, conversations: totalConversations, reach: totalReach, costPerConversation };
}


async function calculateTotalLeadsForAccount(unitId, startDate, endDate) {
    let totalConversations = 0;

    // Validações
    if (!unitId) {
        throw new Error('ID da unidade não fornecido.');
    }
    if (!startDate || !endDate) {
        throw new Error('Período de análise não fornecido.');
    }

    console.log(`Calculando total de leads para a conta ${unitId}, período: ${startDate} a ${endDate}`);

    const response = await new Promise((resolve) => {
        FB.api(
            `/${unitId}/insights`,
            {
                fields: ['actions'],
                time_range: { since: startDate, until: endDate },
                level: 'account',
                access_token: currentAccessToken
            },
            resolve
        );
    });

    console.log('Resposta da API (total de leads):', response);

    if (response && !response.error && response.data && response.data.length > 0) {
        response.data.forEach(data => {
            if (data.actions && Array.isArray(data.actions)) {
                const conversationAction = data.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalConversations += parseInt(conversationAction.value) || 0;
                }
            }
        });
    } else {
        console.log('Nenhum dado retornado ou erro na API (total de leads):', response?.error || 'Sem dados');
    }

    console.log(`Total de leads da conta no período de comparação: ${totalConversations}`);
    return totalConversations;
}


async function getBestAds(unitId, startDate, endDate) {
    const bestAds = [];
    let url = '';

    console.log(`Iniciando busca de melhores anúncios para unitId: ${unitId}, período: ${startDate} a ${endDate}`);

    // Determinar quais campanhas/conjuntos buscar com base nas seleções
    if (hasBlack) {
        // Se hasBlack é true, buscar anúncios de campanhas/conjuntos White e Black selecionados
        const whiteCampaignIds = Array.from(selectedWhiteCampaigns);
        const whiteAdSetIds = Array.from(selectedWhiteAdSets);
        const blackCampaignIds = Array.from(selectedBlackCampaigns);
        const blackAdSetIds = Array.from(selectedBlackAdSets);

        console.log(`Campanhas White selecionadas: ${whiteCampaignIds}`);
        console.log(`Conjuntos White selecionados: ${whiteAdSetIds}`);
        console.log(`Campanhas Black selecionadas: ${blackCampaignIds}`);
        console.log(`Conjuntos Black selecionados: ${blackAdSetIds}`);

        // Função auxiliar para buscar anúncios de uma lista de campanhas ou conjuntos
        const fetchAds = async (campaignIds, adSetIds, type) => {
            const adsList = [];
            if (adSetIds.length > 0) {
                for (const adSetId of adSetIds) {
                    let adSetUrl = `/${adSetId}/ads?fields=id,creative&access_token=${currentAccessToken}&limit=50`;
                    while (adSetUrl) {
                        const adResponse = await new Promise((resolve) => {
                            FB.api(adSetUrl, resolve);
                        });
                        if (adResponse && !adResponse.error) {
                            console.log(`Anúncios carregados do conjunto ${type} ${adSetId}: ${adResponse.data.length}`);
                            adsList.push(...adResponse.data.map(ad => ({ ...ad, type })));
                            adSetUrl = adResponse.paging?.next || null;
                        } else {
                            console.error(`Erro ao carregar anúncios do conjunto ${type} ${adSetId}:`, adResponse?.error || adResponse);
                            adSetUrl = null;
                        }
                        await delay(500);
                    }
                }
            } else if (campaignIds.length > 0) {
                for (const campaignId of campaignIds) {
                    let campaignUrl = `/${campaignId}/ads?fields=id,creative&access_token=${currentAccessToken}&limit=50`;
                    while (campaignUrl) {
                        const adResponse = await new Promise((resolve) => {
                            FB.api(campaignUrl, resolve);
                        });
                        if (adResponse && !adResponse.error) {
                            console.log(`Anúncios carregados da campanha ${type} ${campaignId}: ${adResponse.data.length}`);
                            adsList.push(...adResponse.data.map(ad => ({ ...ad, type })));
                            campaignUrl = adResponse.paging?.next || null;
                        } else {
                            console.error(`Erro ao carregar anúncios da campanha ${type} ${campaignId}:`, adResponse?.error || adResponse);
                            campaignUrl = null;
                        }
                        await delay(500);
                    }
                }
            }
            return adsList;
        };

        // Buscar anúncios White e Black
        const whiteAds = await fetchAds(whiteCampaignIds, whiteAdSetIds, 'White');
        const blackAds = await fetchAds(blackCampaignIds, blackAdSetIds, 'Black');

        // Combinar os anúncios
        let allAds = [...whiteAds, ...blackAds];
        console.log(`Total de anúncios encontrados (White + Black): ${allAds.length}`);

        // Se não houver seleções, buscar todos os anúncios da conta
        if (whiteCampaignIds.length === 0 && whiteAdSetIds.length === 0 && blackCampaignIds.length === 0 && blackAdSetIds.length === 0) {
            console.log('Nenhuma campanha ou conjunto selecionado. Buscando todos os anúncios da conta...');
            allAds = []; // Resetar a lista
            url = `/${unitId}/ads?fields=id,creative,effective_status&access_token=${currentAccessToken}&limit=50`;
            let pageCount = 0;
            while (url) {
                pageCount++;
                console.log(`Buscando página ${pageCount} de anúncios da conta...`);
                const adResponse = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });
                if (adResponse && !adResponse.error) {
                    const ads = adResponse.data || [];
                    console.log(`Anúncios carregados na página ${pageCount}: ${ads.length}`);
                    allAds.push(...ads.map(ad => ({ ...ad, type: 'Geral' })));
                    url = adResponse.paging?.next || null;
                } else {
                    console.error(`Erro ao carregar anúncios da conta ${unitId} (página ${pageCount}):`, adResponse?.error || adResponse);
                    url = null;
                }
                await delay(500);
            }
            console.log(`Total de anúncios encontrados (geral): ${allAds.length}`);
            if (allAds.length === 0) {
                console.log('Nenhum anúncio encontrado para a conta. Verifique permissões ou se há anúncios disponíveis.');
            }
        }

        // Processar os anúncios
        console.log('Processando anúncios...');
        for (const ad of allAds) {
            let messages = 0;
            let costPerMessage = 0;
            let spend = 0;
            let imageUrl = 'https://dummyimage.com/150x150/ccc/fff';

            // Verificar o status do anúncio
            const status = ad.effective_status || 'UNKNOWN';
            console.log(`Anúncio ${ad.id} (${ad.type}) - Status: ${status}`);

            const insightsResponse = await new Promise((resolve) => {
                FB.api(
                    `/${ad.id}/insights`,
                    {
                        fields: 'actions,spend,reach',
                        time_range: { since: startDate, until: endDate },
                        access_token: currentAccessToken
                    },
                    resolve
                );
            });

            if (insightsResponse && !insightsResponse.error && insightsResponse.data && insightsResponse.data.length > 0) {
                const insights = insightsResponse.data[0];
                console.log(`Anúncio ${ad.id} (${ad.type}) - Período retornado: ${insights.date_start} a ${insights.date_stop}, Solicitado: ${startDate} a ${endDate}`);
                if (insights.actions) {
                    const conversationAction = insights.actions.find(
                        action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                    );
                    messages = conversationAction ? parseInt(conversationAction.value) || 0 : 0;
                }
                spend = insights.spend ? parseFloat(insights.spend) : 0;
                costPerMessage = messages > 0 ? (spend / messages).toFixed(2) : '0.00';
            } else {
                console.log(`Anúncio ${ad.id} (${ad.type}) - Nenhum insight retornado para o período`);
                if (insightsResponse?.error) {
                    console.error(`Erro ao carregar insights do anúncio ${ad.id}:`, insightsResponse.error);
                }
            }

            if (messages > 0 && ad.creative && ad.creative.id) {
                const creativeData = await getCreativeData(ad.creative.id);
                imageUrl = creativeData.imageUrl;
            }

            if (messages > 0) {
                bestAds.push({
                    imageUrl: imageUrl,
                    messages: messages,
                    costPerMessage: costPerMessage,
                    type: ad.type
                });
            }

            if (bestAds.length >= 3) {
                console.log('Encontrados 3 anúncios com mensagens, interrompendo busca.');
                break;
            }
        }
    } else {
        // Se hasBlack é false, buscar anúncios das campanhas/conjuntos gerais selecionados
        const campaignIds = Array.from(selectedCampaigns);
        const adSetIds = Array.from(selectedAdSets);

        console.log(`Campanhas selecionadas: ${campaignIds}`);
        console.log(`Conjuntos selecionados: ${adSetIds}`);

        const adsList = [];
        if (adSetIds.length > 0) {
            for (const adSetId of adSetIds) {
                url = `/${adSetId}/ads?fields=id,creative,effective_status&access_token=${currentAccessToken}&limit=50`;
                while (url) {
                    const adResponse = await new Promise((resolve) => {
                        FB.api(url, resolve);
                    });
                    if (adResponse && !adResponse.error) {
                        console.log(`Anúncios carregados do conjunto ${adSetId}: ${adResponse.data.length}`);
                        adsList.push(...adResponse.data);
                        url = adResponse.paging?.next || null;
                    } else {
                        console.error(`Erro ao carregar anúncios do conjunto ${adSetId}:`, adResponse?.error || adResponse);
                        url = null;
                    }
                    await delay(500);
                }
            }
        } else if (campaignIds.length > 0) {
            for (const campaignId of campaignIds) {
                url = `/${campaignId}/ads?fields=id,creative,effective_status&access_token=${currentAccessToken}&limit=50`;
                while (url) {
                    const adResponse = await new Promise((resolve) => {
                        FB.api(url, resolve);
                    });
                    if (adResponse && !adResponse.error) {
                        console.log(`Anúncios carregados da campanha ${campaignId}: ${adResponse.data.length}`);
                        adsList.push(...adResponse.data);
                        url = adResponse.paging?.next || null;
                    } else {
                        console.error(`Erro ao carregar anúncios da campanha ${campaignId}:`, adResponse?.error || adResponse);
                        url = null;
                    }
                    await delay(500);
                }
            }
        } else {
            // Se nada for selecionado, buscar todos os anúncios da conta
            console.log('Nenhuma campanha ou conjunto selecionado. Buscando todos os anúncios da conta...');
            url = `/${unitId}/ads?fields=id,creative,effective_status&access_token=${currentAccessToken}&limit=50`;
            let pageCount = 0;
            while (url) {
                pageCount++;
                console.log(`Buscando página ${pageCount} de anúncios da conta...`);
                const adResponse = await new Promise((resolve) => {
                    FB.api(url, resolve);
                });
                if (adResponse && !adResponse.error) {
                    const ads = adResponse.data || [];
                    console.log(`Anúncios carregados na página ${pageCount}: ${ads.length}`);
                    adsList.push(...ads);
                    url = adResponse.paging?.next || null;
                } else {
                    console.error(`Erro ao carregar anúncios da conta ${unitId} (página ${pageCount}):`, adResponse?.error || adResponse);
                    url = null;
                }
                await delay(500);
            }
            console.log(`Total de anúncios encontrados (geral): ${adsList.length}`);
            if (adsList.length === 0) {
                console.log('Nenhum anúncio encontrado para a conta. Verifique permissões ou se há anúncios disponíveis.');
            }
        }

        console.log('Processando anúncios...');
        for (const ad of adsList) {
            let messages = 0;
            let costPerMessage = 0;
            let spend = 0;
            let imageUrl = 'https://dummyimage.com/150x150/ccc/fff';

            // Verificar o status do anúncio
            const status = ad.effective_status || 'UNKNOWN';
            console.log(`Anúncio ${ad.id} - Status: ${status}`);

            const insightsResponse = await new Promise((resolve) => {
                FB.api(
                    `/${ad.id}/insights`,
                    {
                        fields: 'actions,spend,reach',
                        time_range: { since: startDate, until: endDate },
                        access_token: currentAccessToken
                    },
                    resolve
                );
            });

            if (insightsResponse && !insightsResponse.error && insightsResponse.data && insightsResponse.data.length > 0) {
                const insights = insightsResponse.data[0];
                console.log(`Anúncio ${ad.id} - Período retornado: ${insights.date_start} a ${insights.date_stop}, Solicitado: ${startDate} a ${endDate}`);
                if (insights.actions) {
                    const conversationAction = insights.actions.find(
                        action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                    );
                    messages = conversationAction ? parseInt(conversationAction.value) || 0 : 0;
                }
                spend = insights.spend ? parseFloat(insights.spend) : 0;
                costPerMessage = messages > 0 ? (spend / messages).toFixed(2) : '0.00';
            } else {
                console.log(`Anúncio ${ad.id} - Nenhum insight retornado para o período`);
                if (insightsResponse?.error) {
                    console.error(`Erro ao carregar insights do anúncio ${ad.id}:`, insightsResponse.error);
                }
            }

            if (messages > 0 && ad.creative && ad.creative.id) {
                const creativeData = await getCreativeData(ad.creative.id);
                imageUrl = creativeData.imageUrl;
            }

            if (messages > 0) {
                bestAds.push({
                    imageUrl: imageUrl,
                    messages: messages,
                    costPerMessage: costPerMessage
                });
            }

            if (bestAds.length >= 3) {
                console.log('Encontrados 3 anúncios com mensagens, interrompendo busca.');
                break;
            }
        }
    }

    // Ordenar por número de mensagens (decrescente) e limitar a 3 anúncios
    bestAds.sort((a, b) => b.messages - a.messages);
    console.log('Melhores anúncios selecionados:', bestAds);
    return bestAds.slice(0, 3);
}


function calculateVariation(current, previous, metric) {
    if (!previous || previous === 0) return { percentage: 0, direction: 'neutral' };
    const percentage = ((current - previous) / previous) * 100;

    let direction;
    if (metric === 'costPerConversation') {
        direction = percentage < 0 ? 'positive' : 'negative';
    } else {
        direction = percentage >= 0 ? 'positive' : 'negative';
    }

    return { percentage: Math.abs(percentage).toFixed(2), direction };
}

function renderReport(unitName, startDate, endDate, metrics, comparisonMetrics, blackMetrics, blackComparisonMetrics, bestAds, comparisonTotalLeads) {
    const formatCurrency = (value) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatNumber = (value) => {
        return value.toLocaleString('pt-BR');
    };

    const start = new Date(startDate).toLocaleDateString('pt-BR');
    const end = new Date(endDate).toLocaleDateString('pt-BR');

    let reportHTML = `
        <h2 class="text-2xl font-bold text-primary mb-4">
            Relatório Completo - ${unitName}
        </h2>
        <p class="text-gray-600 mb-4"><strong>Período Analisado:</strong> ${start} a ${end}</p>
    `;

    // Seção de Campanhas
    reportHTML += `
        <div class="bg-primary text-white rounded-lg p-4 mb-6">
            <h3 class="text-xl font-semibold mb-2">Campanhas</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p class="text-sm">Investimento</p>
                    <p class="text-lg font-bold">${formatCurrency(metrics.spend)}</p>
                </div>
                <div>
                    <p class="text-sm">Alcance</p>
                    <p class="text-lg font-bold">${formatNumber(metrics.reach)}</p>
                </div>
                <div>
                    <p class="text-sm">Conversas Iniciadas</p>
                    <p class="text-lg font-bold">${metrics.conversations}</p>
                </div>
                <div>
                    <p class="text-sm">Custo por Conversa</p>
                    <p class="text-lg font-bold">${formatCurrency(metrics.costPerConversation)}</p>
                </div>
            </div>
        </div>
    `;

    // Seção de Black (se aplicável)
    if (hasBlack && blackMetrics) {
        reportHTML += `
            <div class="bg-gray-800 text-white rounded-lg p-4 mb-6">
                <h3 class="text-xl font-semibold mb-2">Black</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p class="text-sm">Investimento</p>
                        <p class="text-lg font-bold">${formatCurrency(blackMetrics.spend)}</p>
                    </div>
                    <div>
                        <p class="text-sm">Alcance</p>
                        <p class="text-lg font-bold">${formatNumber(blackMetrics.reach)}</p>
                    </div>
                    <div>
                        <p class="text-sm">Conversas Iniciadas</p>
                        <p class="text-lg font-bold">${blackMetrics.conversations}</p>
                    </div>
                    <div>
                        <p class="text-sm">Custo por Conversa</p>
                        <p class="text-lg font-bold">${formatCurrency(blackMetrics.costPerConversation)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Seção de Comparação (se aplicável)
    if (comparisonMetrics) {
        const compareStart = new Date(comparisonData.startDate).toLocaleDateString('pt-BR');
        const compareEnd = new Date(comparisonData.endDate).toLocaleDateString('pt-BR');

        reportHTML += `
            <div class="bg-gray-100 rounded-lg p-4 mb-6">
                <h3 class="text-xl font-semibold text-primary mb-2">Comparação com Período Anterior (${compareStart} a ${compareEnd})</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p class="text-sm">Investimento</p>
                        <p class="text-lg font-bold">${formatCurrency(comparisonMetrics.spend)}</p>
                    </div>
                    <div>
                        <p class="text-sm">Alcance</p>
                        <p class="text-lg font-bold">${formatNumber(comparisonMetrics.reach)}</p>
                    </div>
                    <div>
                        <p class="text-sm">Conversas Iniciadas</p>
                        <p class="text-lg font-bold">${comparisonMetrics.conversations}</p>
                    </div>
                    <div>
                        <p class="text-sm">Custo por Conversa</p>
                        <p class="text-lg font-bold">${formatCurrency(comparisonMetrics.costPerConversation)}</p>
                    </div>
                </div>
            </div>
        `;
    } else if (comparisonTotalLeads !== null) {
        const compareStart = new Date(comparisonData.startDate).toLocaleDateString('pt-BR');
        const compareEnd = new Date(comparisonData.endDate).toLocaleDateString('pt-BR');

        reportHTML += `
            <div class="bg-gray-100 rounded-lg p-4 mb-6">
                <h3 class="text-xl font-semibold text-primary mb-2">Comparação com Período Anterior (${compareStart} a ${compareEnd})</h3>
                <p class="text-gray-700"><strong>Total de Leads da Conta:</strong> ${comparisonTotalLeads}</p>
            </div>
        `;
    }

    // Seção de Anúncios em Destaque
    reportHTML += `
        ${
            bestAds.length > 0
                ? `
                    <h3 class="text-xl font-semibold text-primary mb-3">Anúncios em Destaque</h3>
                    <div class="space-y-4">
                        ${bestAds
                            .map(
                                ad => `
                                    <div class="flex items-center bg-white border border-gray-200 rounded-lg p-3">
                                        <img src="${ad.imageUrl}" alt="Anúncio" class="w-24 h-24 object-cover rounded-md mr-4" />
                                        <div>
                                            ${
                                                hasBlack && ad.type
                                                    ? `<p class="text-gray-500 text-sm"><strong>Tipo:</strong> ${ad.type}</p>`
                                                    : ''
                                            }
                                            <p class="text-gray-700 text-base"><strong>Mensagens:</strong> ${ad.messages}</p>
                                            <p class="text-gray-700 text-base"><strong>Custo por Msg:</strong> R$ ${ad.costPerMessage.replace(
                                                '.',
                                                ','
                                            )}</p>
                                        </div>
                                    </div>
                                `
                            )
                            .join('')}
                    </div>
                `
                : '<p class="text-gray-600 text-base">Nenhum anúncio com conversas iniciadas encontrado para este período.</p>'
        }
    `;

    reportContainer.innerHTML = reportHTML;
}


// Compartilhar no WhatsApp
shareWhatsAppBtn.addEventListener('click', () => {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const startDate = document.getElementById('startDate').value.split('-').reverse().join('/');
    const endDate = document.getElementById('endDate').value.split('-').reverse().join('/');

    let message = `Relatório Completo - ${unitName}\n`;
    message += `Período Analisado: ${startDate} a ${endDate}\n\n`;

    const report = reportContainer.querySelector('.bg-white');
    if (hasBlack) {
        message += `Campanhas White:\n`;
        const whiteMetrics = report.querySelectorAll('.metric-card')[0].parentElement.querySelectorAll('.metric-card');
        whiteMetrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });

        message += `\nCampanhas Black:\n`;
        const blackMetrics = report.querySelectorAll('.metric-card')[4].parentElement.querySelectorAll('.metric-card');
        blackMetrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });

        const totalLeads = report.querySelector('p.text-lg.font-semibold span').textContent;
        message += `\nNúmero total de leads: ${totalLeads}\n`;
    } else {
        message += `Campanhas:\n`;
        const metrics = report.querySelectorAll('.metric-card');
        metrics.forEach(metric => {
            const label = metric.querySelector('h4').textContent;
            const value = metric.querySelector('p.text-lg').textContent;
            message += `${label}: ${value}\n`;
        });
    }

    const bestAds = report.querySelectorAll('.flex.items-center');
    if (bestAds.length > 0) {
        message += `\nAnúncios em Destaque:\n`;
        bestAds.forEach((ad, adIndex) => {
            const messages = ad.querySelector('p:nth-child(1)').textContent;
            const costPerMessage = ad.querySelector('p:nth-child(2)').textContent;
            message += `Anúncio ${adIndex + 1}:\n${messages}\n${costPerMessage}\n`;
        });
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
});

// Voltar para a seleção de relatórios
backToReportSelectionBtn.addEventListener('click', () => {
    window.location.href = 'index.html?appLoggedIn=true';
});

// Limpar seleções e recarregar a página
refreshBtn.addEventListener('click', () => {
    // Limpar todas as seleções
    selectedCampaigns.clear();
    selectedAdSets.clear();
    selectedWhiteCampaigns.clear();
    selectedWhiteAdSets.clear();
    selectedBlackCampaigns.clear();
    selectedBlackAdSets.clear();
    comparisonData = null;
    hasBlack = null;

    // Limpar o formulário
    form.reset();
    reportContainer.innerHTML = '';
    shareWhatsAppBtn.classList.add('hidden');

    // Limpar os filtros visuais
    whiteFilters.classList.add('hidden');
    blackFilters.classList.add('hidden');
    defaultFilters.classList.remove('hidden');
    comparisonFilter.classList.remove('hidden');

    // Desabilitar botões novamente até que "A unidade possui Black?" seja respondido
    disableButtons();

    // Recarregar a página
    window.location.reload();
});