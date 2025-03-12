export function generateReportHTML(unitName, startDate, endDate, totalReach, totalConversations, totalSpend, costPerConversation, comparisonData, comparisonMetrics, topTwoAds) {
    console.log('Gerando HTML do relatório com os seguintes dados:', {
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
    });

    function calculateVariation(currentValue, previousValue) {
        if (!previousValue || previousValue === 0) return { percentage: "0%", icon: '' };
        const percentage = ((currentValue - previousValue) / previousValue) * 100;
        const icon = percentage >= 0 ? 'arrow-up' : 'arrow-down';
        return { percentage: `${percentage.toFixed(2)}%`, icon };
    }

    return `
        <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="text-center mb-6">
                <h2 class="text-2xl font-semibold text-primary">Relatório Completo - CA - ${unitName}</h2>
                <p class="text-gray-600 mt-2">
                    <i class="far fa-calendar-alt"></i> Período: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}
                </p>
                ${comparisonData && comparisonData.startDate && comparisonData.endDate ? `
                    <p class="text-gray-600">
                        <i class="fas fa-exchange-alt"></i> Comparação: ${comparisonData.startDate.split('-').reverse().join('/')} a ${comparisonData.endDate.split('-').reverse().join('/')}
                    </p>
                ` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                ${comparisonMetrics ? `
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 transform transition-transform hover:scale-105">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">Alcance Total</p>
                            <p class="text-2xl font-semibold text-primary mt-1">${totalReach.toLocaleString('pt-BR')}</p>
                            <p class="text-sm text-gray-500">pessoas</p>
                        </div>
                        <div class="text-4xl text-blue-500">
                            <i class="fas fa-bullhorn"></i>
                        </div>
                    </div>
                    ${(() => {
                        const variation = calculateVariation(totalReach, comparisonMetrics.reach);
                        return `
                            <div class="mt-2 text-sm flex items-center ${variation.icon === 'arrow-up' ? 'text-green-600' : 'text-red-600'}">
                                <i class="fas fa-${variation.icon} mr-1"></i>
                                ${variation.percentage}
                            </div>
                        `;
                    })()}
                </div>
                ` : ''}

                <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 transform transition-transform hover:scale-105">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">Mensagens Iniciadas</p>
                            <p class="text-2xl font-semibold text-primary mt-1">${totalConversations}</p>
                        </div>
                        <div class="text-4xl text-purple-500">
                            <i class="fas fa-comments"></i>
                        </div>
                    </div>
                    ${comparisonMetrics ? (() => {
                        const variation = calculateVariation(totalConversations, comparisonMetrics.conversations);
                        return `
                            <div class="mt-2 text-sm flex items-center ${variation.icon === 'arrow-up' ? 'text-green-600' : 'text-red-600'}">
                                <i class="fas fa-${variation.icon} mr-1"></i>
                                ${variation.percentage}
                            </div>
                        `;
                    })() : ''}
                </div>

                <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 transform transition-transform hover:scale-105">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">Custo por Mensagem</p>
                            <p class="text-2xl font-semibold text-primary mt-1">R$ ${costPerConversation.replace('.', ',')}</p>
                        </div>
                        <div class="text-4xl text-yellow-500">
                            <i class="fas fa-coins"></i>
                        </div>
                    </div>
                    ${comparisonMetrics ? (() => {
                        const variation = calculateVariation(parseFloat(costPerConversation), comparisonMetrics.costPerConversation);
                        return `
                            <div class="mt-2 text-sm flex items-center ${variation.icon === 'arrow-up' ? 'text-red-600' : 'text-green-600'}">
                                <i class="fas fa-${variation.icon} mr-1"></i>
                                ${variation.percentage}
                            </div>
                        `;
                    })() : ''}
                </div>

                <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 transform transition-transform hover:scale-105">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm">Investimento Total</p>
                            <p class="text-2xl font-semibold text-primary mt-1">R$ ${totalSpend.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div class="text-4xl text-green-500">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-8">
                <h3 class="text-xl font-semibold text-primary mb-4 text-center">
                    <i class="fas fa-star text-yellow-400"></i> Anúncios em Destaque
                </h3>
                <div class="space-y-4">
                    ${topTwoAds.length > 0 ? topTwoAds.map(ad => `
                        <div class="bg-white rounded-xl shadow p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
                            <div class="flex flex-col md:flex-row items-center gap-4">
                                <div class="w-full md:w-1/2">
                                    <img src="${ad.imageUrl}" 
                                         alt="Imagem do Anúncio" 
                                         class="w-full h-auto rounded-lg shadow-sm" 
                                         style="max-height: 300px; object-fit: contain;"
                                         crossorigin="anonymous" 
                                         loading="lazy">
                                </div>
                                <div class="w-full md:w-1/2 space-y-3">
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-comments text-purple-500"></i>
                                        <span class="text-gray-700">Mensagens:</span>
                                        <span class="font-semibold">${ad.messages}</span>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-coins text-yellow-500"></i>
                                        <span class="text-gray-700">Custo por Msg:</span>
                                        <span class="font-semibold">R$ ${ad.costPerMessage.replace('.', ',')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="text-center text-gray-500 py-8 bg-gray-50 rounded-xl">
                            <i class="fas fa-info-circle text-4xl mb-3 block"></i>
                            <p>Nenhum anúncio com mensagens no período selecionado ou imagens de qualidade insuficiente.</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}
