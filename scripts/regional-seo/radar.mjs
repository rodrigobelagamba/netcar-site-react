import { createHash } from "node:crypto";

const SURFACES = new Set(["organic", "map_pack", "google_maps"]);
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const compact = (value) => normalize(value).replace(/ /g, "");
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const present = (value) => value !== null && value !== undefined;
const array = (value) => (Array.isArray(value) ? value : []);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ],
  );

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function isTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  return (
    isDate(value.slice(0, 10)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(Date.parse(value))
  );
}

function periodDetails(period) {
  if (!Array.isArray(period) || period.length !== 2 || !period.every(isDate))
    return null;
  const [start, end] = period.map((value) => Date.parse(`${value}T00:00:00Z`));
  return end >= start
    ? { start, end, days: (end - start) / 86400000 + 1 }
    : null;
}

function validateGscSource(source) {
  const current = periodDetails(source.currentPeriod);
  const previous = periodDetails(source.previousPeriod);
  const errors = [];
  if (!isTimestamp(source.observedAt))
    errors.push("observed_timestamp_with_timezone_required");
  if (!isHttpUrl(source.url)) errors.push("http_source_url_required");
  if (typeof source.description !== "string" || !source.description.trim())
    errors.push("source_description_required");
  if (
    typeof source.property !== "string" ||
    !(
      /^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(source.property) ||
      isHttpUrl(source.property)
    )
  )
    errors.push("gsc_property_required");
  if (String(source.searchType).toLowerCase() !== "web")
    errors.push("web_search_type_required");
  if (!current) errors.push("valid_current_period_required");
  if (
    current &&
    isTimestamp(source.observedAt) &&
    current.end > Date.parse(`${source.observedAt.slice(0, 10)}T00:00:00Z`)
  )
    errors.push("current_period_after_observation");
  const currentValid = errors.length === 0;
  if (!previous) errors.push("valid_previous_period_required");
  if (current && previous && current.days !== previous.days)
    errors.push("period_duration_mismatch");
  if (current && previous && previous.end >= current.start)
    errors.push("periods_overlap_or_wrong_order");
  return { currentValid, comparisonValid: errors.length === 0, errors };
}

export function change(current, previous) {
  if (!present(current) || !present(previous))
    return { absolute: null, percent: null, state: "missing" };
  if (previous === 0)
    return {
      absolute: current,
      percent: null,
      state: current === 0 ? "both_zero" : "zero_baseline",
    };
  return {
    absolute: current - previous,
    percent: Math.round(((current - previous) / previous) * 1000) / 10,
    state: "comparable",
  };
}

function metrics(
  row = {},
  validation = { currentValid: false, comparisonValid: false },
) {
  const current = {
    clicks: number(row.clicks_current),
    impressions: number(row.impressions_current),
    averagePosition: number(row.position_current),
  };
  const previous = {
    clicks: number(row.clicks_previous),
    impressions: number(row.impressions_previous),
    averagePosition: number(row.position_previous),
  };
  // Retain the source contract with every metric; unverified inputs cannot
  // become observed traffic or comparable growth in the report.
  if (!validation.currentValid)
    for (const key of Object.keys(current)) current[key] = null;
  if (!validation.comparisonValid)
    for (const key of Object.keys(previous)) previous[key] = null;
  for (const period of [current, previous]) {
    period.ctrPercent =
      present(period.clicks) && period.impressions > 0
        ? Math.round((period.clicks / period.impressions) * 10000) / 100
        : null;
  }
  return {
    current,
    previous,
    sourceValidation: validation,
    clicksChange: validation.comparisonValid
      ? change(current.clicks, previous.clicks)
      : { absolute: null, percent: null, state: "incomparable_source" },
    impressionsChange: validation.comparisonValid
      ? change(current.impressions, previous.impressions)
      : { absolute: null, percent: null, state: "incomparable_source" },
  };
}

function sourceOf(evidence, kind) {
  return {
    kind,
    observedAt:
      evidence.observed_at ??
      evidence.collected_at ??
      evidence.observedAt ??
      null,
    description: evidence.source ?? null,
    url: evidence.source_url ?? null,
    property: evidence.property ?? null,
    currentPeriod: evidence.current_period ?? null,
    previousPeriod: evidence.previous_period ?? null,
    searchType: evidence.search_type ?? null,
  };
}

function cityQueries(evidence) {
  return [
    ...array(evidence.selected_queries),
    ...array(evidence.selected_query_rows),
    ...array(evidence.selected_commercial_query_rows),
    ...array(evidence.query_rows),
  ];
}

function pageAssessment(metric) {
  const { current, previous } = metric;
  if (current.impressions === null)
    return {
      queue: "collect_baseline",
      evidence: "insufficient",
      reason: "Sem linha de base observada para esta página.",
    };
  if (
    previous.clicks >= 3 &&
    current.clicks !== null &&
    current.clicks < previous.clicks
  )
    return {
      queue: "investigate_decline",
      evidence: "observed_signal",
      reason:
        "A página perdeu cliques no período comparado. Investigar consultas e destino; causa não determinada.",
    };
  if (
    current.impressions >= 100 &&
    current.clicks !== null &&
    current.clicks <= 2
  )
    return {
      queue: "test_capture",
      evidence: "observed_signal",
      reason:
        "Há aparições da página, mas poucos cliques. Verificar consultas, posição e oferta antes de alterar.",
    };
  if (current.clicks >= 3)
    return {
      queue: "defend_and_test",
      evidence: "observed_signal",
      reason:
        "Existe entrada orgânica observada; preservar URLs e testar melhorias mensuráveis.",
    };
  return {
    queue: "expand_evidence",
    evidence: "limited_sample",
    reason:
      "Amostra pequena; coletar demanda e concorrência antes de priorizar mudanças.",
  };
}

