import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultBankPath = path.join(
  os.homedir(),
  'Library',
  'CloudStorage',
  'Dropbox',
  'DEPTO. TI',
  'AUTOADS',
  'squads',
  'netcar-cronograma',
  'media_bank',
);

const bankPath = process.env.NETCAR_MEDIA_BANK_PATH || defaultBankPath;
const indexPath = path.join(bankPath, 'index.json');
const logPath = fileURLToPath(
  new URL('../docs/local-seo-project/evidencias/gbp-photo-log.csv', import.meta.url),
);
const validateOnly = process.argv.includes('--validate');

function parseSemicolonCsv(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(';');

  return lines.filter(Boolean).map((line) => {
    const values = line.split(';');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

await access(indexPath, constants.R_OK);
await access(logPath, constants.R_OK);

const index = JSON.parse(await readFile(indexPath, 'utf8'));
const log = parseSemicolonCsv(await readFile(logPath, 'utf8'));
const media = Array.isArray(index.midias) ? index.midias : [];
const usedIds = new Set(log.map((entry) => entry.media_bank_id).filter(Boolean));

// Historico permanece por unidade; novas candidatas comerciais sao do perfil principal.
const historicalUnits = ['loja1', 'loja2'];
const units = ['loja1'];
const safeCandidates = Object.fromEntries(
  units.map((unit) => {
    const candidates = media
      .filter((item) => item.unidade === unit)
      .filter((item) => item.tipo_midia === 'foto')
      .filter((item) => !usedIds.has(item.id))
      .filter((item) => item.disponivel === true)
      .filter((item) => item.qa_class === 'A')
      .filter((item) => item.manual_review_required !== true)
      .sort((left, right) => String(right.catalogado_em).localeCompare(String(left.catalogado_em)));

    return [unit, candidates];
  }),
);

const errors = [];

for (const unit of historicalUnits) {
  const publishedThisCycle = log.filter(
    (entry) => entry.data === '2026-08-22' && entry.unidade === unit,
  );

  if (publishedThisCycle.length !== 2) {
    errors.push(`${unit}: esperado registro inicial de 2 fotos em 2026-08-22`);
  }
}

for (const entry of log) {
  if (entry.media_bank_id && !media.some((item) => item.id === entry.media_bank_id)) {
    errors.push(`mídia do histórico não encontrada no banco: ${entry.media_bank_id}`);
  }
}

if (errors.length > 0) {
  console.error('Rotina GBP inválida:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (validateOnly) {
  console.log(`Rotina GBP válida: ${log.length} publicações registradas`);
} else {
  console.log('Fotos para o perfil principal Netcar Multimarcas — nº 740');
  console.log(`Banco: ${bankPath}`);
  console.log(`Histórico: ${logPath}`);
  console.log(`Publicações registradas: ${log.length}`);

  for (const unit of units) {
    console.log('\nNetcar Multimarcas — nº 740 — candidatos seguros ainda não usados:');
    const candidates = safeCandidates[unit];

    if (candidates.length === 0) {
      console.log('- nenhum; solicitar fotos novas ou realizar revisão visual manual');
      continue;
    }

    for (const item of candidates.slice(0, 5)) {
      console.log(`- ${item.id} | ${item.data_foto || 'sem data'} | ${item.arquivo}`);
    }
  }

  console.log('\nPróxima coleta fixa: sábado, 16h05, a partir do Centro de Esteio.');
  console.log('Publicar somente no perfil principal 11161331340741727452, após revisão visual.');
  console.log('Não apresentar fotos exclusivas da filial como se fossem do endereço nº 740.');
}
