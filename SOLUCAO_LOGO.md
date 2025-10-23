# ✅ Solução para Logo Não Persistir

## 🔴 Problema Identificado

**Erro CORS**: O Firebase Storage está bloqueando o upload devido a configuração Cross-Origin Resource Sharing (CORS).

```
Cross-origin resource sharing (CORS) request was blocked because the response to the associated preflight request failed
```

## 🛠️ Soluções

### Opção 1: Configurar CORS do Firebase Storage (Recomendado)

**Via Google Cloud Console:**

1. Acesse: https://console.cloud.google.com/
2. Selecione o projeto: `insightflow-82cc4`
3. Menu **Cloud Storage** → **Buckets**
4. Clique no bucket: `insightflow-82cc4.firebasestorage.app`
5. Aba **Configuration** → **CORS**
6. Cole esta configuração:

```json
[
  {
    "origin": ["https://insightflowapp.vercel.app", "http://localhost:5500", "http://localhost:3000", "http://127.0.0.1:5500"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "X-Requested-With", "X-Upload-Content-Type", "X-Upload-Content-Length"]
  }
]
```

**Via Terminal (Google Cloud SDK):**

```bash
# 1. Instalar Google Cloud SDK
# Download: https://cloud.google.com/sdk/docs/install

# 2. Login
gcloud auth login

# 3. Definir projeto
gcloud config set project insightflow-82cc4

# 4. Aplicar CORS (arquivo cors.json já está criado)
gsutil cors set cors.json gs://insightflow-82cc4.firebasestorage.app

# 5. Verificar
gsutil cors get gs://insightflow-82cc4.firebasestorage.app
```

---

### Opção 2: Usar Vercel Function para Upload (Alternativa)

Se não conseguir configurar CORS, podemos criar uma Vercel Function que faz o upload.

**Criar arquivo `api/upload-logo.js`:**

```javascript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase-admin/storage';
import { initializeApp, cert } from 'firebase-admin/app';

// Inicializar Firebase Admin (necessita service account key)
if (!admin.apps.length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: 'insightflow-82cc4.firebasestorage.app'
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, fileData, fileName } = req.body;
    
    const storage = getStorage();
    const bucket = storage.bucket();
    const file = bucket.file(`projects/${projectId}/${fileName}`);
    
    // Converter base64 para buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
      }
    });
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });
    
    res.status(200).json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🧪 Teste

Após configurar CORS:

1. Recarregue a página do projeto
2. Faça upload de uma logo
3. Verifique o console do navegador:
   - ✅ Não deve aparecer erro de CORS
   - ✅ Deve mostrar: `✅ Upload concluído: https://...`
   - ✅ Deve mostrar: `✅ Logo salva com sucesso no Firestore!`
4. **Atualize a página (F5)**
5. A logo deve permanecer visível ✅

---

## 📋 Checklist

- [ ] Configurar CORS no Firebase Storage
- [ ] Testar upload de logo
- [ ] Verificar persistência (F5)
- [ ] Verificar logo no relatório gerado

---

## 🆘 Se Ainda Não Funcionar

Me envie:
1. Print do console completo
2. Print das regras do Storage
3. Print do erro (se houver)

