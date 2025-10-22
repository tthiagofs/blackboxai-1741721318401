# 🏗️ ARQUITETURA DO PROJETO - INSIGHTFLOW

**Última atualização:** 22 de Outubro de 2025  
**Status:** Em desenvolvimento - Fase de Planejamento Completa  
**Versão:** 2.0.0

---

## 📌 VISÃO GERAL

O Insightflow é uma plataforma de geração de relatórios de Meta Ads e Google Ads, com sistema completo de gestão de usuários, projetos e autenticação.

---

## 🎯 STACK TECNOLÓGICA APROVADA

### **Frontend**
- HTML5 + CSS3 + JavaScript (ES6+)
- Tailwind CSS
- Font Awesome (ícones)
- Padrão de design: Azul e Branco moderno

### **Backend/Infraestrutura**
- **Hosting:** Vercel (serverless)
- **Authentication:** Firebase Authentication
- **Database:** Firebase Firestore (NoSQL)
- **Storage:** Firebase Storage (fotos de perfil)
- **Email:** SendGrid (100 emails/dia grátis)
- **APIs Externas:** Meta Graph API, Google Ads REST API

### **Deployment**
- Git + GitHub (controle de versão)
- Vercel (deploy automático via Git)

---

## 🗂️ ESTRUTURA DE DADOS (FIRESTORE)

### **Collection: users**
```javascript
{
  id: "auto-generated",
  name: "string",              // Nome completo do usuário
  email: "string",             // Email único
  password: "hash",            // Hash da senha (Firebase Auth)
  profilePhoto: "url",         // URL da foto no Firebase Storage
  role: "admin | user",        // Papel do usuário
  createdAt: "timestamp",      // Data de criação
  lastLogin: "timestamp",      // Último login
  isActive: "boolean"          // Conta ativa?
}
```

### **Collection: invites**
```javascript
{
  id: "auto-generated",
  email: "string",             // Email do convidado
  token: "string",             // Token único (hash)
  expiresAt: "timestamp",      // Expira em 24h
  createdBy: "userId",         // ID do admin que criou
  createdAt: "timestamp",
  usedAt: "timestamp | null",  // Quando foi usado
  status: "pending | used | expired"
}
```

### **Collection: projects**
```javascript
{
  id: "auto-generated",
  name: "string",              // Nome do projeto
  userId: "string",            // ID do dono do projeto
  createdAt: "timestamp",
  updatedAt: "timestamp",
  settings: {                  // Configurações futuras do projeto
    // A ser definido
  },
  isActive: "boolean"
}
```

### **Collection: connections**
```javascript
{
  id: "auto-generated",
  userId: "string",            // Dono da conexão
  platform: "meta | google",   // Plataforma conectada
  accountId: "string",         // ID da conta de ads
  accountName: "string",       // Nome da conta
  accessToken: "encrypted",    // Token criptografado
  refreshToken: "encrypted",   // Refresh token criptografado
  connectedAt: "timestamp",
  lastSync: "timestamp"
}
```

### **Collection: reports (futuro)**
```javascript
{
  id: "auto-generated",
  projectId: "string",         // Projeto relacionado
  userId: "string",            // Criador do relatório
  type: "simple | complete",   // Tipo de relatório
  data: {                      // Dados do relatório (JSON)
    // Estrutura atual de relatórios
  },
  createdAt: "timestamp",
  sharedWith: ["userId1", "userId2"]  // Compartilhamento futuro
}
```

---

## 🎨 FLUXO DE TELAS

### **1. AUTENTICAÇÃO**

