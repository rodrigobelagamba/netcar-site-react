import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyEquipmentSourceWatch, validateEquipmentSourceWatch, watchEquipmentSources } from "./lib/equipmentSourceWatch";
import { expandExactResearchCandidates, createDiscoveryReport, type PublicEquipmentObservation, type EquipmentResearchProgress, fetchReviewDiscoverySnapshot } from "./lib/equipmentDiscovery";
import { applyReviewProposal, decideReviewCandidates, recordReviewPublication, reopenReviewCandidate, type ReviewAnswer, type ReviewProposal, decideReviewCandidate, emptyReviewLedger, markReviewAsked, observeReviewStock, parseReviewInput, parseReviewSnapshot, prepareReviewProposal, syncReviewCandidates, validateReviewLedger, type ReviewLedger } from "./lib/equipmentReview";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 8 * 1024 * 1024;
const STATE = "research-review.json";
const commands = ["discover", "sync", "list", "mark-asked", "decide", "decide-batch", "reopen", "prepare", "apply", "recover-apply", "record-publication"];
const CONFIRMATIONS = join(ROOT, "src", "data", "vehicle-equipment-confirmations.json");
const PENDING = "research-application-pending.json";
const help = `Revisão LOCAL de equipamentos; apply incorpora somente itens especificamente autorizados. Deploy é separado.
  discover --input candidatos.json [--stock estoque-sanitizado.json] [--public-observations observacoes.json] [--research-progress pesquisa.json] [--expand-exact-matches]
  sync --input candidatos.json [--stock estoque-sanitizado.json]
  list
  mark-asked --key CHAVE --vehicle-id ID --item-key ITEM
  decide --key CHAVE --vehicle-id ID --item-key ITEM --status presence_confirmed|authorized|excluded|confirmed|rejected|deferred --note TEXTO [--present --authorize-publication --confirm-market --confirm-source-identity --confirmation-reference REFERENCIA --approved-name NOME --approved-description DESCRICAO]
  decide-batch --input decisoes-exatas.json
  reopen --key CHAVE --vehicle-id ID --item-key ITEM --note PEDIDO_DO_RESPONSAVEL
  prepare [--stock estoque-sanitizado.json]
  apply --proposal-sha256 HASH [--stock estoque-sanitizado.json]
  recover-apply
  record-publication --key CHAVE --vehicle-id ID --item-key ITEM --commit SHA --public-url URL --evidence-reference PROVA --reversal-reference REVERSAO
  --state-dir CAMINHO/.devops/equipment (opcional; padrão no checkout)
Sem --stock, sync/prepare/apply consultam XML/API pelo fluxo existente.
prepare grava apenas research-proposal.json no diretório privado.
mark-asked só deve ser chamado DEPOIS de a pergunta ser apresentada.
`;

