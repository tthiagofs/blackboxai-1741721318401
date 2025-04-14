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

// Modais
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

        // Caso 1: Filtrado por conjuntos de anúncios (filteredAdSets)
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
                    await delay(500); // Pausa para evitar limite de requisições
                }
            }
        } 
        // Caso 2: Filtrado por campanhas (filteredCampaigns)
        else if (filteredCampaigns && filteredCampaigns.size > 0) {
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
                    await delay(500); // Pausa para evitar limite de requisições
                }
            }
        } 
        // Caso 3: Sem filtros, carrega todos os anúncios da conta
        else {
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
                await delay(500); // Pausa para evitar limite de requisições
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

        // Paginação para buscar todas as campanhas
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
            await delay(500); // Pausa para evitar limite de requisições
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

        // Log para depuração
        console.log('Campanhas carregadas:', campaignsMap[unitId]);

        renderCampaignOptions();
    } catch (error) {
        console.error('Erro ao carregar campanhas:', error);
    }
}

async function loadAdSets(unitId, startDate, endDate) {
    try {
        adSetsMap[unitId] = {};
        let allAdSets = [];
        let url = `/${unitId}/adsets?fields=id,name&access_token=${currentAccessToken}&limit=50`;

        // Paginação para buscar todos os ad sets
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
            await delay(500); // Pausa para evitar limite de requisições
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
    await delay(200); // Pausa para evitar limite de requisições
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
                    console.log(`Insights para campanha ${campaignId}:`, response.data[0]); // Log para depuração
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
    await delay(200); // Pausa para evitar limite de requisições
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
    await delay(200); // Pausa para evitar limite de requisições
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
                    const insights = response.data[0];
                    let conversations = 0;
                    if (insights.actions) {
                        const conversationAction = insights.actions.find(action => action.action_type === 'onsite_conversion.messaging_conversation_started_7d');
                        conversations = conversationAction ? parseInt(conversationAction.value) : 0;
                    }
                    resolve({
                        spend: insights.spend || '0',
                        reach: insights.reach || '0',
                        conversations: conversations
                    });
                } else {
                    resolve({ spend: '0', actions: [], reach: '0', conversations: 0 });
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

        // Aplicar estilo inicial diretamente
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

        // Aplicar estilo inicial diretamente
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

// Event Listeners
if (filterCampaignsBtn) {
    filterCampaignsBtn.addEventListener('click', () => toggleModal('campaignsModal', true));
}
if (filterAdSetsBtn) {
    filterAdSetsBtn.addEventListener('click', () => toggleModal('adSetsModal', true));
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
    reportContainer.innerHTML = '<p class="text-gray-500">Carregando relatório...</p>';
    shareWhatsAppBtn.style.display = 'none';

    try {
        const formData = new FormData(form);
        const unitId = formData.get('unitId');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const comparisonStartDate = comparisonData ? comparisonData.startDate : null;
        const comparisonEndDate = comparisonData ? comparisonData.endDate : null;
        const selectedCampaigns = new Set(formData.getAll('campaigns'));
        const selectedAdSets = new Set(formData.getAll('adSets'));

        await loadCampaigns(unitId, startDate, endDate);
        await loadAdSets(unitId, startDate, endDate);
        const adsMap = await loadAds(unitId, startDate, endDate, selectedCampaigns.size > 0 ? selectedCampaigns : null, selectedAdSets.size > 0 ? selectedAdSets : null);

        let metrics = {
            reach: 0,
            conversations: 0,
            spend: 0,
            costPerConversation: 0
        };

        for (const adId in adsMap) {
            const ad = adsMap[adId];
            metrics.reach += parseInt(ad.insights.reach || 0);
            metrics.conversations += parseInt(ad.insights.conversations || 0);
            metrics.spend += parseFloat(ad.insights.spend || 0);
        }

        metrics.costPerConversation = metrics.conversations > 0 ? metrics.spend / metrics.conversations : 0;

        let comparisonMetrics = null;
        if (comparisonStartDate && comparisonEndDate) {
            await loadCampaigns(unitId, comparisonStartDate, comparisonEndDate);
            await loadAdSets(unitId, comparisonStartDate, comparisonEndDate);
            const comparisonAdsMap = await loadAds(unitId, comparisonStartDate, comparisonEndDate, selectedCampaigns.size > 0 ? selectedCampaigns : null, selectedAdSets.size > 0 ? selectedAdSets : null);

            comparisonMetrics = {
                reach: 0,
                conversations: 0,
                spend: 0,
                costPerConversation: 0
            };

            for (const adId in comparisonAdsMap) {
                const ad = comparisonAdsMap[adId];
                comparisonMetrics.reach += parseInt(ad.insights.reach || 0);
                comparisonMetrics.conversations += parseInt(ad.insights.conversations || 0);
                comparisonMetrics.spend += parseFloat(ad.insights.spend || 0);
            }

            comparisonMetrics.costPerConversation = comparisonMetrics.conversations > 0 ? comparisonMetrics.spend / comparisonMetrics.conversations : 0;
        }

        const bestAds = Object.entries(adsMap)
            .map(([id, ad]) => ({
                id,
                ...ad,
                insights: {
                    ...ad.insights,
                    costPerConversation: ad.insights.conversations > 0 ? (ad.insights.spend || 0) / ad.insights.conversations : 0
                }
            }))
            .sort((a, b) => (b.insights.conversations || 0) - (a.insights.conversations || 0))
            .slice(0, 5);

        renderReport(metrics, comparisonMetrics, bestAds);
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        reportContainer.innerHTML = '<p class="text-red-500">Ocorreu um erro ao gerar o relatório. Por favor, tente novamente.</p>';
    }
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

function calculateVariation(current, previous, metric) {
    if (!previous || previous === 0) return { percentage: 0, direction: 'neutral' };
    const percentage = ((current - previous) / previous) * 100;
    
    let direction;
    if (metric === 'costPerConversation') {
        // Para custo por mensagem, uma diminuição é uma melhora (verde), e um aumento é uma piora (vermelho)
        direction = percentage < 0 ? 'positive' : 'negative';
    } else {
        // Para alcance e mensagens, um aumento é uma melhora (verde), e uma diminuição é uma piora (vermelho)
        direction = percentage >= 0 ? 'positive' : 'negative';
    }
    
    return { percentage: Math.abs(percentage).toFixed(2), direction };
}

function renderReport(metrics, comparisonMetrics, bestAds) {
    const topAds = bestAds || [];
    const variations = comparisonMetrics ? {
        reach: calculateVariation(metrics.reach, comparisonMetrics.reach, 'reach'),
        conversations: calculateVariation(metrics.conversations, comparisonMetrics.conversations, 'conversations'),
        costPerConversation: calculateVariation(metrics.costPerConversation, comparisonMetrics.costPerConversation, 'costPerConversation')
    } : null;

    reportContainer.innerHTML = `
        <div class="p-6 rounded-lg">
            <h1 class="text-2xl font-bold mb-6">Relatório Completo - CA - Oral Center Paracatu</h1>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="metric-card bg-white/10 backdrop-blur">
                    <div class="text-lg font-semibold mb-2">
                        <i class="fas fa-bullhorn mr-2"></i>Alcance Total
                    </div>
                    <div class="text-2xl font-bold">
                        ${metrics.reach.toLocaleString('pt-BR')}
                    </div>
                    ${comparisonMetrics ? `
                        <div class="mt-2 text-sm font-medium ${variations.reach.direction === 'positive' ? 'text-green-400' : variations.reach.direction === 'negative' ? 'text-red-400' : 'text-gray-400'}">
                            <i class="fas ${variations.reach.direction === 'positive' ? 'fa-arrow-up' : variations.reach.direction === 'negative' ? 'fa-arrow-down' : 'fa-minus'} mr-1"></i>
                            ${variations.reach.percentage}%
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
                        <div class="mt-2 text-sm font-medium ${variations.conversations.direction === 'positive' ? 'text-green-400' : variations.conversations.direction === 'negative' ? 'text-red-400' : 'text-gray-400'}">
                            <i class="fas ${variations.conversations.direction === 'positive' ? 'fa-arrow-up' : variations.conversations.direction === 'negative' ? 'fa-arrow-down' : 'fa-minus'} mr-1"></i>
                            ${variations.conversations.percentage}%
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
                        <div class="mt-2 text-sm font-medium ${variations.costPerConversation.direction === 'positive' ? 'text-green-400' : variations.costPerConversation.direction === 'negative' ? 'text-red-400' : 'text-gray-400'}">
                            <i class="fas ${variations.costPerConversation.direction === 'positive' ? 'fa-arrow-up' : variations.costPerConversation.direction === 'negative' ? 'fa-arrow-down' : 'fa-minus'} mr-1"></i>
                            ${variations.costPerConversation.percentage}%
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
                    <h2 class="text-xl font-semibold mb-4 text-gray-800">Anúncios em Destaque</h2>
                    <div class="space-y-4">
                        ${topAds.map(ad => `
                            <div class="flex items-center bg-white rounded-lg shadow-sm p-4">
                                <img src="${ad.creative.imageUrl}" alt="Thumbnail" class="w-20 h-20 object-cover rounded-md mr-4">
                                <div class="flex-1">
                                    <div class="text-sm text-gray-600">
                                        Mensagens: <span class="font-medium text-gray-800">${ad.insights.conversations || 0}</span>
                                    </div>
                                    <div class="text-sm text-gray-600">
                                        Custo por Msg: <span class="font-medium text-gray-800">R$ ${(ad.insights.costPerConversation || 0).toFixed(2).replace('.', ',')}</span>
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
    console.log('Botão Voltar clicado - Redirecionando para seleção de relatório');
    console.log('Antes de voltar - appLoggedIn:', localStorage.getItem('appLoggedIn'));
    console.log('Antes de voltar - fbAccessToken:', localStorage.getItem('fbAccessToken') ? 'Sim' : 'Não');
    window.location.href = 'index.html?screen=reportSelection&appLoggedIn=true';
});