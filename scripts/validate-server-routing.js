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
const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

expect(htaccess.includes("ErrorDocument 404 /404.html"), "ErrorDocument 404 ausente");
expect(htaccess.includes("ErrorDocument 410 /410.html"), "ErrorDocument 410 ausente");
expect(/\^noticias\?\\\.\(php\|html\?\)\$ \/blog/.test(htaccess), "301 de noticias.php/html ausente");
expect(/\^equipe\\\.\(php\|html\?\)\$ \/sobre/.test(htaccess), "301 de equipe.php/html ausente");
expect(/\^clientes\?\\\.\(php\|html\?\)\$ - \[G/.test(htaccess), "410 de cliente(s) ausente");
expect(/\^ficha-cadastral\\\.\(php\|html\?\)\$ - \[G/.test(htaccess), "410 de ficha cadastral ausente");
expect(controller.includes("netcar_render_error(404)"), "controlador sem 404 real para rota desconhecida");
expect(controller.includes("netcar_apply_route_meta"), "metadados por rota não são aplicados ao HTML comum");
expect(controller.includes("imagesrcset="), "preload responsivo do LCP ausente");
expect(controller.includes("home-lcp.json"), "fallback de LCP gerado no build ausente");
expect(controller.includes("__NETCAR_HOME_LCP_ID__"), "LCP não está alinhado entre servidor e React");
expect(controller.includes('id="netcar-initial-lcp"'), "imagem do LCP ausente do HTML inicial");
expect(controller.includes("array(480, 768, 960, 1280"), "srcset do servidor diverge do React");
expect(initialHtml.includes('href="tel:+555134737900"'), "telefone ausente do HTML inicial");
expect(initialHtml.includes("https://wa.me/5551997293118"), "WhatsApp ausente do HTML inicial");

for (const path of ["public/404.html", "public/410.html"]) {
  expect(existsSync(join(root, path)), `${path} ausente`);
  if (existsSync(join(root, path))) {
    expect(read(path).includes('name="robots" content="noindex, follow"'), `${path} sem noindex`);
  }
}

expect(existsSync(join(root, "public/seo/home-lcp.json")), "manifesto do LCP da Home ausente");

for (const path of [
  "public/seo-static/regions-hub.html",
  "public/seo-static/city-porto-alegre.html",
  "public/seo-static/blog-seminovos-em-esteio-guia-completo.html",
]) {
  expect(existsSync(join(root, path)), `${path} não foi gerado`);
}

if (errors.length) {
  console.error("Roteamento/servidor inválido:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Roteamento validado: 404/410, legado, metadados, LCP e contatos.");
