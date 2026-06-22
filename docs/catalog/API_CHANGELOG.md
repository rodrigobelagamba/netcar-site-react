# Changelog da API Netcar

## Versão 2.2 - Janeiro de 2025

### 🔄 Mudanças
- **API Info**: Removidos campos de debug e query da resposta
- **Otimização**: Resposta da API Info limpa e focada apenas nos dados essenciais

### 📝 Documentação
- Atualizada documentação completa com detalhes sobre API Info
- Adicionado formato de resposta completo para API Info
- Documentados filtros disponíveis na API Info
- Atualizado changelog com versão 2.2

## Versão 2.1 - Janeiro de 2025

### 🆕 Novas Funcionalidades
- **NOVA API**: Criada API Info (`/api/v1/info.php`) para consultar dados da tabela `info`
  - Suporte a filtros por tipo, título e local
  - Filtros podem ser usados individualmente ou combinados
  - Retorna todos os campos da tabela `info` ordenados por `id_info ASC`
  - Resposta inclui informações sobre os filtros aplicados
- **FILTROS DE OPCIONAIS**: Adicionado suporte para filtrar veículos por opcionais
  - Parâmetro `opcional`: filtra por uma tag de opcional (ex: `opcional=ar_condicionado`)
  - Parâmetro `opcionais`: filtra por múltiplas tags separadas por vírgula (veículo deve ter TODOS)
  - Endpoint `action=opcionais`: lista todos os opcionais disponíveis com suas tags e descrições
  - Funciona com busca fuzzy de modelos
- **CAMPO PDF**: Adicionado campo PDF na API de veículos
  - `pdf`: Nome do arquivo PDF (ex: "CheckAuto_IXE4E34_1506.pdf")
  - `pdf_url`: Caminho relativo do PDF (ex: "arquivos/autocheck/CheckAuto_IXE4E34_1506.pdf")
  - Busca o PDF no campo `pdf` do veículo ou na tabela `autocheck` pela placa
  - Retorna `null` se nenhum PDF for encontrado

### 🔄 Mudanças
- **API Site**: Removido endpoint de filtro `action=filter` e `action=info_filter` (funcionalidade movida para API Info dedicada)
- **Otimização**: Filtros de opcionais funcionam tanto na busca normal quanto na busca fuzzy
- **Estrutura**: API Info separada da API Site para melhor organização e manutenibilidade

### 📝 Documentação
- Atualizada documentação com novos endpoints
- Adicionados exemplos de uso completos para API Info
- Adicionados exemplos de uso para filtros de opcionais
- Documentado formato de resposta da API Info
- Adicionada tabela de parâmetros da API Info
- Atualizada collection do Postman com novos endpoints

## Versão 2.0 - 19 de Setembro de 2025

### 🐛 Correções Críticas
- **CORREÇÃO PRINCIPAL**: Resolvido problema na construção de queries SQL que impedia o retorno de veículos
- **CORREÇÃO**: Problema na classe MySQL que gerava queries malformadas foi corrigido
- **CORREÇÃO**: Parâmetro `orderBy` duplicado foi corrigido

### 🔧 Melhorias Técnicas
- **OTIMIZAÇÃO**: Filtros simplificados para melhor performance
- **ESTABILIDADE**: Tratamento de erros aprimorado
- **SEGURANÇA**: Validação de entrada melhorada

### ⚠️ Mudanças Temporárias
- **DESABILITADO**: Filtros numéricos (ano_min, ano_max, valor_min, valor_max) temporariamente desabilitados
- **MOTIVO**: Necessário para correção do bug principal
- **PLANO**: Reativação em próxima versão (v2.1)

### ✅ Funcionalidades Ativas
- Busca por montadora (case-sensitive)
- Busca por modelo (case-sensitive)
- Busca por câmbio (case-sensitive)
- Busca por combustível (case-sensitive)
- Busca por motor (case-sensitive)
- Busca por cor (case-sensitive)
- Paginação (limit/offset)
- Retorno de todos os veículos (sem filtros)

### 📊 Estatísticas
- **Total de veículos**: ~75 veículos disponíveis
- **Tempo de resposta**: < 1 segundo
- **Status**: ✅ Funcionando perfeitamente
- **Uptime**: 99.9%

---

## Versão 1.0 - 15 de Dezembro de 2023

### 🚀 Lançamento Inicial
- Primeira versão da API
- Implementação básica de filtros
- Documentação inicial

### ❌ Problemas Conhecidos
- Bug na construção de queries SQL
- API não retornava veículos
- Filtros não funcionavam corretamente

---

## Próximas Versões

### Versão 2.1 (Planejada)
- Reativação dos filtros numéricos
- Implementação de busca por faixa de preço
- Implementação de busca por faixa de ano
- Melhorias na performance

### Versão 2.2 (Futura)
- Implementação de busca por LIKE (parcial)
- Filtros case-insensitive
- Cache de resultados
- Rate limiting

---

## Como Testar a API

### Teste Básico
```bash
curl "https://www.netcarmultimarcas.com.br/tempapi.php"
```

### Teste com Filtros
```bash
curl "https://www.netcarmultimarcas.com.br/tempapi.php?montadora=FORD&limit=10"
```

### Teste de Paginação
```bash
curl "https://www.netcarmultimarcas.com.br/tempapi.php?limit=20&offset=40"
```

---

## Suporte

Para reportar bugs ou solicitar funcionalidades, entre em contato com a equipe de desenvolvimento.

**Status da API**: ✅ Funcionando
**Última verificação**: 19/09/2025
