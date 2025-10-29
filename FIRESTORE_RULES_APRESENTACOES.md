# Regras do Firestore para Apresentações

## ⚠️ IMPORTANTE: Adicionar ao Firebase Console

As subcoleções `presentations` dentro de `projects` precisam das seguintes regras no Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... suas regras existentes ...
    
    // ADICIONAR: Regras para Apresentações
    match /projects/{projectId}/presentations/{presentationId} {
      // Permitir leitura se o usuário é membro do projeto
      allow read: if request.auth != null && 
                     exists(/databases/$(database)/documents/projects/$(projectId)) &&
                     get(/databases/$(database)/documents/projects/$(projectId)).data.users[request.auth.uid] != null;
      
      // Permitir criação se o usuário é membro do projeto
      allow create: if request.auth != null && 
                       exists(/databases/$(database)/documents/projects/$(projectId)) &&
                       get(/databases/$(database)/documents/projects/$(projectId)).data.users[request.auth.uid] != null;
      
      // Permitir atualização/deleção se o usuário é membro do projeto
      allow update, delete: if request.auth != null && 
                                exists(/databases/$(database)/documents/projects/$(projectId)) &&
                                get(/databases/$(database)/documents/projects/$(projectId)).data.users[request.auth.uid] != null;
    }
  }
}
```

## Como Aplicar:

1. Abra o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Firestore Database** > **Regras**
4. Adicione as regras acima dentro do bloco `match /databases/{database}/documents`
5. Clique em **Publicar**

## Estrutura das Apresentações:

```
projects/{projectId}/presentations/{presentationId}
  - name: string
  - unitId: string
  - unitName: string
  - startDate: string (ISO)
  - endDate: string (ISO)
  - platforms: {
      meta: boolean,
      google: boolean
    }
  - metrics: {
      meta: object,
      google: object
    }
  - html: string (HTML completo da apresentação)
  - createdAt: string (ISO)
  - createdBy: string (userId)
```

## Alternativa Temporária (Desenvolvimento):

Se você está em ambiente de desenvolvimento e quer testar rapidamente, pode usar regras permissivas (NÃO use em produção):

```javascript
match /projects/{projectId}/presentations/{presentationId} {
  allow read, write: if request.auth != null;
}
```

Isso permite que qualquer usuário autenticado acesse as apresentações. Use apenas para testes!

