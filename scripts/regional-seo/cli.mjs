#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRadar, renderReport, sha256 } from "./radar.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const allowed = new Set([
  "--gsc",
  "--queries",
  "--stock",
  "--landings",
  "--cities",
  "--config",
  "--locations",
  "--observations",
  "--demand",
  "--out",
  "--generated-at",
  "--dry-run",
  "--help",
]);
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!allowed.has(arg))
    throw new Error(
      `Opção não permitida: ${arg}. O radar não possui modo de coleta paga.`,
    );
  if (["--help", "--dry-run"].includes(arg)) {
    options[arg] = true;
    continue;
  }
  const value = process.argv[++i];
  if (!value || value.startsWith("--"))
    throw new Error(`Falta valor para ${arg}`);
  options[arg] = value;
}
if (options["--help"]) {
  console.log(
    "Radar regional offline. Não acessa rede nem cobra ferramentas.\nnode scripts/regional-seo/cli.mjs --gsc <evidence.json> --out <diretorio> [--queries <gsc-query.json>] [--stock <snapshot.json>] [--landings <landings.json>] [--locations <verified-points.json>] [--observations <serp.json>] [--demand <keyword-planner.json>] [--dry-run]\nSem --out, valida e imprime resumo, sem gravar arquivos. --dry-run reforça explicitamente o modo sempre offline; pode gerar o plano em --out.",
  );
} else {
  if (!options["--gsc"])
    throw new Error(
      "Informe --gsc com uma coleta datada; não existe linha de base implícita.",
    );
  const sources = [];
  const load = async (role, file, required = false) => {
    if (!file) return null;
    const path = resolve(file);
    try {
      const content = await readFile(path, "utf8");
      sources.push({ role, path, sha256: sha256(content) });
      return JSON.parse(content);
    } catch (error) {
      if (!required && error.code === "ENOENT") return null;
      throw new Error(
        `Não foi possível ler JSON de ${role}: ${path} (${error.code ?? "JSON inválido"})`,
      );
    }
  };
  const evidence = await load("gsc_pages", options["--gsc"], true);
  const queryEvidence = await load(
    "gsc_queries",
    options["--queries"],
    Boolean(options["--queries"]),
  );
  const stock = await load(
    "stock_snapshot",
    options["--stock"] ?? join(root, "public/seo/stock-bootstrap.json"),
    Boolean(options["--stock"]),
  );
  const landings = await load(
    "existing_landings",
    options["--landings"] ?? join(root, "src/data/seo/landings.json"),
    Boolean(options["--landings"]),
  );
  const cityData = await load(
    "existing_city_pages",
    options["--cities"] ?? join(root, "src/data/seo/cities.json"),
    true,
  );
  const config = await load(
    "research_config",
    options["--config"] ?? join(root, "scripts/regional-seo/config.json"),
    true,
  );
  const locations = await load(
    "verified_locations",
    options["--locations"],
    Boolean(options["--locations"]),
  );
  const observations = await load(
    "serp_observations",
    options["--observations"],
    Boolean(options["--observations"]),
  );
  const generatedAt = options["--generated-at"] ?? new Date().toISOString();
  const demand = await load(
    "keyword_planner_municipal",
    options["--demand"],
    Boolean(options["--demand"]),
  );
  if (!Number.isFinite(Date.parse(generatedAt)))
    throw new Error("--generated-at precisa ser uma data válida");
  const { report, manifest } = buildRadar({
    evidence,
    queryEvidence,
    stock,
    landings: landings ?? [],
    cityData,
    config,
    locations,
    observations,
    demand,
    generatedAt,
    inputSources: sources,
  });
  if (options["--out"]) {
    const out = resolve(options["--out"]);
    await mkdir(out, { recursive: true });
    // wx prevents silently replacing the evidence of a previous run.
    for (const [name, content] of [
      ["regional-radar.json", JSON.stringify(report, null, 2)],
      ["research-manifest.json", JSON.stringify(manifest, null, 2)],
      ["regional-radar.html", renderReport(report, manifest)],
    ]) {
      await writeFile(join(out, name), `${content}\n`, { flag: "wx" });
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        networkCalls: 0,
        pagesObserved: report.summary.cityPagesObserved,
        stockSnapshotAt: report.summary.stockObservedAt,
        stockCandidates: report.stockIntents.filter(
          (i) => i.status === "candidate",
        ).length,
        plannedMeasurementCells: manifest.measurementCells,
        pendingLocationPoints: manifest.pendingLocationPoints,
        demandCitiesObserved: report.summary.demandCitiesObserved,
        output: options["--out"] ? resolve(options["--out"]) : null,
      },
      null,
      2,
    ),
  );
}
