# Diagnóstico de entidades e NAP — Netcar Esteio

Coleta: 21/08/2026, aproximadamente 17h, no fuso America/Sao_Paulo.

Escopo: diagnóstico somente leitura do site em produção, código, dois Perfis da Empresa, dados estruturados, CEPs, CIDs do Google Maps, redirecionamentos e citações selecionadas. Nenhuma informação pública foi alterada nesta etapa.

## Resultado executivo

As duas unidades estão corretamente representadas como entidades `AutoDealer` distintas e subordinadas à mesma organização. Nomes, números, telefones, horários, imagens, coordenadas e links `hasMap` estão bem separados. Os CIDs levam aos perfis corretos e a distância calculada entre as coordenadas é de 391 m, coerente com a estimativa operacional de aproximadamente 400 m.

O principal problema é o endereço postal: os CEPs e o bairro da Loja 1 não são consistentes entre site, Google e bases postais/cadastrais. Isso é um problema de NAP corrigível, mas não comprova isoladamente perda de ranking. O pino geográfico continua correto.

## Comparação das entidades

| Campo | Loja 1 | Loja 2 | Diagnóstico |
|---|---|---|---|
| Nome público e schema | Netcar Multimarcas - Loja 1 | Netcar Multimarcas - Loja 2 | consistente |
| Número | 740 | 1106 | consistente |
| Telefone principal | (51) 3473-7900 | (51) 3033-3900 | consistente |
| Horário | seg.–sex. 9h–18h; sáb. 9h–16h30 | igual | consistente |
| `@id` | `/#loja-1` | `/#loja-2` | único e estável |
| URL da entidade | `/contato#loja-1` | `/contato#loja-2` | âncoras renderizadas e indexáveis |
| CID do Maps | `9144067949621682127` | `10839197980729051544` | cada CID abre o perfil correto |
| Coordenadas | -29.8380385, -51.1702399 | -29.8411446, -51.1721442 | pontos distintos; 391 m entre eles |
| CEP no schema/site | 93260-048 | 93260-001 | divergente das faixas postais atuais |
| CEP público no Google | 93260-001 | 93260-001 | o mesmo CEP é exibido para os dois números |

## Divergência postal

### Loja 1 — número 740

- site e schema: `93260-048`, bairro Centro;
- painel público do Google: `93260-001`, bairro Centro;
- CSV exportado do GBP: `93260-048`, bairro Centro;
- ViaCEP para a avenida: o número 740 está na faixa 551/552 a 889/890, CEP `93260-490`, bairro Tamandaré;
- cadastro público do CNPJ ativo 02.237.969/0001-06: número 740, bairro Tamandaré, CEP `93260-490`.

Conclusão: **forte evidência** de que o endereço postal atual é `93260-490`, bairro Tamandaré. Antes de editar Google e site, confirmar em documento recente da unidade, como conta de serviço, IPTU, alvará ou comprovante dos Correios.

### Loja 2 — número 1106

- site, schema, painel público do Google e CSV do GBP: `93260-001`;
- ViaCEP: `93260-001` não é reconhecido como CEP atual;
- a faixa 891/892 a 1747/1748 da Avenida Presidente Vargas contém o número 1106 e usa `93260-048`, bairro Centro;
- o antigo CNPJ 12.999.974/0001-00 do endereço 1106 registra `93260-003`, mas está baixado desde 09/12/2025 e esse CEP também não é reconhecido atualmente pelo ViaCEP.

Conclusão: **forte evidência** de que o endereço postal atual é `93260-048`, bairro Centro. Confirmar documentalmente antes da edição.

