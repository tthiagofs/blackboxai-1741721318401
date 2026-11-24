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
 * Atualização automática das métricas de tráfego pago (Meta Ads & Google Ads)
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var maxRow = 86; // Linha máxima das unidades
    var data = sheet.getRange(2, 1, maxRow - 1, 3).getValues();
    var units = [];
    
    for (var i = 0; i < data.length; i++) {
      var rowNumber = i + 2;
      var name = String(data[i][0] || '').trim();
      if (!name) continue;
      // Interromper se atingir linhas de resumo
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

function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    var updates = json.updates || [];
    var tabName = json.tabName || '';
    var maxRow = json.maxRow || 86;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = tabName ? ss.getSheetByName(tabName) : ss.getActiveSheet();
    if (!sheet) sheet = ss.getActiveSheet();
    
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
    
    // Localizar coluna de Data de Atualização na linha 1
    var headerValues = sheet.getRange(1, 1, 1, 20).getValues()[0];
    var colDate = -1;
    for (var c = 0; c < headerValues.length; c++) {
      var h = String(headerValues[c] || '').toLowerCase();
      if (h.indexOf('data') !== -1 && h.indexOf('atualiz') !== -1) {
        colDate = c + 1;
        break;
      }
    }
    if (colDate === -1) colDate = 17; // Padrão coluna Q
    
    // Data e Hora de Brasília
    var nowStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss');
    var updatedCount = 0;
    
    // Aplicar atualizações apenas nas colunas de tráfego
    for (var u = 0; u < updates.length; u++) {
      var item = updates[u];
      var key = String(item.unit || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var targetRow = rowMap[key];
      
      // Validação estrita: linha deve existir e ser <= maxRow (86)
      if (targetRow && targetRow <= maxRow) {
        if (item.spend !== undefined && item.spend !== null) {
          sheet.getRange(targetRow, 2).setValue(item.spend); // Coluna B = Investimento
        }
        if (item.leads !== undefined && item.leads !== null) {
          sheet.getRange(targetRow, 3).setValue(item.leads); // Coluna C = Leads
        }
        sheet.getRange(targetRow, colDate).setValue(nowStr); // Coluna Data de Atualização
        updatedCount++;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      updatedCount: updatedCount,
      timestamp: nowStr
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
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
