# 📮 Netcar API - Collection Postman

Esta pasta contém os arquivos necessários para importar e usar a API Netcar no Postman.

## 📁 Arquivos Disponíveis

### 1. **Netcar_API_Collection.postman_collection.json**
- Collection completa com todos os endpoints da API
- Organizada por categorias (Veículos, Stock, Depoimentos, Site)
- Inclui exemplos de requisições com parâmetros

### 2. **Netcar_API_Environment.postman_environment.json**
- Ambiente configurado com variáveis úteis
- URLs base para produção e desenvolvimento local
- Valores de exemplo para testes

## 🚀 Como Importar

### Passo 1: Importar a Collection
1. Abra o Postman
2. Clique em **Import** (botão no canto superior esquerdo)
3. Selecione o arquivo `Netcar_API_Collection.postman_collection.json`
4. Clique em **Import**

### Passo 2: Importar o Environment
1. No Postman, clique no ícone de **engrenagem** (⚙️) no canto superior direito
2. Clique em **Import**
3. Selecione o arquivo `Netcar_API_Environment.postman_environment.json`
4. Clique em **Import**

### Passo 3: Selecionar o Environment
1. No canto superior direito, clique no dropdown de environments
2. Selecione **"Netcar API Environment"**

## 🎯 Como Usar

### Variáveis Disponíveis
- `{{base_url}}` - URL base da API (produção)
- `{{base_url_local}}` - URL base para ambiente local
- `{{montadora_example}}` - Exemplo de montadora (FORD)
- `{{modelo_example}}` - Exemplo de modelo (KA)
- `{{valor_min_example}}` - Exemplo de valor mínimo (30000)
- `{{valor_max_example}}` - Exemplo de valor máximo (60000)
- `{{ano_min_example}}` - Exemplo de ano mínimo (2018)
- `{{ano_max_example}}` - Exemplo de ano máximo (2022)
- `{{limit_example}}` - Exemplo de limite (25)
- `{{offset_example}}` - Exemplo de offset (0)
- `{{depoimento_id_example}}` - Exemplo de ID de depoimento (1)
- `{{loja_example}}` - Exemplo de loja (Loja1)

### Exemplos de Uso

#### 🚗 API Veículos
```
GET {{base_url}}/api/v1/veiculos.php?montadora={{montadora_example}}
GET {{base_url}}/api/v1/veiculos/montadora/{{montadora_example}}
```

#### 📊 API Stock
```
GET {{base_url}}/api/v1/stock.php?action=enterprises
GET {{base_url}}/api/v1/stock.php?action=cars_by_brand&brand={{montadora_example}}
```

#### 💬 API Depoimentos
```
GET {{base_url}}/api/v1/depoimentos.php?action=list
GET {{base_url}}/api/v1/depoimentos.php?action=single&id={{depoimento_id_example}}
```

#### 🏢 API Site
```
GET {{base_url}}/api/v1/site.php?action=info
GET {{base_url}}/api/v1/site.php?action=phone&loja={{loja_example}}
```

#### ℹ️ API Info
```
GET {{base_url}}/api/v1/info.php
GET {{base_url}}/api/v1/info.php?tipo=Texto
GET {{base_url}}/api/v1/info.php?titulo=Desenvolvemos
GET {{base_url}}/api/v1/info.php?local=Empresa
```

#### 🔧 API Veículos - Opcionais
```
GET {{base_url}}/api/v1/veiculos.php?action=opcionais
GET {{base_url}}/api/v1/veiculos.php?opcional=ar_condicionado
GET {{base_url}}/api/v1/veiculos.php?opcionais=ar_condicionado,alarme
```

## 🔧 Configurações

### Para Ambiente Local
1. No environment, altere a variável `base_url` para:
   ```
   http://localhost/netcar
   ```

### Para Produção
1. Mantenha a variável `base_url` como:
   ```
   https://www.netcarmultimarcas.com.br
   ```

## 📋 Estrutura da Collection

### 🚗 API Veículos (13 endpoints)
- Listar Todos os Veículos
- Buscar por Montadora
- Buscar por Faixa de Preço
- Buscar por Faixa de Ano
- Busca Completa com Múltiplos Filtros
- Paginação
- URL Amigável - Montadora
- URL Amigável - Múltiplos Filtros
- Listar Opcionais
- Buscar por Opcional (Tag única)
- Buscar por Múltiplos Opcionais
- Buscar com Opcionais e Outros Filtros

### 📊 API Stock (11 endpoints)
- Listar Marcas (Enterprises)
- Listar Modelos
- Modelos por Marca
- Listar Anos
- Listar Cores
- Listar Motores
- Listar Combustíveis
- Listar Transmissões
- Listar Faixas de Preço
- Todos os Dados (All)
- Lista Padrão (JSON)

### 💬 API Depoimentos (6 endpoints)
- Listar Todos os Depoimentos
- Depoimento Específico
- Galeria de Depoimentos
- Depoimentos com Imagens
- Depoimentos (Método Depoiments)
- Paginação de Depoimentos

### 🏢 API Site (14 endpoints)
- Informações Gerais do Site
- Banners
- Banners Loja 1
- Banners Loja 2
- Notificações
- Subgaleria
- Telefone da Loja 1
- Telefone da Loja 2
- Endereço da Loja 1
- Endereço da Loja 2
- WhatsApp
- Horário de Atendimento
- Texto Sobre - Desenvolvemos
- Contadores - Experiência
- Notícias
- Vídeos - Home
- Verificação Mobile

### ℹ️ API Info (5 endpoints)
- Listar Todos os Itens
- Filtrar por Tipo
- Filtrar por Título
- Filtrar por Local
- Filtrar Combinado

## 🎨 Dicas de Uso

1. **Teste Individual**: Execute cada endpoint individualmente para entender as respostas
2. **Modifique Parâmetros**: Altere os valores das variáveis para testar diferentes cenários
3. **Use URLs Amigáveis**: Teste tanto as URLs com query parameters quanto as URLs amigáveis
4. **Verifique Respostas**: Analise a estrutura JSON das respostas para entender os dados
5. **Teste Paginação**: Use diferentes valores de `limit` e `offset` para testar paginação

## 📚 Documentação Completa

Para documentação completa da API, acesse:
- **HTML**: `api-documentation.html`
- **Markdown**: `README_API.md`
- **Changelog**: `API_CHANGELOG.md`

## 🔄 Atualizações

Esta collection será atualizada sempre que houver mudanças na API. Para receber as últimas versões:

1. Baixe os novos arquivos
2. Re-importe a collection no Postman
3. Substitua a collection existente

---

**Criado em**: 19 de setembro de 2025  
**Última atualização**: Janeiro de 2025  
**Versão**: 2.1  
**Compatível com**: Postman 8.0+
