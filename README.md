# 📊 BlackBox Ads Reporter

Aplicação web para gerar relatórios de anúncios do **Meta Ads (Facebook/Instagram)** e **Google Ads**.

---

## 🚀 **INÍCIO RÁPIDO**

### 1️⃣ **Clone o repositório**
```bash
git clone https://github.com/SEU-USUARIO/blackboxai-1741721318401.git
cd blackboxai-1741721318401
```

### 2️⃣ **Instale as dependências**
```bash
npm install
```

### 3️⃣ **Configure as credenciais**

#### **Para Meta Ads (Facebook/Instagram):**
- Já está configurado! ✅
- Faz login direto pelo Facebook SDK

#### **Para Google Ads:**
1. Siga o guia: [`GUIA_GOOGLE_ADS.md`](GUIA_GOOGLE_ADS.md)
2. Obtenha as credenciais do Google Cloud Console
3. Rode o script para obter o refresh token:
   ```bash
   node get-refresh-token.js
   ```
4. Configure as variáveis de ambiente no Netlify

### 4️⃣ **Faça o deploy**

Siga o guia: [`DEPLOY_NETLIFY.md`](DEPLOY_NETLIFY.md)

---

## 📁 **Estrutura do Projeto**

```
blackboxai-1741721318401/
├── index.html                  # Página de login
├── RelatorioCompleto.html      # Página de relatórios
├── app.js                      # Lógica de autenticação e navegação
├── auth.js                     # Autenticação Facebook
├── RelatorioCompleto.js        # Geração de relatórios
├── exportPDF.js                # Exportação para PDF
├── style.css                   # Estilos globais
│
├── services/
│   ├── facebookInsights.js     # API do Meta Ads
│   └── googleAds.js            # API do Google Ads (via Netlify)
│
├── utils/
│   ├── format.js               # Formatação de dados
│   └── dom.js                  # Utilitários DOM
│
├── netlify/
│   └── functions/
│       └── google-ads.js       # Serverless function para Google Ads
│
├── netlify.toml                # Configuração do Netlify
├── package.json                # Dependências Node.js
├── get-refresh-token.js        # Script auxiliar Google Ads
│
├── GUIA_GOOGLE_ADS.md          # Guia completo Google Ads
├── DEPLOY_NETLIFY.md           # Guia de deploy
└── README.md                   # Este arquivo
```

---

## 🎯 **Funcionalidades**

### ✅ **Meta Ads (Facebook/Instagram)**
- Login via Facebook OAuth
- Seleção de contas de anúncios
- Filtros por campanhas e conjuntos de anúncios
- Métricas:
  - Investimento
  - Alcance
  - Conversas iniciadas
  - Custo por conversa
- Comparação de períodos
- Top 2 melhores anúncios com imagens
- Dados manuais (vendas, faturamento, análise)
- Exportação para PDF e WhatsApp

### 🔄 **Google Ads (Em implementação)**
- Seleção de contas do Google Ads
- Filtros por campanhas
- Métricas:
  - Custo (gasto)
  - Impressões
  - Conversões (todas)
  - Custo por conversão
- Comparação de períodos
- Exportação para PDF

---

## 🛠️ **Tecnologias Utilizadas**

- **Frontend:** HTML, CSS (Tailwind), JavaScript (ES6 Modules)
- **APIs:**
  - Facebook Graph API (Meta Ads)
  - Google Ads API
- **Backend:** Netlify Functions (Serverless)
- **Bibliotecas:**
  - jsPDF (exportação PDF)
  - html2canvas (captura de tela)
  - google-ads-api (Google Ads)

---

## 💰 **Custos**

| Serviço | Plano | Custo |
|---------|-------|-------|
| GitHub Pages / Netlify | Gratuito | R$ 0,00 |
| Meta Ads API | Gratuito | R$ 0,00 |
| Google Ads API | Gratuito* | R$ 0,00 |
| Netlify Functions | Gratuito** | R$ 0,00 |
| **TOTAL** | | **R$ 0,00/mês** |

*Até 15.000 operações/dia  
**Até 125.000 requisições/mês

---

## 📖 **Como Usar**

### **Gerar Relatório Meta Ads:**
1. Faça login com sua conta Facebook
2. Selecione a conta de anúncios
3. Escolha o período (ou clique em "Últimos 7 Dias")
4. Selecione se possui Black (opcional)
5. Filtre campanhas/conjuntos (opcional)
6. Ative comparação de período (opcional)
7. Preencha dados manuais (opcional)
8. Clique em "Gerar Relatório"
9. Exporte para PDF ou compartilhe no WhatsApp

### **Gerar Relatório Google Ads:**
*(Em desenvolvimento)*
1. Faça login com sua conta Google
2. Selecione a conta do Google Ads
3. Escolha o período
4. Filtre campanhas (opcional)
5. Clique em "Gerar Relatório"

---

## 🔐 **Segurança**

- ✅ Credenciais armazenadas como variáveis de ambiente
- ✅ Tokens de acesso não expostos no código
- ✅ Comunicação via HTTPS
- ✅ Sem banco de dados (stateless)
- ✅ Sem armazenamento de dados sensíveis

---

## 🐛 **Problemas Conhecidos**

- [ ] Google Ads ainda não implementado no frontend
- [ ] Comparação de múltiplas contas simultaneamente

---

## 📝 **Próximas Funcionalidades**

- [ ] Suporte completo ao Google Ads
- [ ] Comparação lado a lado Meta vs Google
- [ ] Gráficos de desempenho
- [ ] Histórico de relatórios
- [ ] Agendamento de relatórios

---

## 🤝 **Contribuindo**

Este é um projeto privado. Para sugestões ou reportar bugs, entre em contato.

---

## 📞 **Suporte**

Encontrou algum problema? Verifique os guias:
- [`GUIA_GOOGLE_ADS.md`](GUIA_GOOGLE_ADS.md) - Problemas com Google Ads
- [`DEPLOY_NETLIFY.md`](DEPLOY_NETLIFY.md) - Problemas com deploy

---

## 📄 **Licença**

Uso privado. Todos os direitos reservados.

---

**Desenvolvido com ❤️ por Thiago FS**

