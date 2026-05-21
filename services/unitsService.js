/**
 * Units Service
 * Gerenciamento de unidades dentro de projetos
 */

import { db } from '../config/firebase.js';
import { 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Criar nova unidade
 */
export async function createUnit(projectId, unitData) {
    try {
        console.log('📝 [createUnit] Criando unidade:', unitData.name);
        
        // Estrutura nova: trafficSources separados por plataforma
        const defaultTrafficSources = unitData.trafficSources || {
            meta: {
                facebook: true,      // ✅ Facebook ativado por padrão (Meta)
                instagram: true,     // ✅ Instagram ativado por padrão (Meta)
                google: false,
                revista: false,
                empty: false,
                dots: false
            },
            google: {
                facebook: false,
                instagram: false,
                google: true,        // ✅ Google Ads ativado por padrão (Google)
                revista: false,
                empty: false,
                dots: false
            }
        };
        
        const defaultCustomKeywords = unitData.customKeywords || {
            meta: {
                enabled: false, // ❌ Busca em "Outros" desativada por padrão
                terms: ['Tráfego', 'Tráfego Pago', 'trafego', 'trafego pago']
            },
            google: {
                enabled: false,
                terms: ['Tráfego', 'Tráfego Pago', 'trafego', 'trafego pago']
            }
        };
        
        const unitRef = await addDoc(collection(db, `projects/${projectId}/units`), {
            name: unitData.name,
            /** CRM da planilha: 'clinicorp' | 'sistema_oc' (padrão Clinicorp) */
            crmSource: unitData.crmSource === 'sistema_oc' ? 'sistema_oc' : 'clinicorp',
            trafficSources: defaultTrafficSources,
            customKeywords: defaultCustomKeywords,
            excludeMaintenance: true, // ✅ Excluir manutenções ativado por padrão
            budgetData: null, // Será preenchido no upload
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ [createUnit] Unidade criada:', unitRef.id);
        return unitRef.id;
    } catch (error) {
        console.error('❌ [createUnit] Erro:', error);
        throw error;
    }
}

/**
 * Listar todas as unidades de um projeto
 */
export async function listUnits(projectId) {
    try {
        console.log('📋 [listUnits] Buscando unidades do projeto:', projectId);
        
        // Sem orderBy para evitar erro de permissões
        const snapshot = await getDocs(collection(db, `projects/${projectId}/units`));
        
        const units = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Ordenar manualmente
        units.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`✅ [listUnits] ${units.length} unidades encontradas`);
        return units;
    } catch (error) {
        console.error('❌ [listUnits] Erro:', error);
        console.error('❌ Código:', error.code);
        console.error('❌ Mensagem:', error.message);
        throw error;
    }
}

/**
 * Buscar unidade por ID
 */
export async function getUnit(projectId, unitId) {
    try {
        console.log('🔍 [getUnit] Buscando unidade:', unitId);
        
        const unitDoc = await getDoc(doc(db, `projects/${projectId}/units/${unitId}`));
        
        if (!unitDoc.exists()) {
            throw new Error('Unidade não encontrada');
        }
        
        return {
            id: unitDoc.id,
            ...unitDoc.data()
        };
    } catch (error) {
        console.error('❌ [getUnit] Erro:', error);
        throw error;
    }
}

/**
 * Atualizar configurações da unidade
 */
export async function updateUnit(projectId, unitId, updates) {
    try {
        console.log('✏️ [updateUnit] Atualizando unidade:', unitId);
        
        await updateDoc(doc(db, `projects/${projectId}/units/${unitId}`), {
            ...updates,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ [updateUnit] Unidade atualizada');
    } catch (error) {
        console.error('❌ [updateUnit] Erro:', error);
        throw error;
    }
}

/**
 * Atualizar dados da planilha
 */
export async function updateBudgetData(projectId, unitId, budgetData) {
    try {
        console.log('📊 [updateBudgetData] Atualizando dados da planilha');
        
        await updateDoc(doc(db, `projects/${projectId}/units/${unitId}`), {
            budgetData: budgetData,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ [updateBudgetData] Dados atualizados');
    } catch (error) {
        console.error('❌ [updateBudgetData] Erro:', error);
        throw error;
    }
}

/**
 * Remover dados da planilha
 */
export async function removeBudgetData(projectId, unitId) {
    try {
        console.log('🗑️ [removeBudgetData] Removendo planilha');
        
        await updateDoc(doc(db, `projects/${projectId}/units/${unitId}`), {
            budgetData: null,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ [removeBudgetData] Planilha removida');
    } catch (error) {
        console.error('❌ [removeBudgetData] Erro:', error);
        throw error;
    }
}

/**
 * Deletar unidade
 */
export async function deleteUnit(projectId, unitId) {
    try {
        console.log('🗑️ [deleteUnit] Deletando unidade:', unitId);
        
        await deleteDoc(doc(db, `projects/${projectId}/units/${unitId}`));
        
        console.log('✅ [deleteUnit] Unidade deletada');
    } catch (error) {
        console.error('❌ [deleteUnit] Erro:', error);
        throw error;
    }
}

/**
 * Buscar dados filtrados por período
 */
export function filterDataByPeriod(rawData, startDate, endDate) {
    if (!rawData || rawData.length === 0) {
        return {
            totalBudgets: 0,
            approvedSales: 0,
            revenue: 0
        };
    }
    
    const startStr = (startDate || '').toString().slice(0, 10);
    const endStr = (endDate || '').toString().slice(0, 10);

    const filtered = rawData.filter((item) => {
        const itemDate = (item.date || '').toString().slice(0, 10);
        return itemDate >= startStr && itemDate <= endStr;
    });

    return {
        totalBudgets: filtered.length,
        approvedSales: filtered.filter((r) => r.status === 'APPROVED').length,
        revenue: filtered
            .filter((r) => r.status === 'APPROVED')
            .reduce((sum, r) => sum + Number(r.value || 0), 0)
    };
}