```
┌─────────────────────────────────────┐
│  LOGIN (login.html)                 │
│  ├─ Email                           │
│  ├─ Senha                           │
│  ├─ [Entrar] → Dashboard            │
│  └─ "Esqueci a senha" (futuro)      │
└─────────────────────────────────────┘
           ↓ (via convite)
┌─────────────────────────────────────┐
│  CADASTRO (cadastro.html)           │
│  URL: /cadastro?token=ABC123        │
│  ├─ Validar token (24h)             │
│  ├─ Nome Completo                   │
│  ├─ Email (readonly, pré-preenchido)│
│  ├─ Senha                           │
│  ├─ Confirmar Senha                 │
│  ├─ Upload Foto de Perfil           │
│  └─ [Criar Conta]                   │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  OBRIGADO (obrigado.html)           │
│  "Conta criada com sucesso!"        │
│  Redirect → Login (3 segundos)      │
└─────────────────────────────────────┘
```

### **2. DASHBOARD PRINCIPAL**

```
┌──────────────────────────────────────────────────────┐
│  DASHBOARD (dashboard.html)                          │
│  ┌────────────┬─────────────────────────────────┐   │
│  │ MENU       │  ÁREA PRINCIPAL                 │   │
│  │ LATERAL    │                                 │   │
│  │            │  ┌──────────┐  ┌──────────┐    │   │
│  │ 👤 Profile │  │ Projeto  │  │ Projeto  │    │   │
│  │            │  │ Alpha    │  │ Beta     │    │   │
│  │ 🔗 Conexões│  └──────────┘  └──────────┘    │   │
│  │            │                                 │   │
│  │ 👥 Usuários│  [+ Novo Projeto]               │   │
│  │ (admin)    │                                 │   │
│  │            │                                 │   │
│  │ 🚪 Sair    │                                 │   │
│  └────────────┴─────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### **3. PROJETO**

```
┌─────────────────────────────────────┐
│  PROJETO (projeto.html)             │
│  ← Voltar                           │
│                                     │
│  📋 Projeto: Alpha                  │
│                                     │
│  ┌─ Configurações ──────────────┐  │
│  │ Nome: [_____________]         │  │
│  │ (futuras configurações)       │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Gerar Relatório] → Tipo Relatório│
└─────────────────────────────────────┘
```

### **4. TIPO DE RELATÓRIO**

```
┌─────────────────────────────────────┐
│  TIPO DE RELATÓRIO                  │
│  (tela atual adaptada)              │
│                                     │
│  ┌──────────────┐  ┌──────────────┐│
│  │ Simplificado │  │  Completo    ││
│  │  (atual)     │  │   (atual)    ││
│  └──────────────┘  └──────────────┘│
└─────────────────────────────────────┘
```

### **5. ADMIN - GERENCIAR USUÁRIOS**

```
┌─────────────────────────────────────┐
│  ADMIN - USUÁRIOS (admin.html)      │
│  ← Voltar                           │
│                                     │
│  [+ Enviar Convite]                 │
│                                     │
│  ┌─ Usuários Ativos ──────────────┐│
│  │ 👤 João Silva                  ││
│  │    joao@email.com              ││
│  │    [Desativar] [Editar]        ││
│  │                                ││
│  │ 👤 Maria Santos                ││
│  │    maria@email.com             ││
│  │    [Desativar] [Editar]        ││
│  └────────────────────────────────┘│
│                                     │
│  ┌─ Convites Pendentes ───────────┐│
│  │ 📧 pedro@email.com             ││
│  │    Expira em: 12h              ││
│  │    [Reenviar] [Cancelar]       ││
│  └────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
insightflow/
│
├─── index.html                    # Tela de login (atual)
├─── cadastro.html                 # Nova - Registro via convite
├─── obrigado.html                 # Nova - Confirmação de cadastro
├─── dashboard.html                # Nova - Dashboard principal
├─── projeto.html                  # Nova - Detalhes do projeto
├─── minha-conta.html              # Nova - Editar perfil
├─── conexoes.html                 # Adaptada - Conexões Meta/Google
├─── admin-usuarios.html           # Nova - Admin gerenciar usuários
├─── RelatorioCompleto.html        # Atual - Relatório completo
├─── style.css                     # Estilos globais (atual)
├─── package.json                  # Configuração do projeto
├─── vercel.json                   # Configuração Vercel
│
├─── services/
│    ├─── auth.js                  # Novo - Login/Logout/Session
│    ├─── users.js                 # Novo - CRUD Usuários
│    ├─── projects.js              # Novo - CRUD Projetos
│    ├─── invites.js               # Novo - Enviar/Validar Convites
│    ├─── connections.js           # Adaptado - Conexões Meta/Google
│    ├─── facebookInsights.js      # Atual - API Facebook
│    └─── googleAds.js             # Atual - API Google Ads
│
├─── utils/
│    ├─── format.js                # Atual - Formatação
│    ├─── dom.js                   # Atual - Utilitários DOM
│    └─── validators.js            # Novo - Validações (email, senha, etc)
│
├─── components/
│    ├─── sidebar.js               # Novo - Menu lateral
│    ├─── project-card.js          # Novo - Card de projeto
│    └─── modal.js                 # Novo - Modais reutilizáveis
│
├─── api/                          # Vercel Serverless Functions
│    ├─── google-ads.js            # Atual - Google Ads API
│    │
│    ├─── auth/
│    │    ├─── login.js            # Novo - Login
│    │    ├─── logout.js           # Novo - Logout
│    │    └─── validate.js         # Novo - Validar sessão
│    │
│    ├─── users/
│    │    ├─── create.js           # Novo - Criar usuário
│    │    ├─── update.js           # Novo - Atualizar usuário
│    │    ├─── list.js             # Novo - Listar usuários
│    │    └─── delete.js           # Novo - Deletar usuário
│    │
│    ├─── invites/
│    │    ├─── send.js             # Novo - Enviar convite
│    │    ├─── validate.js         # Novo - Validar token
│    │    └─── list.js             # Novo - Listar convites
│    │
│    ├─── projects/
│    │    ├─── create.js           # Novo - Criar projeto
│    │    ├─── list.js             # Novo - Listar projetos
│    │    ├─── update.js           # Novo - Atualizar projeto
│    │    └─── delete.js           # Novo - Deletar projeto
│    │
│    └─── upload/
│         └─── profile-photo.js    # Novo - Upload foto perfil
│
├─── config/
│    └─── firebase.js              # Novo - Configuração Firebase
│
└─── docs/
     ├─── ARQUITETURA_PROJETO.md   # Este arquivo
     ├─── API.md                   # Documentação das APIs
     └─── FLUXOS.md                # Fluxos detalhados
