# Gestão diária dos equipamentos — VPS / Netcar DevOps

## O que a rotina faz

O painel agenda uma auditoria diária às **09:00 em `America/Sao_Paulo`**. Ela usa a mesma fila serial dos jobs de build/deploy, mas **não faz build, deploy, commit nem alterações no XML/API**. A agenda roda dentro do processo do painel na VPS, via `node-cron`, sem depender de um computador pessoal ou de uma automação do Codex. O horário substitui a agenda anterior das 07h; não há segundo cron.

1. Consulta a API pública de estoque com timeout, limite de resposta e três tentativas. Aceita somente coleção completa e válida; separa os veículos ativos pelos mesmos preços positivos usados pelo estoque.
2. Aplica os resolvers compartilhados de equipamentos e garantia e compara com a última auditoria. Não armazena XML/API integral, placas, chassi, Renavam, fotos, contatos ou credenciais.
3. Gera a fila autenticada **Equipamentos** no DevOps, com cadastro recebido, apresentação resolvida, alertas e busca preparada para pesquisar a versão exata.
4. No mesmo job, `scripts/run-equipment-daily.mjs` executa a descoberta pelo CLI existente: lê XML/API e reavalia `docs/equipment-research-library.json` somente para identidades exatas. Registra candidatos e lacunas em `research-discovery.json`, o retrato sanitizado em `research-stock.json` e o histórico por item em `research-review.json`. Uma combinação nova sem fonte compatível fica explicitamente pendente de pesquisa; a biblioteca não certifica todo o estoque.
5. A terceira etapa do mesmo wrapper, `scripts/audit-equipment-public.ts`, confere as fichas públicas **às segundas-feiras às 09:00 de São Paulo**. O próprio comando verifica se a semana está pendente; os demais dias conservam a auditoria diária. Não existe outro cron, coletor independente ou automação no Codex. A próxima segunda prevista na implantação de 13/10/2026 é **19/10/2026**.

## Conferência semanal das fichas públicas

A conferência usa o retrato XML/API recém-produzido pela descoberta, as regras
compartilhadas de equipamentos e as correções já aprovadas por unidade. Abre as
fichas do estoque no navegador da VPS, expande equipamentos e descrição, e
compara o conteúdo apresentado com os dados esperados para aquele carro.
Uma ausência no XML não revoga uma correção específica já aprovada, como a
retirada de Park Assist do Renegade 20075. A conferência detecta divergências;
não concede novas aprovações nem altera XML, ERP, registros ou site.

O painel mostra os totais de veículos conformes, divergentes e inconclusivos,
a data da tentativa, a última conclusão, a próxima segunda e um link
`https://www.netcarmultimarcas.com.br/veiculo/ID` para cada resultado. A agenda
única controla ambas as etapas. **Executar agora** também força uma nova
conferência pública, mesmo quando a semana já foi conferida. A rotina mantém
travas e a fila serial existentes; não concorre com outra auditoria ou decisão.

A tentativa semanal é persistida antes da coleta. Uma execução perdida pode
ser reposta pela rotina diária; reiniciar o painel não cria repetição ilimitada.
Falha de página ou resultado parcial nunca vira confirmação do estoque inteiro.
O último relatório completo fica separado da tentativa parcial, com suas datas
originais. Diferenças numa rodada completa são um resultado de conferência,
não uma autorização de correção automática. Não há mensagens externas ou
publicação automática.

O Chromium é instalado na imagem operacional do DevOps, com cliente
`puppeteer-core` de versão fixa. A dependência fica em `/app/node_modules`,
disponível ao driver por `NODE_PATH`; o executável está configurado em
`PUPPETEER_EXECUTABLE_PATH`. O job não baixa navegador ou instala pacotes a cada
rodada. Não confundir disponibilidade de Chromium no computador pessoal com
navegador instalado e execução comprovada na VPS.

Na primeira execução, o wrapper pode carregar o progresso documental e as
observações públicas de 09/10/2026 incluídos em `docs/audits/`, somente se os
respectivos arquivos privados ainda não existirem. Execuções seguintes preservam
as evidências privadas mais novas. Observações antigas ou de outra identidade
não confirmam a ficha pública atual. Mudanças em fontes oficiais entram como
trechos para leitura humana; a primeira coleta não afirma novidade absoluta.

Na primeira execução, todos os carros entram como pendentes de conferência. Nas seguintes, os pareceres são reaproveitados enquanto equipamentos, identidade e regras permanecem iguais. Alterar apenas preço, fotos ou ordem dos opcionais não reabre a revisão. Uma alteração relevante gera outra chave, então a revisão anterior não aprova o novo conteúdo. Alterações no catálogo/resolver/evidências também exigem nova conferência.

## Alertas e revisão

