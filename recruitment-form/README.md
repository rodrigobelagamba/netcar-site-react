# Formulário de candidatura Netcar

Consultor de Vendas de Veículos Seminovos, Esteio/RS. Publicação autorizada por Marcelo em 08/09/2026.

## Comportamento

- Metas: resposta descritiva com meta, período e resultado; 20–1.000 caracteres.
- Currículo opcional em PDF, DOC ou DOCX até 5 MiB, removível/substituível antes do envio. O cadastro sem arquivo permanece válido.
- JSON preserva compatibilidade com proxies PHP. Base64 existe somente no transporte; o backend valida tamanho e formato e salva binário em `curriculum:<id>`, separado de `result:<id>` no KV existente.
- Confirmação somente após persistência. Erros preservam as respostas na página; não se grava candidatura ou currículo em localStorage.
- Painel com listagem paginada, escape de dados e download autenticado como anexo.
- Painel abre pelo link privado da equipe, sem digitação de chave. `ADMIN_LINK_KEY` é uma credencial independente, aleatória (32 bytes ou mais em base64url), enviada no fragmento `#acesso=...` e trocada por sessão de 30 dias em cookie HttpOnly/Secure/SameSite=Strict. Após a troca, o fragmento é removido. Nenhuma credencial é gravada em localStorage/sessionStorage ou no HTML público.
- Notificações usam o mesmo link privado com `id` para abrir o candidato. Links antigos com apenas `id` funcionam depois de abrir o link privado no mesmo navegador; o ID retornado ao candidato nunca autentica o painel.
- `ADMIN_KEY` existente (ou `ADMIN_TOKEN`) continua aceito via Bearer. APIs sem sessão/credencial válida permanecem fechadas, incluindo currículos. Rotacionar `ADMIN_LINK_KEY` revoga links e sessões anteriores; Sair remove o cookie do navegador.
- Notificações existentes ocorrem em segundo plano após salvar. A configuração de produção consultada tem CallMeBot; e-mail via Resend depende de configuração adicional que não foi criada nesta entrega.

## Desenvolvimento e publicação

`npm ci`, `npm test`, `npm run build`. Os testes usam somente dados fictícios, KV em memória e rede simulada. `npm run dev` usa KV local na porta 8788; não usar `--remote` para testes.

O pacote `dist/` contém somente os HTMLs, logo, headers e rotas. O comando de deploy compila `functions/` do projeto. Artefatos de validação, testes, fontes e configurações não são enviados como arquivos estáticos.

Deploy na conta e projeto existentes:

```
CLOUDFLARE_ACCOUNT_ID=11edc212d8f0ae41b9594f87b2724ea4 npx wrangler pages deploy dist --project-name questionario-perfil --branch main
```

Preservar `PERFIL_KV`, `ADMIN_KEY`, `ADMIN_LINK_KEY`, `CALLMEBOT_APIKEY` e `CALLMEBOT_PHONE`. Não expor segredos em código ou logs. O link privado deve ser entregue somente à equipe responsável pelas candidaturas, nunca publicado em anúncios. O endpoint legado aberto `test-notify.js` não faz parte desta versão.

## Integração no site

A página da oportunidade e o rodapé ficam no projeto principal. Os candidatos usam `/vagas/consultor-vendas-seminovos/candidatura/` e o proxy JSON `/vagas/consultor-vendas-seminovos/enviar`, sempre no domínio Netcar. O questionário permanece noindex; a oportunidade é a URL de descoberta no Google.

O original em Dropbox foi preservado. Esta cópia versionada é a fonte da revisão publicada. Não substituir o backend por uma versão antiga de Dropbox sem revisar as diferenças.

## Limites

A validação de formato não é antivírus. KV tem consistência eventual: candidaturas recentes podem demorar a aparecer. A proteção do botão impede cliques simultâneos, mas falha de rede após persistência pode gerar confirmação incerta e uma repetição manual pode criar outro cadastro.
