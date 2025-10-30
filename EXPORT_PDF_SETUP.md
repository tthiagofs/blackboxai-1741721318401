# 📄 Configuração da Exportação PDF com Puppeteer

## Visão Geral

A exportação de PDF das apresentações foi **completamente reescrita** para usar **Puppeteer (Chromium headless)** ao invés de html2canvas/jsPDF. Isso garante:

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

### 2. **Função Netlify Serverless** (`netlify/functions/export-pdf.js`)
- Usa `@sparticuz/chromium` (otimizado para serverless)
- Usa `puppeteer-core` para controlar Chromium
- Processo:
  1. Navega para `apresentacao-print.html?id=...&projectId=...`
  2. Aguarda `networkidle0` e `document.fonts.ready`
  3. Espera sinal `window.isPrintReady === true`
  4. Gera PDF com `page.pdf({ printBackground: true, preferCSSPageSize: true, landscape: true })`
  5. Retorna PDF como resposta HTTP

### 3. **Botão de Exportação** (`gerar-apresentacao.html`)
- Abre URL: `/.netlify/functions/export-pdf?id={presentationId}&projectId={projectId}`
- IDs são armazenados em `window.currentPresentationData` quando apresentação é salva

---

## 📦 Dependências

### Adicionadas em `netlify/functions/package.json`:
```json
{
  "dependencies": {
    "@sparticuz/chromium": "^119.0.2",
    "puppeteer-core": "^21.6.1"
  }
}
```

### Configuração Netlify (`netlify.toml`):
```toml
[[functions]]
  name = "export-pdf"
  timeout = 60
```

---

## 🚀 Como Usar

### 1. **Desenvolvimento Local**

```bash
# Instalar dependências da função
cd netlify/functions
npm install
cd ../..

# Rodar Netlify Dev
netlify dev
```

A função estará disponível em:
```
http://localhost:8888/.netlify/functions/export-pdf?id=PRESENTATION_ID&projectId=PROJECT_ID
```

### 2. **Produção (Netlify)**

O Netlify automaticamente:
1. Detecta as funções em `netlify/functions/`
2. Instala as dependências específicas
3. Builda e deploya as funções

URL em produção:
```
https://seu-site.netlify.app/.netlify/functions/export-pdf?id=...&projectId=...
```

---

## 🔍 Testando Localmente

### Testar página print diretamente:
```
http://localhost:8888/apresentacao-print.html?id=PRESENTATION_ID&projectId=PROJECT_ID
```

**Requisitos:**
- Apresentação deve estar salva no Firestore
- Usar IDs válidos de apresentação e projeto

### Testar função PDF:
1. Gere uma apresentação
2. Clique em "Salvar Apresentação"
3. Clique em "Exportar PDF"
4. PDF será aberto em nova aba

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

- [ ] Dependências instaladas em `netlify/functions/`
- [ ] Firestore rules aplicadas para `presentations` collection
- [ ] Firebase Storage CORS configurado (se usar imagens)
- [ ] Variáveis de ambiente configuradas no Netlify:
  - `URL` (setado automaticamente pelo Netlify)
- [ ] Testado localmente com `netlify dev`
- [ ] Testado em produção após deploy

---

## 📚 Referências

- [Puppeteer Documentation](https://pptr.dev/)
- [Sparticuz Chromium](https://github.com/Sparticuz/chromium)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [CSS Paged Media](https://www.w3.org/TR/css-page-3/)

