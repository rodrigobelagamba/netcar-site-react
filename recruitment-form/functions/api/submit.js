import { InputError, readLimitedJson, validateCurriculum } from '../../lib/curriculum.js';

const ALLOWED_FIELDS = ['nome','idade','email','telefone','instagram','linkedin','cep','rua','numero_complemento','bairro','cidade','estado','endereco_completo','distancia_km','dentro_raio','experiencia_vendas','vendeu_veiculos','horario','cnh','metas','metas_formato','scores','percentuais','dominante','dominante_pct','respostas','timestamp'];

export async function onRequestPost(context) {
    const { env, request } = context;
    const origin = request.headers.get('Origin');
    const allowedOrigins = ['https://questionario-perfil.pages.dev','https://netcar-rc.com.br','https://www.netcarmultimarcas.com.br'];
    const headers = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin' };
    if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    let id;
    let fileSaved = false;
    let recordSaved = false;
    try {
        const input = await readLimitedJson(request);
        const data = Object.fromEntries(ALLOWED_FIELDS.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
        for (const key of ['nome','email','telefone']) {
            if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 180) {
                throw new InputError('Preencha nome, e-mail e telefone válidos.');
            }
            data[key] = data[key].trim();
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.telefone.replace(/\D/g, '').length < 10) {
            throw new InputError('Preencha e-mail e telefone válidos.');
        }
        if (data.metas_formato === 'resultado_vendas_v1' && (typeof data.metas !== 'string' || data.metas.trim().length < 20 || data.metas.length > 1000)) {
            throw new InputError('Descreva sua experiência com metas em 20 a 1.000 caracteres.');
        }
        if (JSON.stringify(data).length > 32000) throw new InputError('As respostas excedem o tamanho permitido.');
        const resume = validateCurriculum(input.curriculo);
        id = crypto.randomUUID();
        const record = { ...data, id, savedAt:new Date().toISOString(), curriculo:resume?.metadata || null };
        if (resume) {
            await env.PERFIL_KV.put(`curriculum:${id}`, resume.bytes.buffer, { metadata:resume.metadata });
            fileSaved = true;
        }
        // Cada candidatura tem sua própria chave. A listagem não depende de um índice
        // compartilhado que poderia perder candidatos em envios simultâneos.
        await env.PERFIL_KV.put(`result:${id}`, JSON.stringify(record));
        recordSaved = true;
        // Notificações não atrasam a confirmação de que dados e currículo foram salvos.
        context.waitUntil(sendNotifications(env, data, id).catch(() => {}));
        return new Response(JSON.stringify({ success:true, id }), { status:200, headers });
    } catch (error) {
        if (fileSaved && !recordSaved) await env.PERFIL_KV.delete(`curriculum:${id}`).catch(() => {});
        const message = error instanceof InputError ? error.message : 'Não foi possível concluir o envio. Tente novamente; se necessário, remova o currículo e reenvie.';
        return new Response(JSON.stringify({ error:message }), { status:error instanceof InputError ? error.status : 500, headers });
    }
}

