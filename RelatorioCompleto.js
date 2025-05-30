import { fbAuth } from './auth.js';
import { exportToPDF } from './exportPDF.js';

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
let reportMetrics = null;      // Para armazenar as métricas (metrics)
let reportBlackMetrics = null; // Para armazenar as métricas Black (blackMetrics)
let reportBestAds = null;      // Para armazenar os melhores anúncios (bestAds)
let lastFormState = {
    unitId: null,
    startDate: null,
    endDate: null,
    selectedCampaigns: new Set(),
    selectedAdSets: new Set(),
    selectedWhiteCampaigns: new Set(),
    selectedWhiteAdSets: new Set(),
    selectedBlackCampaigns: new Set(),
    selectedBlackAdSets: new Set(),
    comparisonData: null,
    hasBlack: null
};
let includeMonthly = null; // null (não respondido), true (Sim), false (Não)
let monthlyPeriodData = null; // Para armazenar as datas do período mensal
let reportMonthlyMetrics = null; // Para armazenar as métricas mensais


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

// Função para armazenar cache
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
    }
    return data;
}

function setCachedData(key, data) {
    const cacheEntry = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
}


// Desabilitar botões até que a pergunta "A unidade possui Black?" seja respondida
function disableButtons() {
    filterCampaignsBtn.disabled = true;
    filterAdSetsBtn.disabled = true;
    comparePeriodsBtn.disabled = true;

    // Verificar se o botão de submit existe antes de desabilitá-lo
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50');
    } else {
        console.warn('Botão de submit não encontrado no formulário.');
    }

    filterWhiteCampaignsBtn.disabled = true;
    filterWhiteAdSetsBtn.disabled = true;
    filterBlackCampaignsBtn.disabled = true;
    filterBlackAdSetsBtn.disabled = true;

    filterCampaignsBtn.classList.add('opacity-50');
    filterAdSetsBtn.classList.add('opacity-50');
    comparePeriodsBtn.classList.add('opacity-50');

    filterWhiteCampaignsBtn.classList.add('opacity-50');
    filterWhiteAdSetsBtn.classList.add('opacity-50');
    filterBlackCampaignsBtn.classList.add('opacity-50');
    filterBlackAdSetsBtn.classList.add('opacity-50');
}

// Habilitar botões após a resposta
function enableButtons() {
    const submitButton = form.querySelector('button[type="submit"]');

    if (hasBlack) {
        filterWhiteCampaignsBtn.disabled = false;
        filterWhiteAdSetsBtn.disabled = false;
        filterBlackCampaignsBtn.disabled = false;
        filterBlackAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50');
        } else {
            console.warn('Botão de submit não encontrado no formulário ao habilitar botões.');
        }

        filterWhiteCampaignsBtn.classList.remove('opacity-50');
        filterWhiteAdSetsBtn.classList.remove('opacity-50');
        filterBlackCampaignsBtn.classList.remove('opacity-50');
        filterBlackAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
    } else {
        filterCampaignsBtn.disabled = false;
        filterAdSetsBtn.disabled = false;
        comparePeriodsBtn.disabled = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50');
        } else {
            console.warn('Botão de submit não encontrado no formulário ao habilitar botões.');
        }

        filterCampaignsBtn.classList.remove('opacity-50');
        filterAdSetsBtn.classList.remove('opacity-50');
        comparePeriodsBtn.classList.remove('opacity-50');
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

// Evento para o botão "Sim" do relatório mensal
includeMonthlyYesBtn.addEventListener('click', () => {
    includeMonthly = true;
    monthlyPeriod.classList.remove('hidden'); // Mostra os campos de período
});

