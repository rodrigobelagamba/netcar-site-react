# 🚗 API Netcar - Documentação Rápida

## Status: ✅ FUNCIONANDO

A API Netcar está **funcionando perfeitamente**.

## 🚀 Uso Rápido

### Buscar todos os veículos
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos.php
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos
```

### Buscar por montadora
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?montadora=FORD
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos/montadora/FORD
```

### Buscar por modelo
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?modelo=KA
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos/modelo/KA
```

### Buscar por câmbio
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?cambio=AUTOMATICO
```

### Buscar por combustível
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?combustivel=Flex
```

### Buscar por motor
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?motor=1.6
```

### Buscar por cor
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?cor=BRANCA
```

### Buscar por opcional (tag)
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?opcional=ar_condicionado
```

### Buscar por múltiplos opcionais
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?opcionais=ar_condicionado,alarme,air_bag
```

### Listar opcionais disponíveis
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?action=opcionais
```

### Paginação
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/veiculos?limit=20&offset=40
```

## 📊 API Stock

### Listar marcas disponíveis
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/stock.php?action=enterprises
```

### Listar modelos por marca
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/stock.php?action=cars_by_brand&brand=FORD
```

### Listar anos disponíveis
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/stock.php?action=years
```

## 💬 API Depoimentos

### Listar todos os depoimentos
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/depoimentos.php?action=list
```

### Buscar depoimento específico
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/depoimentos.php?action=single&id=1
```

## 🏢 API Site

### Informações básicas do site
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/site.php?action=info
```

### Buscar banners
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/site.php?action=banners
```

### Buscar banners da Loja 1
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/site.php?action=loja1
```

### Buscar banners da Loja 2
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/site.php?action=loja2
```

### Buscar telefone da loja
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/site.php?action=phone&loja=Loja1
```

## ℹ️ API Info

API dedicada para consultar dados da tabela `info` com suporte a filtros por tipo, título e local.

### Listar todos os itens
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/info.php
```

### Filtrar por tipo
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/info.php?tipo=Texto
```

### Filtrar por título
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/info.php?titulo=Desenvolvemos
```