```

---

## 🔐 SISTEMA DE AUTENTICAÇÃO

### **Login Flow:**
```
1. Usuário acessa /login
2. Digita email/senha
3. Firebase Authentication valida
4. Gera token de sessão (JWT)
5. Armazena no localStorage
6. Redirect → Dashboard
```

### **Session Management:**
```javascript
// Verificar sessão em TODAS as páginas protegidas
if (!isAuthenticated()) {
  window.location.href = '/login.html';
}

// Middleware de autenticação
function isAuthenticated() {
  const token = localStorage.getItem('authToken');
  if (!token) return false;
  
  // Validar token com Firebase
  return validateToken(token);
}
```

### **Proteção de Rotas:**
```
Páginas PÚBLICAS:
├─ login.html
├─ cadastro.html (com token válido)
└─ obrigado.html

Páginas PROTEGIDAS (requer login):
├─ dashboard.html
├─ projeto.html
├─ minha-conta.html
├─ conexoes.html
├─ RelatorioCompleto.html
└─ admin-usuarios.html (requer role=admin)
```

---

## 📧 SISTEMA DE CONVITES

### **Fluxo Completo:**

```
ADMIN ENVIA CONVITE:
1. Admin acessa /admin-usuarios.html
2. Clica em [+ Enviar Convite]
3. Digita email do novo usuário
4. Sistema chama API: POST /api/invites/send
   ├─ Gera token único (UUID)
   ├─ Cria registro no Firestore (invites)
   ├─ Define expiresAt = now() + 24h
   └─ Envia email via SendGrid
5. Email contém link:
   https://insightflowapp.vercel.app/cadastro.html?token=ABC123XYZ

