import { readFileSync } from "node:fs";

// Material editorial updates to SPA pages do not pass through writeSeoPage.
// A versioned minimum reaches the VPS without refreshing unrelated URL dates.
const pageLastmods = JSON.parse(readFileSync(
  new URL("../../src/data/seo/page-lastmods.json", import.meta.url), "utf8",
));

export function resolvePageLastmod(loc, previousLastmod, fallbackDate) {
  const minimum = pageLastmods[new URL(loc).pathname];
  if (!minimum) return previousLastmod ?? fallbackDate;
  if (!previousLastmod) return minimum;
  return Date.parse(previousLastmod) >= Date.parse(minimum) ? previousLastmod : minimum;
}
