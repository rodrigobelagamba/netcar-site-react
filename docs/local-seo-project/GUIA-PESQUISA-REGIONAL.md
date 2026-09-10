# Pesquisa de buscas e aquisição regional da Netcar

Referência editorial e técnica atualizada em 10/09/2026. Aplicação inicial: Canoas, Sapucaia do Sul, São Leopoldo e Gravataí. As duas lojas e o estoque ficam em Esteio.

## Princípio

Pesquisar a intenção do comprador, não uma lista de palavras isoladas. “Carros usados”, “seminovos”, “revenda” e “loja de carros” podem levar ao mesmo objetivo; câmbio, orçamento, modelo, troca e financiamento acrescentam necessidades diferentes. Uma página deve resolver a necessidade com informação e oferta reais.

O Google recomenda antecipar diferenças de vocabulário e consegue relacionar uma página a variações que não estejam escritas literalmente. A ausência de uma palavra exata não explica sozinha a ausência no resultado. A meta tag keywords não é usada pelo Google. Não estabelecer densidade mínima, inserir listas de sinônimos ou criar um URL para cada variante. [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Mapa de intenções e destinos

| Intenção | Exemplos para pesquisar | Destino da Netcar |
|---|---|---|
| Encontrar carros/empresa próxima | carros usados, seminovos, revenda multimarcas, loja de carros + cidade | /seminovos-[cidade], com estoque, comparação e rota para Esteio |
| Escolher por tipo ou câmbio | SUV, hatch, carro automático | /comprar-suv, /comprar-hatch, /seminovos-automaticos |
| Definir orçamento | carros até R$100 mil, automáticos até R$100 mil | /comprar-carros-ate-100-mil, /comprar-automaticos-ate-100-mil |
| Procurar modelo | Compass, HR-V, T-Cross, Kicks | /comprar-jeep-compass, /comprar-honda-hr-v, /comprar-volkswagen-t-cross, /comprar-nissan-kicks |
| Comparar candidatos | comparar carros, diferenças entre versões/equipamentos | /comparar e fichas dos exemplares disponíveis |
| Comprar com financiamento ou troca | simular financiamento, usado como entrada | /financiamento, atendimento do carro e pré-avaliação existente |
| Vender o carro atual | vender meu carro, empresa que compra carro usado | /vender-carro-[cidade], separado da intenção principal de compra |
| Conferir procedência e atendimento | preparação, histórico, vistoria, endereço | /como-selecionamos-nossos-carros, ficha real e rotas das duas lojas |

Os exemplos são famílias editoriais. Sua presença nesta tabela não é uma estimativa de volume de busca nem prova de procura em cada município. Condições como financiamento direto com a loja, sem entrada ou aprovação garantida exigiriam uma oferta real; não devem ser usadas para atrair tráfego incompatível.

## Evidência antes de priorização

1. **Search Console:** coletar consulta, página, cliques, impressões, CTR e posição em períodos completos; separar marca, nomes de concorrentes e intenção comercial. Impressões representam aparições da Netcar, não o tamanho total do mercado.
2. **Lacunas de cobertura:** consultas sem impressão no GSC podem existir. Complementar com Planejador de Palavras-chave, quando houver acesso autorizado, pesquisa pública dos resultados e dúvidas reais do atendimento. Identificar fonte, data, localização e período; não inventar volumes a partir de autocomplete ou concorrentes.
3. **Adequação à oferta:** conferir disponibilidade, preço, câmbio, modelo e condições da Netcar. Um termo popular sem oferta compatível não é prioridade automática.
4. **Utilidade do destino:** escolher página existente capaz de responder à intenção; melhorar conteúdo e navegação antes de abrir novos URLs.
5. **Resultado comercial:** combinar descoberta com conversas recebidas, qualificação, visitas e vendas. Clique no WhatsApp é sinal de intenção, sem equivalência automática a lead confirmado.

O GSC omite parte das consultas e agrega páginas de forma diferente da propriedade. Posição média varia por consulta, dispositivo e contexto; não usar a média de uma página como ranking genérico de uma cidade. [Dimensões e limites](https://support.google.com/webmasters/answer/17011259?hl=pt-BR).

## Implementação de setembro/2026

- As quatro URLs /seminovos-canoas, /seminovos-sapucaia-do-sul, /seminovos-sao-leopoldo e /seminovos-gravatai mantêm seus endereços e canônicas.
- Title/H1, apresentação, quatro parágrafos e quatro perguntas por cidade passam a cobrir usados, escolha de revenda, comparação por atributos/orçamento e negociação. Os textos mantêm os locais reais de atendimento e os caminhos de visita.
- O estoque continua antes dos textos detalhados, com contato e venda do usado disponíveis.
- A configuração src/data/seo/regional-focus.json define as quatro cidades destacadas pelos hubs de estoque e as oito seleções regionais. React e HTML para crawler leem a mesma fonte.
- T-Cross e Kicks entram entre as seleções candidatas. Cada seleção só é mostrada quando a landing está indexável e tem oferta; os limiares existentes de estoque não foram alterados.
- As demais cidades continuam acessíveis pelo hub e pelos links relacionados. As páginas de venda do usado mantêm seu conteúdo e formulário.
- Não foram criadas novas páginas cidade × modelo, cidade × preço ou cidade × sinônimo. Não foram adicionadas keywords aos nomes dos perfis Google.

## Critérios de edição

Títulos devem ser descritivos e concisos; descriptions resumem a oferta. O Google pode reescrever título e snippet conforme o contexto. Não há limite rígido universal de caracteres de title que garanta ranking. Os validadores do projeto são convenções internas, não regras do Google. [Títulos](https://developers.google.com/search/docs/appearance/title-link) · [Snippets](https://developers.google.com/search/docs/appearance/snippet).

Cada página regional precisa ajudar a escolher um carro e organizar uma visita real. Trocar apenas o nome da cidade não cria utilidade. Links para estoque, modelos, orçamento e negociação devem ter destinos úteis e rastreáveis. [Conteúdo útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Spam: doorway e keyword stuffing](https://developers.google.com/search/docs/essentials/spam-policies).

A cidade de origem do comprador não deve substituir o endereço real das lojas em texto ou dados estruturados. Descrever área atendida não cria filial nem remove o efeito da distância no Maps. [Representação do negócio](https://support.google.com/business/answer/3038177?hl=pt-BR) · [Classificação local](https://support.google.com/business/answer/7091?hl=pt-BR).

Preservar canônicas e sitemap; evitar combinações ilimitadas de filtros indexáveis. Canonical não equivale a impedir rastreamento, e o Google precisa rastrear um URL para ler noindex. [URLs de comércio](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) · [Navegação por filtros](https://developers.google.com/crawling/docs/faceted-navigation).

## Avaliação após a publicação

Registrar versão e data; comparar os primeiros 28 dias completos posteriores com os 28 anteriores. Analisar cada cidade e família, mantendo separação entre marca e descoberta. Observar o tempo de recrawl e evitar atribuir causalidade com poucos cliques. As demais mudanças de site, campanhas e instrumentação devem entrar na interpretação.

Critérios: novos termos comerciais identificados, ganho de cliques sem marca, navegação até carros disponíveis e conversas qualificadas. Persistir com a intenção quando existe demanda e oferta; ajustar conteúdo/destino se a página aparece e não satisfaz a busca; retirar prioridades que não correspondam ao estoque ou às condições reais.

Build e validação técnica demonstram consistência da implementação, não aumento futuro de posição ou vendas. Esta referência deve ser atualizada com evidências novas, sem apresentar hipóteses antigas como fatos atuais.