USUÁRIO RECEBE EMAIL:
Subject: "Você foi convidado para o Insightflow!"
Body:
  "Olá!
  
  Você foi convidado por [ADMIN_NAME] para acessar o Insightflow.
  
  Clique no link abaixo para criar sua conta:
  [CRIAR MINHA CONTA]
  
  Este link expira em 24 horas.
  
  Atenciosamente,
  Equipe Insightflow"

USUÁRIO CADASTRA:
1. Clica no link do email
2. Abre /cadastro.html?token=ABC123XYZ
3. Sistema valida token:
   ├─ Existe no Firestore?
   ├─ Status = pending?
   ├─ expiresAt > now()?
   └─ Se OK → Mostra formulário
4. Usuário preenche:
   ├─ Nome Completo
   ├─ Email (readonly)
   ├─ Senha (min 8 chars)
   ├─ Confirmar Senha
   └─ Foto de Perfil (upload)
5. Submit → API: POST /api/users/create
6. Marca convite como "usado"
7. Mostra /obrigado.html
8. Redirect → /login.html (3s)
```

### **Template de Email (SendGrid):**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .button { background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Insightflow</h1>
    </div>
    <p>Olá!</p>
    <p>Você foi convidado por <strong>{{admin_name}}</strong> para acessar o Insightflow.</p>
    <p>Clique no botão abaixo para criar sua conta:</p>
    <p style="text-align: center;">
      <a href="{{invite_link}}" class="button">CRIAR MINHA CONTA</a>
    </p>
    <p style="color: #666;">Este link expira em 24 horas.</p>
    <p>Atenciosamente,<br>Equipe Insightflow</p>
  </div>
</body>
</html>
```

---

## 🎨 COMPONENTES REUTILIZÁVEIS

### **Sidebar (Menu Lateral):**
```javascript
// components/sidebar.js
export function renderSidebar(currentPage, userRole) {
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <img src="${user.profilePhoto}" class="avatar">
        <h3>${user.name}</h3>
      </div>
      
      <nav class="sidebar-nav">
        <a href="/dashboard.html" class="${currentPage === 'dashboard' ? 'active' : ''}">
          <i class="fas fa-home"></i> Dashboard
        </a>
        
        <a href="/minha-conta.html" class="${currentPage === 'account' ? 'active' : ''}">
          <i class="fas fa-user"></i> Minha Conta
        </a>
        
        <a href="/conexoes.html" class="${currentPage === 'connections' ? 'active' : ''}">
          <i class="fas fa-link"></i> Conexões
        </a>
        
        ${userRole === 'admin' ? `
          <a href="/admin-usuarios.html" class="${currentPage === 'admin' ? 'active' : ''}">
            <i class="fas fa-users"></i> Usuários
          </a>
        ` : ''}
        
        <a href="#" onclick="logout()" class="logout">
          <i class="fas fa-sign-out-alt"></i> Sair
        </a>
      </nav>
    </aside>
  `;
}
```

### **Project Card:**
```javascript
// components/project-card.js
export function renderProjectCard(project) {
  return `
    <div class="project-card" onclick="openProject('${project.id}')">
      <h3>${project.name}</h3>
      <p class="text-gray-500">
        Criado em ${formatDate(project.createdAt)}
      </p>
      <div class="project-actions">
        <button onclick="editProject('${project.id}')">Editar</button>
        <button onclick="deleteProject('${project.id}')">Excluir</button>
      </div>
    </div>
  `;
}
```

---

## 🔒 SEGURANÇA

### **Regras do Firestore:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Usuários só podem ler/editar seus próprios dados
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Apenas admins podem criar/gerenciar convites
    match /invites/{inviteId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Projetos: usuário só vê seus próprios projetos
    match /projects/{projectId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
    }
    
    // Conexões: privadas por usuário
    match /connections/{connectionId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
    }
  }
}
```

