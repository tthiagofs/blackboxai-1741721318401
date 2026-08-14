# Como Adicionar Usuários de Teste no Google Ads API

## 🚨 Problema

Quando um novo usuário tenta conectar o Google Ads, aparece o erro:

```
Acesso bloqueado: o app insightflowapp.vercel.app não concluiu o processo de verificação do Google
Erro 403: access_denied
```

## 📋 Solução: Adicionar Usuários de Teste

### Passo 1: Acessar Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Faça login com **thiagofelipefreire0810@gmail.com**
3. Selecione o projeto: **"InsightFlow"** (ou o nome do seu projeto)

### Passo 2: Configurar Tela de Consentimento OAuth

1. No menu lateral, vá em:
   - **APIs e serviços** → **Tela de consentimento OAuth**
   
2. Você verá algo assim:
   ```
   Tipo de usuário: Externo
   Status de publicação: Em testes
   ```

3. Clique em **"EDITAR APLICATIVO"** (botão no topo)

### Passo 3: Adicionar Usuários de Teste

1. Role até a seção **"Usuários de teste"**

2. Clique em **"+ ADICIONAR USUÁRIOS"**

3. Insira os **e-mails** dos usuários que você quer autorizar:
   ```
   exemplo@gmail.com
   usuario2@gmail.com
   usuario3@gmail.com
   ```
   ⚠️ **IMPORTANTE:** Use o e-mail exato que a pessoa usa para fazer login no Google!

4. Clique em **"ADICIONAR"**

5. Clique em **"SALVAR E CONTINUAR"** (na parte inferior)

6. Continue clicando em **"SALVAR E CONTINUAR"** até finalizar

### Passo 4: Confirmar que o Usuário Foi Adicionado

1. Volte para **"Tela de consentimento OAuth"**

2. Na seção **"Usuários de teste"**, você deve ver:
   ```
   👤 exemplo@gmail.com
   👤 usuario2@gmail.com
   ```

### Passo 5: Testar

1. O usuário pode agora tentar conectar o Google Ads novamente

2. Ele verá um aviso:
   ```
   ⚠️ Este app não foi verificado pelo Google
   
   [Voltar para a segurança]  [Avançado]
   ```

3. Clique em **"Avançado"** → **"Ir para insightflowapp.vercel.app (não seguro)"**

4. A conexão deve funcionar! ✅

---

## 🔄 Limite de Usuários de Teste

- **Modo de Testes:** Até **100 usuários de teste**
- Se precisar de mais, você precisa **publicar o app** (requer verificação do Google)

---

## 🚀 Publicar o App (Produção)

Se você quiser que **qualquer pessoa** possa conectar (sem adicionar manualmente), você precisa:

1. Ir em **"Tela de consentimento OAuth"**
2. Clicar em **"PUBLICAR APLICATIVO"**
3. Passar pelo processo de **verificação do Google** (pode demorar semanas)

⚠️ **Para o seu caso:** Adicionar usuários de teste manualmente é mais rápido e suficiente!

---

## 📝 Resumo Rápido

| Ação | Onde | O que fazer |
|------|------|-------------|
| **Adicionar usuário** | Google Cloud Console → Tela de consentimento OAuth | + ADICIONAR USUÁRIOS |
| **Limite** | 100 usuários | Adicione quantos precisar |
| **Funciona imediatamente?** | ✅ Sim | Sem necessidade de aprovação |

---

## 🆘 Se Ainda Não Funcionar

1. Verifique se o **e-mail está correto**
2. O usuário deve usar o **mesmo e-mail** para fazer login no Google
3. Aguarde **1-2 minutos** após adicionar (cache do Google)
4. Peça para o usuário **limpar cache/cookies** do navegador

---

## 📞 Contato

Se precisar de ajuda, entre em contato com:
- **Admin:** thiagofelipefreire0810@gmail.com

