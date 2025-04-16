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
const exportPdfBtn = document.getElementById('exportPdfBtn');
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
if (!unitSelect) {
    console.error('Elemento unitId não encontrado no DOM.');
} else {
    // Verificar se adAccountsMap é válido
    const sortedAccounts = adAccountsMap && typeof adAccountsMap === 'object'
        ? Object.entries(adAccountsMap)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        : [];

    unitSelect.innerHTML = '<option value="">Escolha a unidade</option>';
    if (sortedAccounts.length === 0) {
        console.warn('Nenhuma conta de anúncios encontrada em adAccountsMap.');
        unitSelect.innerHTML += '<option value="">Nenhuma conta disponível</option>';
    } else {
        sortedAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            unitSelect.appendChild(option);
        });
    }
}

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

// Manipulação do formulário
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const unitId = document.getElementById('unitId').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
    const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const performanceAnalysis = document.getElementById('performanceAnalysis').value.trim();

    reportContainer.innerHTML = '<p class="text-center text-gray-600"><i class="fas fa-spinner fa-spin mr-2"></i>Gerando relatório, por favor aguarde...</p>';

    let adsMapWhite = {};
    let adsMapBlack = {};

    if (hasBlack) {
        adsMapWhite = await loadAds(unitId, startDate, endDate, selectedWhiteCampaigns.size > 0 ? selectedWhiteCampaigns : null, selectedWhiteAdSets.size > 0 ? selectedWhiteAdSets : null);
        adsMapBlack = await loadAds(unitId, startDate, endDate, selectedBlackCampaigns.size > 0 ? selectedBlackCampaigns : null, selectedBlackAdSets.size > 0 ? selectedBlackAdSets : null);
    } else {
        const adsMap = await loadAds(unitId, startDate, endDate, selectedCampaigns.size > 0 ? selectedCampaigns : null, selectedAdSets.size > 0 ? selectedAdSets : null);
        adsMapWhite = adsMap; // Sem Black, todos os dados são considerados White
    }

    let comparisonAdsMapWhite = {};
    let comparisonAdsMapBlack = {};

    if (comparisonData && (comparisonData.startDate || comparisonData.isPrevious)) {
        let compareStartDate = comparisonData.startDate;
        let compareEndDate = comparisonData.endDate;

        if (comparisonData.isPrevious) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffDays = (end - start) / (1000 * 60 * 60 * 24);
            const newEnd = new Date(start);
            newEnd.setDate(newEnd.getDate() - 1);
            const newStart = new Date(newEnd);
            newStart.setDate(newStart.getDate() - diffDays);

            compareStartDate = newStart.toISOString().split('T')[0];
            compareEndDate = newEnd.toISOString().split('T')[0];
        }

        if (hasBlack) {
            comparisonAdsMapWhite = await loadAds(unitId, compareStartDate, compareEndDate, selectedWhiteCampaigns.size > 0 ? selectedWhiteCampaigns : null, selectedWhiteAdSets.size > 0 ? selectedWhiteAdSets : null);
            comparisonAdsMapBlack = await loadAds(unitId, compareStartDate, compareEndDate, selectedBlackCampaigns.size > 0 ? selectedBlackCampaigns : null, selectedBlackAdSets.size > 0 ? selectedBlackAdSets : null);
        } else {
            const comparisonAdsMap = await loadAds(unitId, compareStartDate, compareEndDate, selectedCampaigns.size > 0 ? selectedCampaigns : null, selectedAdSets.size > 0 ? selectedAdSets : null);
            comparisonAdsMapWhite = comparisonAdsMap;
        }
    }

    const metricsWhite = calculateMetrics(adsMapWhite);
    const metricsBlack = hasBlack ? calculateMetrics(adsMapBlack) : null;
    const comparisonMetricsWhite = comparisonData ? calculateMetrics(comparisonAdsMapWhite) : null;
    const comparisonMetricsBlack = comparisonData && hasBlack ? calculateMetrics(comparisonAdsMapBlack) : null;

    const topAdsWhite = calculateTopAds(adsMapWhite);
    const topAdsBlack = hasBlack ? calculateTopAds(adsMapBlack) : null;

    renderReport(metricsWhite, metricsBlack, comparisonMetricsWhite, comparisonMetricsBlack, topAdsWhite, topAdsBlack, startDate, endDate, budgetsCompleted, salesCount, revenue, performanceAnalysis);

    // Mostrar o botão de exportar PDF após gerar o relatório
    exportPdfBtn.classList.remove('hidden');
    form.classList.add('hidden');
    isFilterActivated = true;
    updateFilterButtons();
});

