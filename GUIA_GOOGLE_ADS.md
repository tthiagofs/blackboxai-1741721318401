# 📘 GUIA COMPLETO - Configurar Google Ads API

## 🎯 O que você vai precisar fazer:

### **PARTE 1: Criar Projeto no Google Cloud (15 min)**

1. **Acesse:** https://console.cloud.google.com/
2. **Faça login** com sua conta Google
3. **Clique em** "Selecionar projeto" → "Novo Projeto"
4. **Nome do projeto:** "BlackBox Ads Reporter"
5. **Clique em** "Criar"

---

### **PARTE 2: Ativar Google Ads API (5 min)**

1. **No menu lateral:** "APIs e serviços" → "Biblioteca"
2. **Pesquise:** "Google Ads API"
3. **Clique em** "Google Ads API"
4. **Clique em** "Ativar"

---

### **PARTE 3: Criar Credenciais OAuth 2.0 (10 min)**

1. **No menu lateral:** "APIs e serviços" → "Credenciais"
2. **Clique em** "Criar credenciais" → "ID do cliente OAuth 2.0"
3. **Se pedir, configure a tela de consentimento:**
   - Tipo: Externo
   - Nome do app: BlackBox Ads Reporter
   - Email de suporte: seu email
   - Domínio: (deixe em branco por enquanto)
   - Clique em "Salvar e continuar"
   
4. **Volte para criar credenciais:**
   - Tipo de aplicativo: "Aplicativo da Web"
   - Nome: "BlackBox Reporter"
   - URIs de redirecionamento autorizados:
     - `http://localhost:8888/.netlify/functions/google-ads-callback`
     - `https://SEU-SITE.netlify.app/.netlify/functions/google-ads-callback`
   
5. **Clique em** "Criar"
6. **COPIE E GUARDE:**
   - Client ID (começa com algo como: `123456-abc.apps.googleusercontent.com`)
   - Client Secret (algo como: `GOCSPX-xxxxxxxxxxxxx`)

---

### **PARTE 4: Obter Developer Token do Google Ads (10 min)**

1. **Acesse:** https://ads.google.com/
2. **Faça login** com a conta de administrador do Google Ads
3. **Clique em** "Ferramentas e configurações" (ícone de chave inglesa)
4. **Em "Configuração":** clique em "Central da API"
5. **Clique em** "Solicitar acesso básico" (se ainda não tiver)
6. **Preencha o formulário:**
   - Descrição: "Relatórios internos de desempenho"
   - Aceite os termos
7. **COPIE E GUARDE** o Developer Token (algo como: `ABcdEF1234567890`)

⚠️ **IMPORTANTE:** O token pode levar algumas horas para ser aprovado. Enquanto isso, você pode usar em modo de teste.

---

### **PARTE 5: Obter Refresh Token (15 min)**

Este é o passo mais técnico, mas vou te guiar:

1. **Baixe e instale Node.js:** https://nodejs.org/ (versão LTS)

2. **Abra o terminal/cmd** na pasta do projeto

3. **Rode o comando:**
   ```bash
   npm install
   ```

4. **Crie um arquivo** `.env` na raiz do projeto com:
   ```
   GOOGLE_ADS_CLIENT_ID=SEU_CLIENT_ID_AQUI
   GOOGLE_ADS_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
   GOOGLE_ADS_DEVELOPER_TOKEN=SEU_DEVELOPER_TOKEN_AQUI
   ```

5. **Vou criar um script para você obter o refresh token** (próximo passo)

---

### **PARTE 6: Obter Customer IDs**

1. **Acesse:** https://ads.google.com/
2. **No canto superior direito,** veja o ID da conta (ex: `123-456-7890`)
3. **Remova os hífens:** `1234567890`
4. **Este é seu Customer ID!**

⚠️ Se você gerencia várias contas, anote o Customer ID de cada uma.

---

## 🚀 Próximos Passos Após Obter as Credenciais:

1. ✅ Adicione as credenciais ao arquivo `.env`
2. ✅ Rode o script para obter o refresh token (vou criar)
3. ✅ Configure no Netlify (vou te mostrar)
4. ✅ Teste a integração!

---

## 🆘 Problemas Comuns:

**"API não ativada"**
- Volte para o Google Cloud Console e ative a Google Ads API

**"Token inválido"**
- Aguarde algumas horas para aprovação do Developer Token
- Enquanto isso, use em modo de teste

**"Erro de OAuth"**
- Verifique se os URIs de redirecionamento estão corretos
- Verifique se o Client ID e Secret estão corretos no .env

---

## 💰 Custos:

- **Google Ads API:** GRATUITO (até 15.000 operações/dia)
- **Netlify Functions:** GRATUITO (até 125.000 requisições/mês)
- **Total:** R$ 0,00 ✅

---

Quando você tiver todas as credenciais, me avise para continuar! 🎉

