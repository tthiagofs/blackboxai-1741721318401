# 🌐 URL do App - Insightflow

## URL Atual (Nova Conta Vercel)
**https://insightflowv2.vercel.app/**

---

## 📋 Configurações Necessárias

### ✅ Firestore Rules
As regras do Firestore estão corretas e não precisam de alteração. Elas controlam acesso aos dados, não URLs.

### ⚠️ Firebase Authentication - Domínios Autorizados
**AÇÃO NECESSÁRIA:** Adicionar a nova URL aos domínios autorizados

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: `insightflow-82cc4`
3. Vá em **Authentication** → **Settings** → **Authorized domains**
4. Clique em **"Add domain"**
5. Adicione: `insightflowv2.vercel.app`
6. Clique em **"Add"**

### ⚠️ Firebase Storage - CORS
**AÇÃO NECESSÁRIA:** Atualizar configuração CORS no Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Selecione o projeto: `insightflow-82cc4`
3. Vá em **Cloud Storage** → **Buckets**
4. Clique no bucket: `insightflow-82cc4.firebasestorage.app`
5. Vá em **Permissions** → **CORS Configuration**
6. Atualize para incluir a nova URL:

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

---

## 🔗 URLs Configuradas

| Serviço | URL Antiga | URL Nova |
|---------|------------|----------|
| **Vercel** | `insightflowapp.vercel.app` | `insightflowv2.vercel.app` ✅ |
| **Facebook OAuth** | ⚠️ Precisa atualizar | ⚠️ Precisa atualizar |
| **Google OAuth** | ⚠️ Precisa atualizar | ⚠️ Precisa atualizar |
| **Firebase Auth** | ⚠️ Precisa adicionar | ⚠️ Precisa adicionar |
| **Firebase Storage CORS** | ⚠️ Precisa atualizar | ⚠️ Precisa atualizar |

---

## ✅ Checklist de Migração

- [x] Projeto criado na nova conta Vercel
- [x] Deploy concluído
- [x] Variáveis de ambiente configuradas
- [ ] Firebase Authentication - Domínio autorizado adicionado
- [ ] Firebase Storage - CORS atualizado
- [ ] Facebook Developers - URLs atualizadas
- [ ] Google Cloud Console - OAuth URLs atualizadas
- [ ] Testes realizados

---

**Última atualização:** $(date)

