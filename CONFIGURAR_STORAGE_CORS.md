# Configurar CORS do Firebase Storage

## ⚠️ IMPORTANTE: Configure CORS para permitir upload de logos

### Problema
A logo não está salvando devido a erro de CORS (Cross-Origin Resource Sharing).

### Solução

**Opção 1: Via Google Cloud Console (Recomendado)**

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione o projeto: `insightflow-82cc4`
3. Vá em **Cloud Storage** > **Buckets**
4. Clique no bucket: `insightflow-82cc4.firebasestorage.app`
5. Vá em **Permissions** (Permissões)
6. Clique em **CORS Configuration**
7. Adicione a seguinte configuração:

```json
[
  {
    "origin": ["https://insightflowapp.vercel.app", "http://localhost:*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

**Opção 2: Via gsutil (Google Cloud SDK)**

1. Instale o [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Execute no terminal:

```bash
# Login
gcloud auth login

# Definir projeto
gcloud config set project insightflow-82cc4

# Aplicar CORS
gsutil cors set cors.json gs://insightflow-82cc4.firebasestorage.app
```

### Verificar se CORS foi aplicado

```bash
gsutil cors get gs://insightflow-82cc4.firebasestorage.app
```

### Alternativa: Usar URL de upload direto

Se não conseguir configurar CORS, podemos usar o Firebase Admin SDK no backend (Vercel Function).

---

## 🔧 Teste após configurar

1. Recarregue a página
2. Tente fazer upload da logo
3. Verifique o console - não deve mais aparecer erro de CORS
4. A logo deve persistir após atualizar a página