function stockPrice(value) {
  if (typeof value === "string" && /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value))
    value = Number(value);
  return number(value) !== null && value <= Number.MAX_SAFE_INTEGER
    ? value
    : null;
}

function normalizedStock(stock) {
  if (!stock || !Array.isArray(stock.vehicles))
    return { vehicles: null, status: "missing_stock" };
  if (!isTimestamp(stock.generatedAt))
    return { vehicles: null, status: "undated_stock" };
  const vehicles = [];
  for (const v of stock.vehicles) {
    if (!v || typeof v !== "object" || Array.isArray(v))
      return { vehicles: null, status: "invalid_stock" };
    if (v.sold === true) continue;
    const price = stockPrice(v.price ?? v.valor);
    if (price === null) return { vehicles: null, status: "invalid_stock" };
    if (price === 0) continue;
    vehicles.push({
      brand: v.marca ?? "",
      model: v.modelo ?? v.name ?? "",
      gearbox: v.cambio ?? "",
      category: v.categoria ?? "",
      price,
    });
  }
  return { vehicles, status: "dated_snapshot" };
}

function matches(vehicle, filters) {
  const supported = new Set([
    "marca",
    "modelo",
    "cambio",
    "categoria",
    "precoMin",
    "precoMax",
  ]);
  if (Object.keys(filters).some((key) => !supported.has(key))) return null;
  if (
    (filters.marca && !vehicle.brand) ||
    (filters.modelo && !vehicle.model) ||
    (filters.cambio && !vehicle.gearbox) ||
    (filters.categoria && !vehicle.category)
  )
    return null;
  if (
    (present(filters.precoMin) && number(filters.precoMin) === null) ||
    (present(filters.precoMax) && number(filters.precoMax) === null)
  )
    return null;
  if (filters.marca && normalize(vehicle.brand) !== normalize(filters.marca))
    return false;
  if (
    filters.modelo &&
    !compact(vehicle.model).includes(compact(filters.modelo))
  )
    return false;
  if (
    filters.cambio &&
    normalize(vehicle.gearbox) !== normalize(filters.cambio)
  )
    return false;
  if (
    filters.categoria &&
    normalize(vehicle.category) !== normalize(filters.categoria)
  )
    return false;
  if (present(filters.precoMin) && vehicle.price < filters.precoMin)
    return false;
  if (present(filters.precoMax) && vehicle.price > filters.precoMax)
    return false;
  return true;
}

export function inventoryIntents(config, stock, landings) {
  const snapshot = normalizedStock(stock);
  const { vehicles } = snapshot;
  return config.intentSlugs.map((slug) => {
    const landing = array(landings).find((l) => l.slug === slug);
    const candidates =
      vehicles && landing
        ? vehicles.map((vehicle) => ({
            vehicle,
            matched: matches(vehicle, landing.filters ?? {}),
          }))
        : null;
    const unknownFilter = candidates?.some(
      (candidate) => candidate.matched === null,
    );
    const matched =
      candidates && !unknownFilter
        ? candidates.filter((c) => c.matched).map((c) => c.vehicle)
        : null;
    return {
      slug,
      label: landing?.name ?? slug,
      path: `/comprar-${slug}`,
      type: landing?.type ?? null,
      indexable: landing?.indexable ?? null,
      stockCount: matched?.length ?? null,
      stockObservedAt: stock?.generatedAt ?? null,
      priceMin: matched?.length
        ? Math.min(...matched.map((v) => v.price))
        : null,
      priceMax: matched?.length
        ? Math.max(...matched.map((v) => v.price))
        : null,
      status: !landing
        ? "missing_landing"
        : vehicles === null
          ? snapshot.status
          : unknownFilter
            ? "unsupported_filter"
            : !matched.length
              ? "no_stock"
              : landing.indexable !== true
                ? "not_indexable"
                : "candidate",
      demand: { municipalMonthlySearches: null, status: "not_measured" },
      evidence: "stock_snapshot_not_search_demand",
    };
  });
}

function pointIsVerified(point) {
  return (
    point?.status === "verified" &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180 &&
    isHttpUrl(point.sourceUrl) &&
    isTimestamp(point.verifiedAt)
  );
}

