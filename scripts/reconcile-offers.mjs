#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOfferReconciliation,
  planOfferReconciliation,
  rollbackOfferReconciliation,
  withOfferReconciliationLock,
} from "./lib/offer-reconciliation.js";
import { readSeoBuildStockSnapshot } from "./lib/seo-stock-cache.js";
import { acquireSitePublishLock } from "./lib/site-publish-lock.mjs";
import { configureSeoStockNetwork } from "./lib/seo-stock-source.js";

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function runOfferReconciliation({
  rootDir = defaultRoot,
  apply = false,
  snapshotFromBuild = false,
  rollback,
  fetchStock,
} = {}) {
  const release = acquireSitePublishLock(rootDir);
  try {
    return await withOfferReconciliationLock(rootDir, async () => {
    if (rollback) return { mode: "rollback", ...rollbackOfferReconciliation(rootDir, rollback) };
    const snapshot = snapshotFromBuild
      ? readSeoBuildStockSnapshot(rootDir, { includeSold: true })
      : await (fetchStock ?? (await import("./lib/seo-stock-source.js")).fetchCompleteSeoStock)({ rootDir });
    const plan = planOfferReconciliation(rootDir, snapshot);
    const result = apply
      ? applyOfferReconciliation(rootDir, plan)
      : { changed: plan.changes.length > 0, changedFiles: plan.changes.map((change) => change.path) };
    return { mode: apply ? "apply" : "dry-run", ...result, summary: plan.summary };
    });
  } finally {
    release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(["--apply", "--dry-run", "--snapshot-from-build", "--rollback"]);
  let rollback;
  for (let index = 0; index < args.length; index += 1) {
    if (!known.has(args[index])) throw new Error("invalid_reconciliation_argument");
    if (args[index] === "--rollback") {
      rollback = args[++index];
      if (!rollback) throw new Error("backup_id_required");
    }
  }
  if ((args.includes("--apply") && args.includes("--dry-run")) || (rollback && args.length !== 2)) throw new Error("conflicting_reconciliation_arguments");
  const result = await runOfferReconciliation({
    apply: args.includes("--apply"),
    snapshotFromBuild: args.includes("--snapshot-from-build"),
    rollback,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  configureSeoStockNetwork();
  main().catch((error) => {
    // No vehicle payloads, URLs, plate numbers, credentials or response bodies.
    const code = /^[a-z][a-z0-9_]+$/i.test(error?.code || error?.message || "")
      ? error.code || error.message
      : "offer_reconciliation_failed";
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = error?.exitCode === 75 ? 75 : 1;
  });
}