// Função para calcular métricas
function calculateMetrics(adsMap) {
    let totalSpend = 0;
    let totalReach = 0;
    let totalConversations = 0;

    Object.values(adsMap).forEach(ad => {
        const insights = ad.insights;
        totalSpend += parseFloat(insights.spend || 0);
        totalReach += parseInt(insights.reach || 0);

        if (insights.actions) {
            const conversationAction = insights.actions.find(action => action.action_type === 'onsite_conversion.message_send');
            totalConversations += conversationAction ? parseInt(conversationAction.value) : 0;
        }
    });

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

    return {
        totalSpend,
        totalReach,
        totalConversations,
        costPerConversation
    };
}

// Função para calcular os melhores anúncios
function calculateTopAds(adsMap) {
    const adsArray = Object.entries(adsMap).map(([id, ad]) => {
        const conversations = ad.insights.actions?.find(action => action.action_type === 'onsite_conversion.message_send')?.value || 0;
        return {
            id,
            imageUrl: ad.creative.imageUrl,
            spend: parseFloat(ad.insights.spend || 0),
            reach: parseInt(ad.insights.reach || 0),
            conversations: parseInt(conversations)
        };
    });

    return adsArray
        .sort((a, b) => b.conversations - a.conversations || b.spend - a.spend)
        .slice(0, 3);
}

