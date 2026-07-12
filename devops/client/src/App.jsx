import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  streamJob,
} from './api.js';

function Login({ onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.status(token.trim());
      setStoredToken(token.trim());
      onLogin(token.trim());
    } catch (err) {
      setError(err.status === 401 ? 'Token inválido' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="gate" onSubmit={handleSubmit}>
      <p className="brand">Netcar</p>
      <h1>DevOps</h1>
      <p>Entre com o Bearer token configurado em DEVOPS_TOKEN.</p>
      {error ? <div className="error-banner">{error}</div> : null}
      <label>
        Token
        <input
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={loading || !token.trim()}>
        {loading ? 'Validando…' : 'Entrar'}
      </button>
    </form>
  );
}

function SecretPills({ secrets }) {
  if (!secrets) return null;
  const items = [
    ['envLocal', '.env.local'],
    ['envProduction', '.env.production'],
    ['socialConfig', 'social-config'],
  ];
  return (
    <>
      {items.map(([key, label]) => (
        <span key={key} className={`pill ${secrets[key] ? 'ok' : 'bad'}`}>
          {label} {secrets[key] ? 'ok' : 'ausente'}
        </span>
      ))}
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [status, setStatus] = useState(null);
  const [commits, setCommits] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [log, setLog] = useState('');
  const logRef = useRef(null);
  const stopStreamRef = useRef(null);

  const refresh = useCallback(async (authToken) => {
    const [st, dist, npm] = await Promise.all([
      api.status(authToken),
      api.distCommits(authToken, 40),
      api.npmScripts(authToken),
    ]);
    setStatus(st);
    setCommits(dist.commits || []);
    setScripts(npm.allowed || []);
    setSelectedScript((prev) => prev || npm.allowed?.[0] || '');
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await refresh(token);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          clearStoredToken();
          setToken('');
        } else {
          setError(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    return () => stopStreamRef.current?.();
  }, []);

  function attachJob(job) {
    stopStreamRef.current?.();
    setActiveJob(job);
    setLog(job.log || '');
    setBusy(true);

    stopStreamRef.current = streamJob(token, job.id, {
      onLog: (chunk) => setLog((prev) => prev + chunk),
      onStatus: (s) => setActiveJob((prev) => (prev ? { ...prev, ...s } : prev)),
      onDone: (s) => {
        setActiveJob((prev) => (prev ? { ...prev, ...s } : prev));
        setBusy(false);
        refresh(token).catch(() => {});
      },
      onError: (err) => {
        setError(err.message);
        setBusy(false);
      },
    });
  }

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      const result = await action();
      attachJob(result.job);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function logout() {
    stopStreamRef.current?.();
    clearStoredToken();
    setToken('');
    setStatus(null);
    setLog('');
    setActiveJob(null);
  }

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  const repo = status?.repo;
  const distHead = status?.dist?.head;

  return (
    <div className="app">
      <header className="hero">
        <div className="row" style={{ width: '100%' }}>
          <p className="brand">Netcar DevOps</p>
          <button type="button" className="btn btn-ghost logout" onClick={logout}>
            Sair
          </button>
        </div>
        <h1>Deploys</h1>
        <p>
          Gerencie versões versionadas em <code>dist/</code> e rode scripts npm do site sem
          rebuildar o painel.
        </p>
        <div className="meta">
          {repo ? (
            <>
              <span>
                repo <strong>{repo.branch}</strong> @ <strong>{repo.shortHash}</strong>
                {repo.dirty ? ' (dirty)' : ''}
              </span>
              <span title={repo.subject}>{repo.subject}</span>
            </>
          ) : (
            <span>Carregando status…</span>
          )}
          {distHead ? (
            <span>
              dist HEAD <strong>{distHead.shortHash}</strong>
            </span>
          ) : null}
          <SecretPills secrets={status?.secrets} />
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-main">
        <section className="panel">
          <h2>Versões em dist/</h2>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !status?.dist?.available}
              onClick={() => run(() => api.deployDist(token))}
            >
              Deploy último (HEAD)
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Rodar build completo + deploy (npm run deploy:local)? Pode demorar vários minutos.'
                  )
                ) {
                  run(() => api.deployLocal(token));
                }
              }}
            >
              Build + deploy completo
            </button>
          </div>

          {!status?.dist?.available ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              {status?.dist?.error || 'Histórico de dist/ indisponível. Rode um deploy:local antes.'}
            </p>
          ) : (
            <ul className="commit-list">
              {commits.map((c) => (
                <li key={c.fullHash}>
                  <div>
                    <div className="commit-hash">{c.shortHash}</div>
                    <p className="commit-subject">{c.subject}</p>
                    <p className="commit-date">{c.date}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => run(() => api.deployDist(token, c.shortHash))}
                  >
                    Deploy
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid">
          <section className="panel">
            <h2>npm scripts</h2>
            <div className="row">
              <select
                value={selectedScript}
                onChange={(e) => setSelectedScript(e.target.value)}
                disabled={busy}
              >
                {scripts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !selectedScript}
                onClick={() => run(() => api.npmRun(token, selectedScript))}
              >
                Run
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Log do job</h2>
            <div className="meta" style={{ marginBottom: '0.75rem' }}>
              {activeJob ? (
                <>
                  <span className={`pill ${activeJob.status === 'succeeded' ? 'ok' : activeJob.status === 'failed' ? 'bad' : ''}`}>
                    {activeJob.status}
                  </span>
                  <span>{activeJob.label || activeJob.command}</span>
                </>
              ) : (
                <span>Nenhum job ativo</span>
              )}
            </div>
            <pre className="log" ref={logRef}>
              {log || <span className="log-empty">Saída dos deploys e scripts aparece aqui.</span>}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
