# Diferenciais e legendas por veículo

## Identidade e fontes

A identificação editorial usa marca, modelo com versão e ano-modelo exatos.
Fabricação e ano-modelo não são intercambiáveis. Motor, câmbio e mercado devem
ser considerados na pesquisa documental e nas regras de equipamento existentes.

Há duas decisões distintas:

- **O que o carro tem:** resultado de `resolveVehicleEquipment`, com cadastro,
  correções documentais e confirmações da unidade já autorizadas. Um perfil
  editorial não acrescenta equipamentos nem altera XML/API.
- **O que vale destacar:** curadoria dos temas relevantes para aquela combinação
  de modelo, versão e ano. O perfil escolhe somente entre os temas que os fatos
  atuais permitem montar. A ordem continua respeitando o resolver compartilhado.

Pesquisa de série exige fonte oficial da combinação brasileira exata. A página
atual de um fabricante ou um manual multiversões não comprova automaticamente
equipamentos de outro ano. A revisão documental segue `vehicle-equipment.md`.

## Entrada e atualização de um carro

1. Identificar a combinação exata recebida do estoque.
2. Aplicar correções e confirmações existentes pelo resolver compartilhado.
3. Encontrar o perfil editorial compatível e selecionar até quatro temas
   sustentados pelos itens daquela unidade.
4. Gerar o contexto com motor, potência, km e único dono somente quando informados.
5. Manter na lista todos os equipamentos que não foram consumidos pelos cards.
6. Se não existir perfil, manter a apresentação factual e indicar internamente
   que falta revisão editorial. Não herdar o perfil de outro ano ou versão.

Cada nova versão/ano é revisada uma vez; outras unidades compatíveis reutilizam
o perfil, mas sempre passam pelo filtro dos próprios dados. Acessórios e
confirmações específicos continuam restritos à unidade. Mudanças de cadastro
recalculam os cards, sem conservar alegações que desapareceram da fonte válida.

Os primeiros perfis são uma curadoria local de apresentação baseada nos cadastros
consultados, não uma certificação de fábrica de todo o estoque. Não foi criado
coletor, agendamento ou publicação automática. Uma futura fila operacional deve
integrar a rotina de revisão já existente, sem serviço paralelo.

## Legendas de fotografias

Cada legenda pertence à unidade e ao arquivo efetivamente revisado. A posição
na galeria não identifica o conteúdo: reordenar fotos não troca suas legendas.
A legenda visual descreve o que a fotografia mostra. Para mencionar um recurso,
ele precisa aparecer na imagem e continuar autorizado pelo resolver da unidade.

Fotos novas ou substituídas precisam de revisão; um número de arquivo igual ao
de outro carro não autoriza reutilizar sua legenda. O fallback é a descrição
visual conservadora da foto revisada, sem inventar equipamento. Enquanto um
arquivo não tiver revisão, não recebe legenda específica.

Na preparação de cada veículo, a conferência das fotos e suas legendas é uma
etapa própria. Os perfis de modelo/ano não substituem essa conferência.

## Verificação e publicação

Testar identidade exata, mudanças/ausências de equipamento, partição dos itens,
reordenação das fotos e preservação dos vídeos. Conferir a página renderizada
no desktop e no celular. A prévia local não representa publicação; deploy segue
o procedimento e o escopo aprovado pelo responsável.

## Ampliação pesquisada em 26/10/2026

A revisão dos 58 cadastros antes sem perfil considera também motor e câmbio.
Por exemplo, Cronos Drive 1.3 2025 manual e automático têm identidades distintas.
A correspondência exige esses dados quando definidos no perfil; dados ausentes,
outro mercado informado ou outra configuração não herdam a seleção.

`research.status` separa fonte exata, pesquisa parcial e divergência documental.
As conclusões, URLs e limites ficam em `docs/audits/editorial-profiles-2026-10-26.json`.
`profile-applied` significa apenas que os temas da curadoria puderam ser montados
com os equipamentos resolvidos. Não certifica a configuração de fábrica nem
resolve pendências documentais. Um perfil sem tema defensável fica identificado
como `no-supported-topics`, sem fabricar cards ou equipamentos. Quando a revisão
concluiu que não há temas elegíveis, `emptySelectionReason: no-eligible-topics`
permite concluir a seleção vazia apenas enquanto o resolver não oferecer nenhum
tema. Um novo fato elegível reabre a revisão. Fox19840 e HB2019985 usam esse
estado após a confirmação individual de ausência de ISOFIX pelo responsável.

As legendas do Tera19587 e Tracker20088 usam chaves SHA-256 da localização dos
arquivos revisados. O registro guarda separadamente o SHA-256 dos bytes vistos,
para detectar substituição na revisão operacional. O navegador não baixa as
fotos novamente para calcular esse checksum. Arquivo novo ou URL diferente não
herda legenda; os checksums de conteúdo devem ser conferidos antes da publicação
e em revisões posteriores. A primeira foto continua sem legenda visível.

Os textos específicos do Tera19587 foram conferidos no lançamento brasileiro
oficial (https://www.vwnews.com.br/news/2428). A aplicação exige unidade, versão,
ano, motor, câmbio e conjunto exato de equipamentos explicados pelo card.
Mudança nesses fatos volta à descrição canônica, sem prometer recursos ausentes
ou serviços conectados por assinatura. A legenda traseira do HR-V19854 descreve
o enquadramento da foto, sem inferir presença ou ausência da câmera.
