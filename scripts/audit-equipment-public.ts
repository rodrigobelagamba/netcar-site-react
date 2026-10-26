import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configureEquipmentAuditNetwork,
  EQUIPMENT_STOCK_URL,
  parseStockResponse,
} from "./audit-vehicle-equipment";
import {
  discoveryVehicleFingerprint,
  fetchReviewDiscoverySnapshot,
} from "./lib/equipmentDiscovery";
import {
  parseReviewSnapshot,
  snapshotFromStock,
  type ReviewSnapshot,
  type ReviewStockVehicle,
} from "./lib/equipmentReview";
import {
  buildPublicCheckReport,
  changedPublicVehicleIds,
  comparePublicEquipment,
  publicCheckDue,
  publicCheckPeriod,
  PUBLIC_CHECK_MAX_BYTES,
  PUBLIC_CHECK_MAX_MS,
  PUBLIC_CHECK_ORIGIN,
  safePublicLabel,
  type PublicCheckState,
  type PublicCheckVehicle,
  type PublicEquipmentBrowser,
} from "./lib/equipmentPublicCheck";

const fail = (message: string): never => {
  throw new Error(message);
};
const code = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
export interface PublicCheckApi {
  snapshot: ReviewSnapshot;
  fuels: Record<string, string>;
}

/** Retain only fuel and the existing safe stock projection; raw API never reaches disk/logs. */
export async function fetchPublicCheckApi(
  fetcher: typeof fetch = fetch,
): Promise<PublicCheckApi> {
  configureEquipmentAuditNetwork();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(EQUIPMENT_STOCK_URL, {
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (
        !response.ok ||
        !response.body ||
        Number(response.headers.get("content-length")) > PUBLIC_CHECK_MAX_BYTES
      )
        fail("API pública indisponível.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > PUBLIC_CHECK_MAX_BYTES)
            fail("API pública acima do limite.");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const snapshot = snapshotFromStock(
        parseStockResponse(payload, { includeSold: true }),
        new Date().toISOString(),
      );
      const includedIds = new Set(snapshot.vehicles.map((v) => v.id));
      const fuels: Record<string, string> = Object.create(null);
      for (const row of payload.data)
        if (includedIds.has(String(row.id))) {
          if (
            row.combustivel != null &&
            (typeof row.combustivel !== "string" ||
              row.combustivel.length > 400)
          )
            fail("Combustível inválido na API.");
          fuels[String(row.id)] =
            typeof row.combustivel === "string"
              ? row.combustivel.trim().replace(/\s+/g, " ")
              : "";
        }
      return { snapshot, fuels };
    } catch {
      if (attempt === 2)
        fail(
          "Não foi possível obter API pública completa; relatório anterior preservado.",
        );
    }
  }
  return fail("API pública indisponível.");
}

function readJson(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > PUBLIC_CHECK_MAX_BYTES)
    fail("Arquivo de estado inválido ou acima do limite.");
  return JSON.parse(readFileSync(path, "utf8"));
}
function readState(stateDir: string): PublicCheckState | null {
  const path = join(stateDir, "public-check-state.json");
  if (!existsSync(path)) return null;
  const value = readJson(path);
  if (
    value?.schemaVersion !== 1 ||
    !["running", "succeeded", "failed"].includes(value.status) ||
    ![value.lastAttempt, value.lastSuccess].every(
      (v) =>
        v === null || (typeof v === "string" && Number.isFinite(Date.parse(v))),
    ) ||
    !(value.period === null || /^\d{4}-\d{2}-\d{2}$/.test(value.period)) ||
    !(value.error === null || typeof value.error === "string") ||
    !Number.isFinite(Date.parse(value.nextRun))
  )
    fail("Estado da conferência pública inválido; preserve para investigação.");
  return value;
}

