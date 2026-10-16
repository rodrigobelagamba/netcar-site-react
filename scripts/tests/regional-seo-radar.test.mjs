import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  buildRadar,
  change,
  inventoryIntents,
  normalizeDemand,
  renderReport,
  validateObservations,
} from "../regional-seo/radar.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(
  await readFile(new URL("../regional-seo/config.json", import.meta.url)),
);
const evidence = JSON.parse(
  await readFile(new URL("../regional-seo/fixtures/gsc.json", import.meta.url)),
);
const stock = JSON.parse(
  await readFile(
    new URL("../regional-seo/fixtures/stock.json", import.meta.url),
  ),
);
const demandFixture = JSON.parse(
  await readFile(
    new URL("../regional-seo/fixtures/demand.json", import.meta.url),
  ),
);
const landings = [
  {
    slug: "automaticos-ate-80-mil",
    name: "Automáticos até R$ 80 mil",
    type: "faixa",
    filters: { cambio: "AUTOMATICO", precoMax: 80000 },
    indexable: true,
  },
  {
    slug: "automaticos-ate-100-mil",
    name: "Automáticos até R$ 100 mil",
    type: "faixa",
    filters: { cambio: "AUTOMATICO", precoMax: 100000 },
    indexable: true,
  },
  {
    slug: "carros-de-100-a-150-mil",
    name: "Carros de R$ 100 mil a R$ 150 mil",
    type: "faixa",
    filters: { precoMin: 100000, precoMax: 150000 },
    indexable: true,
  },
  {
    slug: "jeep-compass",
    name: "Jeep Compass",
    type: "modelo",
    filters: { marca: "JEEP", modelo: "COMPASS" },
    indexable: true,
  },
  {
    slug: "honda-hr-v",
    name: "Honda HR-V",
    type: "modelo",
    filters: { marca: "HONDA", modelo: "HRV" },
    indexable: true,
  },
  {
    slug: "volkswagen-t-cross",
    name: "Volkswagen T-Cross",
    type: "modelo",
    filters: { marca: "VOLKSWAGEN", modelo: "T CROSS" },
    indexable: false,
  },
];
const run = (extra = {}) =>
  buildRadar({
    config,
    evidence,
    stock,
    landings,
    generatedAt: "2026-10-16T15:00:00Z",
    ...extra,
  });

test("zero denominator is explicit, never Infinity or invented growth", () => {
  assert.deepEqual(change(3, 0), {
    absolute: 3,
    percent: null,
    state: "zero_baseline",
  });
  assert.deepEqual(change(0, 0), {
    absolute: 0,
    percent: null,
    state: "both_zero",
  });
  assert.equal(change(1, null).state, "missing");
  assert.equal(change(1, 6).percent, -83.3);
});

test("missing city metrics are null, never a rank or zero clicks", () => {
  const { report } = run();
  const city = report.cities.find((c) => c.slug === "gravatai");
  assert.equal(city.metrics.current.clicks, null);
  assert.equal(city.metrics.current.impressions, null);
  assert.equal(city.assessment.queue, "collect_baseline");
  assert.equal(city.mapsRank, null);
  assert.equal(city.measuredGenericOrganicRank, null);
  assert.equal(city.searcherResidenceKnown, false);
});

test("GSC page position is not merged with query position or maps", () => {
  const city = run().report.cities.find((c) => c.slug === "sapucaia-do-sul");
  assert.equal(city.metrics.current.averagePosition, 6.3);
  assert.equal(city.queries[0].current.averagePosition, 8);
  assert.equal(city.queries[0].municipalSearchVolume, null);
  assert.equal(city.mapPackRank, null);
});

