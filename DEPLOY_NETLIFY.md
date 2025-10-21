# 🚀 GUIA DE DEPLOY NO NETLIFY (100% GRÁTIS)

## 📋 Pré-requisitos:
- Conta no GitHub (já tem ✅)
- Ter feito commit/push do código (vou fazer com você)

---

## PASSO 1: Criar conta no Netlify (5 min)

1. **Acesse:** https://app.netlify.com/signup
2. **Clique em:** "Sign up with GitHub"
3. **Autorize** o Netlify a acessar seus repositórios
4. **Pronto!** Conta criada 🎉

---

## PASSO 2: Fazer Deploy do Projeto (3 min)

1. **No dashboard do Netlify,** clique em "Add new site"
2. **Escolha:** "Import an existing project"
3. **Selecione:** "Deploy with GitHub"
4. **Procure** pelo repositório: `blackboxai-1741721318401`
5. **Clique** no repositório
6. **Configure:**
   - **Branch to deploy:** `main`
   - **Build command:** (deixe em branco)
   - **Publish directory:** `.`
7. **Clique em** "Deploy site"

⏳ **Aguarde 1-2 minutos** enquanto o Netlify faz o deploy...

✅ **Pronto!** Seu site está no ar em: `https://NOME-ALEATORIO.netlify.app`

---

## PASSO 3: Configurar Variáveis de Ambiente (5 min)

Agora vamos adicionar as credenciais do Google Ads de forma segura:

1. **No Netlify,** clique no seu site
2. **Vá em:** "Site configuration" → "Environment variables"
3. **Clique em** "Add a variable"
4. **Adicione** as seguintes variáveis (uma por vez):

   | Key | Value |
   |-----|-------|
   | `GOOGLE_ADS_CLIENT_ID` | Seu Client ID do Google |
   | `GOOGLE_ADS_CLIENT_SECRET` | Seu Client Secret do Google |
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | Seu Developer Token do Google Ads |

5. **Para cada variável:**
   - Cole o nome no campo "Key"
   - Cole o valor no campo "Value"
   - Clique em "Add variable"

6. **Após adicionar todas,** clique em "Deploy" → "Trigger deploy" → "Deploy site"

---

## PASSO 4: Personalizar o domínio (opcional - 2 min)

1. **No Netlify,** vá em "Domain management"
2. **Clique em** "Options" → "Edit site name"
3. **Escolha um nome** (ex: `blackbox-reporter`)
4. **Salve**

Agora seu site estará em: `https://blackbox-reporter.netlify.app`

---

## PASSO 5: Testar Functions (2 min)

1. **Abra** o console do navegador (F12)
2. **No seu site,** tente gerar um relatório do Google
3. **Verifique** se não há erros

**Erros comuns:**
- "Function not found" → Espere 1-2 minutos e tente novamente
- "Missing credentials" → Verifique as variáveis de ambiente
- "Invalid token" → Rode o script `get-refresh-token.js` novamente

---

## 🔄 Como fazer updates futuros:

1. **Faça alterações** no código local
2. **Commit e push:**
   ```bash
   git add .
   git commit -m "Descrição das alterações"
   git push
   ```
3. **Aguarde 1-2 minutos** → Netlify faz deploy automático! 🎉

---

## 💰 Limites do Plano Gratuito:

- ✅ 125.000 requisições/mês nas Functions
- ✅ 100 GB de banda
- ✅ Deploy automático em cada push
- ✅ HTTPS grátis
- ✅ CDN global

**Para seu caso:** Mais que suficiente! Você poderia gerar 4.000+ relatórios por mês.

---

## 🆘 Problemas?

**Deploy falhou:**
- Verifique se o `netlify.toml` está na raiz do projeto
- Verifique se o `package.json` está correto

**Function não funciona:**
- Verifique os logs em: Site → Functions → Logs
- Verifique se as variáveis de ambiente estão configuradas

**Site não atualiza:**
- Aguarde 2-3 minutos
- Force um novo deploy: Deploy → Trigger deploy

---

Quando estiver tudo no ar, me avise! 🚀

