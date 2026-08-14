# 🚀 GUIA COMPLETO - Migração para Nova Conta Vercel

## ⚠️ IMPORTANTE: Dados NÃO serão perdidos!

- ✅ **Firebase (Firestore)** é independente do Vercel
- ✅ **Dados dos usuários** permanecem intactos
- ✅ **Unidades, pastas, senhas** continuam funcionando
- ✅ Apenas a **URL do frontend** muda

---

## 📋 CHECKLIST COMPLETO

### ✅ **PASSO 1: Transferir Projeto (2-5 min)**

1. **Na conta ANTIGA do Vercel:**
   - Acesse: https://vercel.com
   - Entre no projeto: `insightflowapp`
   - Vá em **Settings** → **General**
   - Role até **"Transfer Project"**
   - Digite o **email da nova conta**
   - Clique em **"Transfer"**
   - Confirme a transferência

2. **Na conta NOVA do Vercel:**
   - Verifique o email de confirmação
   - Aceite a transferência
   - Projeto será transferido automaticamente

3. **Anote a NOVA URL:**
   - Será algo como: `https://insightflowapp-novousuario.vercel.app`
   - **COPIE ESSA URL** (você vai precisar)

---

### ✅ **PASSO 2: Configurar Variáveis de Ambiente (5 min)**

1. **Na nova conta Vercel:**
   - Vá em **Settings** → **Environment Variables**
   - Adicione todas as variáveis:

```
SENDGRID_FROM_EMAIL=thiagofelipefreire0810@gmail.com
SENDGRID_API_KEY=SG.[SEU_API_KEY_AQUI]
GOOGLE_ADS_CLIENT_ID=73361857075-qoqd61imivlju9l83dd6fevvh8e8ppsf.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=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
GOOGLE_ADS_DEVELOPER_TOKEN=XJMJTE6x6lU7zbtl8oNFXA
GOOGLE_ADS_REFRESH_TOKEN=1//[SEU_REFRESH_TOKEN_AQUI]
```

2. **Após adicionar todas:**
   - Clique em **"Redeploy"** para aplicar as variáveis

---

### ✅ **PASSO 3: Atualizar Facebook Developers (5 min)**