- Unidade nova ou cadastro alterado: conferir equipamentos e, se necessário, pesquisar documentação oficial.
- Tag/descrição ainda não classificada: verificar significado antes de definir prioridade ou benefício.
- Fonte contrariando confirmação: corrigir o cadastro de origem. Ex.: teto do Civic 20051; Park Assist/ACC do Fastback 20050.
- Identidade de unidade confirmada alterada: a confirmação exata deixa de se aplicar; não transportar para outro carro.
- Contradições de presença, ausência ou quantidade: conferir a unidade, sem somar categorias de airbags.
- Correção oficial divergente da origem: conferir a referência e corrigir o cadastro.
- Garantia marcada sem registro compatível: manter a unidade visível no catálogo sem carimbo e encaminhar a pesquisa para revisão documental.
- Garantia antes aprovada com identidade, FAB/MY, km, flag ou regra alterada: conferir a nova pendência. Um aumento de km ainda compatível pode reabrir a conferência sem retirar o carimbo; falta de dados, regressão ou teto atingido bloqueiam a cobertura.
- Motor e câmbio: conferir o escopo próprio, prazo original, uso e fonte. Elegibilidade restrita não significa garantia geral; o relatório mantém os resultados separados.
- Bateria de tração: conferir separadamente sua fonte, prazo, limite e elegibilidade. A aprovação de uma garantia geral não aprova automaticamente a bateria, nem a cobertura restrita passa a ser garantia geral.

Para garantia, o parser reutilizado preserva os campos originais mínimos; ano
ausente não vira ano atual e km ausente não vira zero. Só uma unidade marcada
ou já presente no registro recebe a revisão adicional de garantia. A chave
inclui os campos relevantes, as regras daquele ID e o resultado dos gates;
mudanças de outro veículo não invalidam os pareceres não relacionados.
Preço positivo diferente, fotos e ordem dos opcionais continuam sem reabrir
uma conferência. O relatório conserva apenas o resumo sanitizado e hashes.

O botão de pesquisa abre uma consulta com marca, versão, ano-modelo, motor e câmbio. A descoberta agendada reavalia fontes oficiais previamente registradas; não faz uma pesquisa irrestrita da internet nem atribui equipamentos às versões sem fonte. Não há IA acrescentando opcionais ou credenciais de serviços de pesquisa configuradas nesta rotina.

Marcar **Revisado** exige um parecer; a fonte HTTPS é opcional para triagem, mas a comprovação continua obrigatória antes de complementar equipamentos. Esse status registra que alguém tratou a pendência: **não certifica o carro inteiro, não aprova equipamentos novos e não publica nada**. Se a divergência permanece, o alerta continua no relatório, mesmo com parecer registrado. Pode-se reabrir uma revisão.

O mesmo limite vale para garantia: esse botão não altera nem aprova a matriz
versionada. A incorporação de uma nova cobertura exige registro documental
compatível, atestes da unidade quando necessários, testes e release autorizado.

Complementos efetivos seguem `docs/vehicle-equipment.md`: confirmação da unidade ou evidência oficial exata, registro versionado, testes e publicação aprovada. Corrigir o ERP/XML evita divergências também nos outros canais da loja.

A seção **Descoberta e decisões por equipamento** separa descoberto/aguardando, presença confirmada, inclusão autorizada, publicado, não incluir e preciso conferir. A resposta liga chave da revisão, ID da unidade e item. Autorizar exige atestes separados de presença e mercado brasileiro, referência da confirmação e nome/descrição exatos. A rota autenticada `/api/equipment/research/decisions` enfileira somente `decide` no CLI e usa sua trava de histórico. Não aplica registro nem publica. Aprovar uma revisão geral do veículo continua sem aprovar qualquer equipamento.

Fontes, classificação, comparação XML/API/ficha pública e bloqueios permanecem visíveis. A ficha pública só recebe presença/ausência quando existe observação renderizada compatível. A descoberta mantém sua validade de 24 horas para observações públicas; um relatório semanal preservado não transforma observações antigas em atuais. Nenhum candidato vira presença porque a execução terminou com sucesso.

## Operação

No painel, usar **Executar agora**, pausar/retomar a agenda, filtrar pendências e registrar pareceres. Falhas e a última execução ficam visíveis. Uma rodada idêntica não apaga pareceres. Ao iniciar depois das 09:00, o painel pode repor a execução perdida naquele dia; a tentativa do dia é persistida para não criar um loop a cada reinício. Após falha, verificar o motivo e usar a execução manual ou aguardar a próxima rodada diária.

A agenda anterior foi conferida em 05/10/2026: 07h de São Paulo. Esta alteração
substitui o horário por 09h na mesma rotina; a instalação exige a verificação
do painel após a publicação autorizada. A rotina
detecta o que a API apresenta na execução; não recebe um evento a cada XML e
não entrega notificações push. Com a rotina saudável, a fila reflete uma
alteração disponível na API na rodada diária seguinte, ou numa execução
manual. Não depende de agenda no Mac nem de uma automação do Codex.

Padrão: agenda habilitada em produção e desabilitada no desenvolvimento. `EQUIPMENT_CRON_ENABLED` permite definir o padrão; a escolha salva no painel prevalece. **Preparar o código localmente não ativa a VPS**: a atualização do painel precisa ser publicada e seu container reiniciado pelo workflow autorizado. Isso não exige nem autoriza publicar alterações pendentes do site.