test("different-date query source is retained and brand is marked", () => {
  const queryEvidence = {
    source: evidence.source,
    source_url: evidence.source_url,
    property: evidence.property,
    search_type: evidence.search_type,
    collected_at: "2026-10-15T17:30:00-03:00",
    current_period: ["2026-09-16", "2026-10-13"],
    previous_period: evidence.previous_period,
    selected_queries: [
      {
        query: "Netcar Esteio",
        impressions_current: 580,
        position_current: 1.2,
      },
    ],
  };
  const city = run({ queryEvidence }).report.cities.find(
    (c) => c.slug === "esteio",
  );
  assert.equal(city.queries[0].source.observedAt, queryEvidence.collected_at);
  assert.equal(city.queries[0].branded, true);
  assert.equal(city.metrics.current.averagePosition, null);
});

test("outside pilot pages are retained without pretending they are within 50km", () => {
  const { report, manifest } = run();
  assert.equal(
    report.cities.find((c) => c.slug === "gramado").role,
    "outside_pilot_radius_unverified",
  );
  assert.equal(manifest.commercialScope.radiusMembershipVerified, false);
  assert.equal(
    report.cities.find((c) => c.slug === "sao-leopoldo").assessment.queue,
    "investigate_decline",
  );
});

test("inventory excludes sold units, matches model variants, and supplies no fake demand", () => {
  const intents = inventoryIntents(config, stock, landings);
  assert.equal(intents.find((i) => i.slug === "honda-hr-v").stockCount, 1);
  assert.equal(intents.find((i) => i.slug === "jeep-compass").stockCount, 1);
  assert.equal(
    intents.find((i) => i.slug === "automaticos-ate-80-mil").status,
    "no_stock",
  );
  assert.equal(intents[0].demand.municipalMonthlySearches, null);
});

test("missing snapshot and unsupported filters stay unknown, not empty inventory", () => {
  assert.equal(inventoryIntents(config, null, landings)[0].stockCount, null);
  const changed = structuredClone(landings);
  changed[0].filters.unknown = true;
  assert.equal(
    inventoryIntents(config, stock, changed)[0].status,
    "unsupported_filter",
  );
});

test("manifest has five cities, eight base queries and genuine stock intentions", () => {
  const { manifest } = run();
  assert.equal(manifest.cities.length, 5);
  for (const c of manifest.cities) {
    assert.equal(
      c.queries.filter((q) => q.intent === "generic_purchase").length,
      8,
    );
    assert.ok(c.queries.some((q) => q.intent === "model_purchase"));
    assert.ok(c.queries.some((q) => q.intent === "budget_purchase"));
    assert.ok(c.queries.every((q) => q.volume === null));
  }
  assert.equal(manifest.networkCalls, 0);
  assert.equal(manifest.provider.paidCollectionAuthorized, false);
  assert.equal(manifest.pendingLocationPoints, 25);
  assert.equal(manifest.measurementCells, 5 * 5 * 12 * 2 * 3);
});

test("no coordinates are inferred from existing city routes or unverified inputs", () => {
  const locations = {
    points: [
      {
        citySlug: "canoas",
        id: "centro",
        latitude: 0,
        longitude: 0,
        status: "verified",
      },
    ],
  };
  const { manifest } = run({
    locations,
    cityData: [
      {
        slug: "canoas",
        distanceKm: 12,
        routeOrigins: [
          { id: "niteroi", label: "Niterói", query: "Niterói, Canoas, RS" },
        ],
      },
    ],
  });
  const c = manifest.cities.find((city) => city.slug === "canoas");
  assert.equal(c.points[0].latitude, null);
  assert.equal(c.points[0].suppliedButUnverified, true);
  assert.equal(c.points[1].searchHint, "Niterói, Canoas, RS");
  assert.equal(c.points[1].latitude, null);
});

test("verified coordinate source is retained, still no paid collection authorization", () => {
  const locations = {
    points: [
      {
        citySlug: "canoas",
        id: "centro",
        latitude: -29,
        longitude: -51,
        status: "verified",
        sourceUrl: "https://example.invalid/coordinate-fixture",
        verifiedAt: "2026-10-16T12:00:00Z",
      },
    ],
  };
  const { manifest } = run({ locations });
  assert.equal(manifest.pendingLocationPoints, 24);
  assert.equal(
    manifest.cities.find((c) => c.slug === "canoas").points[0].latitude,
    -29,
  );
  assert.ok(
    manifest.collectionBlockedBy.includes(
      "explicit_budget_and_provider_approval_required",
    ),
  );
});

