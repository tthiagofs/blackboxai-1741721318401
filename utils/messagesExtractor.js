/**
 * Função unificada para extrair mensagens, leads, cadastros e conversões
 * Esta função garante que todos os tipos de interações sejam contabilizados como "mensagens"
 * 
 * @param {Array} actions - Array de ações do Meta Ads API
 * @returns {Number} - Total de mensagens/leads/cadastros/conversões
 */
export function extractAllMessagesAndLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  
  let total = 0;
  
  // 1. Mensagens (conversas iniciadas)
  const messageTypes = [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply',
    'messaging_conversation_started_7d',
    'offsite_conversion.messaging_conversation_started_7d'
  ];
  
  const messageActions = actions.filter(action => 
    messageTypes.includes(action.action_type)
  );
  messageActions.forEach(action => {
    if (action.value) {
      total += parseInt(action.value) || 0;
    }
  });
  
  // 2. Cadastros (leads)
  const leadTypes = [
    'lead',
    'onsite_conversion.lead_grouped'
  ];
  
  const leadActions = actions.filter(action => 
    leadTypes.includes(action.action_type)
  );
  leadActions.forEach(action => {
    if (action.value) {
      total += parseInt(action.value) || 0;
    }
  });
  
  // 3. Conversões personalizadas (offsite_conversion.* que não sejam mensagens)
  const customConversions = actions.filter(action => {
    if (!action.action_type) return false;
    // Incluir todas as conversões offsite, exceto as de mensagens já contabilizadas
    if (action.action_type.startsWith('offsite_conversion.')) {
      return !messageTypes.includes(action.action_type);
    }
    return false;
  });
  
  customConversions.forEach(action => {
    if (action.value) {
      total += parseInt(action.value) || 0;
    }
  });
  
  return total;
}