### Filtrar por local
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/info.php?local=Empresa
```

### Filtrar combinado
```bash
GET https://www.netcarmultimarcas.com.br/api/v1/info.php?tipo=Texto&local=Empresa&titulo=Desenvolvemos
```

### Formato da Resposta - API Info

```json
{
  "success": true,
  "message": "Dados da tabela info obtidos com sucesso",
  "data": [
    {
      "id_info": 1,
      "tipo": "Texto",
      "titulo": "Desenvolvemos",
      "texto": "Conteúdo do texto...",
      "local": "Empresa",
      "ordem": 1
    }
  ],
  "total_results": 5,
  "filters": {
    "tipo": "Texto",
    "titulo": "",
    "local": "Empresa"
  },
  "timestamp": "2025-01-XX XX:XX:XX"
}
```

## 🌐 URLs Amigáveis

- **API Veículos:** `/api/v1/veiculos` (recomendado) ou `/api/v1/veiculos.php`
- **API Stock:** `/api/v1/stock` ou `/api/v1/stock.php`
- **API Depoimentos:** `/api/v1/depoimentos` ou `/api/v1/depoimentos.php`
- **API Site:** `/api/v1/site` ou `/api/v1/site.php`
- **API Info:** `/api/v1/info.php`
- **API com Parâmetros no Path:** `/api/v1/veiculos/montadora/FIAT/valor_min/100000/ano_min/2015`
- **Documentação:** `/api/v1/docs`
- **README:** `/api/v1/readme`
- **Changelog:** `/api/v1/changelog`
- **Página de Entrada:** `/api/`

### 📝 Formato de URL com Parâmetros no Path

```
/api/v1/veiculos/parametro/valor/parametro2/valor2
```

**Exemplos:**
- `/api/v1/veiculos/montadora/FIAT`
- `/api/v1/veiculos/montadora/FIAT/valor_min/100000`
- `/api/v1/veiculos/montadora/FIAT/valor_min/100000/ano_min/2015`
- `/api/v1/veiculos/montadora/VOLKSWAGEN/modelo/GOL/ano_min/2018/ano_max/2022`

## 📋 Parâmetros Disponíveis

| Parâmetro | Tipo | Status | Descrição |
|-----------|------|--------|-----------|
| `montadora` | String | ✅ | Fabricante (FORD, CHEVROLET, etc.) |
| `modelo` | String | ✅ | Modelo (KA, GOL, etc.) |
| `cambio` | String | ✅ | Câmbio (MANUAL, AUTOMATICO) |
| `combustivel` | String | ✅ | Combustível (Flex, Gasolina, etc.) |
| `motor` | String | ✅ | Motor (1.0, 1.6, 2.0, etc.) |
| `cor` | String | ✅ | Cor (BRANCA, PRETA, PRATA, etc.) |
| `limit` | Integer | ✅ | Máximo de resultados (padrão: 50) |
| `offset` | Integer | ✅ | Registros para pular (padrão: 0) |
| `ano_min` | Integer | ✅ | Ano mínimo |
| `ano_max` | Integer | ✅ | Ano máximo |
| `valor_min` | Integer | ✅ | Valor mínimo |
| `valor_max` | Integer | ✅ | Valor máximo |
| `opcional` | String | ✅ | Tag de um único opcional (ex: ar_condicionado) |
| `opcionais` | String | ✅ | Múltiplas tags separadas por vírgula (ex: ar_condicionado,alarme) |
| `id` | Integer | ✅ | ID do veículo para busca específica |

### 📋 Parâmetros API Info

| Parâmetro | Tipo | Status | Descrição |
|-----------|------|--------|-----------|
| `tipo` | String | ✅ | Tipo do item na tabela info |
| `titulo` | String | ✅ | Título do item na tabela info |
| `local` | String | ✅ | Local do item na tabela info |

## 📤 Formato da Resposta

```json
{
  "success": true,
  "message": "Veículos encontrados com sucesso",
  "filters_applied": { ... },
  "total_results": 50,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": "12345",
      "marca": "FORD",
      "modelo": "KA",
      "ano": 2018,
      "valor": 45000.00,
      "valor_formatado": "<span>R$</span> 45.000,00",
      "cor": "BRANCA",
      "motor": "1.0",
      "combustivel": "Flex",
      "cambio": "MANUAL",
      "potencia": 85,
      "km": 45000,
      "placa": "ABC1234",
      "link": "detalhe-produto-ka-2018-ABC-xx34-branca.html",
      "pdf": "CheckAuto_ABC1234_1506.pdf",
      "pdf_url": "arquivos/autocheck/CheckAuto_ABC1234_1506.pdf",
      "imagens": {
        "thumb": [ "..." ],
        "full": [ "..." ]
      },
      "opcionais": [
        {
          "tag": "ar_condicionado",
          "descricao": "Ar Condicionado"
        }
      ]
    }
  ],
  "timestamp": "2025-09-19 17:58:55"
}
```

## ⚠️ Importante

- **Filtros são case-sensitive**: Use `FORD` não `ford`
- **Busca exata**: `montadora=FORD` busca exatamente "FORD"
- **Filtros numéricos**: Funcionam com faixas de valores e anos
- **Todos os filtros**: Estão funcionando perfeitamente
- **API Info**: Filtros podem ser usados individualmente ou combinados
- **Opcionais**: Use o endpoint `action=opcionais` para ver todas as tags disponíveis

## 🔧 Testando a API

### JavaScript
```javascript
fetch('https://www.netcarmultimarcas.com.br/api/v1/veiculos?montadora=FORD')
  .then(response => response.json())
  .then(data => console.log(data));
```

### PHP
```php
$response = file_get_contents('https://www.netcarmultimarcas.com.br/api/v1/veiculos?montadora=FORD');
$data = json_decode($response, true);
print_r($data);
```

### Python
```python
import requests
response = requests.get('https://www.netcarmultimarcas.com.br/api/v1/veiculos?montadora=FORD')
data = response.json()
print(data)
```

## 📊 Status

- **Status**: ✅ Funcionando

## 🆘 Suporte

Se encontrar algum problema:

1. Verifique se está usando os parâmetros corretos
2. Confirme que os valores são case-sensitive
3. Teste primeiro sem filtros: `tempapi.php`
4. Use paginação para navegar por todos os veículos

## 📮 Collection Postman

Para facilitar os testes da API, disponibilizamos uma collection completa do Postman:

- **📦 Pacote Completo**: [Netcar_API_Postman_Files.zip](Netcar_API_Postman_Files.zip) - Baixe todos os arquivos de uma vez
- **Collection**: [Netcar_API_Collection.postman_collection.json](Netcar_API_Collection.postman_collection.json)
- **Environment**: [Netcar_API_Environment.postman_environment.json](Netcar_API_Environment.postman_environment.json)
- **Instruções**: [README_Postman.md](README_Postman.md)

A collection inclui todos os endpoints organizados por categoria, com exemplos de requisições e variáveis configuradas.

## 📚 Documentação Completa

- [Documentação HTML Completa](api-documentation.html)
- [Changelog](API_CHANGELOG.md)
- [Instruções Postman](README_Postman.md)

---

**Última atualização**: Janeiro de 2025
