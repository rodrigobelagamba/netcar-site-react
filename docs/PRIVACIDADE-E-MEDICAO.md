# Privacidade e medição

O site usa o Consent Mode v2 antes de carregar tags de publicidade e
mensuração. O estado inicial é negado para `analytics_storage`, `ad_storage`,
`ad_user_data` e `ad_personalization`.

## Escolhas do visitante

- `accepted`: libera armazenamento de medição e publicidade e permite o Meta
  Pixel.
- `essential`: mantém os quatro estados de consentimento negados e não carrega
  o Meta Pixel. A origem em memória/localStorage é descartada e o clique não é
  enviado ao log próprio de campanhas.

A escolha fica em `nc_privacy_consent_v1`. O botão **Preferências de
privacidade**, no rodapé, reabre o painel e permite alterá-la.

Sem consentimento, a origem de tráfego pode existir apenas em memória durante a
navegação atual para que a escolha ainda possa ser aplicada, mas ela não é
exposta nos eventos nem no link de WhatsApp. A persistência de 30 dias é
permitida somente depois da aceitação. Se o visitante escolhe apenas o
essencial, a memória é apagada.

A página pública `/privacidade`, também vinculada no painel e no rodapé,
explica dados, finalidades, fornecedores, retenção, controles e canal de contato.

Os cliques comerciais e os cliques de suporte são eventos diferentes. Nethelp
usa `data-wa-conversion="support"` e nunca deve disparar conversão de vendas no
Google Ads ou evento `Contact` no Meta.

Referência técnica: [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent).

Este mecanismo é uma proteção técnica. Textos legais, bases jurídicas, prazos
de retenção e atendimento aos direitos dos titulares ainda devem ser revisados
pela assessoria jurídica responsável pela LGPD.