Fontes: [consulta ViaCEP por logradouro](https://viacep.com.br/ws/RS/Esteio/Presidente%20Vargas/json/), [ViaCEP 93260-490](https://viacep.com.br/ws/93260490/json/), [ViaCEP 93260-048](https://viacep.com.br/ws/93260048/json/), [BrasilAPI — CNPJ ativo no nº 740](https://brasilapi.com.br/api/cnpj/v1/02237969000106) e [BrasilAPI — antigo CNPJ do nº 1106](https://brasilapi.com.br/api/cnpj/v1/12999974000100).

## Pontos técnicos comprovadamente corretos

- produção e código usam duas entidades `AutoDealer`, não um único endereço múltiplo;
- as duas entidades apontam para uma única `Organization`, coerente com a operação integrada;
- nomes do schema acompanham os nomes atuais dos perfis;
- CIDs `hasMap` abrem “Netcar Multimarcas - Loja 1” e “Netcar Multimarcas - Loja 2”;
- telefones principais correspondem aos respectivos perfis;
- imagens das duas lojas e o logotipo respondem HTTP 200;
- `/contato`, `/contato#loja-1` e `/contato#loja-2` respondem HTTP 200;
- página de contato possui canonical próprio, `index, follow` e uma única tag `h1`;
- JSON-LD renderizado contém uma organização e duas lojas, sem duplicação de entidades;
- redirecionamentos de HTTP, domínio sem `www` e subdomínio `mysql` convergem para o domínio canônico;
- validadores locais de SEO gerado, SEO regional e roteamento foram aprovados.

## Inconsistências secundárias

### Rótulos das lojas no HTML pré-renderizado

O conteúdo HTML inicial da página de contato usa “Matriz” e “Filial”, enquanto a interface renderizada, os perfis e o schema usam “Loja 1” e “Loja 2”. É uma inconsistência pequena, mas corrigível para reforçar a mesma nomenclatura em todas as superfícies.

Classificação: **comprovado**, impacto provável baixo.

### Diretórios e superfícies históricas

- a página ativa da NaPista foi verificada diretamente em 21/08/2026: concentra o estoque no endereço 1106 e exibe o fixo `(51) 3473-7900` e o WhatsApp atual `(51) 99729-3118`;
- algumas versões antigas ainda indexadas da NaPista exibem o WhatsApp antigo `(51) 99887-9281`, mas isso não corresponde ao cadastro ativo observado;
- o subdomínio `mysql.netcarmultimarcas.com.br` ainda aparece em resultado antigo com “Av. Getúlio Vargas” e WhatsApp antigo, mas atualmente redireciona por 301 para o domínio principal;
- buscas cadastrais ainda associam “Netcar Multimarcas” ao CNPJ baixado do nº 1106.

Essas referências podem contribuir para ambiguidade externa, mas a operação integrada torna o cruzamento dos telefones menos grave do que seria em lojas independentes. Como o WhatsApp ativo já está correto, a NaPista deve ser monitorada, não tratada como correção urgente. O cadastro só deve ser alterado se a Netcar decidir padronizar o fixo da listagem do nº 1106 para `(51) 3033-3900`.

Classificação: **comprovado para o conteúdo encontrado**; influência sobre ranking é **hipótese fraca**, sem causalidade demonstrada.

## Datas de abertura

- schema: ano de fundação `1997` para a marca;
- CNPJ ativo: início em 04/11/1997;
- GBP Loja 1: 06/10/1997;
- GBP Loja 2: 11/01/1997.

As datas dos perfis parecem representar a antiguidade da marca, não necessariamente a abertura de cada endereço. O impacto de ranking é provavelmente pequeno, mas os dias e meses devem ser corrigidos somente após confirmação histórica.

## Prioridade recomendada

1. confirmar os CEPs e o bairro do nº 740 com documento recente;
2. depois da confirmação, alinhar primeiro os dois Perfis da Empresa;
3. alinhar schema, HTML pré-renderizado, página de contato e validadores no mesmo deploy;
4. trocar links visíveis de Maps por URLs diretas dos respectivos CIDs;
5. solicitar correção do WhatsApp antigo e da identificação das unidades nos diretórios controláveis;
6. monitorar a remoção do resultado residual do subdomínio `mysql` após o 301.

## Nível de confiança

- separação técnica das duas entidades: **comprovado**;
- CIDs, telefones e coordenadas: **comprovado**;
- distância aproximada de 400 m: **comprovado pelas coordenadas — 391 m em linha reta**;
- CEP provável da Loja 1 (`93260-490`): **forte evidência**;
- CEP provável da Loja 2 (`93260-048`): **forte evidência**;
- efeito direto dos CEPs no posicionamento local: **hipótese provável, sem evidência causal suficiente**.

## Registro de implementação — 21/08/2026

- código local alinhado para `93260-490` na Loja 1 e `93260-048` na Loja 2, sem alteração de coordenadas ou links dos pinos;
- validação TypeScript e verificação de whitespace aprovadas;
- build integral concluído em 21/08/2026: 58 veículos ativos, 25 landings transacionais e validações de SEO gerado, runtime, roteamento, tracking e TypeScript aprovadas; a divergência anterior de `ItemList` era resultado de uma geração parcial com fotografias diferentes do estoque e desapareceu ao executar o fluxo completo na ordem prevista;
- artefato de produção gerado em `dist/`, mas ainda não enviado à KingHost: esta cópia local não possui `.env.local` com credenciais de deploy; a publicação deve ser disparada pelo painel DevOps/VPS que mantém os segredos ou por um ambiente autorizado;
- Perfil da Loja 2: o CEP `93260-048` foi preenchido e o envio final foi confirmado pelo responsável da Netcar em 21/08/2026; status: **enviado ao Google, aguardando verificação da publicação pública**;
- Perfil da Loja 1: o CEP `93260-490` foi preenchido e o envio final foi confirmado pelo responsável da Netcar em 21/08/2026; status: **enviado ao Google, aguardando verificação da publicação pública**;
- nenhum pino do mapa foi movido.

Os dois endereços foram submetidos ao Google pelo responsável. Até que os endereços públicos sejam verificados e o site seja publicado, `ENTITY-001` permanece em andamento. O registro acima distingue alteração preparada, envio confirmado pelo responsável e publicação comprovada para evitar tratar a submissão como exibição pública definitiva.
