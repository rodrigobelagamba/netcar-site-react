#!/usr/bin/env node

/** Regressões que voltariam a criar soft 404, metadado da home ou telefone só via JS. */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const htaccess = read("public/.htaccess");
const controller = read("public/index.php");
const initialHtml = read("index.html");
const analytics = read("src/lib/analytics.ts");
const waTracking = read("src/lib/waTracking.ts");
const vehiclesEndpoint = read("src/catalog/endpoints/vehicles.ts");
const vehicleSeoRenderer = read("public/detalhe-veiculo.php");
const crawlerPageRenderer = read("public/seo-pagina.php");
const vehicleQueryHook = read("src/catalog/queries/useVehiclesQuery.ts");
const landingFilters = read("src/data/seo/index.ts");
const homePage = read("src/modules/home/pages/HomePage.tsx");
const homeStock = read("src/lib/homeStock.ts");
const showroomPage = read("src/modules/seminovos/pages/SeminovosPage.tsx");
const stockBootstrap = read("src/lib/stockBootstrap.ts");
const seoAssets = read("scripts/generate-seo-assets.js");
const compareTrackingSource = analytics.slice(
  analytics.indexOf("export function trackCompareInteraction("),
  analytics.indexOf("/** Evento GA4: scroll 50%"),
);
const fetchVehiclesSource = vehiclesEndpoint.slice(
  vehiclesEndpoint.indexOf("export async function fetchVehicles("),
  vehiclesEndpoint.indexOf("export async function fetchVehicleById("),
);
const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

