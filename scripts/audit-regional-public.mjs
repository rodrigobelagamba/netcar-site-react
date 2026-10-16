#!/usr/bin/env node
// Read-only public HTTP audit. It does not render JavaScript or query Google.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SITE = "https://www.netcarmultimarcas.com.br";
export const USER_AGENTS = {
  normal: "NetcarRegionalCheck/1.0",
  crawler: "NetcarReleaseAuditBot/1.0",
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function decodeHtml(value) {
  const named = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" };
  return String(value).replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi,
    (raw, code) => {
      if (code[0] !== "#") return named[code.toLowerCase()] ?? raw;
      const number = /^#x/i.test(code)
        ? parseInt(code.slice(2), 16)
        : Number(code.slice(1));
      return number > 0 &&
        number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : raw;
    },
  );
}

function attr(tag, name) {
  const match = tag.match(
    new RegExp(
      `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3]) : null;
}

function text(html) {
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function clean(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
}

function sectionById(html, id) {
  const tags = [...html.matchAll(/<\/?section\b[^>]*>/gi)];
  const start = tags.findIndex((tag) => attr(tag[0], "id") === id);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < tags.length; i += 1) {
    depth += /^<\//.test(tags[i][0]) ? -1 : 1;
    if (depth === 0)
      return html.slice(tags[start].index, tags[i].index + tags[i][0].length);
  }
  return "";
}

export function inspectHtml(html, pageUrl, { xRobotsTag = null } = {}) {
  const visible = clean(html);
  const meta = [...visible.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const links = [...visible.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonicals = links
    .filter((tag) =>
      (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
    )
    .map((tag) => attr(tag, "href"));
  const descriptions = meta
    .filter((tag) => attr(tag, "name")?.toLowerCase() === "description")
    .map((tag) => attr(tag, "content"));
  const robots = meta
    .filter((tag) =>
      /^(robots|googlebot|bingbot)$/i.test(attr(tag, "name") ?? ""),
    )
    .map((tag) => ({
      name: attr(tag, "name"),
      content: attr(tag, "content") ?? "",
    }));
  const titles = [
    ...visible.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi),
  ].map((m) => text(m[1]));
  const h1 = [...visible.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(
    (m) => text(m[1]),
  );
  const allTags = [...visible.matchAll(/<[a-z][^>]*>/gi)].map((m) => m[0]);
  const stockTargetCount = allTags.filter(
    (tag) => attr(tag, "id") === "estoque-regional",
  ).length;
  const ctas = [...visible.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)]
    .filter((m) => attr(m[1], "data-regional-action") === "view_stock")
    .map((m) => ({ href: attr(m[1], "href"), text: text(m[2]) }));
  const stockSection = sectionById(visible, "estoque-regional");
  const stockHrefs = [...stockSection.matchAll(/<a\b[^>]*>/gi)]
    .map((m) => attr(m[0], "href"))
    .filter(Boolean);
  const stockVehicleUrls = [
    ...new Set(stockHrefs.filter((href) => /\/veiculo\//i.test(href))),
  ];
  const invalidStockVehicleUrls = stockVehicleUrls.filter((href) => {
    try {
      const url = new URL(href, pageUrl);
      return (
        url.origin !== new URL(pageUrl).origin ||
        !/^\/veiculo\/[^/]+-\d+\/?$/.test(url.pathname)
      );
    } catch {
      return true;
    }
  });
  const stockCatalogUrls = stockHrefs.filter((href) => {
    try {
      const url = new URL(href, pageUrl);
      return (
        url.origin === new URL(pageUrl).origin && url.pathname === "/seminovos"
      );
    } catch {
      return false;
    }
  });
  const hasNoindex =
    robots.some((tag) => /\b(noindex|none)\b/i.test(tag.content)) ||
    /\b(noindex|none)\b/i.test(xRobotsTag ?? "");
  return {
    titles,
    descriptions,
    canonicals,
    robots,
    xRobotsTag,
    hasNoindex,
    h1,
    stockTargetCount,
    stockCtas: ctas,
    stockVehicleUrls,
    invalidStockVehicleUrls,
    stockCatalogUrls,
    appShellPresent: allTags.some((tag) => attr(tag, "id") === "root"),
    sourceBytes: Buffer.byteLength(html),
    sourceSha256: createHash("sha256").update(html).digest("hex"),
  };
}

export function compareCity(city, normal, crawler, baseUrl = SITE) {
  const url = `${baseUrl}/seminovos-${city.slug}`;
  const errors = [];
  for (const [kind, response] of Object.entries({ normal, crawler })) {
    if (response.error) {
      errors.push(`${kind}:request_failed`);
      continue;
    }
    if (response.status !== 200) errors.push(`${kind}:http_${response.status}`);
    if (response.finalUrl !== url) errors.push(`${kind}:unexpected_redirect`);
    if (!/\btext\/html\b/i.test(response.contentType ?? ""))
      errors.push(`${kind}:not_html`);
    const data = response.document;
    if (!data) {
      errors.push(`${kind}:document_missing`);
      continue;
    }
    if (data.titles.length !== 1 || data.titles[0] !== city.title)
      errors.push(`${kind}:title_source_mismatch`);
    if (
      data.descriptions.length !== 1 ||
      data.descriptions[0] !== city.description
    )
      errors.push(`${kind}:description_source_mismatch`);
    if (data.canonicals.length !== 1 || data.canonicals[0] !== url)
      errors.push(`${kind}:canonical_mismatch`);
    if (data.hasNoindex) errors.push(`${kind}:noindex`);
  }
  const data = crawler.document;
  if (data) {
    if (data.h1.length !== 1 || data.h1[0] !== city.h1)
      errors.push("crawler:h1_source_mismatch");
    if (data.stockTargetCount !== 1)
      errors.push("crawler:stock_target_missing_or_duplicate");
    if (
      data.stockCtas.length !== 1 ||
      data.stockCtas[0].href !== "#estoque-regional"
    )
      errors.push("crawler:stock_cta_mismatch");
    if (!data.stockVehicleUrls.length)
      errors.push("crawler:no_vehicle_links_in_stock");
    if (data.invalidStockVehicleUrls.length)
      errors.push("crawler:invalid_vehicle_links");
    if (!data.stockCatalogUrls.length)
      errors.push("crawler:full_catalog_link_missing");
  }
  const normalDoc = normal.document;
  const parity =
    normalDoc && data
      ? {
          title:
            JSON.stringify(normalDoc.titles) === JSON.stringify(data.titles),
          description:
            JSON.stringify(normalDoc.descriptions) ===
            JSON.stringify(data.descriptions),
          canonical:
            JSON.stringify(normalDoc.canonicals) ===
            JSON.stringify(data.canonicals),
          normalH1Count: normalDoc.h1.length,
          crawlerH1Count: data.h1.length,
          normalStockTargetCount: normalDoc.stockTargetCount,
          crawlerStockTargetCount: data.stockTargetCount,
          expectedContract:
            "Regular visitor may receive the React shell; audit crawler receives prerendered body. Body differences alone are not a failure.",
          renderedDomChecked: false,
        }
      : null;
  return {
    city: city.name,
    slug: city.slug,
    url,
    expected: { title: city.title, description: city.description, h1: city.h1 },
    normal,
    crawler,
    parity,
    errors,
    passed: errors.length === 0,
  };
}

export async function mapLimit(items, concurrency, mapper) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2)
    throw new Error("Concurrency must be 1 or 2.");
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

export async function fetchDocument(url, kind, fetchImpl = fetch) {
  const requestedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENTS[kind], Accept: "text/html" },
      signal: AbortSignal.timeout(30000),
      redirect: "follow",
    });
    const html = await response.text();
    return {
      requestedAt,
      completedAt: new Date().toISOString(),
      userAgent: USER_AGENTS[kind],
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type"),
      document: inspectHtml(html, url, {
        xRobotsTag: response.headers.get("x-robots-tag"),
      }),
    };
  } catch (error) {
    return {
      requestedAt,
      completedAt: new Date().toISOString(),
      userAgent: USER_AGENTS[kind],
      status: null,
      error: String(error?.message ?? error),
    };
  }
}

export async function runAudit({
  cities,
  baseUrl = SITE,
  concurrency = 2,
  fetchImpl = fetch,
  progress = () => {},
}) {
  const fetched = await mapLimit(
    cities.flatMap((city) =>
      ["normal", "crawler"].map((kind) => ({ city, kind })),
    ),
    concurrency,
    async ({ city, kind }) => {
      const url = `${baseUrl}/seminovos-${city.slug}`;
      const response = await fetchDocument(url, kind, fetchImpl);
      progress(`${city.slug} ${kind}: ${response.status ?? "request failed"}`);
      return { slug: city.slug, kind, response };
    },
  );
  const pages = cities.map((city) => {
    const normal = fetched.find(
      (entry) => entry.slug === city.slug && entry.kind === "normal",
    ).response;
    const crawler = fetched.find(
      (entry) => entry.slug === city.slug && entry.kind === "crawler",
    ).response;
    return compareCity(city, normal, crawler, baseUrl);
  });
  const validStockUrls = [
    ...new Set(
      pages.flatMap((page) => {
        const doc = page.crawler.document;
        return [
          ...(doc?.stockVehicleUrls ?? []),
          ...(doc?.stockCatalogUrls ?? []),
        ]
          .filter((href) => {
            try {
              return new URL(href, baseUrl).origin === baseUrl;
            } catch {
              return false;
            }
          })
          .map((href) => new URL(href, baseUrl).href);
      }),
    ),
  ];
  const stockFetched = await mapLimit(
    validStockUrls.flatMap((url) =>
      ["normal", "crawler"].map((kind) => ({ url, kind })),
    ),
    concurrency,
    async ({ url, kind }) => ({
      url,
      kind,
      response: await fetchDocument(url, kind, fetchImpl),
    }),
  );
  const stockUrlChecks = validStockUrls.map((url) => {
    const normal = stockFetched.find(
      (entry) => entry.url === url && entry.kind === "normal",
    ).response;
    const crawler = stockFetched.find(
      (entry) => entry.url === url && entry.kind === "crawler",
    ).response;
    const errors = [];
    const warnings = [];
    for (const [kind, response] of Object.entries({ normal, crawler })) {
      if (response.error) {
        errors.push(`${kind}:request_failed`);
        continue;
      }
      if (response.status !== 200)
        errors.push(`${kind}:http_${response.status}`);
      if (response.finalUrl !== url) errors.push(`${kind}:unexpected_redirect`);
      if (response.document.hasNoindex) errors.push(`${kind}:noindex`);
      if (!/\btext\/html\b/i.test(response.contentType ?? ""))
        errors.push(`${kind}:not_html`);
      if (
        response.document.canonicals.length !== 1 ||
        response.document.canonicals[0] !== url
      ) {
        if (
          kind === "normal" &&
          response.document.appShellPresent &&
          response.document.canonicals.length === 1 &&
          response.document.canonicals[0] === `${baseUrl}/`
        )
          warnings.push(
            "normal:app_shell_has_home_canonical_before_javascript",
          );
        else errors.push(`${kind}:canonical_mismatch`);
      }
    }
    return {
      url,
      normal,
      crawler,
      errors,
      warnings,
      passed: errors.length === 0,
      availabilityChecked: false,
      renderedDomChecked: false,
    };
  });
  return {
    pages,
    stockUrlChecks,
    passed:
      pages.every((page) => page.passed) &&
      stockUrlChecks.every((check) => check.passed),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--out", "--base-url", "--cities-file", "--concurrency"].includes(
        args[index],
      ) ||
      !args[index + 1]
    )
      throw new Error(
        "Usage: node scripts/audit-regional-public.mjs [--out report.json] [--base-url https://...] [--cities-file file.json] [--concurrency 1|2]",
      );
    options[args[index]] = args[index + 1];
  }
  const baseUrl = new URL(options["--base-url"] ?? SITE).origin;
  const concurrency = Number(options["--concurrency"] ?? 2);
  const sourceFile = resolve(
    options["--cities-file"] ?? resolve(ROOT, "src/data/seo/cities.json"),
  );
  const sourceText = await readFile(sourceFile, "utf8");
  const cities = JSON.parse(sourceText);
  if (
    !Array.isArray(cities) ||
    !cities.length ||
    new Set(cities.map((city) => city.slug)).size !== cities.length ||
    cities.some(
      (city) =>
        !/^[a-z0-9-]+$/.test(city.slug) ||
        ["name", "title", "description", "h1"].some(
          (key) => typeof city[key] !== "string" || !city[key].trim(),
        ),
    )
  )
    throw new Error("Invalid cities source.");
  const startedAt = new Date().toISOString();
  const result = await runAudit({
    cities,
    baseUrl,
    concurrency,
    progress: (line) => console.log(line),
  });
  let commit = null;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    /* source hash still identifies the input */
  }
  const report = {
    schemaVersion: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    source: {
      file: sourceFile,
      sha256: createHash("sha256").update(sourceText).digest("hex"),
      commit,
      note: "Source read once at audit start; commit does not imply a clean worktree or deployment.",
    },
    method: {
      requestConcurrency: concurrency,
      userAgents: USER_AGENTS,
      surface: "public HTTP HTML only",
      googleIndexationChecked: false,
      rankingChecked: false,
      renderedDomChecked: false,
      geoSimulation: false,
      inventoryAvailabilityChecked: false,
    },
    limitations: [
      "Absence of noindex is not proof of Google indexing.",
      "Stock HTTP200 is not proof of vehicle availability or successful JavaScript rendering.",
      "Crawler and regular-visitor bodies differ by the established server contract; city metadata parity is checked.",
      "A stock-page React shell with the home canonical is reported as a warning for rendered-DOM follow-up, not concealed or labelled confirmed desindexation.",
      "No Maps, Map Pack, ranking, traffic or conversion measurements are produced.",
    ],
    summary: {
      cityCount: cities.length,
      cityPassedCount: result.pages.filter((page) => page.passed).length,
      stockUrlCount: result.stockUrlChecks.length,
      stockUrlPassedCount: result.stockUrlChecks.filter((entry) => entry.passed)
        .length,
      stockUrlWarningCount: result.stockUrlChecks.filter(
        (entry) => entry.warnings.length,
      ).length,
    },
    ...result,
  };
  const output = resolve(
    options["--out"] ??
      resolve(
        ROOT,
        "../output/audits",
        startedAt.slice(0, 10),
        "public-regional-audit.json",
      ),
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ output, ...report.summary, passed: report.passed }),
  );
  if (!report.passed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