1. **Acesse:** https://developers.facebook.com/
2. **Vá em:** Seu App → **Settings** → **Basic**
3. **Encontre:** "App Domains" e "Website"
4. **Atualize com a NOVA URL:**
   - App Domains: `insightflowapp-novousuario.vercel.app` (sem https://)
   - Website: `https://insightflowapp-novousuario.vercel.app`
5. **Vá em:** **Products** → **Facebook Login** → **Settings**
6. **Atualize "Valid OAuth Redirect URIs":**
   - Adicione: `https://insightflowapp-novousuario.vercel.app`
   - Remova a URL antiga (ou mantenha ambas temporariamente)
7. **Salve todas as alterações**

---

### ✅ **PASSO 4: Atualizar Google Cloud Console (5 min)**

1. **Acesse:** https://console.cloud.google.com/
2. **Selecione o projeto:** (onde está o Google Ads API)
3. **Vá em:** **APIs & Services** → **Credentials**
4. **Encontre seu OAuth 2.0 Client ID**
5. **Clique para editar**
6. **Em "Authorized JavaScript origins":**
   - Adicione: `https://insightflowapp-novousuario.vercel.app`
   - Mantenha a URL antiga temporariamente (ou remova)
7. **Em "Authorized redirect URIs":**
   - Adicione: `https://insightflowapp-novousuario.vercel.app`
   - Mantenha a URL antiga temporariamente (ou remova)
8. **Salve**

---

### ✅ **PASSO 5: Atualizar Firebase Storage CORS (5 min)**

1. **Acesse:** https://console.cloud.google.com/
2. **Selecione o projeto:** `insightflow-82cc4`
3. **Vá em:** **Cloud Storage** → **Buckets**
4. **Clique no bucket:** `insightflow-82cc4.firebasestorage.app`
5. **Vá em:** **Permissions** (Permissões)
6. **Clique em:** **CORS Configuration**
7. **Atualize a configuração:**

```json
[
  {
    "origin": [
      "https://insightflowapp-novousuario.vercel.app",
      "https://insightflowapp.vercel.app",
      "http://localhost:*"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

8. **Salve**

---

### ✅ **PASSO 6: Atualizar SendGrid (se aplicável) (3 min)**

1. **Acesse:** https://app.sendgrid.com/
2. **Vá em:** **Settings** → **Sender Authentication**
3. **Se tiver domínio verificado:**
   - Adicione a nova URL nas configurações de domínio
4. **Se não tiver domínio verificado:**
   - Não precisa fazer nada (usa email do remetente)

---

### ✅ **PASSO 7: Testar Tudo (10 min)**

Teste cada funcionalidade:

1. **✅ Login Facebook:**
   - Acesse o app na nova URL
   - Tente fazer login com Facebook
   - Deve funcionar normalmente

2. **✅ Login Google:**
   - Tente fazer login com Google
   - Deve funcionar normalmente

3. **✅ Upload de Logo:**
   - Tente fazer upload de uma logo
   - Não deve dar erro de CORS

4. **✅ Gerar Relatórios:**
   - Gere um relatório completo
   - Verifique se dados aparecem corretamente

5. **✅ Exportar PDF:**
   - Tente exportar um PDF
   - Deve funcionar

6. **✅ Enviar Convites:**
   - Tente enviar um convite
   - Deve funcionar

---

## 🔒 **SEGURANÇA (IMPORTANTE!)**

Após a migração, considere:

1. **Regenerar SENDGRID_API_KEY:**
   - SendGrid Dashboard → Settings → API Keys
   - Crie uma nova chave
   - Atualize no Vercel

2. **Regenerar GOOGLE_ADS_CLIENT_SECRET:**
   - Google Cloud Console → Credentials
   - Crie novas credenciais OAuth
   - Atualize no Vercel

3. **Remover credenciais antigas:**
   - Após confirmar que tudo funciona
   - Remova as URLs antigas dos serviços

---

## 📝 **RESUMO DO QUE MUDOU**

| Item | Antes | Depois |
|------|-------|--------|
| URL do App | `insightflowapp.vercel.app` | `insightflowapp-novousuario.vercel.app` |
| Firebase | ✅ Mesmo | ✅ Mesmo |
| Dados dos Usuários | ✅ Intactos | ✅ Intactos |
| Variáveis de Ambiente | ⚠️ Precisa reconfigurar | ✅ Configurado |
| Facebook OAuth | ⚠️ Precisa atualizar URLs | ✅ Atualizado |
| Google OAuth | ⚠️ Precisa atualizar URLs | ✅ Atualizado |
| Firebase CORS | ⚠️ Precisa atualizar | ✅ Atualizado |

---

## ⏱️ **TEMPO TOTAL: ~30-40 minutos**

---

## 🆘 **SE ALGO DER ERRADO**

1. **App não carrega:**
   - Verifique se o deploy foi concluído
   - Verifique variáveis de ambiente

2. **Login Facebook não funciona:**
   - Verifique URLs no Facebook Developers
   - Aguarde alguns minutos (cache)

3. **Login Google não funciona:**
   - Verifique URLs no Google Cloud Console
   - Aguarde alguns minutos (cache)

4. **Erro de CORS no upload:**
   - Verifique CORS do Firebase Storage
   - Aguarde alguns minutos (cache)

5. **Dados não aparecem:**
   - Verifique se Firebase está conectado
   - Verifique console do navegador

---

## ✅ **PRÓXIMOS PASSOS (DEPOIS)**

1. **Comprar domínio personalizado:**
   - Registrar domínio (ex: `insightflow.com`)
   - Configurar no Vercel
   - Atualizar todas as URLs novamente

2. **Remover URLs antigas:**
   - Após confirmar que tudo funciona
   - Remover URLs antigas dos serviços

3. **Avisar usuários:**
   - Se necessário, avisar sobre nova URL
   - Ou configurar redirecionamento

---

**Boa sorte com a migração! 🚀**

