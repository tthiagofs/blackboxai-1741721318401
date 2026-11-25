# 📊 Guia de Configuração: Automação Google Sheets no InsightFlow

Este guia explica como ativar a sincronização automática das métricas de tráfego pago (Meta Ads e Google Ads) diretamente na sua planilha do Google Sheets.

---

## 🔗 Link da Planilha
- **URL:** [https://docs.google.com/spreadsheets/d/1YwoSLZKB96Al8OOBFTkEsrT7n5B60RnoWHwsMcGHNbg/edit?gid=255464261#gid=255464261](https://docs.google.com/spreadsheets/d/1YwoSLZKB96Al8OOBFTkEsrT7n5B60RnoWHwsMcGHNbg/edit?gid=255464261#gid=255464261)
- **Aba padrão:** `Novembro` (ou aba do mês corrente)
- **Linhas das Unidades:** da linha `2` até a linha `86`.

> [!IMPORTANT]
> **Segurança Total das Fórmulas e Linhas:**
> - O script altera **apenas** a Coluna B (`Investimento`), Coluna C (`Leads`) e a Coluna `Data de Atualização`.
> - Todas as demais colunas (`Orçamentos`, `Vendas`, `CAC`, `Faturamento`, `Gestor`, etc.) permanecem **100% intactas**.
> - **Nenhuma linha abaixo da linha 86 é alterada** em hipótese alguma.

---

## 🛠️ Passo a Passo de Instalação (Tempo: 1 minuto)

### 1. Abrir o Apps Script na Planilha
1. Abra a sua planilha no Google Sheets.
2. No menu superior, clique em **Extensões** > **Apps Script**.

---

### 2. Colar o Código
1. Apague o código que estiver lá dentro (`Code.gs`).
2. Cole o código abaixo exatamente como está:

```javascript
/**
 * INTEGRAÇÃO INSIGHTFLOW -> GOOGLE SHEETS
 * Atualização automática inteligente das métricas de tráfego pago (Meta Ads & Google Ads)
 * Sempre atualiza a última aba à direita com trava estrita de segurança do mês corrente.
 */

// 1. CARIMBO MANUAL (Sua função original - mantida intacta)
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  if (row < 2 || row > 90) return;
  const COLUNA_DATA = 17; // Coluna Q
  if (col !== COLUNA_DATA) {
    const agora = new Date();
    const dataFormatada = Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
    sheet.getRange(row, COLUNA_DATA).setValue(dataFormatada);
  }
}

// 2. LEITURA DE UNIDADES
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var target = getTargetSheet(ss);
    if (target.error) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: target.error })).setMimeType(ContentService.MimeType.JSON);
    }
    var sheet = target.sheet;
    var maxRow = 86; // Linha máxima das unidades
    var data = sheet.getRange(2, 1, maxRow - 1, 3).getValues();
    var units = [];
    
    for (var i = 0; i < data.length; i++) {
      var rowNumber = i + 2;
      var name = String(data[i][0] || '').trim();
      if (!name) continue;
      if (name.toLowerCase().indexOf('gestor de tr') !== -1 || name.toLowerCase().indexOf('unidades com') !== -1) break;
      units.push({ row: rowNumber, name: name });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheetName: sheet.getName(),
      units: units
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 3. RECEBER DADOS AUTOMÁTICOS
function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    var updates = json.updates || [];
    var maxRow = json.maxRow || 86;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var target = getTargetSheet(ss);
    
    // SEGURANÇA TOTAL: Se a aba do mês atual não existe na planilha, TRAVAR!
    if (target.error) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: target.error
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = target.sheet;
    
    // Ler nomes das unidades (coluna A, linhas 2 até maxRow)
    var numRows = maxRow - 1;
    var rangeUnits = sheet.getRange(2, 1, numRows, 1).getValues();
    
    // Mapear unidade normalizada para linha física na planilha
    var rowMap = {};
    for (var i = 0; i < rangeUnits.length; i++) {
      var uName = String(rangeUnits[i][0] || '').trim();
      if (uName) {
        var cleanKey = uName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        rowMap[cleanKey] = i + 2;
      }
    }
    
    var COLUNA_DATA = 17; // Coluna Q
    var nowStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
    var updatedCount = 0;
    
    // Aplicar atualizações apenas nas colunas de tráfego das unidades (até maxRow)
    for (var u = 0; u < updates.length; u++) {
      var item = updates[u];
      var key = String(item.unit || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var targetRow = rowMap[key];
      
      if (targetRow && targetRow <= maxRow) {
        if (item.spend !== undefined && item.spend !== null) {
          sheet.getRange(targetRow, 2).setValue(item.spend); // Coluna B = Investimento
        }
        if (item.leads !== undefined && item.leads !== null) {
          sheet.getRange(targetRow, 3).setValue(item.leads); // Coluna C = Leads
        }
        sheet.getRange(targetRow, COLUNA_DATA).setValue(nowStr); // Coluna Q = Data de Atualização
        updatedCount++;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      updatedCount: updatedCount,
      targetSheet: target.name,
      timestamp: nowStr
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Localiza a última aba à direita e valida se corresponde ao mês atual
function getTargetSheet(ss) {
  var allSheets = ss.getSheets();
  var now = new Date();
  
  var monthMap = [
    { num: '01', full: 'Janeiro', keys: ['janeiro', 'jan', '01'] },
    { num: '02', full: 'Fevereiro', keys: ['fevereiro', 'fev', '02'] },
    { num: '03', full: 'Março', keys: ['marco', 'março', 'mar', '03'] },
    { num: '04', full: 'Abril', keys: ['abril', 'abr', '04'] },
    { num: '05', full: 'Maio', keys: ['maio', 'mai', '05'] },
    { num: '06', full: 'Junho', keys: ['junho', 'jun', '06'] },
    { num: '07', full: 'Julho', keys: ['julho', 'jul', '07'] },
    { num: '08', full: 'Agosto', keys: ['agosto', 'ago', '08'] },
    { num: '09', full: 'Setembro', keys: ['setembro', 'set', '09'] },
    { num: '10', full: 'Outubro', keys: ['outubro', 'out', '10'] },
    { num: '11', full: 'Novembro', keys: ['novembro', 'nov', '11'] },
    { num: '12', full: 'Dezembro', keys: ['dezembro', 'dez', '12'] }
  ];
  
  var curMonthInfo = monthMap[now.getMonth()];
  var normalize = function(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  };
  
  // 1. Prioridade: A última aba à direita da planilha (onde você duplica cada novo mês)
  var rightmostSheet = allSheets[allSheets.length - 1];
  var rightNameNorm = normalize(rightmostSheet.getName());
  
  var matchesRight = curMonthInfo.keys.some(function(k) {
    return rightNameNorm.indexOf(k) !== -1;
  });
  
  if (matchesRight) {
    return { sheet: rightmostSheet, name: rightmostSheet.getName() };
  }
  
  // 2. Se a última da direita não bater, procurar nas outras abas
  for (var i = allSheets.length - 1; i >= 0; i--) {
    var s = allSheets[i];
    var sNameNorm = normalize(s.getName());
    var matchesOther = curMonthInfo.keys.some(function(k) {
      return sNameNorm.indexOf(k) !== -1;
    });
    if (matchesOther) {
      return { sheet: s, name: s.getName() };
    }
  }
  
  // 3. SEGURANÇA TOTAL: Se nenhuma aba corresponder ao mês atual, TRAVAR!
  return {
    error: '⚠️ Bloqueio de Segurança: A aba do mês atual (' + curMonthInfo.full.toUpperCase() + ') não foi encontrada na planilha! Crie ou renomeie a aba do mês atual para sincronizar com segurança.'
  };
}
```

---

### 3. Fazer a Implantação (Gerar o Webhook)
1. No canto superior direito do Apps Script, clique no botão azul **Implantar** > **Nova implantação**.
2. Clique no ícone de engrenagem ⚙️ ao lado de "Selecione o tipo" e escolha **App da Web**.
3. Preencha os campos:
   - **Descrição:** `InsightFlow Sync`
   - **Executar como:** `Eu (seu-email@gmail.com)`
   - **Quem pode acessar:** `Qualquer pessoa` *(necessário para o servidor do InsightFlow conseguir enviar os dados)*
4. Clique em **Implantar**.
5. Se o Google solicitar autorização de permissões:
   - Clique em **Revisar permissões**
   - Escolha sua conta do Google
   - Clique em **Avançado** > **Acessar [Nome do projeto] (não seguro)**
   - Clique em **Permitir**.
6. Copie a **URL do app da Web** gerada (algo parecido com `https://script.google.com/macros/s/AKfycb.../exec`).

---

### 4. Conectar no InsightFlow
1. Acesse o menu lateral do InsightFlow e clique em **Automação Planilha (Admin)** (`/automacao-planilha.html`).
2. Cole a URL no campo **URL do Webhook do Google Apps Script**.
3. Clique em **Salvar Configurações**.
4. Clique no botão **"Auto-vincular por Nome"** para vincular as contas com as 85 unidades.
5. Clique em **Salvar Mapeamento**.
6. Pronto! Agora você pode ligar a chave **"Automação Ativa"** ou clicar em **"Sincronizar Agora"** para fazer um teste imediato!