// Função para renderizar o relatório
function renderReport(metricsWhite, metricsBlack, comparisonMetricsWhite, comparisonMetricsBlack, topAdsWhite, topAdsBlack, startDate, endDate, budgetsCompleted, salesCount, revenue, performanceAnalysis) {
    const unitId = document.getElementById('unitId').value;
    const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
    const formatDate = (date) => new Date(date).toLocaleDateString('pt-BR');

    reportContainer.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-semibold text-primary">Relatório de Anúncios</h2>
            <p class="text-gray-600">Unidade: ${unitName}</p>
            <p class="text-gray-600">Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
        </div>
    `;

    // Seção de métricas White
    reportContainer.innerHTML += `
        <h3 class="text-xl font-medium text-primary mb-4">${hasBlack ? 'Resultados White' : 'Resultados Gerais'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Investimento</h4>
                <p class="text-2xl font-semibold text-primary">R$ ${metricsWhite.totalSpend.toFixed(2).replace('.', ',')}</p>
                ${comparisonMetricsWhite ? `
                    <p class="metric-comparison ${comparisonMetricsWhite.totalSpend > metricsWhite.totalSpend ? 'decrease' : 'increase'}">
                        <i class="fas ${comparisonMetricsWhite.totalSpend > metricsWhite.totalSpend ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                        ${((metricsWhite.totalSpend - comparisonMetricsWhite.totalSpend) / comparisonMetricsWhite.totalSpend * 100).toFixed(1)}%
                    </p>
                ` : ''}
            </div>
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Alcance</h4>
                <p class="text-2xl font-semibold text-primary">${metricsWhite.totalReach.toLocaleString('pt-BR')}</p>
                ${comparisonMetricsWhite ? `
                    <p class="metric-comparison ${comparisonMetricsWhite.totalReach > metricsWhite.totalReach ? 'decrease' : 'increase'}">
                        <i class="fas ${comparisonMetricsWhite.totalReach > metricsWhite.totalReach ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                        ${((metricsWhite.totalReach - comparisonMetricsWhite.totalReach) / comparisonMetricsWhite.totalReach * 100).toFixed(1)}%
                    </p>
                ` : ''}
            </div>
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Conversas Iniciadas</h4>
                <p class="text-2xl font-semibold text-primary">${metricsWhite.totalConversations.toLocaleString('pt-BR')}</p>
                ${comparisonMetricsWhite ? `
                    <p class="metric-comparison ${comparisonMetricsWhite.totalConversations > metricsWhite.totalConversations ? 'decrease' : 'increase'}">
                        <i class="fas ${comparisonMetricsWhite.totalConversations > metricsWhite.totalConversations ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                        ${((metricsWhite.totalConversations - comparisonMetricsWhite.totalConversations) / comparisonMetricsWhite.totalConversations * 100).toFixed(1)}%
                    </p>
                ` : ''}
            </div>
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Custo por Conversa</h4>
                <p class="text-2xl font-semibold text-primary">R$ ${metricsWhite.costPerConversation.toFixed(2).replace('.', ',')}</p>
                ${comparisonMetricsWhite ? `
                    <p class="metric-comparison ${comparisonMetricsWhite.costPerConversation > metricsWhite.costPerConversation ? 'increase' : 'decrease'}">
                        <i class="fas ${comparisonMetricsWhite.costPerConversation > metricsWhite.costPerConversation ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1"></i>
                        ${((metricsWhite.costPerConversation - comparisonMetricsWhite.costPerConversation) / comparisonMetricsWhite.costPerConversation * 100).toFixed(1)}%
                    </p>
                ` : ''}
            </div>
        </div>
    `;

    // Seção de métricas Black (se aplicável)
    if (hasBlack && metricsBlack) {
        reportContainer.innerHTML += `
            <h3 class="text-xl font-medium text-primary mb-4">Resultados Black</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="metric-card">
                    <h4 class="text-gray-600 mb-2">Investimento</h4>
                    <p class="text-2xl font-semibold text-primary">R$ ${metricsBlack.totalSpend.toFixed(2).replace('.', ',')}</p>
                    ${comparisonMetricsBlack ? `
                        <p class="metric-comparison ${comparisonMetricsBlack.totalSpend > metricsBlack.totalSpend ? 'decrease' : 'increase'}">
                            <i class="fas ${comparisonMetricsBlack.totalSpend > metricsBlack.totalSpend ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                            ${((metricsBlack.totalSpend - comparisonMetricsBlack.totalSpend) / comparisonMetricsBlack.totalSpend * 100).toFixed(1)}%
                        </p>
                    ` : ''}
                </div>
                <div class="metric-card">
                    <h4 class="text-gray-600 mb-2">Alcance</h4>
                    <p class="text-2xl font-semibold text-primary">${metricsBlack.totalReach.toLocaleString('pt-BR')}</p>
                    ${comparisonMetricsBlack ? `
                        <p class="metric-comparison ${comparisonMetricsBlack.totalReach > metricsBlack.totalReach ? 'decrease' : 'increase'}">
                            <i class="fas ${comparisonMetricsBlack.totalReach > metricsBlack.totalReach ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                            ${((metricsBlack.totalReach - comparisonMetricsBlack.totalReach) / comparisonMetricsBlack.totalReach * 100).toFixed(1)}%
                        </p>
                    ` : ''}
                </div>
                <div class="metric-card">
                    <h4 class="text-gray-600 mb-2">Conversas Iniciadas</h4>
                    <p class="text-2xl font-semibold text-primary">${metricsBlack.totalConversations.toLocaleString('pt-BR')}</p>
                    ${comparisonMetricsBlack ? `
                        <p class="metric-comparison ${comparisonMetricsBlack.totalConversations > metricsBlack.totalConversations ? 'decrease' : 'increase'}">
                            <i class="fas ${comparisonMetricsBlack.totalConversations > metricsBlack.totalConversations ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1"></i>
                            ${((metricsBlack.totalConversations - comparisonMetricsBlack.totalConversations) / comparisonMetricsBlack.totalConversations * 100).toFixed(1)}%
                        </p>
                    ` : ''}
                </div>
                <div class="metric-card">
                    <h4 class="text-gray-600 mb-2">Custo por Conversa</h4>
                    <p class="text-2xl font-semibold text-primary">R$ ${metricsBlack.costPerConversation.toFixed(2).replace('.', ',')}</p>
                    ${comparisonMetricsBlack ? `
                        <p class="metric-comparison ${comparisonMetricsBlack.costPerConversation > metricsBlack.costPerConversation ? 'increase' : 'decrease'}">
                            <i class="fas ${comparisonMetricsBlack.costPerConversation > metricsBlack.costPerConversation ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1"></i>
                            ${((metricsBlack.costPerConversation - comparisonMetricsBlack.costPerConversation) / comparisonMetricsBlack.costPerConversation * 100).toFixed(1)}%
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Seção de Resultados de Negócios
    reportContainer.innerHTML += `
        <h3 class="text-xl font-medium text-primary mb-4">Resultados de Negócios</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Orçamentos Realizados</h4>
                <p class="text-2xl font-semibold text-primary">${budgetsCompleted.toLocaleString('pt-BR')}</p>
            </div>
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Número de Vendas</h4>
                <p class="text-2xl font-semibold text-primary">${salesCount.toLocaleString('pt-BR')}</p>
            </div>
            <div class="metric-card">
                <h4 class="text-gray-600 mb-2">Faturamento</h4>
                <p class="text-2xl font-semibold text-primary">R$ ${revenue.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>
    `;

    // Seção de Anúncios em Destaque White
    if (topAdsWhite && topAdsWhite.length > 0) {
        reportContainer.innerHTML += `
            <h3 class="text-xl font-medium text-primary mb-4">${hasBlack ? 'Anúncios em Destaque White' : 'Anúncios em Destaque'}</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                ${topAdsWhite.map(ad => `
                    <div class="top-ad-card">
                        <img src="${ad.imageUrl}" alt="Anúncio" class="w-full h-48 object-cover rounded-md mb-4">
                        <p class="text-gray-600">Conversas: <span class="font-semibold">${ad.conversations.toLocaleString('pt-BR')}</span></p>
                        <p class="text-gray-600">Investimento: <span class="font-semibold">R$ ${ad.spend.toFixed(2).replace('.', ',')}</span></p>
                        <p class="text-gray-600">Alcance: <span class="font-semibold">${ad.reach.toLocaleString('pt-BR')}</span></p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Seção de Anúncios em Destaque Black
    if (hasBlack && topAdsBlack && topAdsBlack.length > 0) {
        reportContainer.innerHTML += `
            <h3 class="text-xl font-medium text-primary mb-4">Anúncios em Destaque Black</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                ${topAdsBlack.map(ad => `
                    <div class="top-ad-card">
                        <img src="${ad.imageUrl}" alt="Anúncio" class="w-full h-48 object-cover rounded-md mb-4">
                        <p class="text-gray-600">Conversas: <span class="font-semibold">${ad.conversations.toLocaleString('pt-BR')}</span></p>
                        <p class="text-gray-600">Investimento: <span class="font-semibold">R$ ${ad.spend.toFixed(2).replace('.', ',')}</span></p>
                        <p class="text-gray-600">Alcance: <span class="font-semibold">${ad.reach.toLocaleString('pt-BR')}</span></p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Seção de Análise de Desempenho
    if (performanceAnalysis) {
        const analysisPoints = performanceAnalysis.split(/\n\s*\n/).filter(point => point.trim());
        reportContainer.innerHTML += `
            <h3 class="text-xl font-medium text-primary mb-4">Análise de Desempenho e Pontos de Melhoria</h3>
            <div class="bg-white p-6 rounded-lg shadow-lg">
                <ul class="list-disc pl-5 text-gray-700">
                    ${analysisPoints.map(point => `<li>${point.replace(/\n/g, '<br>')}</li>`).join('')}
                </ul>
            </div>
        `;
    }
}

// Event Listeners para os modais e botões
filterCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', true));
filterAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', true));
comparePeriodsBtn.addEventListener('click', () => {
    setupComparisonModal();
    toggleModal('comparisonModal', true);
});

filterWhiteCampaignsBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', true));
filterWhiteAdSetsBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', true));
filterBlackCampaignsBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', true));
filterBlackAdSetsBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', true));

closeCampaignsModalBtn.addEventListener('click', () => toggleModal('campaignsModal', false));
closeAdSetsModalBtn.addEventListener('click', () => toggleModal('adSetsModal', false));
closeWhiteCampaignsModalBtn.addEventListener('click', () => toggleModal('whiteCampaignsModal', false));
closeWhiteAdSetsModalBtn.addEventListener('click', () => toggleModal('whiteAdSetsModal', false));
closeBlackCampaignsModalBtn.addEventListener('click', () => toggleModal('blackCampaignsModal', false));
closeBlackAdSetsModalBtn.addEventListener('click', () => toggleModal('blackAdSetsModal', false));
cancelComparisonBtn.addEventListener('click', () => toggleModal('comparisonModal', false));

applyCampaignsBtn.addEventListener('click', () => {
    toggleModal('campaignsModal', false);
    isCampaignFilterActive = selectedCampaigns.size > 0;
    updateFilterButtons();
});

applyAdSetsBtn.addEventListener('click', () => {
    toggleModal('adSetsModal', false);
    isAdSetFilterActive = selectedAdSets.size > 0;
    updateFilterButtons();
});

applyWhiteCampaignsBtn.addEventListener('click', () => {
    toggleModal('whiteCampaignsModal', false);
    updateFilterButtons();
});

applyWhiteAdSetsBtn.addEventListener('click', () => {
    toggleModal('whiteAdSetsModal', false);
    updateFilterButtons();
});

applyBlackCampaignsBtn.addEventListener('click', () => {
    toggleModal('blackCampaignsModal', false);
    updateFilterButtons();
});

applyBlackAdSetsBtn.addEventListener('click', () => {
    toggleModal('blackAdSetsModal', false);
    updateFilterButtons();
});

confirmComparisonBtn.addEventListener('click', () => {
    const selectedOption = document.querySelector('input[name="comparisonOption"]:checked').value;
    if (selectedOption === 'custom') {
        const compareStartDate = document.getElementById('compareStartDate').value;
        const compareEndDate = document.getElementById('compareEndDate').value;
        if (compareStartDate && compareEndDate) {
            comparisonData = { startDate: compareStartDate, endDate: compareEndDate, isPrevious: false };
        } else {
            alert('Por favor, preencha as datas de início e fim para a comparação.');
            return;
        }
    } else if (selectedOption === 'previous') {
        comparisonData = { startDate: null, endDate: null, isPrevious: true };
    } else {
        comparisonData = null;
    }
    toggleModal('comparisonModal', false);
});

backToReportSelectionBtn.addEventListener('click', () => {
    reportContainer.innerHTML = '';
    form.classList.remove('hidden');
    exportPdfBtn.classList.add('hidden');
    isFilterActivated = false;
    updateFilterButtons();
});

refreshBtn.addEventListener('click', () => {
    window.location.reload();
});

// Event Listener para exportar o relatório em PDF
exportPdfBtn.addEventListener('click', () => {
    const element = document.getElementById('reportContainer');
    const opt = {
        margin: 0.5,
        filename: 'Relatorio_Anuncios.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Garantir que as imagens sejam carregadas antes de gerar o PDF
    const images = element.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    });

    Promise.all(imagePromises).then(() => {
        html2pdf().set(opt).from(element).save();
    }).catch(error => {
        console.error('Erro ao gerar PDF:', error);
        alert('Houve um erro ao gerar o PDF. Por favor, tente novamente.');
    });
});