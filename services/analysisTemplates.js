import { db, auth } from '../config/firebase.js';
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    where, 
    orderBy,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Categorias de análises pré-definidas
 */
export const ANALYSIS_CATEGORIES = {
    MELHOROU: 'MELHOROU',
    PIOROU: 'PIOROU',
    ESTAVEL: 'ESTAVEL',
    ESPECIAL: 'ESPECIAL'
};

/**
 * Textos padrão iniciais (sugestões para o usuário)
 */
export const DEFAULT_TEMPLATES = {
    PIOROU: [
        'Houve redução no volume de leads. Iremos testar novos criativos para melhorar os resultados.',
        'Desativamos alguns anúncios com baixa performance e vamos testar novas abordagens.',
        'Iremos atualizar as campanhas com novos criativos e ajustar segmentações.'
    ],
    MELHOROU: [
        'Tivemos um aumento significativo no volume de leads. Vamos manter a estratégia atual.',
        'Os resultados melhoraram após os ajustes realizados. Continuaremos monitorando.',
        'Campanhas apresentaram melhora. Vamos escalar os anúncios de melhor performance.'
    ],
    ESTAVEL: [
        'Resultados mantiveram-se estáveis. Vamos testar novos criativos para buscar melhorias.',
        'Volume de leads consistente. Continuaremos monitorando e testando otimizações.',
        'Desempenho estável. Planejamos novos testes para aumentar performance.'
    ],
    ESPECIAL: [
        'Aguardando aprovação de novos criativos pela equipe.',
        'Nenhum investimento foi realizado neste período por decisão estratégica.',
        'Campanhas pausadas temporariamente para ajustes de estratégia.'
    ]
};

/**
 * Inicializa templates padrão para um novo usuário
 */
export async function initializeDefaultTemplates(userId) {
    try {
        const templatesRef = collection(db, 'users', userId, 'analysisTemplates');
        
        // Verifica se já existem templates
        const existingTemplates = await getDocs(templatesRef);
        if (!existingTemplates.empty) {
            console.log('✅ Templates já existem para este usuário');
            return;
        }

        // Cria templates padrão
        const promises = [];
        
        Object.entries(DEFAULT_TEMPLATES).forEach(([category, texts]) => {
            texts.forEach((text, index) => {
                promises.push(
                    addDoc(templatesRef, {
                        category,
                        text,
                        order: index + 1,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    })
                );
            });
        });

        await Promise.all(promises);
        console.log('✅ Templates padrão inicializados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar templates:', error);
        throw error;
    }
}

/**
 * Lista todos os templates do usuário
 */
export async function listTemplates(userId) {
    try {
        const templatesRef = collection(db, 'users', userId, 'analysisTemplates');
        const q = query(templatesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        const templates = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!templates[data.category]) {
                templates[data.category] = [];
            }
            templates[data.category].push({
                id: doc.id,
                ...data
            });
        });

        return templates;
    } catch (error) {
        console.error('❌ Erro ao listar templates:', error);
        throw error;
    }
}

/**
 * Adiciona um novo template
 */
