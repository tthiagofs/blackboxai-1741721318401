# 📋 Como Usar o Componente de Sidebar Unificado

## 🎯 Objetivo
Ter uma **sidebar consistente** em todas as páginas do app, com regras inteligentes para mostrar/ocultar itens.

## 🚀 Como Implementar em Qualquer Página

### 1️⃣ No HTML - Substituir a sidebar antiga

**ANTES (sidebar antiga - REMOVER):**
```html
<aside class="w-64 bg-white...">
  <div class="p-6">...</div>
  <nav>...</nav>
</aside>
```

**DEPOIS (sidebar nova - USAR):**
```html
<div id="app-sidebar" class="hidden md:block"></div>
```

### 2️⃣ No final do HTML - Inicializar o componente

**Adicionar antes de `</body>`:**
```html
<script type="module">
  import { initSidebar } from './components/sidebar.js';
  // Passar o nome da página atual
  initSidebar('NOME_DA_PAGINA');
</script>
```

### 3️⃣ Nomes de Páginas Disponíveis

| Página | Nome para passar | Observação |
|--------|------------------|------------|
| `home.html` | `'home'` ou `'relatorios'` | Relatórios salvos |
| `dashboard.html` | `'dashboard'` | Dashboard geral |
| `unidades.html` | `'unidades'` | Lista de unidades |
| `conexoes.html` | `'conexoes'` | Conexões Meta/Google |
| `minha-conta.html` | `'minha-conta'` | Perfil do usuário |
| `usuarios.html` | `'usuarios'` | Admin only |
| `analises-predefinidas.html` | `'analises'` | Admin only |

## 🎨 Funcionalidades Automáticas

### ✅ Abas que SEMPRE aparecem:
- 🏠 **Tela Inicial**
- 📊 **Dashboard**
- 🔌 **Conexões**
- 👤 **Minha Conta**

### ✅ Abas CONDICIONAIS:

#### 1. **Sub-abas da Tela Inicial** (só quando projeto selecionado)
Quando há projeto selecionado (`localStorage.getItem('currentProject')`), aparecem **2 sub-abas**:

##### 📄 **Relatórios** (sub-aba 1)
- ✅ Link: `/home.html`
- ✅ Página com relatórios salvos e botão "Gerar Relatório"
- ✅ Indentada com `ml-6`
- ✅ Texto e ícone menores (`text-xs`)

##### 🏢 **Unidades** (sub-aba 2)
- ✅ Link: `/unidades.html`
- ✅ Lista de unidades do projeto
- ✅ Indentada com `ml-6`
- ✅ Texto e ícone menores (`text-xs`)

#### 2. **Usuários** (apenas Admin)
- ✅ Aparece apenas se `user.role === 'admin'` no Firestore

#### 3. **Análises Pré-Definidas** (apenas Admin)
- ✅ Aparece apenas se `user.role === 'admin'` no Firestore

### ✅ Botões no rodapé:
- ⬅️ **Voltar:** `history.back()`
- 🚪 **Sair:** Logout + limpa localStorage

## 📝 Exemplo Completo

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Minha Página</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-gray-50">
  <div class="min-h-screen flex">
    <!-- Sidebar Unificada -->
    <div id="app-sidebar" class="hidden md:block"></div>

    <!-- Conteúdo -->
    <main class="flex-1 p-6">
      <h1>Minha Página</h1>
    </main>
  </div>

  <script type="module">
    import { initSidebar } from './components/sidebar.js';
    initSidebar('minha-pagina');
  </script>
</body>
</html>
```

## 🔄 Atualizar Sidebar Dinamicamente

Se você selecionar um projeto e quiser atualizar a sidebar para mostrar "Unidades":

```javascript
import { updateSidebarOnProjectChange } from './components/sidebar.js';

// Após selecionar projeto
localStorage.setItem('currentProject', projectId);
updateSidebarOnProjectChange();
```

## 📦 Páginas que DEVEM usar o componente:

- ✅ `home.html`
- ✅ `dashboard.html` (JÁ IMPLEMENTADO)
- ✅ `unidades.html`
- ✅ `unidade-detalhes.html`
- ✅ `conexoes.html`
- ✅ `minha-conta.html`
- ✅ `usuarios.html`
- ✅ `analises-predefinidas.html`
- ✅ `RelatorioCompleto.html`
- ✅ `tipo-relatorio.html`

## 🎯 Benefícios

1. ✅ **Consistência:** Todas as páginas têm a mesma sidebar
2. ✅ **Manutenção:** Alterar em 1 lugar = altera em todas
3. ✅ **Inteligente:** Mostra/oculta itens automaticamente
4. ✅ **Hierarquia:** "Unidades" aparece como sub-item
5. ✅ **Segurança:** Itens admin só para admins

## 🐛 Troubleshooting

**Sidebar não aparece?**
- Verifique se `<div id="app-sidebar">` existe
- Verifique se importou `initSidebar` corretamente
- Verifique console do navegador

**"Unidades" não aparece?**
- Verifique se há projeto em `localStorage.getItem('currentProject')`
- Selecione um projeto na Tela Inicial

**Itens admin não aparecem?**
- Verifique se usuário tem `role: 'admin'` no Firestore

