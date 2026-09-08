export async function requireAdmin(request, env) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    const secret = env.ADMIN_KEY || env.ADMIN_TOKEN;
    if (!secret || (!env.ADMIN_KEY && secret.length < 24)) {
        return new Response(JSON.stringify({ error: 'O acesso administrativo precisa ser configurado.' }), { status: 503, headers });
    }
    const supplied = request.headers.get('Authorization') || '';
    const expected = 'Bearer ' + secret;
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([supplied, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
    const aa = new Uint8Array(a), bb = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
    return diff === 0 ? null : new Response(JSON.stringify({ error: 'Informe uma chave de acesso válida.' }), { status: 401, headers });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