async function sendNotifications(env, data, id) {
    const result = { whatsapp: null, email: null };
    const raioTxt = data.dentro_raio === true
        ? 'Dentro do raio (' + (data.distancia_km || '?') + ' km)'
        : data.dentro_raio === false
        ? 'Fora do raio (' + (data.distancia_km || '?') + ' km)'
        : 'N/D';

    // === WHATSAPP via CallMeBot ===
    if (env.CALLMEBOT_APIKEY) {
        try {
            const phone = env.CALLMEBOT_PHONE || '5551998879281';
            const link = 'https://questionario-perfil.pages.dev/admin.html?id=' + id;
            const parts = [
                'NOVO CANDIDATO NETCAR',
                '',
                'Nome: ' + (data.nome || '?'),
                'Idade: ' + (data.idade || '?'),
                'Tel: ' + (data.telefone || '?'),
                'Email: ' + (data.email || '?'),
            ];
            if (data.instagram) parts.push('Instagram: ' + data.instagram);
            parts.push('Cidade: ' + (data.cidade || '?') + ' - ' + raioTxt);
            parts.push('');
            parts.push('Perfil: ' + (data.dominante || '?') + ' (' + (data.dominante_pct || '?') + '%)');
            parts.push('Exp vendas: ' + (data.experiencia_vendas || '?'));
            parts.push('Horario: ' + (data.horario || '?'));
            parts.push('Veiculos: ' + (data.vendeu_veiculos || '?'));
            parts.push('CNH: ' + (data.cnh || '?'));
            parts.push('Metas: ' + (data.metas || '?'));
            parts.push('');
            parts.push('Ver completo: ' + link);

            const msg = parts.join('\n');
            const url = 'https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encodeURIComponent(msg) + '&apikey=' + env.CALLMEBOT_APIKEY;
            const resp = await fetch(url, { signal:AbortSignal.timeout(10000) });
            result.whatsapp = { status: resp.status, body: await resp.text() };
        } catch (e) {
            result.whatsapp = { error: e.message };
        }
    } else {
        result.whatsapp = { error: 'CALLMEBOT_APIKEY not set' };
    }

    // === EMAIL via Resend ===
    if (env.RESEND_API_KEY) {
        try {
            const escape = value => String(value ?? '-').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
            const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escape(value)]));
            const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fa;padding:20px">
  <div style="background:#0f1923;color:#fff;padding:20px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="margin:0;font-size:20px">Netcar - Novo Candidato!</h1>
  </div>
  <div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 15px;color:#1e293b;font-size:18px">${safe.nome}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b;width:130px"><strong>Idade:</strong></td><td>${safe.idade || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>Telefone:</strong></td><td>${safe.telefone || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>E-mail:</strong></td><td>${safe.email || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>Instagram:</strong></td><td>${safe.instagram || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>LinkedIn:</strong></td><td>${safe.linkedin || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>Endereco:</strong></td><td>${safe.endereco_completo || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b"><strong>Raio:</strong></td><td>${escape(raioTxt)}</td></tr>
    </table>
    <hr style="margin:15px 0;border:none;border-top:1px solid #e2e8f0">
    <h3 style="margin:0 0 10px;font-size:15px;color:#1e293b">Perfil: ${safe.dominante} (${safe.dominante_pct}%)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#64748b"><strong>Exp. Vendas:</strong></td><td>${safe.experiencia_vendas || '-'}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b"><strong>Veiculos:</strong></td><td>${safe.vendeu_veiculos || '-'}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b"><strong>Horario:</strong></td><td>${safe.horario || '-'}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b"><strong>CNH:</strong></td><td>${safe.cnh || '-'}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b"><strong>Metas:</strong></td><td>${safe.metas || '-'}</td></tr>
    </table>
    <div style="margin-top:15px;text-align:center">
      <a href="https://questionario-perfil.pages.dev/admin.html?id=${id}" style="display:inline-block;padding:10px 24px;background:#6cc4ca;color:#0f1923;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Ver no Painel</a>
    </div>
  </div>
</div>`;

            const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                signal:AbortSignal.timeout(10000),
                headers: {
                    'Authorization': 'Bearer ' + env.RESEND_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: env.EMAIL_FROM || 'Netcar Perfil <onboarding@resend.dev>',
                    to: [env.NOTIFY_EMAIL || 'marcelo@netcarmultimarcas.com.br'],
                    subject: 'Novo candidato: ' + data.nome + ' - ' + data.dominante + ' (' + data.dominante_pct + '%)',
                    html: emailHtml
                }),
            });
            result.email = { status: emailResponse.ok ? 'sent' : 'failed', httpStatus:emailResponse.status };
        } catch (e) {
            result.email = { error: e.message };
        }
    } else {
        result.email = { error: 'RESEND_API_KEY not set' };
    }

    return result;
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
