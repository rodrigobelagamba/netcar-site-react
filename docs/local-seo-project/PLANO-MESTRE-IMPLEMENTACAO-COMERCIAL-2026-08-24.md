# Plano mestre de implementação comercial — Netcar Multimarcas

Data-base: 24/08/2026
Horizonte: 6 semanas de implementação + 90 dias de medição
Mídia paga: não necessária nesta fase

## Status da execução

### Etapa 1 — auditoria técnica: concluída em 24/08/2026

- 60 veículos disponíveis na API e 60 localizados no ERP;
- 57 vendedores/proprietários cadastrados com UF `RS`;
- nenhum cadastrado em outra UF;
- três cadastros de pessoa jurídica sem UF, todos com CheckAuto indicando jurisdição atual `RS`;
- 51 XMLs CheckAuto, todos com jurisdição atual `RS`;
- nenhum campo dedicado a `UF da aquisição` ou `origem de locadora`;
- nenhum nome cadastral de vendedor com termo explícito de locadora, resultado que serve como triagem e não como prova completa.

Decisão: a política pode ser trabalhada inicialmente como mensagem institucional confirmada pela gestão. Selos individuais de origem ficam adiados até existir registro estruturado por veículo.

Evidência: `AUDITORIA-PROCEDENCIA-ESTOQUE-2026-08-24.md`.

## 1. Resultado esperado

O site deverá comunicar e demonstrar quatro vantagens reais da Netcar:

1. **Procedência:** política de aquisição no Rio Grande do Sul e de não trabalhar com veículos provenientes de locadoras para revenda.
2. **Preparação:** análise, laudo quando disponível e Fábrica de Valor.
3. **Transparência:** informação clara sobre cada veículo, preço, garantia aplicável, documentação e condições comerciais.
4. **Estrutura:** empresa desde 1997, duas lojas físicas e estoque/equipe integrados.

O Nethelp continuará existindo e permanecerá nas menções atuais do site e dos Perfis da Empresa no Google. A implementação não removerá essas referências; apenas não ampliará o Nethelp para novos destaques, selos, páginas, campanhas ou promessas.

## 2. Mensagem central

### Headline

> Confiança começa antes da escolha.

### Explicação

> Nosso cuidado começa na compra do estoque. Selecionamos no Rio Grande do Sul os veículos destinados à revenda e não trabalhamos com carros provenientes de locadoras. Depois, cada veículo segue o processo de avaliação e preparação da Netcar antes de chegar à vitrine.

### Estrutura narrativa

`seleção de origem → análise disponível → preparação → apresentação transparente → decisão do cliente`

### Expressões que não serão adicionadas em novos conteúdos

- histórico 100% completo;
- carro sem risco;
- nunca dará problema;
- garantia total ou ilimitada;
- resolvemos qualquer problema;
- suporte sempre que precisar;
- assumimos qualquer responsabilidade após a entrega;
- sempre rodou no RS;
- todo carro de locadora é ruim ou inseguro.

## 3. Responsabilidades

### Codex / implementação técnica

- preservar as menções atuais ao Nethelp e implementar a nova mensagem de procedência;
- desenvolver componentes e páginas;
- consumir os campos existentes da API;
- propor e implementar campos novos quando autorizado;
- criar eventos de analytics;
- testar mobile, desktop, SEO e build;
- preparar commits e orientar deploy;
- validar produção após cada publicação.

### Netcar / validação operacional

- confirmar a redação exata da política de aquisição;
- confirmar se existe alguma exceção no estoque atual;
- definir quais documentos comprovam origem e não procedência de locadora;
- confirmar os critérios de baixa km, revisões, manual e chave;
- aprovar condições de entrada parcelada e garantia divulgáveis;
- fornecer acesso/documentação do CRM quando chegar a fase de integração;
- manter os dados dos veículos atualizados.

## 4. Deploy 1 — novo posicionamento sem ampliar o Nethelp

Prazo estimado: 1–3 dias úteis de desenvolvimento e validação.

### Objetivo

Introduzir o posicionamento de procedência, preparação e transparência sem remover as referências atuais ao Nethelp e sem aumentar sua exposição.

### Alterações previstas

| Área | Alteração |
|---|---|
| menções atuais ao Nethelp | preservar site, rodapé, páginas e descrições do Google como estão |
| conteúdos novos | não criar novas chamadas, selos, páginas ou campanhas centradas no Nethelp |
| home | adicionar procedência e preparação sem retirar os blocos existentes |
| Sobre | acrescentar seleção do estoque sem ampliar a promessa do Nethelp |
| páginas regionais | preservar conteúdo atual e não repetir o Nethelp em novos blocos |
| conteúdos automáticos | impedir crescimento da frequência do termo além do padrão já aprovado |
| novas fichas e cards | não transformar Nethelp em selo ou CTA adicional |

### Tratamento do canal para clientes

O canal e o acesso atuais serão preservados. Não haverá mudança de nome, link ou funcionamento nesta fase.

