# Auditoria de procedência do estoque — etapa 1

Coleta: 24/08/2026
Fontes: API pública do estoque e ERP PostgreSQL consultado em modo somente leitura
Escopo: veículos com preço maior que zero publicados no site
Privacidade: nenhum nome, telefone, CPF/CNPJ, chassi, Renavam ou placa foi registrado neste relatório.

## 1. Método

1. A API pública `/api/v1/veiculos.php` foi consultada com limite suficiente para todo o estoque.
2. Foram considerados disponíveis os registros com preço maior que zero.
3. Os IDs públicos foram cruzados com `public.veiculos.seqveiculo` no ERP.
4. A UF foi obtida do cadastro do proprietário/vendedor relacionado ao veículo (`codgeralprop` → `cadclientes` → `cadenduf`).
5. A existência de laudo/consulta foi medida sem extrair dados pessoais.
6. Foi feita uma triagem por termos explícitos de locadoras no nome cadastral do vendedor, apenas como filtro inicial. Ausência de termo não comprova ausência de origem de locadora.

## 2. Resultado consolidado

| Indicador | Resultado | Evidência | Confiança |
|---|---:|---|---|
| veículos retornados pela API | 68 | resposta pública atual | comprovado |
| veículos disponíveis | 60 | preço maior que zero | comprovado |
| vendidos/preço zero no retorno | 8 | resposta pública atual | comprovado |
| disponíveis localizados no ERP | 60/60 | cruzamento pelo ID | comprovado |
| vendedor/proprietário relacionado | 60/60 | `codgeralprop` preenchido | comprovado |
| cadastro do vendedor com UF RS | 57/60 | `cadclientes` + `cadenduf` | comprovado |
| cadastro do vendedor com outra UF | 0/60 | mesmo cruzamento | comprovado para o campo cadastral |
| cadastro do vendedor sem UF | 3/60 | mesmo cruzamento | comprovado |
| vendedor pessoa física | 31/60 | `tppessoa = F` | comprovado |
| vendedor pessoa jurídica | 29/60 | `tppessoa = J` | comprovado |
| data de entrada preenchida | 59/60 | campo `dataentrada` | comprovado |
| XML CheckAuto no ERP | 51/60 | campo `xmlcheckauto` | comprovado |
| XML CheckAuto com UF de jurisdição RS | 51/51 | `UFJurisdicao` no XML | comprovado para os consultados |
| PDF/laudo associado no ERP | 47/60 | campo `pscpdf` | comprovado |
| PDF/laudo exposto pela API | 47/60 | `pdf`/`pdf_url` | comprovado |
| termos explícitos de locadora no nome do vendedor | 0/60 | triagem textual | forte evidência negativa, não comprovação |
| campo dedicado a origem de locadora | inexistente | esquema do ERP/API | comprovado |
| campo dedicado a UF da aquisição | inexistente | esquema do ERP/API | comprovado |

## 3. Três veículos com UF cadastral ausente

| ID | Veículo público | Tipo de compra no ERP | Tipo do vendedor | Data de entrada | Laudo/PDF |
|---:|---|---|---|---|---|
| 19884 | Fiat Fastback Impetus Turbo | P | pessoa jurídica | 19/06/2026 | sim |
| 19945 | Hyundai HB20S Premium | P | pessoa jurídica | 31/07/2026 | sim |
| 19965 | Chevrolet Onix LT | P | pessoa jurídica | 17/08/2026 | sim |

Não foi registrado o nome das empresas neste relatório. A UF deve ser corrigida ou confirmada no cadastro administrativo.

Nos três casos, o XML CheckAuto disponível informa UF de jurisdição atual `RS` e procedência nacional. Isso reforça o vínculo atual com o estado, mas não substitui o preenchimento da UF cadastral do vendedor nem cria um campo explícito de local da aquisição.

## 4. Dados úteis já existentes no ERP

A tabela `veiculos` já possui campos valiosos que não chegam à API pública atual:

- `dataentrada`;
- `localveiculo`;
- `empresa`;
- `tipocompra`;
- `codgeralprop`;
- `precofipe` e `codigofipe`;
- `pscpdf` e `xmlcheckauto`;
- `datachecklist` e `userchecklist`;
- `obsfabricavalores`;
- `revisaook`, `datarev` e `kmrev`;
- `pscvideo`;
- `docok`;
- `flgressalvas`.

