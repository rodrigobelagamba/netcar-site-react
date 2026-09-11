#!/usr/bin/env tsx

/** Contratos locais do link de vídeo; sem browser, rede ou publicação real. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";
import * as videos from "../src/modules/detalhes/lib/vehicleInstagramVideos";
import { parseVehicleVideosResponse, vehicleVideosForDisplay } from "../src/modules/detalhes/lib/vehicleVideosResponse";

const {
  normalizeInstagramVideoUrl,
  normalizeVehicleVideoCover,
  getVehicleInstagramVideo,
} = videos;
const canonical = "https://www.instagram.com/reel/Video_123-a/";
const incoming = `${canonical}?utm_source=site&igsh=private#caption`;
const localCover = "/images/vehicle-videos/test-unit_001.webp";
const syncedCover = "/social/v1/instagram-post-media.php?id=180000000001";
assert.equal(normalizeVehicleVideoCover(syncedCover), syncedCover);

for (const extension of ["webp", "jpg", "jpeg", "png"]) {
  const cover = `/images/vehicle-videos/Test-unit_001.${extension}`;
  assert.equal(normalizeVehicleVideoCover(cover), cover);
}
const rejectedCovers = [
  undefined,
  "",
  "https://www.instagram.com/cover.jpg",
  "https://cdn.example.test/images/vehicle-videos/test.webp",
  "//cdn.example.test/images/vehicle-videos/test.webp",
  "data:image/png;base64,AAAA",
  "javascript:alert(1)",
  "images/vehicle-videos/test.webp",
  "/images/test.webp",
  "/images/vehicle-videos/nested/test.webp",
  "/images/vehicle-videos/../test.webp",
  "/images/vehicle-videos/%2e%2e/test.webp",
  "/images/vehicle-videos/test%2ewebp",
  "/images/vehicle-videos/test.webp?tracking=1",
  "/images/vehicle-videos/test.webp#cover",
  "/images/vehicle-videos/test.svg",
  "/images/vehicle-videos/test.gif",
  "/images/vehicle-videos/test.WEBP",
  "/images/vehicle-videos/.webp",
  "/images/vehicle-videos/test name.webp",
  "/images/vehicle-videos/test\\name.webp",
  ` ${localCover}`,
  `${localCover} `,
  `${localCover}\n`,
  `${syncedCover}&url=https://example.test`,
  `${syncedCover}#extra`,
  `${syncedCover}\n`,
  "/social/v1/instagram-post-media.php?id=../secret",
  "/social/v1/instagram-post-media.php?id=abc",
  `https://www.netcarmultimarcas.com.br${syncedCover}`,
];
for (const cover of rejectedCovers) {
  assert.equal(normalizeVehicleVideoCover(cover), undefined, String(cover));
}

for (const url of [
  canonical,
  incoming,
  "https://instagram.com/reel/Video_123-a",
]) {
  assert.equal(normalizeInstagramVideoUrl(url), canonical, url);
}
assert.equal(
  normalizeInstagramVideoUrl("https://instagram.com/p/Post_123-a?igsh=private"),
  "https://www.instagram.com/p/Post_123-a/",
);

const rejectedUrls = [
  "",
  "not a URL",
  "http://www.instagram.com/reel/Video_123-a/",
  "//www.instagram.com/reel/Video_123-a/",
  "javascript:alert(1)",
  "https://www.instagram.com.evil.test/reel/Video_123-a/",
  "https://evilinstagram.com/reel/Video_123-a/",
  "https://sub.instagram.com/reel/Video_123-a/",
  "https://www.instagram.com@evil.test/reel/Video_123-a/",
  "https://user@www.instagram.com/reel/Video_123-a/",
  "https://user:password@www.instagram.com/reel/Video_123-a/",
  "https://www.instagram.com:8443/reel/Video_123-a/",
  "https://www.instagram.com:443/reel/Video_123-a/",
  "https://www.instagram.com/netcar/",
  "https://www.instagram.com/reels/Video_123-a/",
  "https://www.instagram.com/stories/netcar/123/",
  "https://www.instagram.com/reel/",
  "https://www.instagram.com/reel/Video_123-a/embed/",
  "https://www.instagram.com/reel/Video%5F123-a/",
  "https://www.instagram.com/%72eel/Video_123-a/",
  "https://www.instagram.com/%2e/reel/Video_123-a/",
];
for (const url of rejectedUrls) {
  assert.equal(normalizeInstagramVideoUrl(url), undefined, url);
}

const verified: videos.VehicleInstagramVideo = {
  vehicleId: "test-unit-001",
  permalink: incoming,
  verifiedAt: "2026-09-05",
};

const syncedAt = new Date().toISOString();
const remoteVideo = {
  vehicleId: "19978", permalink: canonical, verifiedAt: syncedAt,
  coverImage: syncedCover, stockPrice: 81900, displayModel: "Polo",
};
const response = { success: true, syncedAt, stale: false, videos: [remoteVideo] };
const parsed = parseVehicleVideosResponse(response);
assert.deepEqual(parsed.videos, [remoteVideo]);
assert.deepEqual(vehicleVideosForDisplay(parsed, true), [remoteVideo], "Falha de refetch conserva o último sucesso recente");
assert.deepEqual(vehicleVideosForDisplay(parsed, true, Date.parse(syncedAt) + 49 * 60 * 60 * 1000), [], "Falha de refetch não conserva vídeos além de48h");
assert.equal(vehicleVideosForDisplay(undefined, true), undefined, "Sem cache após falha permite reserva");
assert.deepEqual(vehicleVideosForDisplay(undefined, false), [], "Carregamento não mostra cadastro antigo antes da resposta");
assert.equal(videos.selectVehicleInstagramVideo("19978", 81900, parsed.videos)?.permalink, canonical);
assert.equal(videos.selectVehicleInstagramVideo("19978", 80900, parsed.videos), undefined, "Preço mudou entre sincronizações");
assert.equal(videos.selectVehicleInstagramVideo("19978", 0, parsed.videos), undefined, "Vendido não mostra vídeo");
assert.equal(videos.selectVehicleInstagramVideo("19739", 89900, []), undefined, "API vazia não repõe cadastro antigo");
assert.ok(videos.selectVehicleInstagramVideo("19739", 89900), "Reserva manual durante falha da API");
assert.equal(parseVehicleVideosResponse({ ...response, videos: [remoteVideo, remoteVideo] }).videos.length, 0, "Unidade ambígua não aparece");
assert.equal(parseVehicleVideosResponse({ ...response, videos: [remoteVideo, { ...remoteVideo, vehicleId: "19979" }] }).videos.length, 0, "Um Reel não pode representar dois carros");
assert.equal(parseVehicleVideosResponse({ ...response, videos: [{ ...remoteVideo, permalink: "https://example.test/reel/123" }] }).videos.length, 0);
assert.equal(parseVehicleVideosResponse({ ...response, videos: [{ ...remoteVideo, stockPrice: "81900" }] }).videos.length, 0);
assert.equal(parseVehicleVideosResponse({ ...response, videos: [{ ...remoteVideo, coverImage: "https://www.instagram.com/capa.jpg" }] }).videos[0]?.coverImage, undefined);
assert.equal(parseVehicleVideosResponse({ ...response, syncedAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString() }).videos.length, 0, "Cache expirado não mantém vínculos indefinidamente");
assert.throws(() => parseVehicleVideosResponse({ success: false }));
assert.throws(() => parseVehicleVideosResponse({ ...response, videos: null }));
const fixture = [verified, { ...verified, vehicleId: "test-unit-002" }];
assert.deepEqual(getVehicleInstagramVideo("test-unit-001", fixture), {
  ...verified,
  permalink: canonical,
});
assert.equal(
  verified.permalink,
  incoming,
  "Resolver não deve alterar o registro",
);
for (const id of [
  "unknown",
  "test-unit-00",
  "TEST-UNIT-001",
  "test-unit-001 ",
]) {
  assert.equal(getVehicleInstagramVideo(id, fixture), undefined, id);
}
assert.equal(getVehicleInstagramVideo("test-unit-001", []), undefined);
assert.equal(
  getVehicleInstagramVideo("test-unit-001", [verified, { ...verified }]),
  undefined,
  "Associação duplicada deve ficar oculta",
);
assert.equal(
  getVehicleInstagramVideo("test-unit-001", [{ ...verified, verifiedAt: "" }]),
  undefined,
  "Publicação sem conferência deve ficar oculta",
);
for (const permalink of rejectedUrls) {
  assert.equal(
    getVehicleInstagramVideo("test-unit-001", [{ ...verified, permalink }]),
    undefined,
    permalink,
  );
}

function loadModule<T>(
  path: string,
  dependencies: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      require(name: string) {
        assert.ok(name in dependencies, `Dependência sem isolamento: ${name}`);
        return dependencies[name];
      },
      ...globals,
    },
    { filename: path },
  );
  return module.exports as T;
}

type LinkProps = {
  permalink: string;
  vehicleName: string;
  displayModel?: string;
  coverImage?: string;
  onOpen?: () => void;
};
const { VehicleVideoLink } = loadModule<{
  VehicleVideoLink: (props: LinkProps) => React.ReactElement<{
    href: string;
    target: string;
    rel: string;
    onClick?: () => void;
    "aria-label": string;
    children?: React.ReactNode;
  }> | null;
}>("src/modules/detalhes/components/VehicleVideoLink.tsx", {
  "react/jsx-runtime": jsxRuntime,
  "lucide-react": icons,
  "../lib/vehicleInstagramVideos": videos,
});

let clicks = 0;
const link = VehicleVideoLink({
  permalink: incoming,
  vehicleName: "Carro de teste <script>",
  onOpen: () => {
    clicks += 1;
  },
});
assert.ok(link);
assert.equal(link.type, "a");
assert.equal(link.props.href, canonical);
assert.equal(link.props.target, "_blank");
assert.deepEqual(
  new Set(link.props.rel.split(/\s+/)),
  new Set(["noopener", "noreferrer"]),
);
assert.match(link.props["aria-label"], /Carro de teste <script>/);
assert.match(link.props["aria-label"], /Instagram.*outra aba/);
const markup = renderToStaticMarkup(link);
assert.match(markup, /Ver vídeo deste carro/);
assert.match(markup, /No Instagram/);
assert.doesNotMatch(
  markup,
  /<(?:iframe|video|audio|img|script)\b|\bautoplay\b|\bsrc=/i,
);
assert.equal(clicks, 0, "Renderização não deve disparar clique");
assert.equal(typeof link.props.onClick, "function");
link.props.onClick!();
assert.equal(clicks, 1, "Um gesto deve disparar um callback");
assert.equal(
  VehicleVideoLink({ permalink: canonical, vehicleName: "Teste" })?.props
    .onClick,
  undefined,
);
for (const permalink of rejectedUrls) {
  assert.equal(VehicleVideoLink({ permalink, vehicleName: "Teste" }), null);
  assert.equal(
    VehicleVideoLink({ permalink, vehicleName: "Teste", coverImage: localCover }),
    null,
    "Uma capa não deve liberar um permalink inválido",
  );
}

const pillProps = { permalink: canonical, vehicleName: "Teste" };
for (const coverImage of [undefined, localCover]) {
  const namedLink = VehicleVideoLink({
    ...pillProps,
    coverImage,
    displayModel: " HR-V ",
  });
  assert.ok(namedLink);
  assert.match(renderToStaticMarkup(namedLink), /Veja este HR-V em vídeo/);
  assert.match(namedLink.props["aria-label"], /Veja este HR-V em vídeo.*Instagram.*outra aba/);
  const escapedLabel = renderToStaticMarkup(VehicleVideoLink({
    ...pillProps, coverImage, displayModel: "<script>modelo</script>",
  }));
  assert.doesNotMatch(escapedLabel, /<script>/);
  assert.match(escapedLabel, /&lt;script&gt;/);
  assert.match(renderToStaticMarkup(VehicleVideoLink({
    ...pillProps, coverImage, displayModel: "   ",
  })), /Ver vídeo deste carro/);
}
const pillMarkup = renderToStaticMarkup(VehicleVideoLink(pillProps));
for (const coverImage of rejectedCovers) {
  assert.equal(
    renderToStaticMarkup(VehicleVideoLink({ ...pillProps, coverImage })),
    pillMarkup,
    `Capa inválida deve preservar o link compacto: ${String(coverImage)}`,
  );
}

type ImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading: string;
  decoding: string;
  onError?: (event: { currentTarget: { hidden: boolean } }) => void;
};
function findImage(node: React.ReactNode): React.ReactElement<ImageProps> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) continue;
    if (child.type === "img") return child as React.ReactElement<ImageProps>;
    const image = findImage(child.props.children);
    if (image) return image;
  }
  return undefined;
}

// Validar também os registros publicados, sem depender do estoque ou da Meta.
// O dia de conferência acompanha a data das lojas, mesmo quando o CI roda em UTC.
const todayParts = new Intl.DateTimeFormat("en", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const today = ["year", "month", "day"]
  .map((part) => todayParts.find(({ type }) => type === part)!.value)
  .join("-");
const registeredVehicleIds = new Set<string>();
const registeredReelUrls = new Set<string>();
const maxCoverBytes = 150 * 1024;

assert.ok(videos.vehicleInstagramVideos.length > 0, "Cadastro de vídeos não deve ficar vazio");
for (const entry of videos.vehicleInstagramVideos) {
  const context = `Registro de vídeo ${entry.vehicleId}`;
  assert.match(
    entry.vehicleId,
    /^[1-9]\d*$(?![\s\S])/,
    `${context}: ID numérico inválido`,
  );
  assert.ok(
    Number.isSafeInteger(Number(entry.vehicleId)),
    `${context}: ID fora do intervalo seguro`,
  );
  assert.ok(
    !registeredVehicleIds.has(entry.vehicleId),
    `${context}: unidade duplicada`,
  );
  registeredVehicleIds.add(entry.vehicleId);

  assert.match(
    entry.permalink,
    /^https:\/\/www\.instagram\.com\/reel\/[A-Za-z0-9_-]+\/$(?![\s\S])/,
    `${context}: URL deve ser um Reel canônico, sem parâmetros`,
  );
  assert.equal(
    normalizeInstagramVideoUrl(entry.permalink),
    entry.permalink,
    `${context}: Reel inválido`,
  );
  assert.ok(
    !registeredReelUrls.has(entry.permalink),
    `${context}: Reel associado a mais de uma unidade`,
  );
  registeredReelUrls.add(entry.permalink);
  const displayModel = entry.displayModel?.trim();
  assert.ok(displayModel, `${context}: displayModel obrigatório`);

  assert.match(
    entry.verifiedAt,
    /^\d{4}-\d{2}-\d{2}$(?![\s\S])/,
    `${context}: data deve usar YYYY-MM-DD`,
  );
  const verifiedTime = Date.parse(`${entry.verifiedAt}T00:00:00.000Z`);
  assert.ok(Number.isFinite(verifiedTime), `${context}: data de conferência inválida`);
  assert.equal(
    new Date(verifiedTime).toISOString().slice(0, 10),
    entry.verifiedAt,
    `${context}: data inexistente`,
  );
  assert.ok(
    entry.verifiedAt <= today,
    `${context}: conferência não pode estar no futuro (${today})`,
  );

  assert.ok(entry.coverImage, `${context}: capa local obrigatória`);
  assert.equal(
    normalizeVehicleVideoCover(entry.coverImage),
    entry.coverImage,
    `${context}: caminho de capa inválido`,
  );
  assert.ok(entry.coverImage.endsWith(".webp"), `${context}: capa deve ser WebP`);
  const coverPath = new URL(`../public${entry.coverImage}`, import.meta.url);
  assert.ok(
    existsSync(coverPath),
    `${context}: capa ausente em public${entry.coverImage}`,
  );
  const coverStats = statSync(coverPath);
  assert.ok(coverStats.isFile(), `${context}: capa deve ser um arquivo`);
  assert.ok(
    coverStats.size >= 12 && coverStats.size <= maxCoverBytes,
    `${context}: capa vazia, incompleta ou maior que 150 KB`,
  );
  const coverBytes = readFileSync(coverPath);
  assert.deepEqual(
    coverBytes.subarray(0, 4),
    Buffer.from("RIFF"),
    `${context}: assinatura RIFF ausente`,
  );
  assert.deepEqual(
    coverBytes.subarray(8, 12),
    Buffer.from("WEBP"),
    `${context}: assinatura WEBP ausente`,
  );

  const resolved = getVehicleInstagramVideo(entry.vehicleId);
  assert.deepEqual(
    resolved,
    entry,
    `${context}: associação deve resolver o registro correto`,
  );
  assert.ok(resolved);
  const registeredLink = VehicleVideoLink({
    ...resolved,
    vehicleName: `${displayModel} (${entry.vehicleId})`,
  });
  assert.ok(registeredLink, `${context}: link não renderizado`);
  assert.equal(registeredLink.props.href, entry.permalink, `${context}: destino incorreto`);
  assert.equal(registeredLink.props.target, "_blank", `${context}: Reel deve abrir em outra aba`);
  assert.equal(
    findImage(registeredLink)?.props.src,
    entry.coverImage,
    `${context}: capa incorreta`,
  );
  assert.ok(
    registeredLink.props["aria-label"].includes(`Veja este ${displayModel} em vídeo`),
    `${context}: convite deve nomear o modelo`,
  );
  const registeredMarkup = renderToStaticMarkup(registeredLink);
  assert.deepEqual(
    [...registeredMarkup.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]),
    [entry.permalink],
    `${context}: HTML deve conter somente o destino conferido`,
  );
  assert.deepEqual(
    [...registeredMarkup.matchAll(/\bsrc="([^"]+)"/g)].map((match) => match[1]),
    [entry.coverImage],
    `${context}: HTML deve conter somente a capa local conferida`,
  );
  assert.doesNotMatch(
    registeredMarkup,
    /<(?:iframe|video|audio|script|link)\b|\bautoplay\b|\bsrcset=/i,
    `${context}: renderização deve continuar sem embed`,
  );
}

let coverClicks = 0;
const coverLink = VehicleVideoLink({
  permalink: incoming,
  vehicleName: "Carro de teste <script>",
  coverImage: localCover,
  onOpen: () => {
    coverClicks += 1;
  },
});
assert.ok(coverLink);
assert.equal(coverLink.type, "a");
assert.equal(coverLink.props.href, canonical);
assert.equal(coverLink.props.target, "_blank");
assert.deepEqual(
  new Set(coverLink.props.rel.split(/\s+/)),
  new Set(["noopener", "noreferrer"]),
);
assert.match(coverLink.props["aria-label"], /Carro de teste <script>/);
assert.match(coverLink.props["aria-label"], /Instagram.*outra aba/);
const coverMarkup = renderToStaticMarkup(coverLink);
assert.match(coverMarkup, /Ver vídeo deste carro/);
assert.match(coverMarkup, /No Instagram/);
assert.doesNotMatch(
  coverMarkup,
  /<(?:iframe|video|audio|script|link)\b|\bautoplay\b|\bsrcset=|\bon(?:error|click)=/i,
);
assert.deepEqual(
  [...coverMarkup.matchAll(/\bsrc="([^"]+)"/g)].map((match) => match[1]),
  [localCover],
  "Renderização deve conter somente a imagem local, sem embed ou pixel externo",
);
assert.equal(coverClicks, 0, "Renderizar a capa não deve disparar analytics de clique");
const coverImage = findImage(coverLink);
assert.ok(coverImage);
assert.equal(coverImage.props.src, localCover);
assert.equal(coverImage.props.alt, "", "A capa decorativa não deve duplicar o nome do link");
assert.equal(coverImage.props.loading, "lazy");
assert.equal(coverImage.props.decoding, "async");
assert.equal(coverImage.props.width, 640);
assert.equal(coverImage.props.height, 1138);
assert.equal(typeof coverImage.props.onError, "function");
const failedImage = { hidden: false };
coverImage.props.onError!({ currentTarget: failedImage });
assert.equal(failedImage.hidden, true, "Uma capa quebrada deve ser ocultada");
assert.equal(coverClicks, 0, "Falha da capa não deve disparar analytics de clique");
assert.equal(coverLink.props.href, canonical, "O link deve continuar disponível sem a capa");
assert.match(coverLink.props["aria-label"], /Ver vídeo deste carro.*Instagram/);
assert.match(renderToStaticMarkup(coverLink), /Ver vídeo deste carro/);
coverLink.props.onClick!();
assert.equal(coverClicks, 1, "O link deve continuar acionável após falha da capa");

let consent: string | undefined;
const dataLayer: Record<string, unknown>[] = [];
const gtagCalls: unknown[][] = [];
const forbiddenCalls: string[] = [];
const forbid =
  (name: string) =>
  (..._args: unknown[]) => {
    forbiddenCalls.push(name);
    throw new Error(`Efeito indevido no clique de vídeo: ${name}`);
  };
const waDependencies = Object.fromEntries(
  [
    "appendWaRefToUrl",
    "captureTrafficSource",
    "createWhatsAppClickIdentity",
    "getTrafficSource",
    "logWaClick",
  ].map((name) => [name, forbid(name)]),
);
const { trackVehicleVideoClick, GA4_MEASUREMENT_ID } = loadModule<{
  trackVehicleVideoClick: (vehicleId: string) => void;
  GA4_MEASUREMENT_ID: string;
}>(
  "src/lib/analytics.ts",
  {
    "@/lib/waTracking": {
      ...waDependencies,
      getPrivacyConsentState: () => consent,
    },
  },
  {
    window: {
      dataLayer,
      gtag: (...args: unknown[]) => gtagCalls.push(args),
      fbq: forbid("Meta"),
      open: forbid("window.open"),
      __netcarPrivacyConsent: "accepted",
      __netcarMetaLoaded: true,
      location: { pathname: "/veiculo/test-unit-001", search: "" },
    },
    fetch: forbid("fetch"),
  },
);

for (consent of [undefined, "", "pending", "rejected", "denied"]) {
  trackVehicleVideoClick("test-unit-001");
  assert.equal(dataLayer.length, 0, `Sem opt-in: ${consent}`);
  assert.equal(gtagCalls.length, 0, `Sem opt-in GA4: ${consent}`);
}
consent = "accepted";
trackVehicleVideoClick("test-unit-001");
const expectedPayload = {
  vehicle_id: "test-unit-001",
  video_provider: "instagram",
  video_placement: "vehicle_gallery",
  page_type: "vehicle_detail",
};
// Objetos vêm de outro contexto VM: normalizar os protótipos antes de comparar.
assert.deepEqual(JSON.parse(JSON.stringify(dataLayer)), [
  {
    event: "vehicle_video_click",
    ...expectedPayload,
  },
]);
assert.deepEqual(JSON.parse(JSON.stringify(gtagCalls)), [
  [
    "event",
    "vehicle_video_click",
    { send_to: GA4_MEASUREMENT_ID, ...expectedPayload },
  ],
]);
consent = "rejected";
trackVehicleVideoClick("test-unit-001");
assert.equal(
  dataLayer.length,
  1,
  "Revogar consentimento deve bloquear novos eventos",
);
assert.equal(gtagCalls.length, 1);
assert.deepEqual(
  forbiddenCalls,
  [],
  "Vídeo não deve acionar WhatsApp, Meta ou rede",
);

console.log(
  `[vehicle-video] ${videos.vehicleInstagramVideos.length} registros e capas WebP verificados; URLs, associação por unidade, fallback, links e analytics com consentimento: OK`,
);