export async function addTemplate(userId, category, text, order) {
    try {
        const templatesRef = collection(db, 'users', userId, 'analysisTemplates');
        
        const docRef = await addDoc(templatesRef, {
            category,
            text,
            order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log('✅ Template criado:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Erro ao criar template:', error);
        throw error;
    }
}

/**
 * Atualiza um template existente
 */
export async function updateTemplate(userId, templateId, text) {
    try {
        const templateRef = doc(db, 'users', userId, 'analysisTemplates', templateId);
        
        await updateDoc(templateRef, {
            text,
            updatedAt: serverTimestamp()
        });

        console.log('✅ Template atualizado:', templateId);
    } catch (error) {
        console.error('❌ Erro ao atualizar template:', error);
        throw error;
    }
}

/**
 * Deleta um template
 */
export async function deleteTemplate(userId, templateId) {
    try {
        const templateRef = doc(db, 'users', userId, 'analysisTemplates', templateId);
        await deleteDoc(templateRef);

        console.log('✅ Template deletado:', templateId);
    } catch (error) {
        console.error('❌ Erro ao deletar template:', error);
        throw error;
    }
}

/**
 * Busca templates por categoria
 */
export async function getTemplatesByCategory(userId, category) {
    try {
        const templatesRef = collection(db, 'users', userId, 'analysisTemplates');
        const q = query(
            templatesRef, 
            where('category', '==', category),
            orderBy('order', 'asc')
        );
        const snapshot = await getDocs(q);

        const templates = [];
        snapshot.forEach(doc => {
            templates.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return templates;
    } catch (error) {
        console.error('❌ Erro ao buscar templates:', error);
        throw error;
    }
}

/**
 * Detecta categoria baseada em métricas
 */
export function detectCategory(currentConversations, previousConversations) {
    if (!previousConversations || previousConversations === 0) {
        return null; // Sem comparação possível
    }

    const variation = ((currentConversations - previousConversations) / previousConversations) * 100;

    if (variation > 10) {
        return ANALYSIS_CATEGORIES.MELHOROU;
    } else if (variation < -10) {
        return ANALYSIS_CATEGORIES.PIOROU;
    } else {
        return ANALYSIS_CATEGORIES.ESTAVEL;
    }
}

/**
 * Gera texto automático de negócio
 */
export function generateBusinessText(budgets, sales) {
    if (!budgets || budgets === 0) {
        return null; // Sem dados de negócio
    }

    const conversionRate = (sales / budgets) * 100;
    
    // Classifica orçamentos
    let budgetLevel = '';
    if (budgets <= 3) {
        budgetLevel = 'baixo';
    } else if (budgets <= 9) {
        budgetLevel = 'razoável';
    } else {
        budgetLevel = 'bom';
    }

    // Classifica taxa de conversão
    let conversionLevel = '';
    if (conversionRate < 30) {
        conversionLevel = 'muito baixa';
    } else if (conversionRate < 40) {
        conversionLevel = 'razoável';
    } else if (conversionRate < 60) {
        conversionLevel = 'boa';
    } else {
        conversionLevel = 'excelente';
    }

    // Combina as classificações
    if (budgetLevel === 'baixo' && conversionLevel === 'muito baixa') {
        return 'Tivemos um número baixo de orçamentos e baixa taxa de conversão no período.';
    } else if (budgetLevel === 'baixo' && (conversionLevel === 'boa' || conversionLevel === 'excelente')) {
        return 'Apesar do número baixo de orçamentos, tivemos uma boa taxa de conversão no período.';
    } else if (budgetLevel === 'baixo') {
        return 'Tivemos um número baixo de orçamentos e taxa de conversão razoável no período.';
    } else if (budgetLevel === 'razoável' && conversionLevel === 'muito baixa') {
        return 'Tivemos um número razoável de orçamentos, mas baixa taxa de conversão no período.';
    } else if (budgetLevel === 'razoável' && (conversionLevel === 'boa' || conversionLevel === 'excelente')) {
        return 'Tivemos um número razoável de orçamentos e boa taxa de conversão no período.';
    } else if (budgetLevel === 'razoável') {
        return 'Tivemos um número razoável de orçamentos e taxa de conversão razoável no período.';
    } else if (budgetLevel === 'bom' && conversionLevel === 'muito baixa') {
        return 'Tivemos um bom número de orçamentos, mas baixa taxa de conversão no período.';
    } else if (budgetLevel === 'bom' && (conversionLevel === 'boa' || conversionLevel === 'excelente')) {
        return 'Tivemos um bom número de orçamentos e excelente taxa de conversão no período.';
    } else {
        return 'Tivemos um bom número de orçamentos e taxa de conversão razoável no período.';
    }
}