test("SERP surfaces are distinct and a viewport never proves GPS", () => {
  const base = {
    citySlug: "canoas",
    query: "carros Canoas",
    observedAt: "2026-10-16T12:00:00Z",
    device: "mobile",
    sourceUrl: "https://example.invalid/serp",
    topResults: [
      { position: 1, title: "Test result one" },
      { position: 2, title: "Test result two" },
      { position: 3, title: "Test result three" },
    ],
    netcarPositions: [],
    resultsAnalyzed: 3,
  };
  const results = validateObservations({
    observations: [
      {
        ...base,
        surface: "google_maps",
        location: {
          method: "map_viewport",
          verified: true,
          latitude: -29,
          longitude: -51,
        },
      },
      {
        ...base,
        surface: "map_pack",
        location: {
          method: "provider_coordinates",
          verified: true,
          latitude: -29,
          longitude: -51,
        },
      },
    ],
  });
  assert.equal(
    results[0].geographicControl,
    "uncontrolled_do_not_compare_as_grid",
  );
  assert.equal(results[1].geographicControl, "coordinate_controlled");
  assert.equal(
    results[1].netcarPresence,
    "not_observed_within_results_analyzed",
  );
  assert.throws(
    () =>
      validateObservations({
        observations: [{ ...base, surface: "gsc_average" }],
      }),
    /superfície/,
  );
});

test("SERP refuses incomplete evidence, date-only observations, malformed URLs and invalid ranks", () => {
  const base = {
    citySlug: "canoas",
    query: "carros Canoas",
    surface: "google_maps",
    device: "mobile",
    observedAt: "2026-10-16T12:00:00-03:00",
    sourceUrl: "https://example.invalid/serp",
    resultsAnalyzed: 3,
    topResults: [
      { position: 1, title: "One" },
      { position: 2, title: "Two" },
      { position: 3, title: "Three" },
    ],
    netcarPositions: [3],
    location: {
      method: "provider_coordinates",
      verified: true,
      latitude: -29,
      longitude: -51,
    },
  };
  for (const changed of [
    { observedAt: "2026-10-16" },
    { observedAt: "2026-10-16T12:00:00" },
    { observedAt: "2026-02-31T12:00:00Z" },
    { sourceUrl: "not a URL" },
    { sourceUrl: "https://" },
    { resultsAnalyzed: 0 },
    { resultsAnalyzed: undefined },
    { topResults: undefined },
    { netcarPositions: undefined },
    { netcarPositions: [4] },
    { netcarPositions: [1.5] },
    { topResults: [{ position: 1, title: "One" }] },
    {
      topResults: [
        { position: 1, title: "One" },
        { position: 1, title: "Repeated" },
        { position: 3, title: "Three" },
      ],
    },
  ])
    assert.throws(
      () => validateObservations({ observations: [{ ...base, ...changed }] }),
      /Observação/,
    );
  assert.equal(
    validateObservations({ observations: [base] })[0].netcarPresence,
    "observed",
  );
});

test("GSC metadata-free metrics cannot become observed growth or decline", () => {
  const { report } = run({
    evidence: {
      city_page_rows: [
        {
          slug: "canoas",
          clicks_current: 1,
          clicks_previous: 20,
          impressions_current: 500,
        },
      ],
    },
  });
  const city = report.cities.find((c) => c.slug === "canoas");
  assert.equal(city.assessment.queue, "collect_baseline");
  assert.equal(city.metrics.current.clicks, null);
  assert.equal(city.metrics.clicksChange.state, "incomparable_source");
  assert.equal(city.metrics.clicksChange.percent, null);
  assert.equal(city.source.validation.currentValid, false);
  assert.equal(report.summary.cityPagesObserved, 0);
});

