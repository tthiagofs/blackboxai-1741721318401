# ✅ CHECKLIST - INTEGRAÇÃO GOOGLE ADS

Use este checklist para acompanhar seu progresso!

---

## 📋 FASE 1: CREDENCIAIS GOOGLE ADS

### **1.1 - Google Cloud Console** ⏱️ 15 min
- [ ] Acessar https://console.cloud.google.com/
- [ ] Criar projeto "BlackBox Ads Reporter"
- [ ] Ativar Google Ads API
- [ ] Criar credenciais OAuth 2.0
- [ ] Copiar e guardar Client ID
- [ ] Copiar e guardar Client Secret

### **1.2 - Google Ads** ⏱️ 10 min
- [ ] Acessar https://ads.google.com/
- [ ] Ir em Ferramentas → Central da API
- [ ] Solicitar acesso básico (se necessário)
- [ ] Copiar e guardar Developer Token
- [ ] Anotar Customer ID de cada conta

### **1.3 - Refresh Token** ⏱️ 5 min
- [ ] Baixar e instalar Node.js (se ainda não tem)
- [ ] Abrir terminal na pasta do projeto
- [ ] Rodar: `npm install`
- [ ] Rodar: `node get-refresh-token.js`
- [ ] Seguir instruções do script
- [ ] Copiar e guardar Refresh Token

---

## 🚀 FASE 2: DEPLOY NETLIFY

### **2.1 - Conta Netlify** ⏱️ 5 min
- [ ] Acessar https://app.netlify.com/signup
- [ ] Fazer login com GitHub
- [ ] Autorizar Netlify a acessar repositórios

### **2.2 - Deploy** ⏱️ 3 min
- [ ] Clicar em "Add new site"
- [ ] Selecionar "Deploy with GitHub"
- [ ] Escolher repositório `blackboxai-1741721318401`
- [ ] Branch: `main`
- [ ] Build command: (deixar em branco)
- [ ] Publish directory: `.`
- [ ] Clicar em "Deploy site"
- [ ] Aguardar deploy finalizar

### **2.3 - Variáveis de Ambiente** ⏱️ 5 min
- [ ] Ir em Site configuration → Environment variables
- [ ] Adicionar `GOOGLE_ADS_CLIENT_ID`
- [ ] Adicionar `GOOGLE_ADS_CLIENT_SECRET`
- [ ] Adicionar `GOOGLE_ADS_DEVELOPER_TOKEN`
- [ ] Ir em Deploy → Trigger deploy → Deploy site

### **2.4 - Personalizar (Opcional)** ⏱️ 2 min
- [ ] Ir em Domain management
- [ ] Editar nome do site
- [ ] Anotar URL final: `https://_____.netlify.app`

---

## 🧪 FASE 3: TESTES

### **3.1 - Testar Meta Ads (já funciona)** ⏱️ 5 min
- [ ] Acessar site no Netlify
- [ ] Fazer login com Facebook
- [ ] Selecionar conta de anúncios
- [ ] Gerar relatório de teste
- [ ] Verificar se dados aparecem corretamente
- [ ] Testar exportar PDF

### **3.2 - Avisar que está pronto** ⏱️ 1 min
- [ ] Anotar URL do site
- [ ] Confirmar que credenciais Google estão ok
- [ ] Confirmar que variáveis de ambiente estão configuradas
- [ ] **ME AVISAR!** 🎉

---

## 🔄 FASE 4: FINALIZAÇÃO (EU FAÇO)

### **4.1 - Frontend Google Ads** ⏱️ 15 min
- [ ] Adicionar seleção de plataforma (Meta/Google)
- [ ] Integrar serviço googleAds.js
- [ ] Criar campos de Customer ID
- [ ] Implementar autenticação Google

### **4.2 - Renderização** ⏱️ 10 min
- [ ] Adaptar renderização para Google Ads
- [ ] Adicionar métricas do Google
- [ ] Implementar comparação de períodos
- [ ] Adicionar exportação PDF

### **4.3 - Testes Finais** ⏱️ 10 min
- [ ] Testar Meta Ads (garantir que não quebrou)
- [ ] Testar Google Ads completo
- [ ] Testar comparação de períodos
- [ ] Testar exportação PDF
- [ ] Ajustes finais

---

## 📊 PROGRESSO GERAL

**VOCÊ PRECISA FAZER:**
- [ ] Fase 1: Credenciais Google Ads (~30 min)
- [ ] Fase 2: Deploy Netlify (~15 min)
- [ ] Fase 3: Testes (~5 min)

**EU VOU FAZER:**
- [ ] Fase 4: Finalização (~35 min)

---

## 🎯 DEPOIS DE TUDO PRONTO:

- [ ] Testar com conta real do Google Ads
- [ ] Gerar relatório de teste
- [ ] Comparar com relatório do Meta
- [ ] Celebrar! 🎉🚀

---

## 💡 DICAS:

- ✅ Faça uma fase por vez
- ✅ Marque os checkboxes conforme avança
- ✅ Se travar, leia os guias específicos
- ✅ Me avise quando terminar Fase 1 e 2

---

## 🆘 ONDE BUSCAR AJUDA:

| Se travar em... | Leia... |
|-----------------|---------|
| Credenciais Google | [`GUIA_GOOGLE_ADS.md`](GUIA_GOOGLE_ADS.md) |
| Deploy Netlify | [`DEPLOY_NETLIFY.md`](DEPLOY_NETLIFY.md) |
| Visão geral | [`RESUMO_COMPLETO.md`](RESUMO_COMPLETO.md) |
| O que fazer | [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md) |
| Arquitetura | [`README.md`](README.md) |

---

**🚀 Bora começar! Marca os checkboxes e me avisa quando terminar! 💪**

