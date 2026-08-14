# 📧 Configurar SendGrid para Envio de Convites

O Insightflow usa o **SendGrid** para enviar emails de convite automaticamente.

---

## 🆓 Criar Conta no SendGrid

1. Acesse: https://signup.sendgrid.com/
2. Crie uma conta **gratuita** (permite enviar **100 emails/dia**)
3. Confirme seu email

---

## 🔑 Criar API Key

1. Faça login no SendGrid
2. Vá em **Settings** → **API Keys**
3. Clique em **"Create API Key"**
4. Configure:
   - **Name:** `Insightflow Convites`
   - **Permissions:** **Full Access** (ou pelo menos `Mail Send`)
5. Clique em **"Create & View"**
6. **COPIE a API Key** (ela só aparece uma vez!)

---

## ✉️ Configurar Email Remetente (Sender)

### Opção 1: Single Sender Verification (Mais Rápido)

1. Vá em **Settings** → **Sender Authentication**
2. Clique em **"Verify a Single Sender"**
3. Preencha:
   - **From Name:** `Insightflow`
   - **From Email Address:** Seu email (ex: `seuemail@gmail.com`)
   - **Reply To:** O mesmo email
   - **Company Address:** Preencha qualquer endereço
4. Clique em **"Create"**
5. **Verifique seu email** (SendGrid envia um link de confirmação)

### Opção 2: Domain Authentication (Recomendado para produção)

Para usar um domínio próprio (ex: `noreply@seudominio.com`), siga a documentação do SendGrid.

---

## ⚙️ Configurar no Vercel

### 1. Adicionar Variáveis de Ambiente

1. Acesse: https://vercel.com/
2. Vá no seu projeto **Insightflow**
3. Clique em **Settings** → **Environment Variables**
4. Adicione:

| Name | Value | Exemplo |
|------|-------|---------|
| `SENDGRID_API_KEY` | Sua API Key do SendGrid | `SG.xxxxxxxxxxxxxxx...` |
| `SENDGRID_FROM_EMAIL` | Email verificado no SendGrid | `seuemail@gmail.com` |

5. Clique em **"Save"**

### 2. Reinstalar Dependências

Como a função usa `@sendgrid/mail`, você precisa adicionar no `package.json`:

```json
{
  "dependencies": {
    "@sendgrid/mail": "^7.7.0",
    "node-fetch": "^2.6.7"
  }
}
```

### 3. Fazer Redeploy

```bash
git add -A
git commit -m "chore: Adicionar SendGrid ao package.json"
git push
```

O Vercel fará o deploy automaticamente e instalará as dependências.

---

## 🧪 Testar

1. Acesse **Gerenciar Usuários** no dashboard
2. Clique em **"Enviar Convite"**
3. Digite um email de teste
4. Clique em **"Enviar"**
5. Verifique se o email chegou (pode cair em spam na primeira vez)

---

## ❓ Troubleshooting

### Email não chega

1. ✅ Verifique se confirmou o **Single Sender** no SendGrid
2. ✅ Verifique se as **variáveis de ambiente** estão corretas no Vercel
3. ✅ Verifique a **caixa de spam**
4. ✅ Veja os logs do Vercel em **Deployments** → **Functions** → `send-invite`

### Erro "Serviço de email não configurado"

- A variável `SENDGRID_API_KEY` não está configurada no Vercel

### Erro "403 Forbidden"

- O email remetente não foi verificado no SendGrid
- Ou a API Key não tem permissão de `Mail Send`

---

## 📊 Monitorar Envios

1. Acesse o dashboard do SendGrid
2. Vá em **Activity**
3. Veja todos os emails enviados, abertos, clicados, etc.

---

## 💰 Limites do Plano Gratuito

- **100 emails/dia**
- **2.000 contatos**
- Estatísticas por 7 dias

Para mais, você precisa contratar um plano pago.

---

**Pronto!** Agora o sistema de convites está completo! 🎉

