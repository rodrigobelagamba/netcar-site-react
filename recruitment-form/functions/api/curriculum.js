import { requireAdmin, UUID } from '../../lib/admin-auth.js';

export async function onRequestGet({ request, env }) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
    const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
    const id = new URL(request.url).searchParams.get('id');
    if (!UUID.test(id || '')) return new Response('Candidatura inválida.', { status:400, headers });
    const record = await env.PERFIL_KV.get(`result:${id}`, { type:'json' });
    if (!record?.curriculo) return new Response('Currículo não anexado.', { status:404, headers });
    const file = await env.PERFIL_KV.get(`curriculum:${id}`, { type:'arrayBuffer' });
    if (!file) return new Response('Currículo não encontrado.', { status:404, headers });
    const name = record.curriculo.name;
    const fallback = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Disposition'] = `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, ch => '%' + ch.charCodeAt(0).toString(16))}`;
    return new Response(file, { headers });
}
