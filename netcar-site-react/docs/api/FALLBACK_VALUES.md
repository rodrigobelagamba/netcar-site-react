# 🔧 Valores Padrão (Fallback)

Este documento descreve os valores que serão assumidos quando **não houver arquivos `.env`** ou quando as variáveis de ambiente não estiverem definidas.

## 📋 Valores Padrão

### `VITE_API_BASE_URL`

**Valor padrão:** `https://www.netcarmultimarcas.com.br/api/v1`

**Quando é usado:**
- Quando não existe arquivo `.env.development` ou `.env.production`
- Quando a variável `VITE_API_BASE_URL` não está definida nos arquivos `.env`
- Quando a variável está vazia ou com valor inválido

**Comportamento:**
- O sistema mostrará um aviso no console: `⚠️ VITE_API_BASE_URL não definida. Usando valor padrão: ...`
- A aplicação continuará funcionando normalmente usando a URL de produção

### `VITE_API_TIMEOUT`

**Valor padrão:** `30000` (30 segundos)

**Quando é usado:**
- Quando não existe arquivo `.env.development` ou `.env.production`
- Quando a variável `VITE_API_TIMEOUT` não está definida nos arquivos `.env`
- Quando a variável está vazia ou com valor inválido (não numérico)

**Comportamento:**
- O sistema usará 30 segundos como timeout padrão para todas as requisições
- Não há aviso no console para este valor

## 🔍 Como Funciona

O código em `src/api/config.ts` usa o operador `||` (OR lógico) para definir valores padrão:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || DEFAULT_API_TIMEOUT;
```

Isso significa:
1. **Primeiro**, tenta usar o valor da variável de ambiente
2. **Se não existir ou for falsy**, usa o valor padrão

## 📊 Tabela de Valores

| Variável | Valor Padrão | Tipo | Descrição |
|----------|--------------|------|-----------|
| `VITE_API_BASE_URL` | `https://www.netcarmultimarcas.com.br/api/v1` | String | URL base da API Netcar |
| `VITE_API_TIMEOUT` | `30000` | Number | Timeout em milissegundos (30s) |

## ⚠️ Importante

- Os valores padrão são **sempre de produção**
- Se você estiver desenvolvendo localmente, **é recomendado** criar os arquivos `.env.development` e `.env.production`
- Sem os arquivos `.env`, a aplicação funcionará normalmente, mas sempre apontará para produção

## 🧪 Testando Valores Padrão

Para testar se os valores padrão estão funcionando:

1. **Remova temporariamente** os arquivos `.env.development` e `.env.production`
2. **Execute** `npm run dev`
3. **Verifique** o console do navegador - você verá o aviso sobre `VITE_API_BASE_URL`
4. **Confirme** que as requisições estão sendo feitas para `https://www.netcarmultimarcas.com.br/api/v1`

## 📝 Exemplo de Uso

```typescript
// src/api/config.ts
import { config } from '@/api';

// Sem arquivos .env, config terá:
console.log(config.apiBaseUrl); 
// → "https://www.netcarmultimarcas.com.br/api/v1"

console.log(config.apiTimeout); 
// → 30000
```

