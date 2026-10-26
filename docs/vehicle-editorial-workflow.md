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
