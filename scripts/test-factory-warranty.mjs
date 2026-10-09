import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// React's act() requires its test/development build. Keep this override scoped
// to the test process; the fixtures still define DEV=false and preview=0.
const generated = spawnSync(process.execPath, ["scripts/generate-factory-warranty-registry.mjs"], { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" });
if (generated.status !== 0) process.exit(generated.status ?? 1);

const result = spawnSync(process.execPath, [
  "--import", "tsx", "--test",
  "scripts/tests/factory-warranty.test.ts",
  "scripts/tests/factory-warranty-reconciliation.test.ts",
  "scripts/tests/factory-warranty-migration.test.ts",
  "scripts/tests/factory-warranty-catalog-adapter.test.mjs",
  "scripts/tests/factory-warranty-query-refresh.test.mjs",
  "scripts/tests/factory-warranty-published.test.mjs",
  "scripts/tests/warranty-reconciliation-audit.test.ts",
  "scripts/tests/factory-warranty-card.test.mjs",
  "scripts/tests/factory-warranty-bootstrap.test.mjs",
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: { ...process.env, NODE_ENV: "test" },
  stdio: "inherit",
});

if (result.error) console.error(`Warranty tests failed to start: ${result.error.message}`);
process.exitCode = result.status ?? 1;
