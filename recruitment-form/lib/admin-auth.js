export const SESSION_COOKIE = '__Host-netcar_admin';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export function adminLinkKey(env) {
    return /^[A-Za-z0-9_-]{43,128}$/.test(env.ADMIN_LINK_KEY || '') ? env.ADMIN_LINK_KEY : '';
}

export function adminLink(env, id = '') {
    const url = new URL('https://questionario-perfil.pages.dev/admin.html');
    if (id) url.searchParams.set('id', id);
    const key = adminLinkKey(env);
    if (key) url.hash = new URLSearchParams({ acesso:key }).toString();
    return url.href;
}

export async function constantTimeEqual(supplied, expected) {
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([supplied, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
    const aa = new Uint8Array(a), bb = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
    return diff === 0;
}

function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signSession(payload, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('netcar-admin-session-v1:' + payload))));
}

export async function createAdminSession(env) {
    const secret = adminLinkKey(env);
    if (!secret) throw new Error('Acesso privado não configurado.');
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const payload = expires + '.' + base64url(crypto.getRandomValues(new Uint8Array(18)));
    return payload + '.' + await signSession(payload, secret);
}

export function sessionCookie(value, maxAge = SESSION_SECONDS) {
    return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

async function validSession(request, secret) {
    if (!secret) return false;
    const value = (request.headers.get('Cookie') || '').split(';').map(item => item.trim()).find(item => item.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1) || '';
    const match = /^(\d{10})\.([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(value);
    if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
    return constantTimeEqual(match[3], await signSession(match[1] + '.' + match[2], secret));
}

export async function requireAdmin(request, env) {
    const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };
    const secret = env.ADMIN_KEY || env.ADMIN_TOKEN;
    const hasBearer = !!secret && (!!env.ADMIN_KEY || secret.length >= 24);
    const linkKey = adminLinkKey(env);
    if (!hasBearer && !linkKey) {
        return new Response(JSON.stringify({ error:'O acesso administrativo precisa ser configurado.' }), { status:503, headers });
    }
    if (await validSession(request, linkKey)) return null;
    if (hasBearer && await constantTimeEqual(request.headers.get('Authorization') || '', 'Bearer ' + secret)) return null;
    return new Response(JSON.stringify({ error:'Abra o painel pelo link privado da equipe Netcar.' }), { status:401, headers });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