function pointsForCity(city, config, cityData, locations) {
  const existing = cityData.find((c) => c.slug === city.slug);
  const origins = [
    { id: "centro", label: "Centro", query: `Centro, ${city.name}, RS` },
    ...array(existing?.routeOrigins).filter((o) => o.id !== "centro"),
  ].slice(0, config.pointsPerCity);
  while (origins.length < config.pointsPerCity)
    origins.push({
      id: `point-${origins.length + 1}`,
      label: `Ponto urbano ${origins.length + 1} a selecionar`,
      query: null,
    });
  return origins.map((origin) => {
    const supplied = array(locations?.points).find(
      (p) => p.citySlug === city.slug && p.id === origin.id,
    );
    const verified = pointIsVerified(supplied);
    return {
      id: origin.id,
      label: origin.label,
      searchHint: origin.query,
      status: verified ? "verified" : "pending_coordinates",
      latitude: verified ? supplied.latitude : null,
      longitude: verified ? supplied.longitude : null,
      sourceUrl: verified ? supplied.sourceUrl : null,
      verifiedAt: verified ? supplied.verifiedAt : null,
      suppliedButUnverified: Boolean(supplied && !verified),
    };
  });
}

export function buildManifest(
  config,
  { intents, cityData = [], locations = null, generatedAt },
) {
  const usableIntents = intents.filter((i) => i.status === "candidate");
  const cities = config.pilotCities.map((city) => ({
    ...city,
    points: pointsForCity(city, config, cityData, locations),
    queries: [
      ...config.genericTerms.map((term, i) => ({
        id: `generic-${i + 1}`,
        text: `${term} em ${city.name}`,
        intent: "generic_purchase",
        candidateLanding:
          city.slug === "esteio" ? "/seminovos" : `/seminovos-${city.slug}`,
        volume: null,
        volumeStatus: "not_measured",
      })),
      ...usableIntents.map((intent) => ({
        id: intent.slug,
        text: `${intent.type === "modelo" ? `${intent.label} seminovo` : intent.label.replace(/R\$\s*/g, "").toLowerCase()} em ${city.name}`,
        intent: intent.type === "modelo" ? "model_purchase" : "budget_purchase",
        candidateLanding: intent.path,
        stockCount: intent.stockCount,
        stockObservedAt: intent.stockObservedAt,
        volume: null,
        volumeStatus: "not_measured",
      })),
    ],
  }));
  const pending = cities.reduce(
    (sum, c) => sum + c.points.filter((p) => p.status !== "verified").length,
    0,
  );
  return {
    schemaVersion: 1,
    generatedAt,
    mode: "dry_run",
    networkCalls: 0,
    commercialScope: {
      center: config.businessCity,
      radiusKm: config.commercialRadiusKm,
      status: config.radiusStatus,
      radiusMembershipVerified: false,
      note: "Raio comercial solicitado. Não prova distância em linha reta, tempo de viagem ou presença física nas cidades.",
    },
    provider: {
      name: "DataForSEO_or_manual_collection",
      requestsCreated: false,
      paidCollectionAuthorized: false,
      status: "not_connected",
      documentation:
        "https://dataforseo.com/help-center/track-local-pack-local-finder-and-google-maps-rankings-with-api",
    },
    surfaces: config.surfaces,
    devices: config.devices,
    measurementCells: cities.reduce(
      (sum, c) =>
        sum +
        c.points.length *
          c.queries.length *
          config.devices.length *
          config.surfaces.length,
      0,
    ),
    measurementCellsAreNotBillableRequestEstimate: true,
    collectionBlockedBy: [
      "explicit_budget_and_provider_approval_required",
      ...(pending ? ["verified_coordinates_missing"] : []),
    ],
    pendingLocationPoints: pending,
    cities,
    competitorsToWatch: config.competitorsToWatch,
    repeatProtocol:
      "Repetir os mesmos termos, pontos, dispositivo e superfície em datas distintas. Registrar fuso, localização solicitada/retornada, horário e fonte. Não comparar Maps com orgânico.",
    requiredObservationFields: [
      "query",
      "citySlug",
      "surface",
      "device",
      "observedAt",
      "sourceUrl",
      "location.method",
      "location.verified",
      "topResults",
      "netcarPositions",
      "resultsAnalyzed",
    ],
    observationContract: {
      observedAt: "ISO date-time with seconds and explicit timezone",
      sourceUrl: "Absolute HTTP(S) evidence URL, no embedded credentials",
      topResults:
        "Array of {position: positive integer, title: nonempty string}, including positions 1..min(3, resultsAnalyzed)",
      netcarPositions:
        "Array of positive integer ranks within resultsAnalyzed; [] means not seen within the analyzed results, not absent from Google",
      resultsAnalyzed:
        "Positive integer denominator; incomplete/zero analyzed collections must not be imported as rankings",
    },
    caution:
      "URL com nome de cidade ou viewport do mapa não simula GPS. Não transformar posição média do GSC em observação desta grade.",
  };
}

