# Regras do Firestore para Apresentações

## Como aplicar as regras

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em **Firestore Database** → **Regras**
4. Adicione as seguintes regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regra para a coleção de projetos
    match /projects/{projectId} {
      // Permitir leitura e escrita se o usuário está autenticado
      allow read, write: if request.auth != null;
      
      // Subcoleção de apresentações
      match /presentations/{presentationId} {
        // Permitir leitura e escrita se o usuário está autenticado
        allow read, write: if request.auth != null;
      }
      
      // Subcoleção de relatórios (se ainda não existir)
      match /reports/{reportId} {
        allow read, write: if request.auth != null;
      }
      
      // Subcoleção de unidades
      match /units/{unitId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Outras regras já existentes...
  }
}
```

## Estrutura de dados esperada

```
projects/{projectId}/presentations/{presentationId}
  - name: string
  - unitId: string
  - unitName: string
  - startDate: string
  - endDate: string
  - platforms: array
  - presentationHTML: string (HTML completo da apresentação)
  - createdAt: timestamp
  - updatedAt: timestamp
```

## Verificação

Após aplicar as regras:
1. Tente salvar uma apresentação
2. Se ainda houver erro de permissão, verifique se:
   - O usuário está autenticado (`auth.currentUser` não é `null`)
   - O `projectId` é válido
   - As regras foram publicadas corretamente