### Arquivos principais da nova mensagem de procedência

- componente novo ou seção apropriada da home;
- `src/modules/sobre/pages/SobrePage.tsx` para a política de seleção;
- nova página institucional de procedência;
- rotas, sitemap e dados estruturados correspondentes.

### Fora do deploy

As descrições dos dois Perfis da Empresa no Google permanecerão inalteradas.

### Aceite

- todas as menções e acessos atuais ao Nethelp continuam presentes;
- nenhuma nova área aumenta a promessa ou o destaque do Nethelp;
- títulos e descrições permanecem naturais para SEO;
- build e validadores passam;
- produção é conferida em mobile e desktop.

## 5. Deploy 2 — procedência e confiança visíveis

Prazo estimado: 3–7 dias úteis após o Deploy 1.

### Objetivo

Transformar a política de compra da Netcar em uma explicação concreta e diferenciadora.

### Home

Adicionar uma seção `Como formamos nosso estoque`:

1. adquirimos para revenda no RS;
2. não trabalhamos com veículos provenientes de locadoras;
3. analisamos o histórico disponível e a documentação;
4. recusamos veículos que não atendem aos critérios;
5. os aprovados seguem para avaliação e preparação.

### Página institucional

Criar `/como-selecionamos-nossos-carros` com:

- política de aquisição;
- limites das consultas e do histórico disponível;
- critérios de recusa descritos sem revelar controles internos sensíveis;
- análise documental;
- i-CHECK quando existente;
- preparação pela Fábrica de Valor;
- perguntas frequentes;
- acesso ao estoque.

### Página Sobre

Reorganizar a narrativa:

`desde 1997 → duas lojas → seleção → preparação → estoque integrado`

### Páginas regionais

Incluir um resumo da política de procedência e um link para a página principal, sem duplicar o mesmo texto em todas as cidades.

### Dados estruturados e SEO

- título e descrição próprios;
- canonical próprio;
- breadcrumbs;
- FAQ somente com perguntas respondidas na tela;
- ligações internas a partir da home, Sobre, estoque e fichas;
- inclusão no sitemap;
- validação de indexação e conteúdo duplicado.

### Aceite

- afirmações correspondem exatamente à política aprovada;
- `adquirido no RS` não é apresentado como `sempre circulou no RS`;
- não existe crítica generalizada a veículos de outras origens;
- página é útil, indexável e ligada ao estoque;
- versão mobile não repete problemas de sobreposição do cabeçalho.

## 6. Deploy 3 — provas em cada veículo

Prazo estimado: 5–10 dias úteis, dividido conforme os dados disponíveis.

### Etapa 3A — dados já existentes

Levar aos cards os selos que a ficha já consegue gerar:

- i-CHECK aprovado;
- garantia de fábrica;
- baixa km;
- único dono.

O componente de card já prevê uma propriedade de `badges`, mas ela ainda não participa da renderização. A implementação deverá:

- derivar selos dos dados reais recebidos;
- limitar a dois selos no card;
- mostrar todos os aplicáveis na ficha;
- rastrear visualização/clique relacionados aos selos;
- preservar desempenho e legibilidade mobile.

### Etapa 3B — dados que exigem banco/admin/API

Campos propostos:

- `origem_aquisicao_uf`;
- `origem_tipo`;
- `procedencia_locadora_verificada`;
- `procedencia_verificada_em`;
- `procedencia_verificada_por`;
- `data_entrada_estoque`;
- `unidade_atual`;
- `revisoes_comprovadas`;
- `manual_confirmado`;
- `chave_reserva_confirmada`;
- `fipe_valor`;
- `fipe_mes_referencia`;
- `fipe_consultada_em`;
- `video_url`;
- `campanha_inicio` e `campanha_fim`.

Não armazenar dados pessoais desnecessários do proprietário anterior.

### Regras dos novos selos

| Selo | Condição |
|---|---|
| Adquirido no RS | UF da aquisição confirmada |
| Sem origem de locadora | verificação documental concluída conforme processo definido |
| Recém-chegado | data de entrada dentro da janela aprovada |
| Revisões comprovadas | campo e evidência confirmados |
| Manual e chave reserva | ambos confirmados |
| Abaixo da FIPE | FIPE válida e preço público inferior |

### Ficha do veículo

Adicionar um módulo `Por que este carro entrou no estoque da Netcar`, preenchido apenas com fatos daquele veículo.

Mostrar também:

- unidade atual, quando registrada;
- aviso sobre estoque integrado;
- confirmação da unidade antes da visita;
- laudo e diferenciais disponíveis;
- condições comerciais reais.

### Aceite

- nenhum selo aparece por padrão sem dado;
- toda afirmação pode ser ligada à evidência operacional;
- selos vencidos ou desatualizados deixam de aparecer;
- veículo vendido continua tratado corretamente;
- cards permanecem legíveis em telas pequenas.

## 7. Deploy 4 — contato identificado e CRM

Prazo estimado: 5–15 dias úteis depois de confirmar o CRM.

