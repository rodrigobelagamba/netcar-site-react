import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost as submit } from '../functions/api/submit.js';
import { onRequestGet as results } from '../functions/api/results.js';
import { onRequestGet as curriculum } from '../functions/api/curriculum.js';
import { validateCurriculum, MAX_REQUEST_BYTES, readLimitedJson } from '../lib/curriculum.js';

const ADMIN_TOKEN = 'chave-ficticia-exclusiva-dos-testes-locais';
const candidate = { nome:'Candidato Fictício', email:'teste@example.invalid', telefone:'51999990000', metas:'Minha meta era vender 10 veículos e vendi 12 no mês.', metas_formato:'resultado_vendas_v1', timestamp:'2026-09-08T12:00:00.000Z' };
const pdf = Buffer.from('%PDF-1.4\n% Documento fictício para teste local\n%%EOF');
function attachment(bytes = pdf, name = 'curriculo.pdf') { return { name, size:bytes.length, type:'application/pdf', base64:bytes.toString('base64') }; }
class MemoryKV {
    data = new Map();
    fail = '';
    async put(key, value) { if(this.fail && key.startsWith(this.fail)) throw new Error('Simulação de falha no KV'); this.data.set(key, value); }
    async get(key, opts) {
        const value = this.data.get(key) ?? null;
        if (opts?.type === 'json' && value !== null) return JSON.parse(value);
        return value;
    }
    async delete(key) { this.data.delete(key); }
    async list({prefix, cursor = '0', limit}) {
        const all = [...this.data.keys()].filter(key => key.startsWith(prefix));
        const offset = Number(cursor), next = offset + limit;
        return { keys:all.slice(offset,next).map(name => ({name})), list_complete:next >= all.length, cursor:String(next) };
    }
}
function setup() {
    const kv = new MemoryKV(), background = [];
    const env = { PERFIL_KV:kv, ADMIN_TOKEN };
    return { kv, env, background, context:body => ({ env, request:new Request('http://localhost/api/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }), waitUntil:promise => background.push(promise) }) };
}
const adminRequest = path => new Request('http://localhost'+path, { headers:{Authorization:'Bearer '+ADMIN_TOKEN} });

test('candidatura sem currículo continua aceita, sem criar arquivo', async () => {
    const s=setup(); const response=await submit(s.context(candidate));
    assert.equal(response.status,200);
    const body=await response.json(); assert.equal(body.success,true);
    const saved=JSON.parse(s.kv.data.get('result:'+body.id));
    assert.equal(saved.curriculo,null); assert.equal(saved.metas,candidate.metas);
    assert.equal(s.kv.data.size,1); await Promise.all(s.background);
});
test('notificação trata distância informada como texto, sem HTML do candidato', async t => {
    const s=setup(); s.env.RESEND_API_KEY='chave-ficticia';
    let email;
    t.mock.method(globalThis,'fetch',async (_url,options) => {
        email=JSON.parse(options.body);
        return new Response('{}',{status:200});
    });
    const response=await submit(s.context({...candidate,dentro_raio:true,distancia_km:'<img src=x onerror=alert(1)>'}));
    assert.equal(response.status,200); await Promise.all(s.background);
    assert.match(email.html,/&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(email.html,/<img src=x/);
});
test('PDF é separado do registro e só pode ser baixado com autorização', async () => {
    const s=setup(), bytes=pdf;
    const response=await submit(s.context({...candidate,curriculo:attachment(bytes)}));
    const body=await response.json(); assert.equal(response.status,200);
    const record=JSON.parse(s.kv.data.get('result:'+body.id));
    assert.equal(record.curriculo.size,bytes.length); assert.equal(record.curriculo.base64,undefined);
    assert.deepEqual(Buffer.from(s.kv.data.get('curriculum:'+body.id)),bytes);
    const denied=await curriculum({env:s.env,request:new Request('http://localhost/api/curriculum?id='+body.id)});
    assert.equal(denied.status,401);
    const download=await curriculum({env:s.env,request:adminRequest('/api/curriculum?id='+body.id)});
    assert.equal(download.status,200); assert.match(download.headers.get('Content-Disposition'),/^attachment;/);
    assert.equal(download.headers.get('Cache-Control'),'no-store');
    assert.equal(download.headers.get('X-Content-Type-Options'),'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
});
test('DOCX reconhecido; ZIP disfarçado, conteúdo inválido e tamanhos excedidos recusados', () => {
    const docx=readFileSync(new URL('./fixtures/curriculo-teste.docx',import.meta.url));
    assert.equal(validateCurriculum(attachment(docx,'currículo.docx')).metadata.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const doc=Buffer.from([208,207,17,224,161,177,26,225,0,0,0]);
    assert.equal(validateCurriculum(attachment(doc,'curriculo.doc')).metadata.type,'application/msword');
    assert.throws(()=>validateCurriculum(attachment(Buffer.from('PK\x03\x04apenas um ZIP'),'arquivo.docx')));
    assert.throws(()=>validateCurriculum(attachment(Buffer.from('<html>arquivo</html>'),'arquivo.pdf')));
    assert.throws(()=>validateCurriculum(attachment(pdf,'arquivo.exe')));
    assert.throws(()=>validateCurriculum({...attachment(),base64:'!!!!'}));
    assert.throws(()=>validateCurriculum({...attachment(),size:999}));
    assert.throws(()=>validateCurriculum(attachment(Buffer.alloc(5*1024*1024+1),'grande.pdf')));
});
test('validação de arquivo inválido não grava candidatura', async () => {
    const s=setup(); const response=await submit(s.context({...candidate,curriculo:attachment(Buffer.from('errado'))}));
    assert.equal(response.status,400); assert.equal(s.kv.data.size,0);
});
test('falha no armazenamento do currículo não confirma candidatura', async () => {
    const s=setup(); s.kv.fail='curriculum:';
    const response=await submit(s.context({...candidate,curriculo:attachment()}));
    assert.equal(response.status,500); assert.equal(s.kv.data.size,0);
    assert.equal((await response.json()).success,undefined);
});
test('falha ao salvar candidatura remove currículo órfão', async () => {
    const s=setup(); s.kv.fail='result:';
    const response=await submit(s.context({...candidate,curriculo:attachment()}));
    assert.equal(response.status,500); assert.equal(s.kv.data.size,0);
});
test('lista e detalhes protegidos; registros antigos e novos permanecem listados', async () => {
    const s=setup();
    assert.equal((await results({env:s.env,request:new Request('http://localhost/api/results')})).status,401);
    assert.equal((await results({env:{PERFIL_KV:s.kv},request:adminRequest('/api/results')})).status,503);
    const oldId=crypto.randomUUID(); await s.kv.put('result:'+oldId,JSON.stringify({...candidate,id:oldId}));
    await Promise.all([submit(s.context(candidate)),submit(s.context({...candidate,nome:'Outro Candidato Fictício'}))]);
    const list=await results({env:s.env,request:adminRequest('/api/results')});
    assert.equal((await list.json()).length,3);
    const old=await results({env:s.env,request:adminRequest('/api/results?action=detail&id='+oldId)});
    assert.equal(old.status,200);
    const noFile=await curriculum({env:s.env,request:adminRequest('/api/curriculum?id='+oldId)});
    assert.equal(noFile.status,404);
});
test('chave administrativa já configurada em produção é preservada', async () => {
    const s=setup();
    const response=await results({env:{PERFIL_KV:s.kv,ADMIN_KEY:ADMIN_TOKEN},request:adminRequest('/api/results')});
    assert.equal(response.status,200);
});
test('corpo HTTP limitado antes de gravar, inclusive sem Content-Length', async () => {
    const response=new Request('http://localhost/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(MAX_REQUEST_BYTES+1)});
    await assert.rejects(readLimitedJson(response),error=>error.status===413);
});
test('painel pagina candidatos sem concentrar milhares de leituras numa requisição', async () => {
    const s=setup();
    for(let i=0;i<105;i++) { const id=crypto.randomUUID(); await s.kv.put('result:'+id,JSON.stringify({...candidate,id})); }
    const first=await results({env:s.env,request:adminRequest('/api/results')});
    assert.equal((await first.json()).length,100);
    const cursor=first.headers.get('X-Next-Cursor');assert(cursor);
    const second=await results({env:s.env,request:adminRequest('/api/results?cursor='+encodeURIComponent(cursor))});
    assert.equal((await second.json()).length,5);assert.equal(second.headers.get('X-Next-Cursor'),null);
});

function browser(fetchImpl, file) {
    const elements=new Map();
    const element=id=>{
        if(!elements.has(id))elements.set(id,{value:({fName:candidate.nome,fPhone:candidate.telefone,fEmail:candidate.email,fAge:'30',fCep:'93260000',fMetas:candidate.metas})[id]||'',files:[],style:{},hidden:true,disabled:false,textContent:'',classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},focus(){},scrollIntoView(){}});
        return elements.get(id);
    };
    element('fCurriculo').files=file?[file]:[];
    element('form-page').style.display='block';element('results-page').style.display='none';
    const ctx=vm.createContext({ document:{getElementById:element}, window:{scrollTo(){}}, fetch:fetchImpl, AbortController, setTimeout, clearTimeout,
        FileReader:class { readAsDataURL(){this.result='data:application/pdf;base64,'+pdf.toString('base64');this.onload();} } });
    const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/renderQuestions\(\);\s*$/,'');
    vm.runInContext(source,ctx);
    return {ctx,element,save:()=>ctx.saveResults({A:25,I:0,O:0,C:0},{A:100,I:0,O:0,C:0},'A',Array(25).fill('A'))};
}
test('interface só confirma após resposta positiva da API e inclui anexo opcional', async () => {
    let resolveResponse, sent;
    const b=browser(async(url,options)=>{sent=JSON.parse(options.body);return new Promise(resolve=>{resolveResponse=resolve;});},{name:'curriculo.pdf',size:pdf.length,type:'application/pdf'});
    const saving=b.save(); await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(b.element('results-page').style.display,'none');
    assert.equal(b.element('submitBtn').disabled,true); assert(sent.curriculo.base64);
    resolveResponse(new Response(JSON.stringify({success:true,id:crypto.randomUUID()}),{status:200}));
    await saving;assert.equal(b.element('results-page').style.display,'block');
});
test('erro HTTP ou sucesso falso preservam formulário e permitem tentar novamente', async () => {
    for (const response of [new Response('{"error":"Falha simulada"}',{status:500}),new Response('{"success":false}',{status:200})]) {
        const b=browser(async()=>response);await b.save();
        assert.equal(b.element('results-page').style.display,'none');
        assert.equal(b.element('form-page').style.display,'block');
        assert.equal(b.element('submitError').hidden,false);assert.equal(b.element('submitBtn').disabled,false);
        assert.equal(b.element('fName').value,candidate.nome);
    }
});
