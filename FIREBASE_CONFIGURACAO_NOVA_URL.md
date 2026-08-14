# 🔥 Configuração Firebase - Nova URL

## Nova URL do App
**https://insightflowv2.vercel.app/**

---

## ✅ Verificação das Regras do Firestore

As regras do Firestore que você forneceu estão **CORRETAS** e não precisam de alteração. Elas controlam o acesso aos dados, não as URLs permitidas.

**Status:** ✅ **Aprovado** - Não requer alterações

---

## ⚠️ Configurações Necessárias no Firebase

### 1. Firebase Authentication - Domínios Autorizados

**O QUE FAZER:** Adicionar a nova URL aos domínios autorizados para permitir login

**PASSO A PASSO:**
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: **`insightflow-82cc4`**
3. No menu lateral, clique em **Authentication**
4. Vá na aba **Settings** (Configurações)
5. Role até a seção **"Authorized domains"** (Domínios autorizados)
6. Clique em **"Add domain"** (Adicionar domínio)
7. Digite: `insightflowv2.vercel.app`
8. Clique em **"Add"** (Adicionar)

**Domínios que devem estar autorizados:**
- ✅ `localhost` (já deve estar)
- ✅ `insightflowapp.vercel.app` (URL antiga - manter)
- ⚠️ `insightflowv2.vercel.app` (NOVA - adicionar)

---

### 2. Firebase Storage - Configuração CORS

**O QUE FAZER:** Atualizar CORS no Google Cloud Console para permitir uploads da nova URL

**PASSO A PASSO:**
1. Acesse: https://console.cloud.google.com/
2. Selecione o projeto: **`insightflow-82cc4`**
3. No menu lateral, vá em **Cloud Storage** → **Buckets**
4. Clique no bucket: **`insightflow-82cc4.firebasestorage.app`**
5. Vá na aba **Permissions** (Permissões)
6. Role até **"CORS Configuration"** (Configuração CORS)
7. Clique em **"Edit"** (Editar)
8. Substitua o conteúdo por:

```json
[
  {
    "origin": [
      "https://insightflowv2.vercel.app",
      "https://insightflowapp.vercel.app",
      "http://localhost:*"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

9. Clique em **"Save"** (Salvar)

**IMPORTANTE:** Isso permite que ambas as URLs (antiga e nova) façam upload de arquivos no Storage.

---

## 📋 Checklist de Configuração Firebase

- [ ] Firebase Authentication - Domínio `insightflowv2.vercel.app` adicionado
- [ ] Firebase Storage - CORS atualizado com nova URL
- [ ] Teste de login funcionando na nova URL
- [ ] Teste de upload de logo funcionando na nova URL

---

## 🧪 Como Testar Após Configurar

### Teste 1: Login
1. Acesse: https://insightflowv2.vercel.app/
2. Tente fazer login com Facebook ou Google
3. ✅ Deve funcionar sem erros

### Teste 2: Upload de Logo
1. Acesse qualquer projeto
2. Tente fazer upload de uma logo
3. ✅ Deve salvar sem erro de CORS

### Teste 3: Console do Navegador
1. Abra o DevTools (F12)
2. Vá na aba **Console**
3. ✅ Não deve aparecer erros de CORS ou autenticação

---

## 📝 Notas Importantes

- **Firestore Rules:** Não precisam de alteração - estão corretas ✅
- **Firebase Authentication:** Precisa adicionar domínio ⚠️
- **Firebase Storage:** Precisa atualizar CORS ⚠️
- **Ambas URLs funcionarão:** Mantendo a antiga e a nova na configuração

---

**Última atualização:** Configuração para nova URL `insightflowv2.vercel.app`

