# Netcar DevOps — painel de deploys

Painel web para listar commits versionados em `dist/`, disparar `deploy:dist` / `deploy:local` e rodar scripts npm allowlisted do monorepo.

## Dev local

```bash
cd devops
cp .env.example .env
# edite DEVOPS_TOKEN e confirme WORKSPACE_ROOT=..
npm install
npm run dev
```

- API: http://127.0.0.1:3090  
- UI (Vite): http://127.0.0.1:5174 (proxy `/api` → 3090)

Abra a UI, cole o mesmo `DEVOPS_TOKEN` do `.env`.

Produção local (API + UI buildada):

```bash
npm run build && npm start
```

## Secrets (VPS)

Nada de `.env.production` / `social-config` / chaves entra na image ou no Git.

Crie na VPS:

```text
/opt/netcar-secrets/
  devops.env          # DEVOPS_TOKEN=...  PORT=3090
  .env.local          # DEPLOY_METHOD=ssh, SSH_USER, ...
  .env.production     # VITE_*
  social-config.php   # docs/social
  id_ed25519          # chave privada SSH (chmod 600 no host)
```

No `.env.local` da VPS, use caminho de chave **dentro do container**:

```env
DEPLOY_METHOD=ssh
SSH_USER=netcarmultimarcas
SSH_DIR=www/
SSH_HOST=netcarmultimarcas.com.br
# opcional — o entrypoint copia a chave montada para /root/.ssh/id_netcar
# SSH_KEY_PATH=/root/.ssh/id_netcar
```

Clone do site (exemplo):

```bash
sudo mkdir -p /opt/netcar-site-react /opt/netcar-secrets
sudo git clone git@github.com:ORG/site-react.git /opt/netcar-site-react
# copie os arquivos secretos para /opt/netcar-secrets/
```

## Docker na VPS

```bash
cd /opt/netcar-site-react/devops
export SITE_REPO_PATH=/opt/netcar-site-react
export SECRETS_DIR=/opt/netcar-secrets
export DEVOPS_ENV_FILE=/opt/netcar-secrets/devops.env
docker compose up -d --build
```

Painel: `http://VPS:3090` (proteja com firewall / reverse proxy).

## CI

Workflow [`.github/workflows/devops-deploy.yml`](../.github/workflows/devops-deploy.yml) roda em **qualquer push** em `main`/`master` (ou `workflow_dispatch`):
- atualiza o clone na VPS (`git fetch` + `reset --hard`);
- só reconstrói o container do painel se `devops/` (ou o próprio workflow) mudou;
- **não** publica o site na KingHost.

Secrets no GitHub:

| Secret | Descrição |
|--------|-----------|
| `DEVOPS_VPS_HOST` | IP/hostname da VPS |
| `DEVOPS_VPS_USER` | usuário SSH |
| `DEVOPS_VPS_SSH_KEY` | chave privada para a Action entrar na VPS |
| `DEVOPS_SITE_REPO_PATH` | opcional, default `/opt/netcar-site-react` |
| `DEVOPS_SECRETS_DIR` | opcional, default `/opt/netcar-secrets` |

O CI **não** envia `.env.production` nem `social-config` — eles já devem existir na VPS.

## API (resumo)

Todas as rotas `/api/*` (exceto `/api/health`) exigem `Authorization: Bearer <DEVOPS_TOKEN>`.

- `GET /api/status` — repo, HEAD de dist, presença de secrets
- `GET /api/dist/commits` — histórico de builds
- `POST /api/deploy/dist` — body `{ "hash": "abc123" }` opcional
- `POST /api/deploy/local` — build + deploy
- `GET /api/npm/scripts` / `POST /api/npm/run`
- `GET /api/jobs/:id` / `GET /api/jobs/:id/stream` (SSE)

Jobs rodam em fila serial (um por vez).