export function validateObservations(input = {}) {
  return array(input?.observations).map((observation, index) => {
    if (!observation || !SURFACES.has(observation.surface))
      throw new Error(`Observação ${index}: superfície inválida`);
    if (
      typeof observation.query !== "string" ||
      !observation.query.trim() ||
      typeof observation.citySlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(observation.citySlug) ||
      !["mobile", "desktop"].includes(observation.device) ||
      !isTimestamp(observation.observedAt) ||
      !isHttpUrl(observation.sourceUrl)
    )
      throw new Error(
        `Observação ${index}: query/cidade/dispositivo inválido, ou falta data-hora com fuso e URL HTTP(S) da fonte`,
      );
    const n = observation.resultsAnalyzed;
    const validRank = (rank) =>
      Number.isSafeInteger(rank) && rank > 0 && rank <= n;
    if (
      !Number.isSafeInteger(n) ||
      n < 1 ||
      !Array.isArray(observation.topResults) ||
      !Array.isArray(observation.netcarPositions)
    )
      throw new Error(
        `Observação ${index}: coleção incompleta; informar resultsAnalyzed positivo, topResults e netcarPositions`,
      );
    if (
      observation.topResults.some(
        (result) =>
          !result ||
          !validRank(result.position) ||
          typeof result.title !== "string" ||
          !result.title.trim(),
      ) ||
      observation.netcarPositions.some((rank) => !validRank(rank))
    )
      throw new Error(
        `Observação ${index}: posições ou identificação dos resultados inválidas`,
      );
    const resultRanks = new Set(
      observation.topResults.map((result) => result.position),
    );
    if (
      resultRanks.size !== observation.topResults.length ||
      new Set(observation.netcarPositions).size !==
        observation.netcarPositions.length ||
      Array.from({ length: Math.min(3, n) }, (_, i) => i + 1).some(
        (rank) => !resultRanks.has(rank),
      )
    )
      throw new Error(
        `Observação ${index}: resultados repetidos ou top 3 incompleto`,
      );
    const controlled =
      observation.location?.verified === true &&
      ["provider_coordinates", "device_geolocation"].includes(
        observation.location?.method,
      ) &&
      Number.isFinite(observation.location?.latitude) &&
      Math.abs(observation.location.latitude) <= 90 &&
      Number.isFinite(observation.location?.longitude) &&
      Math.abs(observation.location.longitude) <= 180;
    return {
      ...observation,
      netcarPresence: observation.netcarPositions.length
        ? "observed"
        : "not_observed_within_results_analyzed",
      geographicControl: controlled
        ? "coordinate_controlled"
        : "uncontrolled_do_not_compare_as_grid",
      evidence: "observed_serp_not_gsc",
    };
  });
}

