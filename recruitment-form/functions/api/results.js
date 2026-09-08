import { requireAdmin, UUID } from '../../lib/admin-auth.js';

export async function onRequestGet({ request, env }) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
    const url = new URL(request.url);
    const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };
    if (url.searchParams.get('action') === 'detail') {
        const id = url.searchParams.get('id');
        if (!UUID.test(id || '')) return new Response(JSON.stringify({ error:'ID inválido.' }), { status:400, headers });
        const data = await env.PERFIL_KV.get(`result:${id}`);
        if (!data) return new Response(JSON.stringify({ error:'Não encontrado.' }), { status:404, headers });
        return new Response(data, { headers });
    }
    const summaries = [];
    const cursor = url.searchParams.get('cursor');
    const page = await env.PERFIL_KV.list({ prefix:'result:', limit:100, ...(cursor ? { cursor } : {}) });
    const records = await Promise.all(page.keys.map(key => env.PERFIL_KV.get(key.name, { type:'json' })));
    for (const record of records) {
        if (!record) continue;
        summaries.push(Object.fromEntries(['id','nome','idade','dominante','dominante_pct','dentro_raio','cidade','experiencia_vendas','horario','timestamp'].map(key => [key, record[key]])));
    }
    if (!page.list_complete && page.cursor) headers['X-Next-Cursor'] = page.cursor;
    summaries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return new Response(JSON.stringify(summaries), { headers });
}
