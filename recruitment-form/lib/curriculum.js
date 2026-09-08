export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 7 * 1024 * 1024 + 128 * 1024;

export class InputError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export async function readLimitedJson(request) {
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        throw new InputError('Envie os dados em JSON.', 415);
    }
    if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) {
        throw new InputError('A candidatura excede o tamanho permitido. O currículo pode ter até 5 MB.', 413);
    }
    if (!request.body) throw new InputError('Dados da candidatura ausentes.');
    const reader = request.body.getReader();
    const parts = [];
    let size = 0;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_REQUEST_BYTES) {
            await reader.cancel();
            throw new InputError('A candidatura excede o tamanho permitido. O currículo pode ter até 5 MB.', 413);
        }
        parts.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
    try {
        const data = JSON.parse(new TextDecoder().decode(body));
        if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
        return data;
    } catch { throw new InputError('Os dados enviados não são válidos.'); }
}

function startsWith(bytes, values) {
    return values.every((value, index) => bytes[index] === value);
}

// Verifica as entradas do diretório ZIP sem descompactar conteúdo do candidato.
function isWordPackage(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65557); pos--) {
        if (view.getUint32(pos, true) === 0x06054b50 && pos + 22 + view.getUint16(pos + 20, true) === bytes.length) { end = pos; break; }
    }
    if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) return false;
    const count = view.getUint16(end + 10, true);
    let pos = view.getUint32(end + 16, true);
    const names = new Set();
    if (pos + view.getUint32(end + 12, true) !== end || !count || count > 10000) return false;
    for (let i = 0; i < count; i++) {
        if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) return false;
        if (view.getUint16(pos + 8, true) & 1) return false;
        const length = view.getUint16(pos + 28, true);
        const next = pos + 46 + length + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
        if (next > end) return false;
        const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + length));
        if (/vbaProject\.bin$/i.test(name)) return false;
        names.add(name);
        pos = next;
    }
    return pos === end && names.has('[Content_Types].xml') && names.has('word/document.xml');
}

export function validateCurriculum(input) {
    if (input == null) return null;
    if (typeof input !== 'object' || typeof input.name !== 'string' || typeof input.base64 !== 'string') {
        throw new InputError('O currículo não pôde ser lido. Selecione o arquivo novamente.');
    }
    const extension = input.name.match(/\.(pdf|doc|docx)$/i)?.[1].toLowerCase();
    if (!extension) throw new InputError('O currículo deve estar em PDF, DOC ou DOCX.');
    const base64 = input.base64;
    if (!base64.length || base64.length > 4 * Math.ceil(MAX_RESUME_BYTES / 3)) {
        throw new InputError('O currículo deve ter conteúdo e no máximo 5 MB.', 413);
    }
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const unpadded = base64.slice(0, base64.length - padding);
    if (base64.length % 4 || /[^A-Za-z0-9+/]/.test(unpadded)) throw new InputError('O arquivo do currículo está inválido.');
    let binary;
    try { binary = atob(base64); } catch { throw new InputError('O arquivo do currículo está inválido.'); }
    if (!binary.length || binary.length > MAX_RESUME_BYTES) throw new InputError('O currículo deve ter conteúdo e no máximo 5 MB.', 413);
    if (input.size !== binary.length) throw new InputError('O currículo está incompleto. Selecione o arquivo novamente.');
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const valid = extension === 'pdf' ? startsWith(bytes, [37,80,68,70,45])
        : extension === 'doc' ? startsWith(bytes, [208,207,17,224,161,177,26,225])
        : startsWith(bytes, [80,75,3,4]) && isWordPackage(bytes);
    if (!valid) throw new InputError('O conteúdo do currículo não corresponde ao formato informado. Salve o arquivo novamente como PDF, DOC ou DOCX.');
    const name = input.name.split(/[\\/]/).pop().normalize('NFC').replace(/[\u0000-\u001f\u007f\ud800-\udfff]/g, '').slice(-160);
    const type = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[extension];
    return { bytes, metadata: { name, type, size: bytes.length } };
}
