# 🔐 Aplicar Regras do Firestore - Análises Pré-Definidas

## ⚠️ IMPORTANTE: APLIQUE ESTAS REGRAS NO FIREBASE

As novas regras do Firestore incluem permissões para a subcoleção `analysisTemplates` dentro de `/users/{userId}/`.

### 📝 Regras Atualizadas

As regras já estão no arquivo `firestore.rules` do projeto. Você precisa aplicá-las no Firebase Console.

### 🚀 Como Aplicar

#### **Opção 1: Firebase Console (Recomendado)**

1. Acesse: [https://console.firebase.google.com](https://console.firebase.google.com)
2. Selecione seu projeto: **insightflow-ads-reporter**
3. No menu lateral, vá em **Firestore Database**
4. Clique na aba **Regras** (Rules)
5. Copie e cole o conteúdo do arquivo `firestore.rules` deste projeto
6. Clique em **Publicar** (Publish)

#### **Opção 2: Firebase CLI**

Se você tem o Firebase CLI instalado:

```bash
firebase deploy --only firestore:rules
```

### ✅ Regras Adicionadas

```javascript
// Regras para coleção de usuários
match /users/{userId} {
  // Permitir leitura e escrita apenas para o próprio usuário autenticado
  allow read, write: if request.auth != null && request.auth.uid == userId;
  
  // Regras para subcoleção de templates de análise
  match /analysisTemplates/{templateId} {
    // Permitir CRUD completo apenas para o próprio usuário
    allow read, write, create, update, delete: if request.auth != null && request.auth.uid == userId;
  }
}
```

### 🧪 Testar as Regras

Após aplicar as regras, teste:

1. Faça login no sistema
2. Acesse **"Análises Pré-Definidas"** no menu lateral
3. Tente adicionar/editar/excluir textos
4. Gere um relatório e verifique se as sugestões aparecem

### 🔍 Estrutura do Firestore

```
/users/{userId}/
  └── analysisTemplates/{templateId}
      ├── category: "PIOROU" | "MELHOROU" | "ESTAVEL" | "ESPECIAL"
      ├── text: string
      ├── order: number
      ├── createdAt: timestamp
      └── updatedAt: timestamp
```

### 📌 Observações

- Cada usuário só pode ver/editar seus próprios templates
- As regras garantem total isolamento entre usuários
- Templates padrão são criados automaticamente no primeiro acesso

---

**✅ Após aplicar, o sistema de análises pré-definidas estará 100% funcional!**

