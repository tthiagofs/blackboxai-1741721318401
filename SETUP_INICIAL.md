# 🚀 SETUP INICIAL - CRIAR USUÁRIO ADMIN

**IMPORTANTE:** Siga estes passos para criar o primeiro usuário admin e testar o sistema!

---

## 1️⃣ **Criar Usuário Admin no Firebase Authentication**

1. Acesse o Firebase Console: https://console.firebase.google.com/
2. Selecione seu projeto: **`insightflow-82cc4`**
3. No menu lateral, clique em **"Authentication"**
4. Clique na aba **"Users"**
5. Clique no botão **"Add user"** (Adicionar usuário)
6. Preencha:
   - **Email:** `admin@insightflow.com` (ou seu email)
   - **Password:** `Admin123!` (ou uma senha forte)
7. Clique em **"Add user"**
8. **COPIE O USER ID** que aparece (formato: `AbCd1234...`)

---

## 2️⃣ **Criar Documento do Usuário no Firestore**

1. No menu lateral do Firebase, clique em **"Firestore Database"**
2. Clique no botão **"+ Start collection"** (+ Iniciar coleção)
3. **Collection ID:** `users`
4. Clique em **"Next"**
5. **Document ID:** Cole o **USER ID** que você copiou no passo 1
6. Adicione os seguintes campos:

| Field | Type | Value |
|-------|------|-------|
| `name` | string | `Administrador` |
| `email` | string | `admin@insightflow.com` |
| `role` | string | `admin` |
| `isActive` | boolean | `true` |
| `profilePhoto` | string | `null` (deixe vazio) |
| `createdAt` | timestamp | Clique em "Use server timestamp" |
| `lastLogin` | timestamp | Clique em "Use server timestamp" |

7. Clique em **"Save"**

---

## 3️⃣ **Configurar Regras do Firestore (Segurança)**

1. Ainda no **Firestore Database**, clique na aba **"Rules"**
2. **Substitua** todo o conteúdo por este:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Permitir leitura e escrita para usuários autenticados
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Projetos: usuário só pode acessar seus próprios projetos
    match /projects/{projectId} {
      allow read, write: if request.auth != null && 
                           request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Convites: apenas admins podem gerenciar
    match /invites/{inviteId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Conexões: privadas por usuário
    match /connections/{connectionId} {
      allow read, write: if request.auth != null && 
                           request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

3. Clique em **"Publish"** (Publicar)

---

## 4️⃣ **Criar Índices do Firestore**

1. Ainda no **Firestore Database**, clique na aba **"Indexes"**
2. Clique em **"+ Create index"**
3. Configure:
   - **Collection ID:** `projects`
   - **Fields to index:**
     - `userId` - Ascending
     - `isActive` - Ascending
     - `createdAt` - Descending
   - Clique em **"Create"**

4. Aguarde alguns minutos até o índice ficar pronto (status: "Enabled")

---

## 5️⃣ **Testar o Sistema**

Agora você pode testar o fluxo completo!

### **Teste 1: Login**
1. Acesse: https://insightflowapp.vercel.app/
2. Será redirecionado para `/login.html`
3. Digite:
   - **Email:** `admin@insightflow.com`
   - **Senha:** `Admin123!` (ou a senha que você criou)
4. Clique em **"Entrar"**
5. ✅ Deve ser redirecionado para `/dashboard.html`

### **Teste 2: Dashboard**
1. Verifique se seu nome aparece no sidebar: **"Administrador"**
2. Deve aparecer **"Olá, Administrador! 👋"**
3. Deve mostrar: **"Nenhum projeto ainda"**

### **Teste 3: Criar Projeto**
1. Clique em **"+ Novo Projeto"**
2. Digite um nome: `Teste 1`
3. Clique em **"Criar"**
4. ✅ O projeto deve aparecer na lista

### **Teste 4: Abrir Projeto**
1. Clique em **"Abrir"** no card do projeto
2. ✅ Deve ser redirecionado para `/RelatorioCompleto.html`

### **Teste 5: Logout**
1. No dashboard, clique em **"Sair"**
2. Confirme
3. ✅ Deve ser redirecionado para `/login.html`

---

## 6️⃣ **Próximos Passos (Opcional)**

### **Adicionar variáveis de ambiente no Vercel:**

1. Acesse: https://vercel.com/tthiagofs/insightflowapp
2. Vá em **Settings** → **Environment Variables**
3. Adicione (opcional, por enquanto não precisa):
   ```
   FIREBASE_API_KEY=AIzaSyB3-n3WIdEOhCxvpbigs_ogse7b3tggGGU
   ```

---

## ✅ **Checklist de Verificação**

- [ ] Usuário admin criado no Firebase Authentication
- [ ] Documento do usuário criado no Firestore (collection `users`)
- [ ] Regras do Firestore configuradas
- [ ] Índice do Firestore criado
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Criar projeto funcionando
- [ ] Logout funcionando

---

## 🐛 **Problemas Comuns**

### **Erro: "User not found"**
- Verifique se o email está correto
- Confirme que o usuário foi criado no Firebase Authentication

### **Erro: "Missing or insufficient permissions"**
- Verifique as regras do Firestore
- Confirme que o documento do usuário existe na collection `users`

### **Erro: "Collection users não existe"**
- Crie a collection manualmente no Firestore
- Adicione o documento do usuário admin

### **Página em branco ou loading infinito****
- Abra o console do navegador (F12)
- Verifique se há erros de importação
- Confirme que o Firebase foi configurado corretamente

---

## 📞 **Precisa de Ajuda?**

Se algo não funcionar, abra o console do navegador (F12 → Console) e me envie os erros que aparecerem!

---

**BOM TESTE!** 🎉