test("GSC unequal, overlapping, inverted or missing periods are not comparable", () => {
  for (const previous_period of [
    null,
    ["2026-08-19", "2026-09-14"],
    ["2026-09-16", "2026-10-13"],
    ["2026-09-15", "2026-08-19"],
    ["2026-02-30", "2026-03-28"],
  ]) {
    const { report } = run({ evidence: { ...evidence, previous_period } });
    const city = report.cities.find((c) => c.slug === "sao-leopoldo");
    assert.equal(city.metrics.current.clicks, 1);
    assert.equal(city.metrics.previous.clicks, null);
    assert.equal(city.metrics.clicksChange.state, "incomparable_source");
    assert.notEqual(city.assessment.queue, "investigate_decline");
  }
});

test("GSC current data requires property, Web type, dated source and completed calendar period", () => {
  for (const changed of [
    { property: null },
    { search_type: "Discover" },
    { source_url: "bogus" },
    { observed_at: "2026-10-16" },
    { source: "" },
    { current_period: ["2026-09-16", "2026-10-17"] },
    { current_period: ["2026-09-31", "2026-10-13"] },
  ]) {
    const { report } = run({ evidence: { ...evidence, ...changed } });
    assert.equal(report.gsc.source.validation.currentValid, false);
    assert.equal(report.summary.cityPagesObserved, 0);
  }
});

test("GSC query files from another property or search type cannot be mixed", () => {
  assert.throws(
    () =>
      run({
        queryEvidence: { ...evidence, property: "sc-domain:other.invalid" },
      }),
    /propriedade/,
  );
  assert.throws(
    () => run({ queryEvidence: { ...evidence, search_type: "Image" } }),
    /tipo de pesquisa/,
  );
});

test("strict numeric stock strings are normalized without converting invalid values to zero stock", () => {
  const good = {
    generatedAt: stock.generatedAt,
    vehicles: [{ price: "89900", cambio: "AUTOMATICO" }],
  };
  const intent = inventoryIntents(config, good, landings).find(
    (i) => i.slug === "automaticos-ate-100-mil",
  );
  assert.equal(intent.stockCount, 1);
  assert.equal(intent.priceMin, 89900);
  assert.equal(intent.status, "candidate");
  for (const price of [
    "89.900,00",
    "89,900",
    "89900oops",
    "",
    " 89900",
    "1e5",
    "0x01",
    true,
    null,
    undefined,
    -1,
    Number.NaN,
  ]) {
    const bad = {
      generatedAt: stock.generatedAt,
      vehicles: [{ price, cambio: "AUTOMATICO" }],
    };
    const invalid = inventoryIntents(config, bad, landings).find(
      (i) => i.slug === "automaticos-ate-100-mil",
    );
    assert.equal(invalid.stockCount, null);
    assert.equal(invalid.status, "invalid_stock");
  }
});

test("undated stock and missing filter attributes do not create candidates or fake empty inventory", () => {
  for (const generatedAt of [undefined, "2026-10-15", "invalid"]) {
    const changed = { ...stock, generatedAt };
    assert.ok(
      inventoryIntents(config, changed, landings).every(
        (i) => i.stockCount === null && i.status === "undated_stock",
      ),
    );
    assert.ok(
      run({ stock: changed }).manifest.cities.every(
        (c) => c.queries.length === 8,
      ),
    );
  }
  const partial = {
    generatedAt: stock.generatedAt,
    vehicles: [{ price: 89900 }],
  };
  const intent = inventoryIntents(config, partial, landings).find(
    (i) => i.slug === "automaticos-ate-100-mil",
  );
  assert.equal(intent.status, "unsupported_filter");
  assert.equal(intent.stockCount, null);
});

test("report escapes untrusted query text and remains complete with no data", () => {
  const empty = run({ evidence: {}, stock: null, landings: [] });
  const html = renderReport(empty.report, empty.manifest);
  assert.ok(html.includes("Não medido"));
  assert.ok(html.includes("noindex,nofollow"));
  const malicious = run({
    queryEvidence: {
      selected_queries: [{ query: "<script>alert(1)</script> em Canoas" }],
    },
  });
  const escaped = renderReport(malicious.report, malicious.manifest);
  assert.ok(!escaped.includes("<script>"));
  assert.ok(escaped.includes("&lt;script&gt;"));
});