expect(
  htaccess.includes("ErrorDocument 404 /404.html"),
  "ErrorDocument 404 ausente",
);
expect(
  htaccess.includes("ErrorDocument 410 /410.html"),
  "ErrorDocument 410 ausente",
);
expect(
  /\^noticias\?\\\.\(php\|html\?\)\$ \/blog/.test(htaccess),
  "301 de noticias.php/html ausente",
);
expect(
  /\^equipe\\\.\(php\|html\?\)\$ \/sobre/.test(htaccess),
  "301 de equipe.php/html ausente",
);
expect(
  /\^clientes\?\\\.\(php\|html\?\)\$ - \[G/.test(htaccess),
  "410 de cliente(s) ausente",
);
expect(
  /\^ficha-cadastral\\\.\(php\|html\?\)\$ - \[G/.test(htaccess),
  "410 de ficha cadastral ausente",
);
expect(
  controller.includes("netcar_render_error(404)"),
  "controlador sem 404 real para rota desconhecida",
);
expect(
  controller.includes("netcar_apply_route_meta"),
  "metadados por rota não são aplicados ao HTML comum",
);
expect(
  controller.includes("'/comparar' => 'page-comparar.html'") &&
    controller.includes("src/modules/seo/pages/ComparadorPage.tsx"),
  "comparador não está ligado ao HTML estático e ao chunk React",
);
expect(
  htaccess.includes("politica-editorial|comparar") &&
    htaccess.includes("seo-static/page-$1.html"),
  "crawler não recebe o HTML estático do comparador",
);
expect(
  controller.includes("imagesrcset="),
  "preload responsivo do LCP ausente",
);
expect(
  controller.includes("(max-width: 767px) 50vw, 70vw"),
  "sizes do LCP da Home voltou a solicitar imagem excessiva no mobile",
);
expect(
  controller.includes("array(480, 640, 768, 960, 1280)"),
  "variantes leves do LCP da Home ausentes",
);
expect(
  !controller.includes("array_slice($vehicles, 0, 20)"),
  "Home ainda trunca o bootstrap e causa salto de 20 para o estoque completo",
);
expect(
  controller.includes("netcar_prepend_critical_head_markup($html, $preload)"),
  "preload da Home não está priorizado no início do head",
);
expect(
  controller.includes(
    "netcar_prepend_critical_head_markup($html, $stockCriticalPreload)",
  ),
  "preload do estoque não está priorizado no início do head",
);
expect(
  controller.includes("preg_match('#(?:/|-)([0-9]+)$#'"),
  "shell do veículo não reconhece o ID no slug canônico com hífen",
);
expect(
  controller.includes("str_replace('</body>', \"  {$stockBootstrapScript}"),
  "JSON do estoque voltou a bloquear a descoberta da imagem no head",
);
expect(
  controller.includes("$path === '/seminovos'") &&
    controller.includes("$value['showroomVehicles']") &&
    controller.includes("'scope' => $path === '/seminovos' ? 'showroom' : 'available'") &&
    controller.includes("'vehicles' => $vehicles"),
  "showroom completo não está isolado na rota /seminovos",
);
expect(
  vehiclesEndpoint.includes("includeSold?: boolean") &&
    fetchVehiclesSource.includes("query?.includeSold") &&
    vehicleQueryHook.includes('key.push("includeSold", 1)') &&
    stockBootstrap.includes("query?.includeSold") &&
    stockBootstrap.includes('bootstrap?.scope !== "showroom"'),
  "contrato includeSold não está isolado na API, cache e query key",
);
expect(
  showroomPage.includes("includeSold: true") &&
    showroomPage.includes("sortShowroomVehicles(filtered, sortBy)") &&
    !showroomPage.includes("eagerImage"),
  "showroom não inclui vendidos ou voltou a baixar imagens offscreen imediatamente",
);
expect(
  read("src/lib/showroomStock.ts").includes('case "az"') &&
    read("src/lib/showroomStock.ts").includes("compareModel(left, right)") &&
    !read("src/lib/showroomStock.ts").includes("leftSold !== rightSold"),
  "vendidos voltaram a ser empurrados para o fim da ordem alfabética",
);
expect(
  read("src/design-system/components/patterns/VehicleCard.tsx").includes(
    "onClick={handleClick}",
  ) &&
    read("src/design-system/components/patterns/VehicleCard.tsx").includes(
      "navigate({ to: `/veiculo/${slug}` })",
    ),
  "card vendido perdeu a navegação para sua ficha",
);
expect(
  controller.includes("home-lcp.json"),
  "fallback de LCP gerado no build ausente",
);
expect(
  controller.includes("__NETCAR_HOME_LCP_ID__"),
  "LCP não está alinhado entre servidor e React",
);
expect(
  controller.includes("__NETCAR_HOME_HERO__"),
  "dados iniciais do hero não são entregues ao React",
);
expect(
  controller.includes("function netcar_daily_home_lcp()") &&
    controller.includes("new DateTimeZone('America/Sao_Paulo')") &&
    controller.includes("$rotationDay = $localDay + 1") &&
    controller.includes("$rotationDay % count($candidates)") &&
    controller.includes("array_slice($candidates, 0, 4)"),
  "primeiro carro da Home não usa rotação diária determinística",
);
expect(
  controller.includes(
    "return netcar_home_lcp_from_vehicle($candidates[$selectedIndex])",
  ) &&
    controller.includes("$daily = netcar_daily_home_lcp()") &&
    controller.includes("if ($daily !== null)"),
  "rotação diária da Home não tem payload único ou fallback do build",
);
expect(
  controller.includes("json_encode($buildHomeLcp['id']") &&
    controller.includes("json_encode($buildHomeLcp['hero']") &&
    controller.includes("$bannerUrl = $buildHomeLcp['image'];"),
  "ID, dados e imagem preloaded do hero não vêm da mesma seleção",
);
expect(
  homePage.includes("initialHeroVehicle?.id") &&
    homePage.includes(
      "filtered.some((vehicle) => vehicle.id === preferredHeroId)",
    ) &&
    !homePage.includes("Math.random()") &&
    !homeStock.includes("Math.random()"),
  "React voltou a sortear o hero e pode divergir do preload do servidor",
);
expect(
  homeStock.includes("temFotos === null") &&
    homePage.includes("temFotos === null") &&
    seoAssets.includes("temFotos !== null"),
  "contrato de foto da Home diverge entre PHP, React e gerador",
);
expect(
  controller.includes("__NETCAR_HOME_HAS_ACTIVE_BANNER__"),
  "estado inicial de banner não é entregue ao React",
);
expect(
  controller.includes('id="netcar-initial-lcp"'),
  "imagem do LCP ausente do HTML inicial",
);
expect(
  controller.includes("array(480, 768, 960, 1280"),
  "srcset do servidor diverge do React",
);
expect(
  !htaccess.includes('ExpiresByType text/html "access plus 0 seconds"'),
  "cache da Home é anulado por max-age=0 do mod_expires",
);
expect(
  initialHtml.includes('href="tel:+555134737900"'),
  "telefone ausente do HTML inicial",
);
expect(
  initialHtml.includes("https://wa.me/5551997293118"),
  "WhatsApp ausente do HTML inicial",
);
expect(
  initialHtml.includes(
    '<meta name="robots" content="index, follow, max-image-preview:large"',
  ),
  "meta robots indexável ausente do HTML inicial",
);
expect(initialHtml.includes("GTM-M8MZRTL9"), "container GTM ausente");
expect(initialHtml.includes("G-MGPNBDNQ9G"), "medição GA4 ausente");
expect(initialHtml.includes("367657940934075"), "Meta Pixel ausente");
expect(
  /n\.queue\s*=\s*\[\]/.test(initialHtml) &&
    initialHtml.includes("fbevents.js"),
  "fila/carregador oficial do Meta Pixel ausente",
);
expect(
  !initialHtml.includes("window.fbq = window.fbq || function"),
  "stub incompatível voltou a impedir o carregamento do Meta Pixel",
);
expect(
  analytics.includes('event: "whatsapp_click"') &&
    analytics.includes("wa_ads_conversion: true") &&
    analytics.includes("wa_ads_conversion: false"),
  "contrato de conversão única do WhatsApp/Google Ads foi alterado",
);
expect(
  analytics.includes('window.fbq("track", "Contact"') &&
    analytics.includes('window.fbq("trackCustom", "WhatsAppClick"'),
  "eventos Meta de contato pelo WhatsApp ausentes",
);
expect(
  analytics.includes('| "comparison"') &&
    analytics.includes('pathname === "/comparar"') &&
    analytics.includes("landing_type"),
  "dimensões de comparador/modelo/faixa ausentes do rastreamento",
);
expect(
  compareTrackingSource.includes("compare_vehicle_") &&
    compareTrackingSource.includes('event: "comparison_ready"') &&
    !compareTrackingSource.includes("whatsapp_click") &&
    !compareTrackingSource.includes("wa_ads_conversion") &&
    !compareTrackingSource.includes("fbq("),
  "interações do comparador precisam ser informativas, sem conversão Ads/Meta",
);
expect(
  waTracking.includes("getOrCreateClickCode") &&
    waTracking.includes("appendWaRefToUrl") &&
    waTracking.includes("fbclid: ref?.fbclid") &&
    waTracking.includes("gclid: ref?.gclid"),
  "join Evolution/código/click IDs foi alterado",
);
for (const queryField of ["combustivel", "motor", "limit", "offset"]) {
  expect(
    vehicleQueryHook.includes(`query?.${queryField}`) &&
      vehicleQueryHook.includes(`key.push("${queryField}"`),
    `queryKey do estoque ignora ${queryField}`,
  );
}
expect(
  landingFilters.includes("function compact(") &&
    landingFilters.includes("matchesLandingFilters"),
  "filtro único de landings não normaliza aliases de modelo",
);
expect(
  crawlerPageRenderer.includes("netcar_render_demand_links") &&
    crawlerPageRenderer.includes("/comparar"),
  "Home/estoque do crawler sem links para demanda e comparador",
);
expect(
  vehiclesEndpoint.includes(
    'throw new Error("API de veículos retornou uma resposta inválida")',
  ) &&
    vehiclesEndpoint.includes(
      'throw new Error("API de veículos retornou uma página inválida")',
    ) &&
    fetchVehiclesSource.includes("throw error;") &&
    !fetchVehiclesSource.includes("return [];"),
  "falha da API voltou a apagar o bootstrap/último estoque como lista vazia",
);
expect(
  vehicleSeoRenderer.includes(
    "json_last_error() === JSON_ERROR_NONE && is_array($data)",
  ) &&
    vehicleSeoRenderer.includes("$vehicleFound = (") &&
    vehicleSeoRenderer.includes("$vehicleMissing = (") &&
    vehicleSeoRenderer.includes("$httpCode === 404") &&
    vehicleSeoRenderer.includes("if (!$vehicleFound && !$vehicleMissing)"),
  "renderer de veículo não separa JSON inválido (503) de ausência confirmada (410)",
);
expect(
  vehicleSeoRenderer.includes("function netcarVehicleModelLanding") &&
    vehicleSeoRenderer.includes("empty($landing['indexable'])"),
  "ficha estática liga para hub de modelo noindex",
);

for (const path of ["public/404.html", "public/410.html"]) {
  expect(existsSync(join(root, path)), `${path} ausente`);
  if (existsSync(join(root, path))) {
    expect(
      read(path).includes('name="robots" content="noindex, follow"'),
      `${path} sem noindex`,
    );
  }
}

const homeLcpManifestPath = "public/seo/home-lcp.json";
expect(
  existsSync(join(root, homeLcpManifestPath)),
  "manifesto do LCP da Home ausente",
);
if (existsSync(join(root, homeLcpManifestPath))) {
  try {
    const manifest = JSON.parse(read(homeLcpManifestPath));
    for (const field of ["id", "image", "brand", "model", "year", "price"]) {
      expect(Boolean(manifest?.[field]), `manifesto do LCP sem ${field}`);
    }
  } catch {
    errors.push("manifesto do LCP da Home inválido");
  }
}

for (const path of [
  "public/seo-static/regions-hub.html",
  "public/seo-static/city-porto-alegre.html",
  "public/seo-static/blog-seminovos-em-esteio-guia-completo.html",
  "public/seo-static/page-comparar.html",
  "public/seo/landings.json",
]) {
  expect(existsSync(join(root, path)), `${path} não foi gerado`);
}

if (errors.length) {
  console.error("Roteamento/servidor inválido:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  "Roteamento validado: 404/410, legado, metadados, demanda, comparador, tracking, LCP e contatos.",
);