### **Validações:**
```javascript
// utils/validators.js

export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validatePassword(password) {
  // Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número
  return password.length >= 8;
}

export function validateToken(token) {
  // UUID format
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(token);
}
```

---

## 📊 ORDEM DE IMPLEMENTAÇÃO

### **FASE 1: Autenticação (PRIMEIRA)** ✅
```
1. Configurar Firebase
2. Criar tela de login (login.html)
3. Criar service de auth (services/auth.js)
4. Implementar login/logout
5. Proteger rotas existentes
```

### **FASE 2: Projetos (SEGUNDA)** ✅
```
1. Criar dashboard (dashboard.html)
2. Criar tela de projeto (projeto.html)
3. Criar service de projetos (services/projects.js)
4. Implementar CRUD de projetos
5. Adaptar fluxo de relatórios para usar projetos
```

### **FASE 3: Convites (TERCEIRA)** ✅
```
1. Configurar SendGrid
2. Criar tela de cadastro (cadastro.html)
3. Criar tela admin (admin-usuarios.html)
4. Criar service de convites (services/invites.js)
5. Implementar envio de email
6. Implementar validação de token
```

### **FASE 4: Melhorias**
```
1. Criar tela "Minha Conta"
2. Implementar upload de foto
3. Melhorar UX/UI
4. Testes e ajustes
```

---

## 🌐 VARIÁVEIS DE AMBIENTE

### **Vercel Environment Variables:**
```
# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# SendGrid
SENDGRID_API_KEY=

# Google Ads (existentes)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=

# App Config
APP_URL=https://insightflowapp.vercel.app
ADMIN_EMAIL=admin@insightflow.com
```

---

## 🔄 MIGRAÇÃO DE DADOS EXISTENTES

### **Usuário Admin Inicial:**
```javascript
// Criar primeiro usuário admin manualmente no Firebase Console
{
  email: "admin@insightflow.com",
  password: "SenhaSegura123!",
  name: "Administrador",
  role: "admin",
  isActive: true,
  createdAt: now()
}
```

### **Conexões Atuais:**
```
As conexões Meta/Google atuais (localStorage) serão migradas para:
- Firestore collection "connections"
- Associadas ao userId do usuário logado
- Tokens criptografados
```

---

## 📞 PONTOS DE ATENÇÃO

1. **Criptografia de Tokens:**
   - Usar Firebase Security Rules
   - Tokens de Meta/Google devem ser encrypted

2. **Expiração de Convites:**
   - Cloud Function para limpar convites expirados (cronjob)

3. **Upload de Fotos:**
   - Limite: 5MB
   - Formatos: JPG, PNG, WEBP
   - Resize automático: 300x300px

4. **Rate Limiting:**
   - Firebase tem rate limits nativos
   - SendGrid: 100 emails/dia no free tier

5. **Backup:**
   - Firestore tem backup automático (pago)
   - Exportação manual semanal recomendada

---

## 🎯 PRÓXIMOS PASSOS APÓS IMPLEMENTAÇÃO

### **Funcionalidades Futuras (v3.0):**
- [ ] Compartilhamento de projetos entre usuários
- [ ] Histórico de relatórios
- [ ] Agendamento de relatórios
- [ ] Notificações por email
- [ ] Exportação em formatos variados (Excel, CSV)
- [ ] Dashboard de analytics
- [ ] Integração com Slack/Teams
- [ ] API pública para integrações

---

## 📚 REFERÊNCIAS

- Firebase Documentation: https://firebase.google.com/docs
- SendGrid Documentation: https://docs.sendgrid.com
- Vercel Documentation: https://vercel.com/docs
- Meta Graph API: https://developers.facebook.com/docs/graph-api
- Google Ads API: https://developers.google.com/google-ads/api

---

## 👤 CONTATO

**Desenvolvedor:** Thiago  
**Projeto:** Insightflow  
**GitHub:** https://github.com/tthiagofs/blackboxai-1741721318401  
**Produção:** https://insightflowapp.vercel.app

---

**FIM DA DOCUMENTAÇÃO**