test("Planner keeps zero, unavailable and not-returned terms separate without a sum", () => {
  const demand = normalizeDemand(demandFixture);
  assert.equal(demand.status, "imported_estimates");
  assert.equal(demand.source.validation.valid, true);
  assert.equal(demand.cities[0].rows[0].averageMonthlySearches, 170);
  assert.equal(demand.cities[0].rows[1].averageMonthlySearches, 0);
  assert.equal(
    demand.cities[0].rows[1].status,
    "rounded_zero_not_proof_no_demand",
  );
  assert.equal(demand.cities[0].rows[2].averageMonthlySearches, null);
  assert.equal(demand.cities[0].rows[2].status, "not_available");
  assert.equal(demand.cities[0].rows[3].averageMonthlySearches, null);
  assert.equal(demand.cities[0].rows[3].status, "not_returned");
  assert.equal(demand.summedSearches, null);
  assert.equal(demand.totalUniqueBuyers, null);
  assert.equal(demand.pending[0].city, "Esteio");
  assert.equal(normalizeDemand().status, "not_imported");
});

test("Planner data is never applied to city-suffixed queries, Netcar rankings or residence", () => {
  const { report, manifest } = run({ demand: demandFixture });
  assert.equal(report.summary.demandCitiesObserved, 1);
  assert.ok(
    report.demandResearch.cities[0].rows.every(
      (row) => row.citySuffixAdded === false && row.isNetcarRanking === false,
    ),
  );
  assert.equal(
    report.demandResearch.cities[0].customerResidenceVerified,
    false,
  );
  assert.equal(report.demandResearch.cities[0].radiusMembershipVerified, false);
  assert.ok(
    manifest.cities.every((city) =>
      city.queries.every((query) => query.volume === null),
    ),
  );
  assert.ok(
    report.cities.every(
      (city) =>
        city.mapsRank === null && city.measuredGenericOrganicRank === null,
    ),
  );
  assert.equal(
    report.cities.find((c) => c.slug === "sapucaia-do-sul").metrics.current
      .clicks,
    11,
  );
  const html = renderReport(report, manifest);
  assert.ok(html.includes("Demanda estimada — não é ranking"));
  assert.ok(html.includes("sem nome de cidade"));
  assert.ok(html.includes("0*"));
  assert.ok(html.includes("não retornado, não é zero"));
});

test("Planner rejects source-free numbers and requires a municipal location label", () => {
  for (const changed of [
    { collected_at: "2026-10-16" },
    { source_url: "not a URL" },
    { source: "" },
    { period: ["2026-10", "2025-09"] },
    { period: ["2025-13", "2026-09"] },
    { network: null },
    { measurement_kind: "ranking" },
  ]) {
    const demand = normalizeDemand({ ...demandFixture, ...changed });
    assert.equal(demand.source.validation.valid, false);
    assert.ok(
      demand.cities[0].rows.every((row) => row.averageMonthlySearches === null),
    );
  }
  const missingLocation = structuredClone(demandFixture);
  missingLocation.cities[0].selected_location_label =
    "Rio Grande do Sul estado";
  assert.equal(
    normalizeDemand(missingLocation).cities[0].sourceVerified,
    false,
  );
  assert.ok(
    normalizeDemand(missingLocation).cities[0].rows.every(
      (row) => row.averageMonthlySearches === null,
    ),
  );
});