Execução manual no checkout com dependências instaladas:

```sh
npm run stock:audit-equipment

# Mesmo job da VPS: auditoria, descoberta e verificação da agenda semanal:
node scripts/run-equipment-daily.mjs --state-dir "$PWD/.devops/equipment" --input "$PWD/docs/equipment-research-library.json"

# Execução manual com nova conferência pública, sem esperar segunda-feira:
node scripts/run-equipment-daily.mjs --state-dir "$PWD/.devops/equipment" --input "$PWD/docs/equipment-research-library.json" --force-public
```

Não usar `weekly` ou `deploy:local` para auditar: esses comandos publicam o site. O auditor não roda `npm ci` automaticamente; se as dependências do checkout estiverem ausentes, corrigir a instalação e executar novamente.

## Estado e falhas

Estado privado em `.devops/equipment/`, ignorado pelo Git, dentro do volume persistente `/workspace` da VPS. Diretório 700; arquivos 600; escrita atômica. `report.json` contém o último estoque auditado com sucesso. Pareceres, configuração da agenda e situação dos jobs ficam separados, para uma nova coleta não sobrescrever decisões do painel.

`public-check-state.json` guarda a tentativa e a agenda semanal;
`public-check-report.json`, a última conferência completa;
`public-check-partial.json`, uma tentativa parcial, quando houver. Esses arquivos
não substituem `reviews.json` nem `research-review.json`. O painel projeta somente
datas, totais, identificação pública do carro e diferenças sanitizadas; não
expõe documentos brutos ou campos privados extras presentes em um arquivo.

Todos os pareceres correspondentes ao relatório atual são preservados. O histórico mantém até 1.000 revisões anteriores, priorizando as mais recentes, sujeito ao teto de 8 MiB; apenas revisões antigas são descartadas para respeitar esse limite.

Falha de rede, resposta parcial, IDs repetidos, equipamentos inválidos ou estoque ativo vazio **não substituem o relatório anterior nem dão baixa nas pendências**. O auditor usa uma trava própria contra processos simultâneos; uma trava desconhecida/malformada deve ser investigada, não apagada indiscriminadamente. O painel também impede que cron e execução manual enfileirem duas auditorias simultâneas.

As etapas conservam seus últimos resultados válidos separadamente. Se a auditoria termina e a descoberta falha, o job falha, o relatório de auditoria válido permanece e a pesquisa anterior conserva sua data original. Se a conferência pública falha, os retratos da auditoria e da descoberta já concluídos permanecem válidos, e o último relatório público completo é preservado. O painel exibe essas datas e a falha; o retrato antigo não é apresentado como pesquisa atual. Decisões por item também não correm simultaneamente com o job de auditoria/descoberta/conferência.

Somente no subprocesso do auditor, a tentativa de conexão por família de rede tem um piso de 2 segundos, evitando descartes prematuros do Node em redes IPv4/IPv6. O timeout total de 20 segundos por consulta, as três tentativas e a validação HTTPS permanecem. Falhas registram apenas categorias/códigos seguros, nunca o corpo da API ou credenciais.

O volume precisa ser incluído no backup da VPS. Recriar o container preserva o estado; excluir a pasta ou o checkout sem backup perde os pareceres. Arquivos de estado não vão para `public/`, Git ou hospedagem pública. O acesso depende da autenticação já existente do DevOps; o painel ainda usa HTTP e deve ficar restrito à rede confiável até uma migração de TLS aprovada.

## SEO e limites

A auditoria não regenera nem envia o manifesto de equipamentos SEO: isso continua pertencendo ao build/deploy aprovado. Assim, o cron não publica silenciosamente conteúdo. Relatórios i-CHECK e frontend continuam usando o resolver compartilhado. Uma fonte oficial precisa dizer que o item é de série para a versão brasileira e ano-modelo exatos; um manual multiversões ou anúncio de outra loja não é prova suficiente.

A consulta atual aceita até 500 registros e exige que `total_results` corresponda à coleção recebida. Se a loja superar esse limite, a rotina falha de modo conservador até implementar paginação completa. Zero carros ativos também pede conferência antes de substituir a base anterior.

## Verificação antes de ativar

```sh
npm run stock:test-equipment
npm run stock:test-equipment-audit
npm run lint
npm run build
npm --prefix devops test
node --test devops/client/src/equipment.test.js
npm --prefix devops run build
```

Depois da publicação autorizada do painel: conferir agenda/horário, executar uma auditoria, esperar o job terminar, abrir o relatório e confirmar que uma segunda execução idêntica preserva os pareceres. Não confundir sucesso de CI com cron instalado ou job executado na VPS.

Esta implantação usa o workflow **Deploy DevOps panel** com a publicação do site
desabilitada. Depois do rebuild da imagem, confirmar o commit pelo painel e
executar `POST /api/equipment/run` com `{}` para a primeira conferência real.
Conferir no resultado a próxima segunda às 09h de Brasília e a cobertura de
todas as fichas. Reexecutar manualmente é permitido e preserva decisões; a
execução agendada normal respeita a semana já processada.
