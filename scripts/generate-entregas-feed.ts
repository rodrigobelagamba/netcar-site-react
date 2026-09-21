import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deliveries } from "../src/modules/entregas/lib/deliveries";

// Only the reviewed seed is built. Live publications belong to the server and
// must never be replaced by a local snapshot or a frontend deployment.
const directory = fileURLToPath(new URL("../public/entregas-data/", import.meta.url));
await mkdir(directory, { recursive: true });
const target = `${directory}/seed.json`;
const fields = ["id", "name", "imageUrl", "previewImageUrl", "previewSrcSet", "imagePosition", "date", "year", "month", "caption", "source", "publishedAt", "sourceUrl", "sourceLabel"];
const clean = deliveries.map((delivery) => Object.fromEntries(
  Object.entries(delivery).filter(([field]) => fields.includes(field)),
));
const output = `${JSON.stringify({ version: 1, deliveries: clean })}\n`;
const previous = await readFile(target, "utf8").catch(() => "");
if (output !== previous) {
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, output);
  await rename(temporary, target);
}
console.log(`Entregas: ${clean.length} fotos no seed; publicações ao vivo preservadas.`);