// Evento para o botão "Não" do relatório mensal
includeMonthlyNoBtn.addEventListener('click', () => {
    includeMonthly = false;
    monthlyPeriod.classList.add('hidden'); // Esconde os campos de período
    monthlyPeriodData = null; // Limpa as datas do período mensal
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
        const cacheKey = `campaigns_${unitId}_${startDate}_${endDate}`;
        const cachedCampaigns = getCachedData(cacheKey);
        if (cachedCampaigns) {
            campaignsMap[unitId] = cachedCampaigns;
            if (hasBlack) {
                renderWhiteCampaignOptions();
                renderBlackCampaignOptions();
            } else {
                renderCampaignOptions();
            }
            return;
        }

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
            await delay(200);
        }

        const batchRequests = allCampaigns.map(campaign => ({
            method: 'GET',
            relative_url: `${campaign.id}/insights?fields=spend,actions,reach&time_range={"since":"${startDate}","until":"${endDate}"}&level=campaign&access_token=${currentAccessToken}`
        }));

        const batchSize = 50;
        const insights = [];
        for (let i = 0; i < batchRequests.length; i += batchSize) {
            const batch = batchRequests.slice(i, i + batchSize);
            const batchResponse = await new Promise((resolve) => {
                FB.api('/', 'POST', {
                    batch: batch,
                    access_token: currentAccessToken
                }, resolve);
            });

            batchResponse.forEach((resp, index) => {
                if (resp.code === 200) {
                    const data = JSON.parse(resp.body);
                    if (data.data && data.data.length > 0) {
                        insights[i + index] = data.data[0];
                    } else {
                        insights[i + index] = { spend: '0', actions: [], reach: '0' };
                    }
                } else {
                    console.error(`Erro ao buscar insights para campanha ${allCampaigns[i + index].id}:`, resp);
                    insights[i + index] = { spend: '0', actions: [], reach: '0' };
                }
            });
            await delay(200);
        }

        allCampaigns.forEach((campaign, index) => {
            const spend = insights[index].spend ? parseFloat(insights[index].spend) : 0;
            campaignsMap[unitId][campaign.id] = {
                name: campaign.name.toLowerCase(),
                insights: { 
                    spend,
                    reach: insights[index].reach || 0,
                    actions: insights[index].actions || []
                }
            };
        });

        // Salvar no cache
        setCachedData(cacheKey, campaignsMap[unitId]);

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
        const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';
        const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
        const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
        const revenue = parseFloat(document.getElementById('revenue').value) || 0;

        if (!unitId || !startDate || !endDate) {
            alert('Por favor, preencha todos os campos obrigatórios (unidade, data de início e data de fim).');
            return;
        }

        if (hasBlack === null) {
            alert('Por favor, responda se a unidade possui Black antes de gerar o relatório.');
            return;
        }

        // Função para verificar se dois Sets são iguais
        const areSetsEqual = (setA, setB) => {
            if (setA.size !== setB.size) return false;
            return Array.from(setA).every(item => setB.has(item));
        };

        // Verificar se os campos principais mudaram
        const formStateChanged = (
            lastFormState.unitId !== unitId ||
            lastFormState.startDate !== startDate ||
            lastFormState.endDate !== endDate ||
            !areSetsEqual(lastFormState.selectedCampaigns, selectedCampaigns) ||
            !areSetsEqual(lastFormState.selectedAdSets, selectedAdSets) ||
            !areSetsEqual(lastFormState.selectedWhiteCampaigns, selectedWhiteCampaigns) ||
            !areSetsEqual(lastFormState.selectedWhiteAdSets, selectedWhiteAdSets) ||
            !areSetsEqual(lastFormState.selectedBlackCampaigns, selectedBlackCampaigns) ||
            !areSetsEqual(lastFormState.selectedBlackAdSets, selectedBlackAdSets) ||
            lastFormState.hasBlack !== hasBlack ||
            JSON.stringify(lastFormState.comparisonData) !== JSON.stringify(comparisonData), // Vírgula adicionada
            lastFormState.includeMonthly !== includeMonthly ||
            JSON.stringify(lastFormState.monthlyPeriodData) !== JSON.stringify(monthlyPeriodData)
        );

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';

        let metrics = reportMetrics;
        let blackMetrics = reportBlackMetrics;
        let bestAds = reportBestAds;
        let comparisonMetrics = null;
        let blackComparisonMetrics = null;
        let comparisonTotalLeads = null;

        // Se os dados ainda não foram carregados ou o estado do formulário mudou, buscar os dados
        if (formStateChanged || !metrics || (hasBlack && !blackMetrics) || !bestAds) {
            await generateReport(unitId, unitName, startDate, endDate);
        } else {
            // Apenas re-renderizar o relatório com os dados existentes
            reportContainer.innerHTML = '';
            renderReport(unitName, startDate, endDate, metrics, comparisonMetrics, blackMetrics, blackComparisonMetrics, bestAds, comparisonTotalLeads);

            // Adicionar seção de Resultados
            const reportDiv = reportContainer.querySelector('.bg-white');
            const businessResultsHTML = `
                <div class="mt-8">
                    <h3 class="text-xl font-semibold text-primary mb-4">Resultados</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="metric-card">
                            <h4 class="text-sm font-medium text-gray-600 mb-1">Orçamentos Realizados</h4>
                            <p class="text-lg font-semibold text-gray-800">${budgetsCompleted.toLocaleString('pt-BR')}</p>
                        </div>
                        <div class="metric-card">
                            <h4 class="text-sm font-medium text-gray-600 mb-1">Número de Vendas</h4>
                            <p class="text-lg font-semibold text-gray-800">${salesCount.toLocaleString('pt-BR')}</p>
                        </div>
                        <div class="metric-card">
                            <h4 class="text-sm font-medium text-gray-600 mb-1">Faturamento</h4>
                            <p class="text-lg font-semibold text-gray-800">R$ ${revenue.toFixed(2).replace('.', ',')}</p>
                        </div>
                    </div>
                </div>
            `;
            reportDiv.insertAdjacentHTML('beforeend', businessResultsHTML);

            // Adicionar seção de Análise de Desempenho e Pontos de Melhoria (se houver texto)
            if (performanceAnalysis.trim()) {
                const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
                const analysisHTML = `
                    <div class="mt-8">
                        <h3 class="text-xl font-semibold text-primary mb-4">Análise de Desempenho e Pontos de Melhoria</h3>
                        <ul class="list-disc list-inside space-y-2 text-gray-700">
                            ${paragraphs.map(paragraph => {
                                const formattedParagraph = paragraph.replace(/\n/g, '<br>');
                                return `<li>${formattedParagraph}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                `;
                reportDiv.insertAdjacentHTML('beforeend', analysisHTML);
            }

            // Exibir o botão de compartilhamento
            shareWhatsAppBtn.classList.remove('hidden');
        }

        // Atualizar o último estado do formulário
        lastFormState = {
            unitId,
            startDate,
            endDate,
            selectedCampaigns: new Set(selectedCampaigns),
            selectedAdSets: new Set(selectedCampaigns),
            selectedWhiteCampaigns: new Set(selectedWhiteCampaigns),
            selectedWhiteAdSets: new Set(selectedWhiteAdSets),
            selectedBlackCampaigns: new Set(selectedBlackCampaigns),
            selectedBlackAdSets: new Set(selectedBlackAdSets),
            comparisonData: comparisonData ? { ...comparisonData } : null,
            hasBlack, // Vírgula adicionada
            includeMonthly,
            monthlyPeriodData: monthlyPeriodData ? { ...monthlyPeriodData } : null
        };

        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Ocorreu um erro ao gerar o relatório. Por favor, tente novamente.');
    }
});


async function generateReport(unitId, unitName, startDate, endDate) {
    console.log('Iniciando generateReport:', { unitId, unitName, startDate, endDate });
    const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
    const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
    const revenue = parseFloat(document.getElementById('revenue').value) || 0;
    const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';

    if (!unitId || !startDate || !endDate) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }

    if (budgetsCompleted < 0 || salesCount < 0 || revenue < 0) {
        alert('Os valores de orçamentos, vendas e faturamento não podem ser negativos.');
        return;
    }

    if (!campaignsMap[unitId]) {
        await loadCampaigns(unitId, startDate, endDate);
    }

    let whiteCampaigns = [];
    let blackCampaigns = [];
    let allCampaigns = Object.entries(campaignsMap[unitId] || {});
    
    if (hasBlack) {
        whiteCampaigns = selectedWhiteCampaigns.size > 0 
            ? allCampaigns.filter(([id]) => selectedWhiteCampaigns.has(id))
            : allCampaigns;
        blackCampaigns = selectedBlackCampaigns.size > 0 
            ? allCampaigns.filter(([id]) => selectedBlackCampaigns.has(id))
            : allCampaigns;
    } else {
        if (selectedCampaigns.size > 0) {
            allCampaigns = allCampaigns.filter(([id]) => selectedCampaigns.has(id));
        } else if (selectedAdSets.size > 0) {
            allCampaigns = allCampaigns;
        }
    }

    let metrics = { spend: 0, reach: 0, conversations: 0, costPerConversation: 0 };
    let blackMetrics = null;

    // Paralelizar a busca de métricas White e Black
    if (hasBlack) {
        const [whiteMetricsResult, blackMetricsResult] = await Promise.all([
            calculateMetrics(unitId, startDate, endDate, selectedWhiteCampaigns, selectedWhiteAdSets),
            calculateMetrics(unitId, startDate, endDate, selectedBlackCampaigns, selectedBlackAdSets)
        ]);
        metrics = whiteMetricsResult;
        blackMetrics = blackMetricsResult;
        reportMetrics = metrics;
        reportBlackMetrics = blackMetrics;
    } else {
        const generalMetrics = await calculateMetrics(unitId, startDate, endDate, selectedCampaigns, selectedAdSets);
        metrics = generalMetrics;
        reportMetrics = metrics;
    }

    let comparisonMetrics = null;
    let blackComparisonMetrics = null;
    let comparisonTotalLeads = null;


// Calcular métricas mensais, se solicitado
if (includeMonthly === true) {
    const monthlyStartDate = document.getElementById('monthlyStartDate').value;
    const monthlyEndDate = document.getElementById('monthlyEndDate').value;

    if (!monthlyStartDate || !monthlyEndDate) {
        alert('Por favor, preencha as datas do período mensal.');
        return;
    }

    monthlyPeriodData = { startDate: monthlyStartDate, endDate: monthlyEndDate };

    // Carregar campanhas para o período mensal
    await loadCampaigns(unitId, monthlyStartDate, monthlyEndDate);

    // Calcular métricas mensais (usando as mesmas campanhas/ad sets selecionados)
    if (hasBlack) {
        const [monthlyWhiteMetrics, monthlyBlackMetrics] = await Promise.all([
            calculateMetrics(unitId, monthlyStartDate, monthlyEndDate, selectedWhiteCampaigns, selectedWhiteAdSets),
            calculateMetrics(unitId, monthlyStartDate, monthlyEndDate, selectedBlackCampaigns, selectedBlackAdSets)
        ]);
        // Combinar métricas White e Black para o relatório mensal
        reportMonthlyMetrics = {
            spend: (monthlyWhiteMetrics.spend || 0) + (monthlyBlackMetrics.spend || 0),
            reach: (monthlyWhiteMetrics.reach || 0) + (monthlyBlackMetrics.reach || 0),
            conversations: (monthlyWhiteMetrics.conversations || 0) + (monthlyBlackMetrics.conversations || 0),
            costPerConversation: 0
        };
        if (reportMonthlyMetrics.conversations > 0) {
            reportMonthlyMetrics.costPerConversation = reportMonthlyMetrics.spend / reportMonthlyMetrics.conversations;
        }
    } else {
        reportMonthlyMetrics = await calculateMetrics(unitId, monthlyStartDate, monthlyEndDate, selectedCampaigns, selectedAdSets);
    }
} else {
    reportMonthlyMetrics = null; // Limpar métricas mensais se não for solicitado
}

    
    if (comparisonData) {
        const compareStartDate = comparisonData.startDate;
        const compareEndDate = comparisonData.endDate;

        await loadCampaigns(unitId, compareStartDate, compareEndDate);

        let compareWhiteCampaigns = [];
        let compareBlackCampaigns = [];
        let compareAllCampaigns = Object.entries(campaignsMap[unitId] || {});
        
        if (hasBlack) {
            compareWhiteCampaigns = selectedWhiteCampaigns.size > 0 
                ? compareAllCampaigns.filter(([id]) => selectedWhiteCampaigns.has(id))
                : compareAllCampaigns;
            compareBlackCampaigns = selectedBlackCampaigns.size > 0 
                ? compareAllCampaigns.filter(([id]) => selectedBlackCampaigns.has(id))
                : compareAllCampaigns;

            const [compMetrics, compBlackMetrics, compTotalLeads] = await Promise.all([
                calculateMetrics(unitId, compareStartDate, compareEndDate, selectedWhiteCampaigns, selectedWhiteAdSets),
                calculateMetrics(unitId, compareStartDate, compareEndDate, selectedBlackCampaigns, selectedBlackAdSets),
                calculateTotalLeadsForAccount(unitId, compareStartDate, compareEndDate)
            ]);
            comparisonMetrics = compMetrics;
            blackComparisonMetrics = compBlackMetrics;
            comparisonTotalLeads = compTotalLeads;
        } else {
            if (selectedCampaigns.size > 0) {
                compareAllCampaigns = compareAllCampaigns.filter(([id]) => selectedCampaigns.has(id));
            }
            comparisonMetrics = await calculateMetrics(unitId, compareStartDate, compareEndDate, selectedCampaigns, selectedAdSets);
        }
    }

    const bestAds = await getBestAds(unitId, startDate, endDate);
    reportBestAds = bestAds;

    reportContainer.innerHTML = '';
    renderReport(unitName, startDate, endDate, metrics, comparisonMetrics, blackMetrics, blackComparisonMetrics, bestAds, comparisonTotalLeads);

    const reportDiv = reportContainer.querySelector('.bg-white');
    const businessResultsHTML = `
        <div class="mt-8">
            <h3 class="text-xl font-semibold text-primary mb-4">Resultados</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-600 mb-1">Orçamentos Realizados</h4>
                    <p class="text-lg font-semibold text-gray-800">${budgetsCompleted.toLocaleString('pt-BR')}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-600 mb-1">Número de Vendas</h4>
                    <p class="text-lg font-semibold text-gray-800">${salesCount.toLocaleString('pt-BR')}</p>
                </div>
                <div class="metric-card">
                    <h4 class="text-sm font-medium text-gray-600 mb-1">Faturamento</h4>
                    <p class="text-lg font-semibold text-gray-800">R$ ${revenue.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>
        </div>
    `;
    reportDiv.insertAdjacentHTML('beforeend', businessResultsHTML);

    if (performanceAnalysis.trim()) {
        const paragraphs = performanceAnalysis.split(/\n\s*\n/).filter(p => p.trim());
        const analysisHTML = `
            <div class="mt-8">
                <h3 class="text-xl font-semibold text-primary mb-4">Análise de Desempenho e Pontos de Melhoria</h3>
                <ul class="list-disc list-inside space-y-2 text-gray-700">
                    ${paragraphs.map(paragraph => {
                        const formattedParagraph = paragraph.replace(/\n/g, '<br>');
                        return `<li>${formattedParagraph}</li>`;
                    }).join('')}
                </ul>
            </div>
        `;
        reportDiv.insertAdjacentHTML('beforeend', analysisHTML);
    }

    shareWhatsAppBtn.classList.remove('hidden');
}


async function calculateMetrics(unitId, startDate, endDate, campaignsSet, adSetsSet) {
    let totalSpend = 0;
    let totalConversations = 0;
    let totalReach = 0;

    const response = await new Promise((resolve) => {
        FB.api(
            `/${unitId}/insights`,
            {
                fields: 'spend,reach,actions{action_type,value}',
                time_range: { since: startDate, until: endDate },
                filtering: [
                    campaignsSet.size > 0 ? { field: 'campaign.id', operator: 'IN', value: Array.from(campaignsSet) } : {},
                    adSetsSet.size > 0 ? { field: 'adset.id', operator: 'IN', value: Array.from(adSetsSet) } : {}
                ].filter(filter => Object.keys(filter).length > 0),
                action_breakdowns: 'action_type',
                access_token: currentAccessToken
            },
            resolve
        );
    });

    if (response && !response.error && response.data && response.data.length > 0) {
        response.data.forEach(data => {
            totalSpend += parseFloat(data.spend) || 0;
            totalReach += parseInt(data.reach) || 0;
            if (data.actions && Array.isArray(data.actions)) {
                // Contabilizar conversas iniciadas
                const conversationAction = data.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalConversations += parseInt(conversationAction.value) || 0;
                }

                // Contabilizar conversões personalizadas
                const customConversions = data.actions.filter(
                    action => action.action_type.startsWith('offsite_conversion.')
                );
                customConversions.forEach(action => {
                    if (action.value) {
                        totalConversations += parseInt(action.value) || 0;
                    }
                });

                // Contabilizar cadastros do Facebook (usando 'lead' para Formulários Instantâneos)
                const leadActions = data.actions.filter(
                    action => action.action_type === 'lead'
                );
                leadActions.forEach(action => {
                    if (action.value) {
                        totalConversations += parseInt(action.value) || 0;
                    }
                });
            }
        });
    }

    const costPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;
    return { spend: totalSpend, conversations: totalConversations, reach: totalReach, costPerConversation };
}


async function calculateTotalLeadsForAccount(unitId, startDate, endDate) {
    let totalConversations = 0;

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

    if (response && !response.error && response.data && response.data.length > 0) {
        response.data.forEach(data => {
            if (data.actions && Array.isArray(data.actions)) {
                // Contabilizar conversas iniciadas
                const conversationAction = data.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalConversations += parseInt(conversationAction.value) || 0;
                }

                // Contabilizar conversões personalizadas
                const customConversions = data.actions.filter(
                    action => action.action_type.startsWith('offsite_conversion.')
                );
                customConversions.forEach(action => {
                    if (action.value) {
                        totalConversations += parseInt(action.value) || 0;
                    }
                });

                // Contabilizar cadastros do Facebook (usando 'lead' para Formulários Instantâneos)
                const leadActions = data.actions.filter(
                    action => action.action_type === 'lead'
                );
                leadActions.forEach(action => {
                    if (action.value) {
                        totalConversations += parseInt(action.value) || 0;
                    }
                });
            }
        });
    }

    return totalConversations;
}

async function getBestAds(unitId, startDate, endDate) {
    const adsWithActions = []; // Anúncios com mensagens/conversões/cadastros
    const adsWithoutActions = []; // Anúncios sem mensagens/conversões/cadastros, mas com gasto

    // Determinar as entidades (campanhas, ad sets ou conta) para buscar os anúncios
    const entitiesToFetch = [];
    if (hasBlack && (selectedWhiteAdSets.size > 0 || selectedBlackAdSets.size > 0)) {
        const adSetIds = [...Array.from(selectedWhiteAdSets), ...Array.from(selectedBlackAdSets)];
        entitiesToFetch.push(...adSetIds.map(id => ({ type: 'adset', id })));
    } else if (hasBlack && (selectedWhiteCampaigns.size > 0 || selectedBlackCampaigns.size > 0)) {
        const campaignIds = [...Array.from(selectedWhiteCampaigns), ...Array.from(selectedBlackCampaigns)];
        entitiesToFetch.push(...campaignIds.map(id => ({ type: 'campaign', id })));
    } else if (selectedAdSets.size > 0) {
        entitiesToFetch.push(...Array.from(selectedAdSets).map(id => ({ type: 'adset', id })));
    } else if (selectedCampaigns.size > 0) {
        entitiesToFetch.push(...Array.from(selectedCampaigns).map(id => ({ type: 'campaign', id })));
    } else {
        entitiesToFetch.push({ type: 'account', id: unitId });
    }

    console.log(`Entidades para buscar anúncios:`, entitiesToFetch);

    // Buscar todos os anúncios das entidades
    const adsList = [];
    for (const entity of entitiesToFetch) {
        let entityUrl = entity.type === 'account' ? `/${entity.id}/ads` : `/${entity.id}/ads`;
        console.log(`Buscando anúncios com URL: ${entityUrl}`);
        while (entityUrl) {
            const adResponse = await new Promise((resolve) => {
                FB.api(
                    entityUrl,
                    {
                        fields: 'id,name,creative',
                        time_range: { since: startDate, until: endDate },
                        access_token: currentAccessToken,
                        limit: 50
                    },
                    resolve
                );
            });

            if (adResponse && !adResponse.error) {
                // Adicionar a informação da entidade (campaign ou adset) para cada anúncio
                const adsWithEntity = adResponse.data.map(ad => ({
                    ...ad,
                    entityType: entity.type,
                    entityId: entity.id
                }));
                adsList.push(...adsWithEntity);
                entityUrl = adResponse.paging && adResponse.paging.next ? adResponse.paging.next : null;
            } else {
                console.error(`Erro ao carregar anúncios para ${entity.type} ${entity.id}:`, adResponse?.error);
                entityUrl = null;
            }
            await delay(500);
        }
    }

    console.log(`Total de anúncios encontrados: ${adsList.length}`);
    if (adsList.length === 0) {
        console.log('Nenhum anúncio encontrado para o período ou filtros selecionados.');
    }

    // Função para determinar se o anúncio é White ou Black
    const determineAdType = (ad) => {
        if (!hasBlack) {
            return 'White'; // Se não tem Black, todos os anúncios são White
        }

        const { entityType, entityId } = ad;

        if (entityType === 'adset') {
            if (selectedWhiteAdSets.size > 0 && selectedWhiteAdSets.has(entityId)) {
                return 'White';
            }
            if (selectedBlackAdSets.size > 0 && selectedBlackAdSets.has(entityId)) {
                return 'Black';
            }
        } else if (entityType === 'campaign') {
            if (selectedWhiteCampaigns.size > 0 && selectedWhiteCampaigns.has(entityId)) {
                return 'White';
            }
            if (selectedBlackCampaigns.size > 0 && selectedBlackCampaigns.has(entityId)) {
                return 'Black';
            }
        }

        // Fallback: se não estiver em nenhum filtro específico, verificar o nome da campanha
        const campaignName = campaignsMap[unitId]?.[entityId]?.name || '';
        if (campaignName.toLowerCase().includes('black')) {
            return 'Black';
        }
        return 'White'; // Padrão
    };

    // Processar os anúncios
    for (const ad of adsList) {
        let totalActions = 0;
        let spend = 0;
        let costPerAction = 0;
        let imageUrl = 'https://dummyimage.com/150x150/ccc/fff';

        // Buscar insights do anúncio
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
            console.log(`Insights para o anúncio ${ad.id}:`, insights);

            // Calcular leads (conversas, conversões e cadastros)
            if (insights.actions) {
                // Contabilizar conversas iniciadas
                const conversationAction = insights.actions.find(
                    action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
                );
                if (conversationAction && conversationAction.value) {
                    totalActions += parseInt(conversationAction.value) || 0;
                }

                // Contabilizar conversões personalizadas
                const customConversions = insights.actions.filter(
                    action => action.action_type.startsWith('offsite_conversion.')
                );
                customConversions.forEach(action => {
                    if (action.value) {
                        totalActions += parseInt(action.value) || 0;
                    }
                });

                // Contabilizar cadastros do Facebook (usando 'lead' para Formulários Instantâneos)
                const leadActions = insights.actions.filter(
                    action => action.action_type === 'lead'
                );
                leadActions.forEach(action => {
                    if (action.value) {
                        totalActions += parseInt(action.value) || 0;
                    }
                });
            }

            // Calcular investimento
            spend = insights.spend ? parseFloat(insights.spend) : 0;

            // Calcular custo por lead
            costPerAction = totalActions > 0 ? (spend / totalActions).toFixed(2) : '0.00';
        } else {
            console.log(`Nenhum insight encontrado para o anúncio ${ad.id}`);
            if (insightsResponse?.error) {
                console.error(`Erro ao buscar insights do anúncio ${ad.id}:`, insightsResponse.error);
            }
        }

        console.log(`Anúncio ${ad.id} - Leads: ${totalActions}, Investimento: ${spend}, Custo por Lead: ${costPerAction}`);

        // Determinar o tipo do anúncio (White ou Black)
        const adType = determineAdType(ad);

        // Adicionar o anúncio à lista apropriada
        const adData = {
            creativeId: ad.creative?.id,
            imageUrl: imageUrl,
            messages: totalActions,
            spend: spend,
            costPerMessage: costPerAction,
            adType: adType // Novo campo adicionado
        };

        if (totalActions > 0) {
            adsWithActions.push(adData);
        } else if (spend > 0) {
            adsWithoutActions.push(adData);
        }
    }

    // Ordenar e selecionar os melhores anúncios
    adsWithActions.sort((a, b) => b.messages - a.messages);
    adsWithoutActions.sort((a, b) => b.spend - a.spend);

    const bestAds = [];
    bestAds.push(...adsWithActions.slice(0, 2));
    if (bestAds.length < 2 && adsWithoutActions.length > 0) {
        const remainingSlots = 2 - bestAds.length;
        bestAds.push(...adsWithoutActions.slice(0, remainingSlots));
    }

    if (adsWithActions.length === 0 && adsWithoutActions.length === 1) {
        bestAds.length = 0;
        bestAds.push(...adsWithoutActions);
    } else if (adsWithActions.length === 1 && adsWithoutActions.length === 0) {
        bestAds.length = 0;
        bestAds.push(...adsWithActions);
    }

    console.log(`Melhores anúncios selecionados:`, bestAds);

    // Buscar imagens dos criativos
    const imagePromises = bestAds.map(async (ad) => {
        if (ad.creativeId) {
            const creativeData = await getCreativeData(ad.creativeId);
            ad.imageUrl = creativeData.imageUrl;
        }
        return ad;
    });

    await Promise.all(imagePromises);

    return bestAds;
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
    const formattedStartDate = startDate ? startDate.split('-').reverse().join('/') : 'N/A';
    const formattedEndDate = endDate ? endDate.split('-').reverse().join('/') : 'N/A';

    let comparisonPeriod = '';
    if (comparisonMetrics || comparisonTotalLeads !== null) {
        const compareStart = comparisonData?.startDate ? comparisonData.startDate.split('-').reverse().join('/') : 'N/A';
        const compareEnd = comparisonData?.endDate ? comparisonData.endDate.split('-').reverse().join('/') : 'N/A';
        comparisonPeriod = `
            <p class="text-gray-600 text-base mb-2">
                <i class="fas fa-calendar-alt mr-2"></i>Comparação: 
                ${compareStart} a ${compareEnd}
            </p>
        `;
    }

    let variations = {
        reach: calculateVariation(metrics.reach, comparisonMetrics?.reach, 'reach'),
        conversations: calculateVariation(metrics.conversations, comparisonMetrics?.conversations, 'conversations'),
        costPerConversation: calculateVariation(metrics.costPerConversation, comparisonMetrics?.costPerConversation, 'costPerConversation')
    };

    let blackVariations = {};
    let totalLeads = 0;
    let totalLeadsVariation = null;
    if (hasBlack && blackMetrics) {
        blackVariations = {
            reach: calculateVariation(blackMetrics.reach, blackComparisonMetrics?.reach, 'reach'),
            conversations: calculateVariation(blackMetrics.conversations, blackComparisonMetrics?.conversations, 'conversations'),
            costPerConversation: calculateVariation(blackMetrics.costPerConversation, blackComparisonMetrics?.costPerConversation, 'costPerConversation')
        };
        console.log(`Conversas White: ${metrics.conversations}, Conversas Black: ${blackMetrics.conversations}`);
        totalLeads = (parseInt(metrics.conversations) || 0) + (parseInt(blackMetrics.conversations) || 0);
        console.log(`Total de leads calculado: ${totalLeads}`);

        if (comparisonTotalLeads !== null) {
            totalLeadsVariation = calculateVariation(totalLeads, comparisonTotalLeads, 'conversations');
        }
    }

    const reportHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-semibold text-primary mb-4">Relatório Completo - ${unitName}</h2>
            <button id="exportPDFBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition mb-4">
                <i class="fas fa-file-pdf mr-2"></i>Exportar para PDF
            </button>
            <p class="text-gray-600 text-base mb-4">
                <i class="fas fa-calendar-alt mr-2"></i>Período Analisado: ${formattedStartDate} a ${formattedEndDate}
            </p>
            ${comparisonPeriod}
            <h3 class="text-xl font-semibold text-primary mb-4">Relatório Semanal</h3>
            ${
                hasBlack
                    ? `
                        <div class="campaign-section white-report text-white rounded-lg p-4 mb-6">
                            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas White</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${metrics.spend.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                                    <p class="text-lg font-semibold text-white">${metrics.reach}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                                    <p class="text-lg font-semibold text-white">${metrics.conversations}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${metrics.costPerConversation.toFixed(2).replace('.', ',')}</p>
                                </div>
                            </div>
                        </div>
                        <div class="campaign-section black-report text-white rounded-lg p-4 mb-6">
                            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas Black</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${blackMetrics.spend.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                                    <p class="text-lg font-semibold text-white">${blackMetrics.reach}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                                    <p class="text-lg font-semibold text-white">${blackMetrics.conversations}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${blackMetrics.costPerConversation.toFixed(2).replace('.', ',')}</p>
                                </div>
                            </div>
                        </div>
                        <div class="text-center bg-gray-100 rounded-lg p-4 mb-6">
                            <p class="text-lg font-semibold text-gray-700">
                                Número total de leads: <span class="text-2xl font-bold text-primary">${totalLeads}</span>
                                ${
                                    totalLeadsVariation
                                        ? `
                                            <p class="metric-comparison ${
                                                totalLeadsVariation.direction === 'positive' ? 'increase' : 'decrease'
                                            } text-sm mt-1">
                                                <i class="fas fa-arrow-${
                                                    totalLeadsVariation.direction === 'positive' ? 'up' : 'down'
                                                } mr-1"></i>
                                                ${totalLeadsVariation.percentage}% em relação ao período anterior
                                            </p>`
                                        : ''
                                }
                            </p>
                        </div>`
                    : `
                        <div class="bg-blue-900 text-white rounded-lg p-4 mb-6">
                            <h3 class="text-xl font-semibold uppercase mb-3">Campanhas White</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${metrics.spend.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                                    <p class="text-lg font-semibold text-white">${metrics.reach}</p>
                                    ${
                                        comparisonMetrics
                                            ? `
                                                <p class="metric-comparison ${
                                                    variations.reach.direction === 'positive' ? 'increase' : 'decrease'
                                                } text-sm mt-1">
                                                    <i class="fas fa-arrow-${
                                                        variations.reach.direction === 'positive' ? 'up' : 'down'
                                                    } mr-1"></i>
                                                    ${variations.reach.percentage}% em relação ao período anterior
                                                </p>`
                                            : ''
                                    }
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                                    <p class="text-lg font-semibold text-white">${metrics.conversations}</p>
                                    ${
                                        comparisonMetrics
                                            ? `
                                                <p class="metric-comparison ${
                                                    variations.conversations.direction === 'positive' ? 'increase' : 'decrease'
                                                } text-sm mt-1">
                                                    <i class="fas fa-arrow-${
                                                        variations.conversations.direction === 'positive' ? 'up' : 'down'
                                                    } mr-1"></i>
                                                    ${variations.conversations.percentage}% em relação ao período anterior
                                                </p>`
                                            : ''
                                    }
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${metrics.costPerConversation.toFixed(2).replace('.', ',')}</p>
                                    ${
                                        comparisonMetrics
                                            ? `
                                                <p class="metric-comparison ${
                                                    variations.costPerConversation.direction === 'positive' ? 'increase' : 'decrease'
                                                } text-sm mt-1">
                                                    <i class="fas fa-arrow-${
                                                        variations.costPerConversation.direction === 'positive' ? 'down' : 'up'
                                                    } mr-1"></i>
                                                    ${variations.costPerConversation.percentage}% em relação ao período anterior
                                                </p>`
                                            : ''
                                    }
                                </div>
                            </div>
                        </div>`
            }

            ${
                bestAds.length > 0
                    ? `
                        <h3 class="text-xl font-semibold text-primary mb-3">Anúncios em Destaque</h3>
                        <div class="space-y-4">
                            ${bestAds
                                .map(
                                    ad => `
                                        <div>
                                            <p class="text-sm font-semibold text-gray-600 mb-2">${ad.adType}</p>
                                            <div class="flex items-center bg-white border border-gray-200 rounded-lg p-3">
                                                <img src="${ad.imageUrl}" alt="Anúncio" class="w-24 h-24 object-cover rounded-md mr-4">
                                                <div>
                                                    <p class="text-gray-700 text-base"><strong>Leads:</strong> ${ad.messages}</p>
                                                    <p class="text-gray-700 text-base"><strong>Investimento:</strong> R$ ${ad.spend.toFixed(2).replace('.', ',')}</p>
                                                    <p class="text-gray-700 text-base"><strong>Custo por Lead:</strong> R$ ${ad.costPerMessage.replace('.', ',')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    `
                                )
                                .join('')}
                        </div>`
                    : '<p class="text-gray-600 text-base">Nenhum anúncio com dados (leads ou investimento) encontrado para este período.</p>'
            }

            ${
                reportMonthlyMetrics && monthlyPeriodData
                    ? `
                        <div class="campaign-section monthly-report text-white rounded-lg p-4 mb-6">
                            <h3 class="text-xl font-semibold uppercase mb-3">Relatório Mensal</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Investimento</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${reportMonthlyMetrics.spend.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Alcance</h4>
                                    <p class="text-lg font-semibold text-white">${reportMonthlyMetrics.reach}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Conversas Iniciadas</h4>
                                    <p class="text-lg font-semibold text-white">${reportMonthlyMetrics.conversations}</p>
                                </div>
                                <div class="metric-card">
                                    <h4 class="text-sm font-medium text-gray-200 mb-1">Custo por Conversa</h4>
                                    <p class="text-lg font-semibold text-white">R$ ${reportMonthlyMetrics.costPerConversation.toFixed(2).replace('.', ',')}</p>
                                </div>
                            </div>
                        </div>`
                    : ''
            }
        </div>
    `;

    reportContainer.insertAdjacentHTML('beforeend', reportHTML);
}



// Evento para o botão de exportar PDF
document.addEventListener('click', (event) => {
    if (event.target.closest('#exportPDFBtn')) {
        // Verificar se o relatório foi gerado
      
if (!reportMetrics) {
    alert('Por favor, gere o relatório antes de exportar para PDF.');
    return;
}

        const unitId = document.getElementById('unitId').value;
        const unitName = adAccountsMap[unitId] || 'Unidade Desconhecida';
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const budgetsCompleted = parseInt(document.getElementById('budgetsCompleted').value) || 0;
        const salesCount = parseInt(document.getElementById('salesCount').value) || 0;
        const revenue = parseFloat(document.getElementById('revenue').value) || 0;
        const performanceAnalysis = document.getElementById('performanceAnalysis')?.value || '';

        exportToPDF(
            unitId,
            unitName,
            startDate,
            endDate,
            reportMetrics, // Usar a variável global
            reportBlackMetrics || { spend: 0, reach: 0, conversations: 0, costPerConversation: 0 }, // Usar a variável global
            hasBlack,
            budgetsCompleted,
            salesCount,
            revenue,
            performanceAnalysis,
            reportBestAds // Usar a variável global
        );
    }
});



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
    reportMetrics = null;      // Limpar métricas
    reportBlackMetrics = null; // Limpar métricas Black
    reportBestAds = null;      // Limpar melhores anúncios
    includeMonthly = null;
    monthlyPeriodData = null;
    reportMonthlyMetrics = null;

    
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
