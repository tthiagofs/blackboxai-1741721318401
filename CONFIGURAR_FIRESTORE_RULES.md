# 📋 Configurar Regras do Firestore

As regras do Firestore controlam quem pode ler ou escrever dados no banco de dados. É essencial configurá-las para proteger os dados dos usuários.

---

## 🔧 Passos para Configurar

### 1️⃣ Acessar o Console do Firebase

1. Acesse: https://console.firebase.google.com/
2. Clique no seu projeto **Insightflow**

---

### 2️⃣ Ir para Firestore Database

1. No menu lateral esquerdo, clique em **"Firestore Database"**
2. Clique na aba **"Regras"** (Rules)

---

### 3️⃣ Copiar e Colar as Regras

Copie TODO o conteúdo abaixo e cole na área de edição:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regras para coleção de usuários
    match /users/{userId} {
      // Permitir leitura e escrita apenas para o próprio usuário autenticado
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para coleção de projetos
    match /projects/{projectId} {
      // Função auxiliar para verificar ownership (aceita ownerId ou userId)
      function isOwner() {
        return request.auth != null && 
               (resource.data.ownerId == request.auth.uid || 
                resource.data.userId == request.auth.uid);
      }
      
      function isCreator() {
        return request.auth != null && 
               (request.resource.data.ownerId == request.auth.uid || 
                request.resource.data.userId == request.auth.uid);
      }
      
      // Permitir leitura apenas para o dono do projeto
      allow read: if isOwner();
      
      // Permitir criação se o ownerId/userId for o usuário autenticado
      allow create: if isCreator();
      
      // Permitir atualização e exclusão apenas para o dono
      allow update, delete: if isOwner();
      
      // Permitir listar todos os projetos (a query filtra por userId)
      allow list: if request.auth != null;
    }
    
    // Regras para coleção de convites (apenas para admin)
    match /invites/{inviteId} {
      // Apenas admin pode criar/deletar convites
      allow read, delete: if request.auth != null;
      allow create: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Regras para coleção de relatórios
    match /reports/{reportId} {
      // Permitir leitura e escrita apenas para o dono do relatório
      allow read, delete: if request.auth != null && 
                             resource.data.userId == request.auth.uid;
      
      // Permitir criação se o userId for o usuário autenticado
      allow create: if request.auth != null && 
                      request.resource.data.userId == request.auth.uid;
      
      // Permitir atualização apenas para o dono
      allow update: if request.auth != null && 
                      resource.data.userId == request.auth.uid;
    }
  }
}
```

---

### 4️⃣ Publicar as Regras

1. Clique no botão **"Publicar"** (Publish)
2. Aguarde a mensagem de confirmação: **"Regras publicadas com sucesso"**

---

## ✅ O que essas regras fazem?

### 👤 Coleção `users`
- ✅ Cada usuário pode **ler e editar** apenas seus próprios dados
- ✅ Inclui dados do perfil e **conexões Meta/Google**
- ❌ Um usuário **não pode ver** dados de outros usuários

### 📁 Coleção `projects`
- ✅ Cada usuário pode **criar, ler, editar e deletar** apenas seus próprios projetos
- ❌ Um usuário **não pode ver** projetos de outros usuários

### 📧 Coleção `invites`
- ✅ Todos os usuários autenticados podem **ler** convites
- ✅ Apenas **admin** pode **criar** novos convites
- ✅ Todos podem **deletar** (para invalidar após uso)

### 📊 Coleção `reports`
- ✅ Cada usuário pode **criar, ler, editar e deletar** apenas seus próprios relatórios
- ❌ Um usuário **não pode ver** relatórios de outros usuários

---

## 🔒 Segurança

Essas regras garantem que:

1. ✅ **Tokens do Meta e Google** ficam salvos de forma segura
2. ✅ Cada usuário acessa **apenas seus próprios dados**
3. ✅ Não é possível ver ou editar dados de outros usuários
4. ✅ Apenas usuários autenticados têm acesso ao banco

---

## 🆘 Problemas?

Se aparecer algum erro ao salvar dados, verifique:

1. ✅ As regras foram publicadas corretamente
2. ✅ O usuário está autenticado (logado)
3. ✅ O campo `ownerId` existe nos projetos
4. ✅ O campo `role` existe nos usuários

---

**Pronto!** Agora seus dados estão protegidos e as conexões Meta/Google serão salvas automaticamente! 🎉