Os 60 veículos disponíveis também apresentam diferenciais na API. Entre os campos com potencial comercial estão `baixa_km`, `unico_dono`, `revisados_concessionaria`, `garantia_fabrica` e `manual_chave_reserva`. Esses dados precisam de regra de validade antes de virarem selos adicionais.

## 5. Limitações importantes

### `Adquirido no RS`

A UF do cadastro do vendedor é RS em 57 casos, mas o banco não possui um campo explícito para o local jurídico/operacional da aquisição. UF do vendedor é uma evidência forte, mas não é semanticamente igual a `UF da aquisição`.

### `Não proveniente de locadora`

Nenhum vendedor atual contém termos explícitos de locadoras conhecidas no nome cadastral. Isso não prova a cadeia histórica completa e não identifica empresa de frota com razão social não reconhecível.

O CheckAuto registra diversos dados de histórico, mas o esquema atual não fornece um campo booleano simples e auditável `foi_locadora`. Portanto, não será criado selo individual com base apenas na ausência de um termo.

### Campos que não devem ser reinterpretados

- `carroimportado = N` significa veículo não importado; não comprova origem no RS;
- `procedenciaveiculo = NACIONAL` indica procedência nacional, não ausência de passagem por outro estado ou locadora;
- sete dos XMLs atuais usam `procedenciaveiculo = ESTRANGEIRO`; isso indica fabricação/origem estrangeira e não contradiz, por si só, uma aquisição realizada no RS;
- `docok = N` apareceu nos 60 registros e depende da semântica interna do ERP; não foi tratado como problema documental;
- `tipocompra` usa códigos `P` e `C`; o significado não foi inferido sem dicionário oficial do ERP.

## 6. O que pode ser comunicado agora

Como política institucional confirmada pela gestão:

> A Netcar seleciona no Rio Grande do Sul os veículos destinados à revenda e não trabalha com carros provenientes de locadoras. Essa política orienta a formação do estoque e busca aumentar a rastreabilidade da procedência.

Essa mensagem descreve a política da empresa. Não afirma que cada veículo sempre circulou no RS, não promete histórico completo e não deve virar selo individual antes da conclusão cadastral.

## 7. O que ainda não deve aparecer como selo individual

- `Adquirido no RS`;
- `Nunca saiu do RS`;
- `Sem passagem por locadora`;
- `Histórico completo`;
- `Procedência 100% garantida`.

## 8. Ações seguintes

### Ação imediata — completar a prova dos três casos

Confirmar/corrigir a UF cadastral dos IDs 19884, 19945 e 19965 no ERP.

### Ação de processo — registrar a verificação

Definir onde será registrado, por veículo:

- UF/local da aquisição;
- tipo de origem;
- verificação de passagem por locadora;
- fonte utilizada;
- data e responsável;
- exceção ou inconclusivo.

### Ação técnica — expor somente o necessário

Depois de aprovado o modelo, disponibilizar pela API apenas campos não sensíveis:

- `origem_aquisicao_uf`;
- `procedencia_locadora_verificada`;
- `procedencia_verificada_em`;
- `data_entrada_estoque`;
- `unidade_atual`;
- selos derivados já validados.

Dados de proprietário, CPF/CNPJ, chassi e Renavam não devem ser enviados ao frontend.

### Ação de site — primeiro deploy comercial

Após a validação da redação, implementar a mensagem institucional de procedência na home e criar a página `Como selecionamos nossos carros`. O Nethelp permanecerá inalterado e não será ampliado.

## 9. Conclusão

A política informada pela Netcar encontra suporte parcial e forte nos dados atuais: 57 dos 60 veículos têm vendedor cadastrado no RS e nenhum tem vendedor cadastrado em outra UF. Os três restantes não contradizem a política, mas estão sem UF preenchida.

A ausência de carros de locadora ainda é uma regra operacional informada pela gestão, não um atributo estruturado no banco. Para transformar essa vantagem em prova por veículo, é necessário registrar a verificação de maneira explícita.
