const TOKEN_KEY = 'netcar-devops-token';

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  health: () => request('/api/health'),
  status: (token) => request('/api/status', { token }),
  distCommits: (token, limit = 30) => request(`/api/dist/commits?limit=${limit}`, { token }),
  deployDist: (token, hash) =>
    request('/api/deploy/dist', { method: 'POST', token, body: hash ? { hash } : {} }),
  deployLocal: (token) => request('/api/deploy/local', { method: 'POST', token, body: {} }),
  npmScripts: (token) => request('/api/npm/scripts', { token }),
  npmRun: (token, script) =>
    request('/api/npm/run', { method: 'POST', token, body: { script } }),
  job: (token, id) => request(`/api/jobs/${id}`, { token }),
};

export function streamJob(token, id, { onLog, onStatus, onDone, onError }) {
  // EventSource cannot set Authorization header — use fetch stream
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`/api/jobs/${id}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`stream HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === 'log') onLog?.(parsed.chunk || '');
          if (event === 'status') onStatus?.(parsed);
          if (event === 'done') onDone?.(parsed);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err);
    }
  })();

  return () => controller.abort();
}