export function normalizeDemand(input = null) {
  const limitations = [
    "Estimativas históricas mensais do Planejador, não tráfego nem posição da Netcar.",
    "Os termos foram pesquisados sem nome de cidade, com filtro municipal. Não equivalem ao volume de uma busca como 'carros usados em Canoas'.",
    "Não somar linhas: médias arredondadas e variantes próximas podem se sobrepor; não representam compradores únicos.",
    "Zero exibido é zero arredondado, não prova ausência de procura. Traço e termo não retornado são desconhecidos.",
    "O filtro municipal é a atribuição geográfica do Google, não residência confirmada nem raio de 50 km verificado.",
    "Concorrência de anúncios, quando disponível, não mede dificuldade orgânica. Nenhum índice de dificuldade foi criado.",
  ];
  if (!input)
    return {
      status: "not_imported",
      source: null,
      cities: [],
      pending: [],
      limitations,
    };
  const source = {
    kind: input.measurement_kind ?? null,
    observedAt: input.collected_at ?? null,
    description: input.source ?? null,
    url: input.source_url ?? null,
    period: input.period ?? null,
    network: input.network ?? null,
    language: input.language ?? null,
    queryMethod: input.query_method ?? null,
  };
  const errors = [];
  if (!isTimestamp(source.observedAt))
    errors.push("dated_collection_with_timezone_required");
  if (!isHttpUrl(source.url)) errors.push("http_source_url_required");
  if (typeof source.description !== "string" || !source.description.trim())
    errors.push("source_description_required");
  if (source.kind !== "historical_search_demand_estimate_not_ranking")
    errors.push("historical_estimate_kind_required");
  const validPeriod =
    Array.isArray(source.period) &&
    source.period.length === 2 &&
    source.period.every(
      (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m),
    ) &&
    source.period[0] <= source.period[1];
  if (!validPeriod) errors.push("valid_month_range_required");
  if (
    validPeriod &&
    isTimestamp(source.observedAt) &&
    source.period[1] > source.observedAt.slice(0, 7)
  )
    errors.push("period_after_collection_month");
  if (
    ![source.network, source.language, source.queryMethod].every(
      (value) => typeof value === "string" && value.trim(),
    )
  )
    errors.push("network_language_method_required");
  source.validation = { valid: errors.length === 0, errors };
  const namedCities = [
    ...array(input.cities).map((city) => city?.name),
    ...array(input.pending).map((item) => item?.city),
  ]
    .filter((name) => typeof name === "string" && name.trim())
    .map(normalize);
  const rejectCityQualifiedKeyword = (keyword) => {
    if (
      namedCities.some((cityName) =>
        ` ${normalize(keyword)} `.includes(` ${cityName} `),
      )
    )
      throw new Error(
        `Demanda municipal: termo '${keyword}' contém nome de cidade; este importador exige termos sem qualificador geográfico.`,
      );
  };
  const cityIds = new Set();
  const cities = array(input.cities).map((city) => {
    if (
      !city ||
      typeof city.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city.slug) ||
      typeof city.name !== "string" ||
      !city.name.trim()
    )
      throw new Error("Demanda municipal: cidade sem identificação válida.");
    if (cityIds.has(city.slug))
      throw new Error(`Demanda municipal: cidade duplicada (${city.slug}).`);
    cityIds.add(city.slug);
    const locationValid =
      typeof city.selected_location_label === "string" &&
      city.selected_location_label.trim() &&
      normalize(city.selected_location_label).startsWith(
        `${normalize(city.name)} `,
      ) &&
      /\bcidade\b/.test(normalize(city.selected_location_label));
    const seen = new Set();
    const rows = array(city.rows).map((row) => {
      if (!row || typeof row.keyword !== "string" || !row.keyword.trim())
        throw new Error(
          `Demanda municipal ${city.slug}: termo sem identificação.`,
        );
      rejectCityQualifiedKeyword(row.keyword);
      const key = normalize(row.keyword);
      if (seen.has(key))
        throw new Error(
          `Demanda municipal ${city.slug}: termo duplicado (${row.keyword}).`,
        );
      seen.add(key);
      const display =
        typeof row.average_monthly_searches_display === "string"
          ? row.average_monthly_searches_display.trim()
          : null;
      const displayUnknown = !display || ["—", "–", "-"].includes(display);
      const raw = row.average_monthly_searches;
      const validValue = Number.isSafeInteger(raw) && raw >= 0;
      const missingValue = raw === null || raw === undefined;
      if (!displayUnknown && validValue) {
        const displayNumeric = /^(0|[1-9]\d*)$/.test(display)
          ? Number(display)
          : /^[1-9]\d{0,2}(?:[.,]\d{3})+$/.test(display)
            ? Number(display.replace(/[.,]/g, ""))
            : null;
        if (displayNumeric === null || !Number.isSafeInteger(displayNumeric))
          throw new Error(
            `Demanda municipal ${city.slug}: formato exibido não suportado para '${row.keyword}'; não convertido em volume.`,
          );
        if (displayNumeric !== raw)
          throw new Error(
            `Demanda municipal ${city.slug}: valor exibido e valor numérico divergentes para '${row.keyword}'; corrigir a evidência antes de importar.`,
          );
      }
      const value =
        source.validation.valid &&
        locationValid &&
        !displayUnknown &&
        validValue
          ? raw
          : null;
      const status =
        !source.validation.valid || !locationValid
          ? "unverified_source"
          : displayUnknown || missingValue
            ? "not_available"
            : !validValue
              ? "invalid_estimate"
              : value === 0
                ? "rounded_zero_not_proof_no_demand"
                : "observed_estimate";
      return {
        keyword: row.keyword,
        averageMonthlySearches: value,
        originalDisplay: display,
        kind: ["supplied_keyword", "suggested_keyword"].includes(row.kind)
          ? row.kind
          : "unspecified",
        status,
        citySuffixAdded: false,
        isNetcarRanking: false,
      };
    });
    for (const keyword of array(city.not_returned_seeds)) {
      if (typeof keyword !== "string" || !keyword.trim())
        throw new Error(
          `Demanda municipal ${city.slug}: termo não retornado inválido.`,
        );
      rejectCityQualifiedKeyword(keyword);
      if (seen.has(normalize(keyword)))
        throw new Error(
          `Demanda municipal ${city.slug}: termo retornado e não retornado simultaneamente.`,
        );
      seen.add(normalize(keyword));
      rows.push({
        keyword,
        averageMonthlySearches: null,
        originalDisplay: null,
        kind: "supplied_keyword",
        status: "not_returned",
        citySuffixAdded: false,
        isNetcarRanking: false,
      });
    }
    return {
      slug: city.slug,
      name: city.name,
      selectedLocationLabel: city.selected_location_label ?? null,
      sourceVerified: source.validation.valid && Boolean(locationValid),
      rows,
      customerResidenceVerified: false,
      radiusMembershipVerified: false,
    };
  });
  return {
    status: source.validation.valid ? "imported_estimates" : "invalid_source",
    source,
    cities,
    pending: array(input.pending).map((p) => ({
      city: p.city ?? null,
      reason: p.reason ?? null,
    })),
    limitations: [...limitations, ...array(input.limits)],
    summedSearches: null,
    totalUniqueBuyers: null,
  };
}

