import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost as login, onRequestDelete as logout } from '../functions/api/admin-session.js';
import { onRequestGet as results } from '../functions/api/results.js';
import { onRequestGet as curriculum } from '../functions/api/curriculum.js';
import { onRequestPost as submit } from '../functions/api/submit.js';
import { adminLink, createAdminSession, SESSION_COOKIE, SESSION_SECONDS } from '../lib/admin-auth.js';

const origin = 'https://questionario-perfil.pages.dev';
const key = 'credencial_ficticia_de_acesso_privado_' + 'x'.repeat(12);
const id = '11111111-2222-4333-8444-555555555555';
const record = { id, nome:'Pessoa de teste', timestamp:'2026-09-10T12:00:00Z', curriculo:{ name:'teste.pdf' } };
const bytes = new TextEncoder().encode('%PDF-1.4 teste local');
const env = { ADMIN_LINK_KEY:key, PERFIL_KV:{
    async list() { return { keys:[{name:'result:' + id}], list_complete:true }; },
    async get(name, options) {
        if (name === 'curriculum:' + id) return bytes.buffer;
        return options?.type === 'json' ? record : JSON.stringify(record);
    },
} };
const request = (method = 'POST', credential = key, from = origin) => new Request(origin + '/api/admin-session', {
    method, headers:{ Origin:from, Authorization:'Bearer ' + credential },
});
const apiRequest = (path, cookie = '') => new Request(origin + path, { headers:{Cookie:cookie} });

test('link privado cria sessão de 30 dias e permite lista, detalhe e currículo', async () => {
    const response = await login({ env, request:request() });
    assert.equal(response.status, 200);
    const header = response.headers.get('Set-Cookie');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=' + SESSION_SECONDS]) assert(header.includes(flag));
    assert(!header.includes(key));
    assert.deepEqual(await response.json(), {success:true});
    const cookie = header.split(';')[0];
    const list = await results({env, request:apiRequest('/api/results', cookie)});
    assert.equal((await list.json())[0].id, id);
    const detail = await results({env, request:apiRequest('/api/results?action=detail&id=' + id, cookie)});
    assert.equal((await detail.json()).id, id);
    const file = await curriculum({env, request:apiRequest('/api/curriculum?id=' + id, cookie)});
    assert.equal(file.status,200);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
});

test('ID de candidatura, link inválido e origem externa nunca criam sessão', async () => {
    for (const credential of ['', id, 'incorreta']) {
        const response = await login({env, request:request('POST', credential)});
        assert.equal(response.status,401);
        assert.equal(response.headers.get('Set-Cookie'),null);
    }
    assert.equal((await login({env, request:request('POST', key, 'https://externo.invalid')})).status,403);
    assert.equal((await login({env:{}, request:request()})).status,503);
    for (const path of ['/api/results?id=' + id, '/api/results?action=detail&id=' + id]) {
        assert.equal((await results({env, request:apiRequest(path)})).status,401);
    }
    assert.equal((await curriculum({env, request:apiRequest('/api/curriculum?id=' + id)})).status,401);
});

test('sessão expirada, alterada ou de chave anterior é recusada', async t => {
    const now = Date.now();
    const token = await createAdminSession(env);
    const cookie = SESSION_COOKIE + '=' + token;
    const parts = token.split('.');
    const altered = SESSION_COOKIE + '=' + (Number(parts[0]) + 600) + '.' + parts.slice(1).join('.');
    assert.equal((await results({env, request:apiRequest('/api/results', altered)})).status,401);
    assert.equal((await results({env:{...env, ADMIN_LINK_KEY:'y'.repeat(43)}, request:apiRequest('/api/results', cookie)})).status,401);
    t.mock.method(Date, 'now', () => now + (SESSION_SECONDS + 1) * 1000);
    assert.equal((await results({env, request:apiRequest('/api/results', cookie)})).status,401);
});

test('sair remove o cookie e recusa pedido de outro site', async () => {
    const response = await logout({request:request('DELETE')});
    assert.equal(response.status,200);
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
    assert.equal((await logout({request:request('DELETE', '', 'https://externo.invalid')})).status,403);
});

test('notificações privadas usam o link direto sem expô-lo ao candidato', async t => {
    const sent = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        sent.push({url, body:options?.body});
        return new Response('{}', {status:200});
    });
    const background = [];
    const response = await submit({
        env:{...env, PERFIL_KV:{async put() {}}, CALLMEBOT_APIKEY:'ficticia', CALLMEBOT_PHONE:'000000000', RESEND_API_KEY:'ficticia'},
        request:new Request(origin + '/api/submit', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:'Pessoa de teste',telefone:'51999990000',email:'teste@example.invalid'})}),
        waitUntil(promise) { background.push(promise); },
    });
    const body = await response.json();
    assert.equal(response.status,200);
    assert(!JSON.stringify(body).includes(key));
    await Promise.all(background);
    const link = adminLink(env, body.id);
    assert.equal(new URL(link).searchParams.get('id'),body.id);
    assert.equal(new URLSearchParams(new URL(link).hash.slice(1)).get('acesso'),key);
    assert(new URL(sent[0].url).searchParams.get('text').includes(link));
    assert(JSON.parse(sent[1].body).html.includes(link));
});

function adminBrowser(hash, fetchImpl) {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) {
            const classes = new Set(['adminPage','retryAccess','modalOverlay','emptyMsg'].includes(id) ? ['hidden'] : []);
            elements.set(id,{textContent:'',innerHTML:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}});
        }
        return elements.get(id);
    };
    const location = {hash, pathname:'/admin.html', search:''};
    const ctx = vm.createContext({URL,URLSearchParams,location,fetch:fetchImpl,
        history:{replaceState(_state,_title,url) { location.hash = ''; assert.equal(url,'/admin.html'); }},
        document:{getElementById:element,addEventListener(){}},
    });
    const html = readFileSync(new URL('../admin.html',import.meta.url),'utf8');
    assert.doesNotMatch(html, /type="password"|id="adminKey"/);
    vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/openAdmin\(\);\s*$/,''),ctx);
    return {ctx,element,location};
}

test('interface abre pelo link, limpa fragmento e reaproveita sessão sem digitação', async () => {
    const calls = [];
    const browser = adminBrowser('#acesso=' + key, async (url, options) => {
        calls.push({url,options});
        return new Response(url.endsWith('admin-session') ? '{"success":true}' : '[]');
    });
    await browser.ctx.openAdmin();
    assert.equal(calls[0].options.headers.Authorization,'Bearer ' + key);
    assert.equal(calls[1].options.headers,undefined);
    assert.equal(browser.location.hash,'');
    assert.equal(browser.element('adminPage').classList.contains('hidden'),false);
    await browser.ctx.openAdmin();
    assert.equal(calls.length,3);
    assert.equal(calls[2].url,'/api/results');
});

test('falha temporária preserva link para tentar novamente; acesso anônimo não abre dados', async () => {
    const browser = adminBrowser('#acesso=' + key, async () => new Response('{"error":"Falha temporária"}',{status:503}));
    await browser.ctx.openAdmin();
    assert.equal(browser.location.hash,'#acesso=' + key);
    assert.equal(browser.element('retryAccess').classList.contains('hidden'),false);
    const anonymous = adminBrowser('', async () => new Response('{"error":"Abra o painel pelo link privado da equipe Netcar."}',{status:401}));
    await anonymous.ctx.openAdmin();
    assert.equal(anonymous.element('adminPage').classList.contains('hidden'),true);
    assert.match(anonymous.element('accessMessage').textContent,/link privado/);
});
