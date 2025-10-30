# 📄 Configuração da Exportação PDF com Puppeteer (Vercel)

## Visão Geral

A exportação de PDF das apresentações foi **completamente reescrita** para usar **Puppeteer (Chromium headless)** em função serverless do **Vercel** ao invés de html2canvas/jsPDF. Isso garante:

✅ PDF idêntico ao que aparece na tela  
✅ Gradientes, fontes e estilos preservados  
✅ Sem distorções ou "squash"  
✅ Uma página A4 landscape por slide  
✅ Texto selecionável no PDF (não é imagem)  

---

## 🏗️ Arquitetura

### 1. **Página Print-Friendly** (`apresentacao-print.html`)
- Rota dedicada para renderização otimizada para impressão
- Carrega apresentação do Firestore via parâmetros `?id={presentationId}&projectId={projectId}`
- CSS configurado para:
  - `@page { size: A4 landscape; margin: 0; }`
  - Cada `.slide` com `page-break-after: always`
  - Sem animações/transições na impressão

### 2. **Função Vercel Serverless** (`api/export-pdf.js`)
- Usa `@sparticuz/chromium` (otimizado para serverless)
- Usa `puppeteer-core` para controlar Chromium
- Processo:
  1. Navega para `apresentacao-print.html?id=...&projectId=...`
  2. Aguarda `networkidle0` e `document.fonts.ready`
  3. Espera sinal `window.isPrintReady === true`
  4. Gera PDF com `page.pdf({ printBackground: true, preferCSSPageSize: true, landscape: true })`
  5. Retorna PDF como resposta HTTP

### 3. **Botão de Exportação** (`gerar-apresentacao.html`)
- Abre URL: `/api/export-pdf?id={presentationId}&projectId={projectId}`
- IDs são armazenados em `window.currentPresentationData` quando apresentação é salva

---

## 📦 Dependências

### Adicionadas em `api/package.json`:
```json
{
  "dependencies": {
    "@sparticuz/chromium": "^119.0.2",
    "puppeteer-core": "^21.6.1"
  }
}
```

### Configuração Vercel (`vercel.json`):
```json
{
  "functions": {
    "api/export-pdf.js": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

---

## 🚀 Como Usar

### **Produção (Vercel)**

Basta fazer o deploy no Vercel:

```bash
# Fazer commit e push
git add .
git commit -m "feat: exportação PDF com Puppeteer"
git push

# Vercel automaticamente detecta e faz deploy
```

O Vercel automaticamente:
1. Detecta as funções em `api/`
2. Instala as dependências de `api/package.json`
3. Builda e deploya as funções

URL em produção:
```
https://seu-app.vercel.app/api/export-pdf?id=...&projectId=...
```

---

## 🔍 Como Testar Online

1. Acesse seu app no Vercel: `https://seu-app.vercel.app`
2. Gere uma apresentação
3. Clique em **"Salvar Apresentação"** (isso gera os IDs necessários)
4. Clique em **"Exportar PDF"**
5. PDF será gerado e aberto em nova aba

**Importante:** A apresentação PRECISA ser salva primeiro para gerar os IDs!

---

## 🐛 Troubleshooting

### Erro: "Missing or insufficient permissions"
**Solução:** Aplicar regras do Firestore conforme `FIRESTORE_RULES_APRESENTACOES.md`

### PDF não abre / timeout
**Causas possíveis:**
- Apresentação não foi salva (IDs inexistentes)
- Firestore rules bloqueando leitura
- Timeout da função (aumentar em `netlify.toml`)

**Debug:**
```javascript
// Ver IDs no console
console.log(window.currentPresentationData.presentationId);
console.log(window.currentPresentationData.projectId);
```

### Fontes não aparecem no PDF
**Solução:** Verificar que Google Fonts está carregando em `apresentacao-print.html`

### Imagens não aparecem
**Causas possíveis:**
- CORS não configurado para imagens externas
- Imagens do Firebase Storage sem acesso público

**Solução:** Configurar CORS conforme `CONFIGURAR_STORAGE_CORS.md`

---

## 📝 Diferenças da Implementação Anterior

| Aspecto | html2canvas/jsPDF (ANTIGO) | Puppeteer (NOVO) |
|---------|---------------------------|------------------|
| **Renderização** | Cliente (navegador) | Servidor (Chromium) |
| **Qualidade** | Imagem PNG rasterizada | PDF nativo vetorial |
| **Distorções** | Comum (squash, cortes) | Zero (idêntico ao navegador) |
| **Gradientes** | Às vezes bugados | Perfeitos |
| **Fontes** | Às vezes incorretas | Sempre corretas |
| **Tamanho arquivo** | Grande (80MB+) | Otimizado (~2-5MB) |
| **Performance** | Lenta (cliente) | Rápida (servidor) |
| **Texto selecionável** | ❌ Não | ✅ Sim |

---

## ✅ Checklist de Deploy

- [ ] Código commitado e enviado para repositório
- [ ] Vercel faz deploy automático (detecta `api/export-pdf.js`)
- [ ] Firestore rules aplicadas para `presentations` collection
- [ ] Firebase Storage CORS configurado (se usar imagens)
- [ ] Testar online:
  1. Gerar apresentação
  2. Salvar apresentação
  3. Exportar PDF

---

## 📚 Referências

- [Puppeteer Documentation](https://pptr.dev/)
- [Sparticuz Chromium](https://github.com/Sparticuz/chromium)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [CSS Paged Media](https://www.w3.org/TR/css-page-3/)