export function buildRadar({
  evidence = {},
  queryEvidence = null,
  stock = null,
  landings = [],
  config,
  cityData = [],
  locations = null,
  observations = null,
  demand = null,
  generatedAt = new Date().toISOString(),
  inputSources = [],
}) {
  if (
    !config ||
    !Array.isArray(config.pilotCities) ||
    !config.pilotCities.length ||
    !Array.isArray(config.genericTerms) ||
    config.genericTerms.length < 8 ||
    !Array.isArray(config.intentSlugs)
  )
    throw new Error(
      "Configuração deve conter cidades, oito termos genéricos e intenções.",
    );
  if (
    !Number.isInteger(config.pointsPerCity) ||
    config.pointsPerCity < 1 ||
    config.pointsPerCity > 20 ||
    !Array.isArray(config.devices) ||
    !config.devices.length ||
    config.devices.some((d) => !["mobile", "desktop"].includes(d)) ||
    !Array.isArray(config.surfaces) ||
    !config.surfaces.length ||
    config.surfaces.some((s) => !SURFACES.has(s))
  )
    throw new Error(
      "Configuração de pontos, dispositivos ou superfícies inválida.",
    );
  if (
    new Set(config.pilotCities.map((c) => c.slug)).size !==
    config.pilotCities.length
  )
    throw new Error("Cidades duplicadas.");
  const primarySource = sourceOf(evidence, "gsc_page");
  const querySource = sourceOf(queryEvidence ?? evidence, "gsc_selected_query");
  primarySource.validation = validateGscSource(primarySource);
  querySource.validation = validateGscSource(querySource);
  if (
    queryEvidence &&
    primarySource.property &&
    querySource.property &&
    primarySource.property !== querySource.property
  )
    throw new Error(
      "Fontes GSC incompatíveis: propriedade das consultas difere da propriedade das páginas.",
    );
  if (
    queryEvidence &&
    primarySource.searchType &&
    querySource.searchType &&
    normalize(primarySource.searchType) !== normalize(querySource.searchType)
  )
    throw new Error(
      "Fontes GSC incompatíveis: tipo de pesquisa das consultas difere do tipo das páginas.",
    );
  const queries = cityQueries(queryEvidence ?? evidence);
  const allCities = [
    ...config.pilotCities,
    ...array(evidence.city_page_rows)
      .filter((r) => !config.pilotCities.some((c) => c.slug === r.slug))
      .map((r) => ({
        slug: r.slug,
        name: cityData.find((c) => c.slug === r.slug)?.name ?? r.slug,
        role: "outside_pilot_radius_unverified",
      })),
  ];
  const cities = allCities.map((city) => {
    const row = array(evidence.city_page_rows).find(
      (r) => r.slug === city.slug,
    );
    const metric = metrics(row, primarySource.validation);
    return {
      ...city,
      page: city.slug === "esteio" ? null : `/seminovos-${city.slug}`,
      source: primarySource,
      metrics: metric,
      assessment: pageAssessment(metric),
      queries: queries
        .filter((q) => normalize(q.query).includes(normalize(city.name)))
        .map((q) => ({
          query: q.query,
          ...metrics(q, querySource.validation),
          source: querySource,
          kind: "gsc_query_not_local_rank",
          branded: /\bnetcar\b/.test(normalize(q.query)),
          municipalSearchVolume: null,
        })),
      searcherResidenceKnown: false,
      mapsRank: null,
      mapPackRank: null,
      measuredGenericOrganicRank: null,
      qualifiedLeads: null,
      sales: null,
    };
  });
  const intents = inventoryIntents(config, stock, landings);
  const demandResearch = normalizeDemand(demand);
  const report = {
    schemaVersion: 1,
    generatedAt,
    mode: "offline_analysis",
    sourceFiles: inputSources,
    summary: {
      pilotCities: config.pilotCities.length,
      cityPagesObserved: cities.filter(
        (c) => c.metrics.current.impressions !== null,
      ).length,
      totalActiveStockSnapshot: normalizedStock(stock).vehicles?.length ?? null,
      stockValidationStatus: normalizedStock(stock).status,
      stockObservedAt: stock?.generatedAt ?? null,
      stockIsLiveVerified: false,
      paidNetworkCalls: 0,
      demandCitiesObserved: demandResearch.cities.filter(
        (city) => city.sourceVerified,
      ).length,
    },
    gsc: {
      source: primarySource,
      querySource,
      totals: evidence.totals ?? null,
      dataIsSubset: true,
      originalLimits: array(evidence.limits),
    },
    cities,
    stockIntents: intents,
    commercialQueries: array(evidence.selected_commercial_query_rows).map(
      (q) => ({
        query: q.query,
        ...metrics(q, primarySource.validation),
        source: primarySource,
        city: null,
        municipalSearchVolume: null,
      }),
    ),
    transactionalPages: array(evidence.selected_transactional_pages).map(
      (p) => ({
        path: p.path,
        ...metrics(p, primarySource.validation),
        source: primarySource,
      }),
    ),
    serpObservations: validateObservations(observations),
    demandResearch,
    unmeasured: [
      "city_suffixed_query_and_model_demand_not_measured",
      "competitor_traffic",
      "customer_residence",
      "city_qualified_leads_and_sales",
      "50km_radius_membership",
    ],
    safeguards: [
      "GSC Web mede aparições e cliques da Netcar; não é volume total do mercado nem ranking do Maps.",
      "Cidade no URL ou na consulta não comprova residência ou localização física do visitante.",
      "Posição média da página mistura consultas; não é ranking genérico de uma cidade.",
      "Dados ausentes são null, não zero. Variação sobre base zero não gera percentual.",
      "Filas de investigação são heurísticas transparentes, não notas de SEO nem causalidade comprovada.",
      "Estoque é snapshot datado. Não gerar páginas cidade × modelo ou mudar campanhas automaticamente.",
      "A coleta paga está desconectada. Este comando não faz chamadas externas nem lê tokens.",
    ],
  };
  return {
    report,
    manifest: buildManifest(config, {
      intents,
      cityData,
      locations,
      generatedAt,
    }),
  };
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function renderReport(report, manifest) {
  const show = (value, suffix = "") =>
    present(value) ? `${escapeHtml(value)}${suffix}` : "Não medido";
  const changeText = (delta) =>
    ["missing", "incomparable_source"].includes(delta.state)
      ? "Não comparável"
      : delta.state === "zero_baseline"
        ? `+${delta.absolute}; base anterior zero`
        : delta.state === "both_zero"
          ? "0; ambos zero"
          : `${delta.absolute > 0 ? "+" : ""}${delta.absolute} (${delta.percent > 0 ? "+" : ""}${delta.percent}%)`;
  const period = (value) =>
    Array.isArray(value)
      ? value.map(escapeHtml).join(" a ")
      : "Período não informado";
  const labels = {
    collect_baseline: "Coletar linha de base",
    investigate_decline: "Investigar queda",
    test_capture: "Testar captação",
    defend_and_test: "Preservar e testar",
    expand_evidence: "Ampliar evidência",
  };
  const inventoryLabels = {
    candidate: "Oferta compatível no snapshot",
    missing_landing: "Destino não localizado",
    missing_stock: "Estoque não importado",
    undated_stock: "Estoque sem data-hora verificável",
    invalid_stock: "Snapshot inválido; quantidade desconhecida",
    unsupported_filter: "Filtro precisa de revisão",
    no_stock: "Sem unidade compatível",
    not_indexable: "Destino não indexável",
  };
  const sourceLink = (source) =>
    /^https?:\/\//.test(source?.url ?? "")
      ? `<a href="${escapeHtml(source.url)}" rel="noreferrer">Abrir fonte</a>`
      : "URL não informada";
  const demand = report.demandResearch;
  const demandValue = (row) =>
    row?.averageMonthlySearches === 0
      ? "0*"
      : row?.averageMonthlySearches > 0
        ? escapeHtml(row.averageMonthlySearches)
        : "Não informado";
  const demandColumns = [
    "carros usados",
    "seminovos",
    "loja de carros",
    "carros automáticos até 80 mil",
  ];
  const demandSection = !demand?.cities.length
    ? "<section><p>Pesquisa municipal de demanda não importada. Isso não significa procura zero.</p></section>"
    : `<div class="notice"><strong>Demanda estimada — não é ranking nem tráfego da Netcar.</strong><p>Período: ${period(demand.source.period)}. Coleta: ${show(demand.source.observedAt)}. Rede: ${escapeHtml(demand.source.network)}. Idioma: ${escapeHtml(demand.source.language)}. ${sourceLink(demand.source)}.</p><p>Mesmos termos <strong>sem nome de cidade</strong>, pesquisados com filtro de um município por vez. Não são volumes de “carros usados em [cidade]”. Não some as linhas ou colunas.</p></div><div class="table"><table><thead><tr><th>Cidade selecionada no Planejador</th>${demandColumns.map((term) => `<th>“${escapeHtml(term)}”</th>`).join("")}</tr></thead><tbody>${demand.cities.map((city) => `<tr><td><strong>${escapeHtml(city.name)}</strong><small>${escapeHtml(city.selectedLocationLabel)}${!city.sourceVerified ? " — fonte incompleta; números não validados" : ""}</small></td>${demandColumns.map((term) => `<td>${demandValue(city.rows.find((row) => normalize(row.keyword) === normalize(term)))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="muted">Valores: média mensal histórica estimada. *Zero arredondado não comprova ausência de procura. “Não informado” inclui traço, termo não retornado ou fonte insuficiente.</p>${demand.cities.map((city) => `<details><summary>Todos os termos de ${escapeHtml(city.name)}</summary><div class="table"><table><thead><tr><th>Termo sem sufixo da cidade</th><th>Média mensal estimada</th><th>Origem / limite</th></tr></thead><tbody>${city.rows.map((row) => `<tr><td>${escapeHtml(row.keyword)}</td><td>${demandValue(row)}</td><td>${row.kind === "suggested_keyword" ? "Sugestão do Planejador" : "Termo de entrada"}${row.status === "not_returned" ? "; não retornado, não é zero" : row.status === "not_available" ? "; informação indisponível" : row.status === "rounded_zero_not_proof_no_demand" ? "; zero arredondado" : row.status === "invalid_estimate" ? "; valor inválido, não utilizado" : row.status === "unverified_source" ? "; fonte incompleta, não utilizado" : ""}</td></tr>`).join("")}</tbody></table></div></details>`).join("")}<section><strong>Pendências e limites</strong><ul>${demand.pending.map((item) => `<li>${escapeHtml(item.city)}: ${escapeHtml(item.reason)}</li>`).join("")}${demand.limitations
        .slice(0, 6)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul></section>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Netcar — radar regional</title><style>body{margin:0;background:#f3f6f7;color:#082c3a;font:16px/1.5 system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:32px 20px}h1{font-size:34px}h2{margin-top:36px}.notice,section{background:white;border:1px solid #d7e2e5;border-radius:12px;padding:20px;margin:16px 0}.notice{border-left:5px solid #007f86}.table{overflow:auto}table{border-collapse:collapse;width:100%;min-width:780px}th,td{text-align:left;padding:12px;border-bottom:1px solid #d7e2e5;vertical-align:top}th{background:#e8f1f3}.muted{color:#53676e;font-size:14px}small{display:block}code{word-break:break-word}li{margin:8px 0}details{margin:10px 0}a{color:#006d78}</style></head><body><main>
  <p class="muted">Análise offline • ${escapeHtml(report.generatedAt)} • nenhuma chamada paga</p><h1>Onde investigar a presença regional da Netcar</h1>
  <div class="notice"><strong>Dados para decidir, não promessa de ranking.</strong><p>Período atual: ${period(report.gsc.source.currentPeriod)}. Comparação: ${period(report.gsc.source.previousPeriod)}.</p><p>As linhas abaixo são páginas do site, não moradores dessas cidades. Posição média mistura consultas e não representa o ranking de uma palavra-chave. Maps e Map Pack estão separados.</p></div>
  <h2>Páginas regionais observadas</h2><div class="table"><table><thead><tr><th>Cidade / página</th><th>Cliques anterior → atual</th><th>Variação</th><th>Aparições atuais</th><th>Posição média da página</th><th>Próxima investigação</th></tr></thead><tbody>${report.cities.map((c) => `<tr><td><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.page ?? "Referência Esteio: sem linha de página importada")}</small>${c.role === "outside_pilot_radius_unverified" ? "<small>Fora do piloto; raio não confirmado</small>" : ""}</td><td>${show(c.metrics.previous.clicks)} → ${show(c.metrics.current.clicks)}</td><td>${escapeHtml(changeText(c.metrics.clicksChange))}</td><td>${show(c.metrics.current.impressions)}</td><td>${show(c.metrics.current.averagePosition)}</td><td><strong>${escapeHtml(labels[c.assessment.queue])}</strong><small>${escapeHtml(c.assessment.reason)}</small></td></tr>`).join("")}</tbody></table></div>
  <h2>Consultas selecionadas com nome de cidade</h2><p>Coleta: ${show(report.gsc.querySource.observedAt)}. Período próprio destas consultas: ${period(report.gsc.querySource.currentPeriod)}.</p><div class="table"><table><thead><tr><th>Cidade</th><th>Consulta</th><th>Tipo</th><th>Aparições</th><th>Cliques</th><th>Posição média da consulta</th></tr></thead><tbody>${report.cities.flatMap((c) => c.queries.map((q) => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(q.query)}</td><td>${q.branded ? "Com marca Netcar" : "Sem marca Netcar"}</td><td>${show(q.current.impressions)}</td><td>${show(q.current.clicks)}</td><td>${show(q.current.averagePosition)}</td></tr>`)).join("") || '<tr><td colspan="6">Consultas locais não importadas. Não inferir palavras-chave a partir da posição das páginas.</td></tr>'}</tbody></table></div>
  <h2>Intenções sustentadas pelo estoque</h2><p>Snapshot: ${show(report.summary.stockObservedAt)}. Disponibilidade não verificada ao vivo. Quantidade de carros não é volume de busca. O Planejador está na seção seguinte; seus termos sem sufixo não foram atribuídos automaticamente às consultas com nome de cidade.</p><div class="table"><table><thead><tr><th>Intenção / destino existente</th><th>Unidades no snapshot</th><th>Faixa observada (R$)</th><th>Condição</th><th>Volume para termo + nome da cidade</th></tr></thead><tbody>${report.stockIntents.map((i) => `<tr><td>${escapeHtml(i.label)}<small>${escapeHtml(i.path)}</small></td><td>${show(i.stockCount)}</td><td>${show(i.priceMin)} – ${show(i.priceMax)}</td><td>${escapeHtml(inventoryLabels[i.status])}</td><td>Não medido</td></tr>`).join("")}</tbody></table></div>
  <h2>O que os municípios pesquisam: Planejador de Palavras-chave</h2>${demandSection}
  <h2>Plano da pesquisa, ainda não executado</h2><section><p>${manifest.cities.length} cidades, ${manifest.devices.length} dispositivos e ${manifest.surfaces.length} superfícies independentes. ${manifest.measurementCells} células planejadas — não é estimativa de cobranças da ferramenta.</p><p><strong>${manifest.pendingLocationPoints} pontos sem coordenadas verificadas.</strong> Não chamamos isso de simulação por GPS.</p>${manifest.cities.map((c) => `<details><summary>${escapeHtml(c.name)}: ${c.queries.length} consultas</summary><ul>${c.queries.map((q) => `<li>${escapeHtml(q.text)} <small>${escapeHtml(q.candidateLanding)} • volume não medido</small></li>`).join("")}</ul></details>`).join("")}<p>Concorrentes solicitados: ${manifest.competitorsToWatch.map((c) => escapeHtml(c.name)).join(", ")}. A inclusão não comprova domínio dos resultados.</p></section>
  <h2>Separação das evidências</h2><section><p>Observações SERP importadas: ${report.serpObservations.length}. Não confundir ausência de coleta com ausência da Netcar.</p><ul>${report.safeguards.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></section>
  <h2>Fontes e rastreabilidade</h2><section><p>Coleta GSC: ${show(report.gsc.source.observedAt)}. Origem: ${escapeHtml(report.gsc.source.description ?? "Não informada")}. ${sourceLink(report.gsc.source)}.</p><p>Consultas selecionadas: ${show(report.gsc.querySource.observedAt)}. ${sourceLink(report.gsc.querySource)}.</p><ul>${report.sourceFiles.map((s) => `<li>${escapeHtml(s.role)}: <code>${escapeHtml(s.path)}</code><small>SHA-256 ${escapeHtml(s.sha256)}</small></li>`).join("")}</ul></section>
  </main></body></html>`;
}
