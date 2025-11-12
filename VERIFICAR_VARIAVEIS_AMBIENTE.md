# 🔍 Verificar Variáveis de Ambiente - Google Ads

## ❌ Erro Encontrado

```
DEVELOPER_TOKEN_INVALID
The developer token is not valid.
```

## 🔧 Solução: Verificar Variáveis na Nova Conta Vercel

### Variáveis Necessárias para Google Ads:

1. **`GOOGLE_ADS_DEVELOPER_TOKEN`** ⚠️ **CRÍTICO**
   - Token do desenvolvedor do Google Ads
   - Obtido em: https://ads.google.com/ → Central da API

2. **`GOOGLE_ADS_CLIENT_ID`** (opcional, mas recomendado)
   - Client ID do OAuth 2.0
   - Obtido em: Google Cloud Console → Credentials

3. **`GOOGLE_ADS_CLIENT_SECRET`** (opcional, mas recomendado)
   - Client Secret do OAuth 2.0
   - Obtido em: Google Cloud Console → Credentials

4. **`GOOGLE_ADS_REFRESH_TOKEN`** (opcional)
   - Refresh Token do OAuth
   - Obtido via script `get-refresh-token.js`

---

## 📋 Passo a Passo para Verificar

### 1. Acessar Nova Conta Vercel
1. Acesse: https://vercel.com/
2. Faça login na **conta nova**
3. Selecione o projeto: `insightflowv2` (ou o nome que você deu)

### 2. Verificar Variáveis de Ambiente
1. Vá em **Settings** → **Environment Variables**
2. Verifique se existe:
   - ✅ `GOOGLE_ADS_DEVELOPER_TOKEN`
   - ✅ `GOOGLE_ADS_CLIENT_ID` (se usar)
   - ✅ `GOOGLE_ADS_CLIENT_SECRET` (se usar)
   - ✅ `GOOGLE_ADS_REFRESH_TOKEN` (se usar)

### 3. Se Faltar Alguma Variável

**Opção A: Copiar da Conta Antiga**
1. Acesse a **conta antiga** do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Copie o valor de `GOOGLE_ADS_DEVELOPER_TOKEN`
4. Volte na **conta nova**
5. Adicione a variável com o valor copiado

**Opção B: Obter Novo Token**
1. Acesse: https://ads.google.com/
2. Vá em **Ferramentas e configurações** → **Central da API**
3. Copie o **Developer Token**
4. Adicione na nova conta Vercel

---

## ⚠️ Importante

- Após adicionar/atualizar variáveis, é necessário fazer um **novo deploy** ou **redeploy**
- As variáveis só ficam ativas após o deploy

---

## 🧪 Como Testar Após Configurar

1. Faça um redeploy no Vercel
2. Acesse: https://insightflowv2.vercel.app/
3. Tente conectar Google Ads novamente
4. Verifique o console do navegador (F12) para erros

---

## 📝 Checklist

- [ ] Acessei a nova conta Vercel
- [ ] Verifiquei se `GOOGLE_ADS_DEVELOPER_TOKEN` existe
- [ ] Copiei o valor da conta antiga (se necessário)
- [ ] Adicionei/atualizei a variável na conta nova
- [ ] Fiz um redeploy
- [ ] Testei a conexão Google Ads