/** Same nonempty-directory/token ownership pattern as the existing audit lock. */
function acquirePublicLock(stateDir: string) {
  const path = join(stateDir, "public-check.lock");
  const token = randomUUID();
  const name = `${token}.json`;
  const candidate = join(stateDir, `.public-check-lock.${token}`);
  const recover = () => {
    try {
      if (!lstatSync(path).isDirectory()) return false;
      const entries = readdirSync(path);
      if (entries.length !== 1 || !/^[a-f0-9-]{36}\.json$/.test(entries[0]))
        return false;
      const ownerPath = join(path, entries[0]);
      const owner = readJson(ownerPath);
      if (
        owner.token !== entries[0].slice(0, -5) ||
        !Number.isInteger(owner.pid) ||
        owner.pid < 1 ||
        !Number.isFinite(Date.parse(owner.startedAt))
      )
        return false;
      let stale =
        Date.now() - Date.parse(owner.startedAt) >
        PUBLIC_CHECK_MAX_MS + 5 * 60000;
      if (!stale && owner.hostname === hostname()) {
        try {
          process.kill(owner.pid, 0);
        } catch (error) {
          stale = code(error) === "ESRCH";
        }
      }
      if (!stale) return false;
      // Only the contender removing this exact token may remove the directory.
      try {
        unlinkSync(ownerPath);
      } catch (error) {
        if (code(error) === "ENOENT") return false;
        throw error;
      }
      rmdirSync(path);
      return true;
    } catch (error) {
      if (code(error) === "ENOENT") return true;
      return false;
    }
  };
  mkdirSync(candidate, { mode: 0o700 });
  writeFileSync(
    join(candidate, name),
    JSON.stringify({
      token,
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  try {
    if (existsSync(path) && !recover())
      fail("Já existe conferência pública em execução ou trava pendente.");
    renameSync(candidate, path);
  } catch (error) {
    try {
      unlinkSync(join(candidate, name));
      rmdirSync(candidate);
    } catch {
      /* own candidate only */
    }
    throw error;
  }
  const assertOwnership = () => {
    if (
      !existsSync(join(path, name)) ||
      readJson(join(path, name)).token !== token
    )
      fail("A conferência perdeu a trava; resultado anterior preservado.");
  };
  return {
    assertOwnership,
    write(name: string, value: unknown) {
      assertOwnership();
      const data = `${JSON.stringify(value, null, 2)}\n`;
      if (Buffer.byteLength(data) > PUBLIC_CHECK_MAX_BYTES)
        fail("Relatório acima do limite; resultado anterior preservado.");
      const tmp = join(stateDir, `.${name}.${token}.tmp`);
      try {
        writeFileSync(tmp, data, { mode: 0o600, flag: "wx" });
        assertOwnership();
        renameSync(tmp, join(stateDir, name));
      } finally {
        try {
          unlinkSync(tmp);
        } catch {
          /* renamed or absent */
        }
      }
    },
    release() {
      try {
        unlinkSync(join(path, name));
        rmdirSync(path);
      } catch {
        /* Never remove another owner. */
      }
    },
  };
}

function matchingApiIds(
  snapshot: ReviewSnapshot,
  api: ReviewSnapshot,
): Set<string> {
  // The historical discovery digest excludes seats and market. Both affect
  // reviewed equipment, so supplement this comparison without changing that
  // persisted digest or requiring XML in the supplementary API projection.
  const fingerprint = (vehicle: ReviewStockVehicle) =>
    JSON.stringify([
      discoveryVehicleFingerprint(vehicle),
      vehicle.seats,
      vehicle.market ?? null,
      vehicle.inventoryStatus ?? "active",
    ]);
  const current = new Map(api.vehicles.map((v) => [v.id, fingerprint(v)]));
  return new Set(
    snapshot.vehicles
      .filter((v) => current.get(v.id) === fingerprint(v))
      .map((v) => v.id),
  );
}
export async function runPublicEquipmentCheck({
  stateDir,
  force = false,
  now = () => new Date(),
  // Reuse the same collector with broader equipment-only coverage. Research
  // approval snapshots stay active-only; sold pages still require verification.
  loadBaseline = () => fetchReviewDiscoverySnapshot(fetch, { includeSold: true }),
  loadSnapshot = () => fetchReviewDiscoverySnapshot(fetch, { includeSold: true }),
  loadApi = fetchPublicCheckApi,
  createBrowser = async () =>
    (
      await import("./lib/equipmentPublicBrowser.mjs")
    ).createPublicEquipmentBrowser(),
  timeoutMs = PUBLIC_CHECK_MAX_MS,
}: {
  stateDir: string;
  force?: boolean;
  now?: () => Date;
  timeoutMs?: number;
  loadBaseline?: () => ReviewSnapshot | Promise<ReviewSnapshot>;
  loadSnapshot?: () => Promise<ReviewSnapshot>;
  loadApi?: () => Promise<PublicCheckApi>;
  createBrowser?: () => Promise<PublicEquipmentBrowser>;
}) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  const lock = acquirePublicLock(stateDir);
  let browser: PublicEquipmentBrowser | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortRun: (() => void) | undefined;
  let aborted = false;
  const throwIfAborted = () => {
    if (aborted) fail("Conferência pública interrompida.");
  };
  let state: PublicCheckState | null = null;
  try {
    const previous = readState(stateDir);
    const started = now();
    if (!publicCheckDue(previous, started, force))
      return { skipped: true, state: previous };
    state = {
      schemaVersion: 1,
      lastAttempt: started.toISOString(),
      lastSuccess: previous?.lastSuccess ?? null,
      ...publicCheckPeriod(started),
      status: "running",
      error: null,
    };
    lock.write("public-check-state.json", state);
    const deadline = new Promise<never>((_resolve, reject) => {
      abortRun = () => {
        aborted = true;
        void browser?.close().catch(() => undefined);
        reject(
          new Error(
            "Conferência interrompida ou excedeu o limite de 20 minutos.",
          ),
        );
      };
      timer = setTimeout(
        abortRun,
        Math.min(Math.max(timeoutMs, 1), PUBLIC_CHECK_MAX_MS),
      );
    });
    process.once("SIGTERM", abortRun!);
    process.once("SIGINT", abortRun!);
    const bounded = async <T>(operation: Promise<T>) => {
      throwIfAborted();
      const result = await Promise.race([operation, deadline]);
      throwIfAborted();
      return result;
    };
    const baseline = parseReviewSnapshot(
      await bounded(Promise.resolve(loadBaseline())),
      started.toISOString(),
    );
    if (!baseline.vehicles.every((v) => v.xml))
      fail(
        "Snapshot sem origem XML; execute a descoberta antes da conferência.",
      );
    const initialApi = await bounded(loadApi());
    const initialMatches = matchingApiIds(baseline, initialApi.snapshot);
    browser = await bounded(
      createBrowser().then(async (created) => {
        // A launch completing after cancellation must not leave Chromium orphaned.
        if (aborted) {
          await created.close();
          throwIfAborted();
        }
        browser = created;
        return created;
      }),
    );
    const rows: PublicCheckVehicle[] = [];
    for (const vehicle of baseline.vehicles) {
      throwIfAborted();
      const row: PublicCheckVehicle = {
        vehicleId: vehicle.id,
        publicUrl: `${PUBLIC_CHECK_ORIGIN}/veiculo/${vehicle.id}`,
        model: safePublicLabel(vehicle.model),
        inventoryStatus: vehicle.inventoryStatus,
        status: "inconclusive",
        differences: [],
      };
      if (!initialMatches.has(vehicle.id)) {
        row.differences.push(
          "Estoque mudou entre a descoberta e a leitura da API; conferir em uma nova rodada.",
        );
        rows.push(row);
        continue;
      }
      try {
        const observation = await bounded(browser.observe(vehicle.id));
        rows.push(
          comparePublicEquipment(
            vehicle,
            initialApi.fuels[vehicle.id] ?? "",
            observation,
          ),
        );
      } catch {
        // A timeout/missing page is not evidence that physical equipment is absent.
        row.differences.push(
          "Página não pôde ser conferida por completo; presença física não avaliada.",
        );
        rows.push(row);
        throwIfAborted();
      }
    }
    const [finalSnapshot, finalApi] = await bounded(
      Promise.all([loadSnapshot(), loadApi()]),
    );
    const finalMatches = matchingApiIds(finalSnapshot, finalApi.snapshot);
    const changed = changedPublicVehicleIds(
      baseline,
      initialApi.fuels,
      finalSnapshot,
      finalApi.fuels,
    );
    for (const vehicle of finalSnapshot.vehicles)
      if (!finalMatches.has(vehicle.id)) changed.add(vehicle.id);
    for (const row of rows)
      if (changed.has(row.vehicleId)) {
        row.status = "inconclusive";
        row.differences = [
          "Cadastro XML/API mudou durante a conferência; resultado anterior não representa a unidade atual.",
        ];
      }
    const checkedIds = new Set(rows.map((v) => v.vehicleId));
    // The supplementary API is another HTTP response. A unit entering after
    // the final XML/API pair must remain visible as inconclusive too.
    for (const vehicle of [
      ...finalSnapshot.vehicles,
      ...finalApi.snapshot.vehicles,
    ])
      if (!checkedIds.has(vehicle.id)) {
        rows.push({
          vehicleId: vehicle.id,
          publicUrl: `${PUBLIC_CHECK_ORIGIN}/veiculo/${vehicle.id}`,
          model: safePublicLabel(vehicle.model),
          inventoryStatus: vehicle.inventoryStatus,
          status: "inconclusive",
          differences: [
            "Unidade entrou no estoque durante a conferência; ainda não foi verificada.",
          ],
        });
        checkedIds.add(vehicle.id);
      }
    const report = buildPublicCheckReport(rows, now().toISOString());
    if (report.counts.inconclusive) {
      lock.write("public-check-partial.json", report);
      state = {
        ...state,
        status: "failed",
        error: `Conferência parcial: ${report.counts.inconclusive} de ${report.counts.vehicles} unidades inconclusivas. Último relatório completo preservado.`,
      };
    } else {
      lock.write("public-check-report.json", report);
      state = {
        ...state,
        status: "succeeded",
        lastSuccess: report.generatedAt,
        error: null,
      };
      try {
        unlinkSync(join(stateDir, "public-check-partial.json"));
      } catch (error) {
        if (code(error) !== "ENOENT") throw error;
      }
    }
    lock.write("public-check-state.json", state);
    return { skipped: false, state, report };
  } catch {
    if (state) {
      state = {
        ...state,
        status: "failed",
        error:
          "Conferência pública não concluída (fonte, navegador ou limite de execução). Último relatório completo preservado.",
      };
      lock.write("public-check-state.json", state);
    }
    throw new Error(
      "Conferência pública não concluída; consulte o estado privado. Relatório completo anterior preservado.",
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (abortRun) {
      process.off("SIGTERM", abortRun);
      process.off("SIGINT", abortRun);
    }
    try {
      await browser?.close();
    } finally {
      lock.release();
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (
    args[0] !== "--state-dir" ||
    !args[1] ||
    args.length > 3 ||
    (args.length === 3 && args[2] !== "--force")
  ) {
    process.stderr.write("Informe --state-dir DIRETORIO [--force].\n");
    process.exitCode = 1;
  } else {
    runPublicEquipmentCheck({
      stateDir: resolve(args[1]),
      force: args[2] === "--force",
    })
      .then((result) => {
        process.stdout.write(
          result.skipped
            ? "Conferência pública já tentada neste período semanal.\n"
            : `Conferência pública: ${result.report!.counts.vehicles} unidades; ${result.report!.counts.divergent} divergentes; ${result.report!.counts.inconclusive} inconclusivas.\n`,
        );
        if (!result.skipped && result.state?.status === "failed")
          process.exitCode = 1;
      })
      .catch(() => {
        process.stderr.write(
          "Conferência pública não concluída; resultados anteriores preservados.\n",
        );
        process.exitCode = 1;
      });
  }
}