### Objetivo

Descobrir se a perda acontece em tráfego, atendimento, visita, proposta, crédito ou negociação.

### WhatsApp

Preservar o contato direto, enviando:

- ID e nome do veículo;
- intenção;
- cidade regional;
- origem e campanha;
- Loja 1/Loja 2;
- código do clique.

### Formulários opcionais

- avaliação do usado;
- agendamento;
- qualificação inicial de financiamento.

O formulário não bloqueará o WhatsApp.

### CRM ou webhook

Registrar:

- origem;
- cidade;
- veículo;
- vendedor;
- tempo de resposta;
- contato efetivo;
- visita;
- proposta;
- aprovação;
- venda;
- motivo de perda.

### Eventos

- `select_item`;
- `view_item`;
- `finance_start`;
- `trade_in_start`;
- `schedule_visit_start`;
- `lead_submit`;
- `whatsapp_click`;
- `similar_vehicle_click`;
- `store_route_click`.

### Aceite

- pelo menos 90% dos leads digitais têm origem identificada;
- cidade e veículo chegam ao registro;
- eventos são validados no GA4;
- nenhuma informação sensível vai para analytics;
- duplicidades de lead são controladas;
- consentimento e retenção seguem a política da empresa.

## 8. Rotina competitiva paralela

O site público não mencionará concorrentes. A análise será interna.

### Toda semana

| Concorrente | O que observar | Como responder |
|---|---|---|
| Dotto | estoque, preços, selos, posição orgânica e modelos coincidentes | melhorar apresentação, revisar comparáveis e fortalecer Canoas |
| R2 Motors | veículos recentes, ofertas, mídia paga e faixas de preço | defender segmentos escolhidos e comunicar procedência/preparação |
| Alusi | presença no Pack de Esteio, avaliações e atividade do perfil | manter consistência dos dois perfis e defender a praça |
| Sul/Avenida | Maps e ofertas de Sapucaia | reduzir barreira da viagem com estoque, vídeo e agendamento |
| Star/Boqueirão | Maps de Canoas | competir no orgânico e na conversão, não manipular endereço |

### Por veículo

- dias em estoque;
- visualizações;
- contatos;
- propostas;
- FIPE;
- três comparáveis;
- preço, ano e km;
- motivo de perda;
- ação comercial.

## 9. Sequência de execução

### Semana 1

- validar a política de aquisição;
- executar Deploy 1;
- preservar as descrições atuais dos Perfis do Google;
- registrar linha de base de conversão e concorrência.

### Semana 2

- criar página e blocos de procedência;
- publicar Deploy 2;
- iniciar a Etapa 3A com os selos existentes.

### Semanas 3 e 4

- mapear banco/admin/API;
- implementar campos aprovados;
- publicar Deploy 3;
- iniciar auditoria dos 20 veículos prioritários.

### Semanas 5 e 6

- confirmar integração com o CRM;
- publicar Deploy 4;
- validar o funil completo;
- treinar a equipe para registrar motivo de perda.

### Dias 30, 60 e 90

- comparar conversão antes/depois;
- revisar estoque e preços;
- medir Canoas, Sapucaia e Esteio;
- priorizar o que comprovadamente gerou contato e venda;
- decidir se existe justificativa para mídia paga.

## 10. Testes obrigatórios por deploy

- build completo;
- validadores SEO, tracking, GBP e rotas;
- estoque e veículo vendido;
- WhatsApp com mensagem e origem corretas;
- mobile Safari e Chrome;
- desktop Chrome;
- imagens e layout sem sobreposição;
- canonical, title, description e schema;
- Core Web Vitals sem regressão evidente;
- URLs regionais e de veículos em produção;
- rollback conhecido antes de publicar.

## 11. Custos

### Obrigatórios

- mídia: R$ 0;
- ferramentas novas: R$ 0 na primeira fase;
- desenvolvimento: realizado no projeto em parceria;
- esforço da Netcar: validação das políticas e manutenção dos dados.

### Possíveis custos externos, somente com aprovação

- adaptação do CRM se o fornecedor cobrar integração;
- revisão jurídica final das mensagens e termos;
- produção profissional de vídeos, se desejada;
- acesso a bases adicionais de histórico/FIPE, se necessário;
- mídia paga após comprovação do funil.

## 12. Critério de sucesso

O projeto será considerado bem-sucedido quando:

- o Nethelp permanecer como está, sem remoção e sem expansão de sua promessa;
- procedência e preparação forem compreendidas rapidamente;
- diferenciais reais aparecerem nos carros corretos;
- os contatos chegarem identificados;
- a Netcar souber por que cada oportunidade foi perdida;
- veículos antigos receberem decisões baseadas em mercado e procura;
- crescimento regional puder ser ligado a contatos, propostas e vendas.

## 13. Primeira implementação

Começar pelo **Deploy 1**. Ele corrige o risco atual de comunicação, não depende de banco nem CRM e prepara o site para o novo posicionamento antes de adicionar páginas e selos.
