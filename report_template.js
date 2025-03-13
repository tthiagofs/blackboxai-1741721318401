export function generateReportHTML(data) {
    return `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-blue-900">Alcance Total</h3>
                    <p class="text-2xl font-bold text-blue-600">${data.reach.toLocaleString('pt-BR')}</p>
                    ${data.reachComparison ? `
                        <p class="text-sm ${data.reachComparison > 0 ? 'text-green-600' : 'text-red-600'}">
                            ${Math.abs(data.reachComparison)}% ${data.reachComparison > 0 ? '↑' : '↓'}
                        </p>
                    ` : ''}
                </div>

                <div class="bg-green-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-green-900">Mensagens Iniciadas</h3>
                    <p class="text-2xl font-bold text-green-600">${data.messages.toLocaleString('pt-BR')}</p>
                    ${data.messagesComparison ? `
                        <p class="text-sm ${data.messagesComparison > 0 ? 'text-green-600' : 'text-red-600'}">
                            ${Math.abs(data.messagesComparison)}% ${data.messagesComparison > 0 ? '↑' : '↓'}
                        </p>
                    ` : ''}
                </div>

                <div class="bg-purple-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-purple-900">Custo por Mensagem</h3>
                    <p class="text-2xl font-bold text-purple-600">R$ ${data.costPerMessage.toFixed(2).replace('.', ',')}</p>
                    ${data.costComparison ? `
                        <p class="text-sm ${data.costComparison < 0 ? 'text-green-600' : 'text-red-600'}">
                            ${Math.abs(data.costComparison)}% ${data.costComparison < 0 ? '↓' : '↑'}
                        </p>
                    ` : ''}
                </div>

                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="text-lg font-semibold text-gray-900">Investimento Total</h3>
                    <p class="text-2xl font-bold text-gray-600">R$ ${data.totalSpend.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>

            ${data.topAds.length > 0 ? `
                <div class="mt-8">
                    <h3 class="text-xl font-semibold mb-4">Anúncios em Destaque</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${data.topAds.map(ad => `
                            <div class="bg-white border rounded-lg overflow-hidden">
                                <img src="${ad.imageUrl}" alt="Anúncio" class="w-full h-48 object-cover">
                                <div class="p-4">
                                    <p class="font-semibold">Mensagens: ${ad.messages}</p>
                                    <p class="text-gray-600">Custo por Msg: R$ ${ad.costPerMessage.toFixed(2).replace('.', ',')}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}