test("Planner dash overrides a numeric field; invalid values and duplicated rows never become estimates", () => {
  const modified = structuredClone(demandFixture);
  modified.cities[0].rows[2].average_monthly_searches = 0;
  assert.equal(
    normalizeDemand(modified).cities[0].rows[2].averageMonthlySearches,
    null,
  );
  modified.cities[0].rows[0].average_monthly_searches = -1;
  assert.equal(
    normalizeDemand(modified).cities[0].rows[0].status,
    "invalid_estimate",
  );
  const duplicate = structuredClone(demandFixture);
  duplicate.cities[0].rows.push(duplicate.cities[0].rows[0]);
  assert.throws(() => normalizeDemand(duplicate), /termo duplicado/);
  const contradictory = structuredClone(demandFixture);
  contradictory.cities[0].not_returned_seeds.push("carros usados");
  assert.throws(() => normalizeDemand(contradictory), /simultaneamente/);
});

test("Planner rejects disagreement between displayed and numeric estimates", () => {
  for (const display of ["0", "90", "1.700", "170–200", "1.7k"]) {
    const changed = structuredClone(demandFixture);
    changed.cities[0].rows[0].average_monthly_searches_display = display;
    assert.throws(
      () => normalizeDemand(changed),
      /divergentes|formato exibido não suportado/,
    );
  }
  const matchingThousands = structuredClone(demandFixture);
  matchingThousands.cities[0].rows[0].average_monthly_searches_display =
    "1.700";
  matchingThousands.cities[0].rows[0].average_monthly_searches = 1700;
  assert.equal(
    normalizeDemand(matchingThousands).cities[0].rows[0].averageMonthlySearches,
    1700,
  );
});

test("Planner periods later than collection cannot become historical demand", () => {
  for (const period of [
    ["2027-01", "2027-12"],
    ["2025-10", "2026-11"],
  ]) {
    const demand = normalizeDemand({ ...demandFixture, period });
    assert.equal(demand.status, "invalid_source");
    assert.ok(
      demand.source.validation.errors.includes("period_after_collection_month"),
    );
    assert.ok(
      demand.cities[0].rows.every((row) => row.averageMonthlySearches === null),
    );
  }
});

test("Planner rejects city-qualified keywords instead of calling them generic terms", () => {
  for (const keyword of [
    "carros usados em Canoas",
    "Canoas carros usados",
    "carros usados CANOAS RS",
    "carros usados em Esteio",
  ]) {
    const changed = structuredClone(demandFixture);
    changed.cities[0].rows[0].keyword = keyword;
    assert.throws(() => normalizeDemand(changed), /contém nome de cidade/);
  }
  const omitted = structuredClone(demandFixture);
  omitted.cities[0].not_returned_seeds.push("carros automáticos em Canoas");
  assert.throws(() => normalizeDemand(omitted), /contém nome de cidade/);
});

test("CLI generates offline outputs with hashes and refuses overwrite or execute modes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "netcar-regional-radar-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const args = [
    "scripts/regional-seo/cli.mjs",
    "--gsc",
    "scripts/regional-seo/fixtures/gsc.json",
    "--stock",
    "scripts/regional-seo/fixtures/stock.json",
    "--demand",
    "scripts/regional-seo/fixtures/demand.json",
    "--out",
    dir,
    "--dry-run",
  ];
  const result = JSON.parse(
    execFileSync(process.execPath, args, { cwd: root, encoding: "utf8" }),
  );
  assert.equal(result.networkCalls, 0);
  assert.equal(result.demandCitiesObserved, 1);
  const report = JSON.parse(
    await readFile(join(dir, "regional-radar.json"), "utf8"),
  );
  assert.match(report.sourceFiles[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(
    report.sourceFiles.some(
      (source) => source.role === "keyword_planner_municipal",
    ),
  );
  assert.equal(report.demandResearch.source.url, demandFixture.source_url);
  assert.ok(
    (await readFile(join(dir, "regional-radar.html"), "utf8")).includes(
      "Páginas regionais",
    ),
  );
  assert.throws(
    () => execFileSync(process.execPath, args, { cwd: root, stdio: "pipe" }),
    /EEXIST/,
  );
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ["scripts/regional-seo/cli.mjs", "--execute"],
        { cwd: root, stdio: "pipe" },
      ),
    /não possui modo de coleta paga/,
  );
});