function pathStat(path: string) {
  try { return lstatSync(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function fileText(path: string): string {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES)
    throw new Error("Arquivo inválido, link simbólico ou maior que 8 MiB.");
  return readFileSync(path, "utf8");
}

function jsonFile(path: string): unknown {
  try { return JSON.parse(fileText(path)); }
  catch { throw new Error("Arquivo JSON ausente, inválido ou fora do limite."); }
}

function privateDirectory(path: string): string {
  const dir = resolve(path);
  if (!dir.endsWith(`${sep}.devops${sep}equipment`))
    throw new Error("O estado deve ficar em um diretório privado .devops/equipment.");
  // Refuse a symlink anywhere on the output path, before creating any files.
  let cursor = dir;
  while (cursor !== dirname(cursor)) {
    if (pathStat(cursor)?.isSymbolicLink())
      throw new Error("Diretório de estado não pode atravessar link simbólico.");
    cursor = dirname(cursor);
  }
  const within = relative(ROOT, dir);
  if (!within.startsWith(`..${sep}`) && !isAbsolute(within) && within !== `.devops${sep}equipment`)
    throw new Error("Use somente .devops/equipment para estado neste checkout.");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  return realpathSync(dir);
}

function atomicJson(dir: string, name: string, value: unknown): void {
  atomicText(dir, name, JSON.stringify(value, null, 2) + "\n");
}
function atomicText(dir: string, name: string, text: string, beforeRename?: () => void, mode = 0o600): void {
  if (Buffer.byteLength(text) > MAX_BYTES)
    throw new Error("Estado excedeu 8 MiB; preserve o histórico e revise antes de continuar.");
  const target = join(dir, name);
  if (pathStat(target)?.isSymbolicLink())
    throw new Error("Arquivo de estado não pode ser link simbólico.");
  const temporary = join(dir, `.${name}.${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", mode);
    writeFileSync(fd, text);
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    beforeRename?.();
    renameSync(temporary, target);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

async function transaction<T>(dir: string, operation: (ledger: ReviewLedger) => T | Promise<T>): Promise<T> {
  const path = join(dir, "research-review.lock");
  let fd: number;
  try { fd = openSync(path, "wx", 0o600); }
  catch { throw new Error("Revisão local ocupada ou trava anterior presente. Confira o processo; não remova a trava automaticamente."); }
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    const saved = join(dir, STATE);
    const ledger = pathStat(saved) ? validateReviewLedger(jsonFile(saved)) : emptyReviewLedger();
    return await operation(ledger);
  } finally { closeSync(fd); unlinkSync(path); }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
/** Journal first; interrupted writes never silently lose decisions or overwrite a changed base. */
export function persistReviewApplication(dir: string, beforeLedger: ReviewLedger, result: ReturnType<typeof applyReviewProposal>, confirmationPath: string): void {
  if (result.alreadyApplied) { atomicJson(dir, STATE, result.ledger); return; }
  const lock = join(dirname(confirmationPath), ".vehicle-equipment-confirmations.review.lock");
  let descriptor: number;
  try { descriptor = openSync(lock, "wx", 0o600); }
  catch { throw new Error("Registro de confirmações ocupado; confira a trava existente."); }
  try {
    if (pathStat(join(dir, PENDING))) throw new Error("Aplicação anterior pendente de recuperação.");
    const beforeText = fileText(confirmationPath);
    if (sha256(beforeText) !== result.beforeSha256) throw new Error("Base de confirmações alterada; prepare novamente.");
    const journal = { schemaVersion: 1, confirmationPath: resolve(confirmationPath), beforeText, afterText: result.documentText, beforeLedger, afterLedger: result.ledger, beforeSha256: result.beforeSha256, afterSha256: result.afterSha256 };
    atomicJson(dir, PENDING, journal);
    atomicText(dirname(confirmationPath), confirmationPath.split(sep).at(-1)!, result.documentText, () => {
      if (sha256(fileText(confirmationPath)) !== result.beforeSha256) throw new Error("Base alterada durante aplicação; journal preservado para investigação.");
    }, pathStat(confirmationPath)!.mode & 0o777);
    atomicJson(dir, STATE, result.ledger);
    atomicJson(dir, `research-application-${result.afterSha256}.json`, journal);
    unlinkSync(join(dir, PENDING));
  } finally { closeSync(descriptor); unlinkSync(lock); }
}
/** Recover only the two exact known byte states. Conflicting state needs investigation. */
export function recoverReviewApplication(dir: string, confirmationPath: string): unknown {
  const lock = join(dirname(confirmationPath), ".vehicle-equipment-confirmations.review.lock");
  let descriptor: number;
  try { descriptor = openSync(lock, "wx", 0o600); }
  catch { throw new Error("Registro de confirmações ocupado; confira a trava existente."); }
  try {
  const journal = jsonFile(join(dir, PENDING)) as { schemaVersion: number; confirmationPath: string; beforeText: string; afterText: string; beforeLedger: ReviewLedger; afterLedger: ReviewLedger; beforeSha256: string; afterSha256: string };
  if (journal.schemaVersion !== 1 || journal.confirmationPath !== resolve(confirmationPath) || typeof journal.beforeText !== "string" || typeof journal.afterText !== "string" || sha256(journal.beforeText) !== journal.beforeSha256 || sha256(journal.afterText) !== journal.afterSha256) throw new Error("Journal inválido; preserve para investigação.");
  const before = validateReviewLedger(journal.beforeLedger); const after = validateReviewLedger(journal.afterLedger);
  const currentLedger = validateReviewLedger(jsonFile(join(dir, STATE)));
  if (![JSON.stringify(before), JSON.stringify(after)].includes(JSON.stringify(currentLedger))) throw new Error("Estado de revisão concorrente; recuperação manual necessária.");
  const currentHash = sha256(fileText(confirmationPath));
  if (![journal.beforeSha256, journal.afterSha256].includes(currentHash)) throw new Error("Base concorrente; recuperação manual necessária.");
  const recoveredLedger = currentHash === journal.afterSha256 ? after : before;
  atomicText(dir, STATE, JSON.stringify(recoveredLedger, null, 2) + "\n", () => {
    if (sha256(fileText(confirmationPath)) !== currentHash || JSON.stringify(validateReviewLedger(jsonFile(join(dir, STATE)))) !== JSON.stringify(currentLedger)) throw new Error("Alteração concorrente durante recuperação; journal preservado.");
  });
  atomicJson(dir, `research-application-${journal.afterSha256}.json`, { ...journal, recovery: currentHash === journal.afterSha256 ? "completed" : "not-applied" });
  unlinkSync(join(dir, PENDING));
  return { recovered: true, appliedLocally: currentHash === journal.afterSha256, published: false };
  } finally { closeSync(descriptor); unlinkSync(lock); }
}

export async function runEquipmentReviewCli(argv: string[]): Promise<unknown> {
  if (!argv.length || argv[0] === "--help") return { help };
  const command = argv[0];
  if (!commands.includes(command)) throw new Error("Comando inválido. Consulte --help.");
  const valued = new Set(["--input", "--stock", "--public-observations", "--research-progress", "--key", "--vehicle-id", "--item-key", "--status", "--note", "--state-dir", "--confirmation-reference", "--approved-name", "--approved-description", "--proposal-sha256", "--commit", "--public-url", "--evidence-reference", "--reversal-reference"]);
  const flags = new Set(["--expand-exact-matches", "--present", "--authorize-publication", "--confirm-market", "--confirm-source-identity"]);
  const options = new Map<string, string | true>();
  for (let i = 1; i < argv.length; i++) {
    const name = argv[i];
    if (options.has(name)) throw new Error("Argumento repetido.");
    if (flags.has(name)) options.set(name, true);
    else if (valued.has(name) && argv[i + 1] && !argv[i + 1].startsWith("--")) options.set(name, argv[++i]);
    else throw new Error("Argumento inválido ou sem valor. Consulte --help.");
  }
  const allowed: Record<string, string[]> = {
    discover: ["--input", "--stock", "--public-observations", "--research-progress", "--expand-exact-matches"],
    sync: ["--input", "--stock"], list: [],
    "mark-asked": ["--key", "--vehicle-id", "--item-key"],
    decide: ["--key", "--vehicle-id", "--item-key", "--status", "--note", "--confirmation-reference", "--approved-name", "--approved-description", ...[...flags].filter(f => f !== "--expand-exact-matches")],
    "decide-batch": ["--input"],
    reopen: ["--key", "--vehicle-id", "--item-key", "--note"],
    apply: ["--stock", "--proposal-sha256"],
    "recover-apply": [],
    "record-publication": ["--key", "--vehicle-id", "--item-key", "--commit", "--public-url", "--evidence-reference", "--reversal-reference"],
    prepare: ["--stock"],
  };
  if ([...options.keys()].some(k => k !== "--state-dir" && !allowed[command].includes(k)))
    throw new Error("Argumento não pertence a este comando.");
  const required = (name: string): string => {
    const value = options.get(name);
    if (typeof value !== "string" || !value.trim()) throw new Error(`Informe ${name}.`);
    return value;
  };
  let now = new Date().toISOString();
  const input = ["sync", "discover"].includes(command) ? parseReviewInput(jsonFile(resolve(required("--input")))) : undefined;
  const snapshot = ["discover", "sync", "prepare", "apply"].includes(command)
    ? options.has("--stock") ? parseReviewSnapshot(jsonFile(resolve(required("--stock"))), now)
      : await fetchReviewDiscoverySnapshot()
    : undefined;
  now = new Date().toISOString();
  const dir = privateDirectory(typeof options.get("--state-dir") === "string" ? String(options.get("--state-dir")) : join(ROOT, ".devops", "equipment"));
  return transaction(dir, async ledger => {
    if (command === "recover-apply") return recoverReviewApplication(dir, CONFIRMATIONS);
    if (pathStat(join(dir, PENDING)) && command !== "list") throw new Error("Aplicação interrompida; preserve o journal e execute recover-apply após conferir os hashes.");
    if (command === "list") return ledger;
    if (command === "discover") {
      const researched = options.get("--expand-exact-matches") ? expandExactResearchCandidates(input!, snapshot!) : input!;
      const next = syncReviewCandidates(ledger, researched, snapshot!, now);
      const observationsPath = join(dir, "research-public-observations.json");
      const observations = options.has("--public-observations") ? jsonFile(resolve(required("--public-observations"))) as PublicEquipmentObservation[] : pathStat(observationsPath) ? jsonFile(observationsPath) as PublicEquipmentObservation[] : [];
      if (!Array.isArray(observations)) throw new Error("Observações públicas inválidas.");
      const progressPath = join(dir, "research-progress.json");
      const progress = options.has("--research-progress") ? jsonFile(resolve(required("--research-progress"))) as EquipmentResearchProgress[] : pathStat(progressPath) ? jsonFile(progressPath) as EquipmentResearchProgress[] : [];
      if (!Array.isArray(progress)) throw new Error("Progresso da pesquisa inválido.");
      const report = createDiscoveryReport(snapshot!, researched, next, observations, progress);
      let sourceWatch: Awaited<ReturnType<typeof watchEquipmentSources>> | undefined;
      let sourceWatchFailure: string | undefined;
      try {
        const sourceState = join(dir, "research-source-watch.json");
        const previous = pathStat(sourceState) ? validateEquipmentSourceWatch(jsonFile(sourceState)) : emptyEquipmentSourceWatch();
        sourceWatch = await watchEquipmentSources(input!, previous);
      } catch { sourceWatchFailure = "source_watch_failed_previous_history_preserved_requires_review"; }
      const completeReport = { ...report, sourceUpdates: sourceWatch ? { updates: sourceWatch.updates, checks: sourceWatch.checks, limitations: sourceWatch.limitations } : { updates: [], checks: [], failure: sourceWatchFailure } };
      if (options.has("--public-observations")) atomicJson(dir, "research-public-observations.json", observations);
      if (options.has("--research-progress")) atomicJson(dir, "research-progress.json", progress);
      atomicJson(dir, "research-stock.json", snapshot);
      atomicJson(dir, "research-discovery.json", completeReport);
      atomicJson(dir, STATE, next);
      if (sourceWatch) atomicJson(dir, "research-source-watch.json", sourceWatch.ledger);
      return { report: completeReport, reportPath: join(dir, "research-discovery.json"), snapshotPath: join(dir, "research-stock.json") };
    }
    if (command === "prepare") {
      const observed = observeReviewStock(ledger, snapshot!, now);
      const proposal = prepareReviewProposal(observed, snapshot!, fileText(CONFIRMATIONS), now);
      atomicJson(dir, "research-proposal.json", proposal);
      atomicJson(dir, STATE, observed);
      return { proposalOnly: true, path: join(dir, "research-proposal.json"), proposal };
    }
    if (command === "apply") {
      const proposal = jsonFile(join(dir, "research-proposal.json")) as ReviewProposal;
      const result = applyReviewProposal(ledger, snapshot!, fileText(CONFIRMATIONS), proposal, required("--proposal-sha256"), now);
      persistReviewApplication(dir, ledger, result, CONFIRMATIONS);
      return { appliedLocally: true, alreadyApplied: result.alreadyApplied ?? false, published: false, proposalSha256: proposal.proposalSha256, afterSha256: result.afterSha256, includedKeys: proposal.includedKeys };
    }
    let next: ReviewLedger;
    if (command === "decide-batch") {
      const batch = jsonFile(resolve(required("--input"))) as { schemaVersion?: number; answers?: ReviewAnswer[] };
      if (!batch || batch.schemaVersion !== 1 || !Array.isArray(batch.answers) || Object.keys(batch).some(k => !["schemaVersion", "answers"].includes(k))) throw new Error("Lote inválido; informe decisões por chave, unidade e item.");
      next = decideReviewCandidates(ledger, batch.answers, now);
    }
    else if (command === "sync") next = syncReviewCandidates(ledger, input!, snapshot!, now);
    else {
      const identity = { key: required("--key"), vehicleId: required("--vehicle-id"), itemKey: required("--item-key") };
      if (command === "mark-asked") next = markReviewAsked(ledger, identity, now);
      else if (command === "reopen") next = reopenReviewCandidate(ledger, identity, required("--note"), now);
      else if (command === "record-publication") next = recordReviewPublication(ledger, identity, { commit: required("--commit"), publicUrl: required("--public-url"), verifiedAt: now, evidenceReference: required("--evidence-reference"), reversalReference: required("--reversal-reference") });
      else {
        const status = required("--status");
        if (!["confirmed", "rejected", "deferred", "presence_confirmed", "authorized", "excluded"].includes(status)) throw new Error("Status inválido.");
        next = decideReviewCandidate(ledger, { ...identity, status: status as ReviewAnswer["status"], note: required("--note"), present: options.get("--present") === true, authorizePublication: options.get("--authorize-publication") === true, marketConfirmed: options.get("--confirm-market") === true, sourceIdentityConfirmed: options.get("--confirm-source-identity") === true, ...(options.has("--confirmation-reference") ? { confirmationReference: required("--confirmation-reference") } : {}), ...(options.has("--approved-name") || options.has("--approved-description") ? { approvedText: { name: required("--approved-name"), description: required("--approved-description") } } : {}) }, now);
      }
    }
    atomicJson(dir, STATE, next);
    return next;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEquipmentReviewCli(process.argv.slice(2)).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch(error => {
    // Validation errors contain only authored field names; remote bodies and
    // credentials are neither persisted nor printed by this workflow.
    process.stderr.write(`Revisão não concluída: ${error instanceof Error ? error.message : "entrada inválida"}\n`);
    process.exitCode = 1;
  });
}
