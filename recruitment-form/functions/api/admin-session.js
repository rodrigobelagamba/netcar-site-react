import { adminLinkKey, constantTimeEqual, createAdminSession, sessionCookie } from '../../lib/admin-auth.js';

function reply(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), { status, headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extra } });
}

function sameOrigin(request) {
    return request.headers.get('Origin') === new URL(request.url).origin;
}

export async function onRequestPost({ request, env }) {
    if (!sameOrigin(request)) return reply({ error:'Abra o link diretamente no painel da Netcar.' }, 403);
    const secret = adminLinkKey(env);
    if (!secret) return reply({ error:'O acesso privado ainda não está configurado.' }, 503);
    if (!await constantTimeEqual(request.headers.get('Authorization') || '', 'Bearer ' + secret)) {
        return reply({ error:'Este link de acesso não é válido. Use o link privado da equipe Netcar.' }, 401);
    }
    return reply({ success:true }, 200, { 'Set-Cookie':sessionCookie(await createAdminSession(env)) });
}

export async function onRequestDelete({ request }) {
    if (!sameOrigin(request)) return reply({ error:'Abra o painel da Netcar.' }, 403);
    return reply({ success:true }, 200, { 'Set-Cookie':sessionCookie('', 0) });
}
