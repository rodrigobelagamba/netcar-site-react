# 🔧 Configuração de Variáveis de Ambiente

Este projeto usa variáveis de ambiente para configurar a URL da API e outros parâmetros.

## 📁 Arquivos de Ambiente

- `.env.example` - Template de exemplo (commitado no repositório)
- `.env.development` - Configuração para desenvolvimento (commitado no repositório)
- `.env.production` - Configuração para produção (commitado no repositório)

## 🚀 Como Configurar

### Desenvolvimento

O arquivo `.env.development` já está configurado com a URL de produção. Se você tiver um servidor local, edite o arquivo:

```bash
# .env.development
VITE_API_BASE_URL=http://localhost/netcar/api/v1
```

### Produção

O arquivo `.env.production` já está configurado corretamente para produção.

## 📝 Variáveis Disponíveis

### `VITE_API_BASE_URL`

URL base da API Netcar. 

**Valores padrão:**
- Desenvolvimento: `https://www.netcarmultimarcas.com.br/api/v1`
- Produção: `https://www.netcarmultimarcas.com.br/api/v1`

**Exemplo para ambiente local:**
```env
VITE_API_BASE_URL=http://localhost/netcar/api/v1
```

### `VITE_API_TIMEOUT`

Timeout das requisições em milissegundos.

**Valor padrão:** `30000` (30 segundos)

## 🔄 Como Funciona

O Vite carrega automaticamente os arquivos de ambiente baseado no modo:

- `npm run dev` → Carrega `.env.development`
- `npm run build` → Carrega `.env.production`

## ⚠️ Importante

1. **Nunca commite** arquivos `.env.local` ou `.env.*.local` (já estão no .gitignore)
2. Os arquivos `.env.development` e `.env.production` estão commitados com valores padrão
3. Se precisar de valores diferentes localmente, crie um arquivo `.env.local` que será ignorado pelo git

## 🔄 Valores Padrão (Fallback)

**Se não houver arquivos `.env`**, o sistema usará os seguintes valores padrão:

- **`VITE_API_BASE_URL`**: `https://www.netcarmultimarcas.com.br/api/v1`
- **`VITE_API_TIMEOUT`**: `30000` (30 segundos)

Isso significa que mesmo sem arquivos de ambiente, a aplicação funcionará normalmente apontando para produção.

Veja mais detalhes em [FALLBACK_VALUES.md](api/FALLBACK_VALUES.md).

## 🛠️ Criando Arquivo Local

Se você precisar sobrescrever as configurações localmente sem afetar o repositório:

```bash
# Criar .env.local (não será commitado)
cp .env.example .env.local

# Editar com suas configurações locais
# .env.local
VITE_API_BASE_URL=http://localhost/netcar/api/v1
```

O arquivo `.env.local` tem prioridade sobre `.env.development` e `.env.production`.

## 📚 Documentação

Para mais informações sobre variáveis de ambiente no Vite:
- [Vite - Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

