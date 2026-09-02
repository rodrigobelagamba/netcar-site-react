#!/usr/bin/env node
/**
 * Gera a lista de "Produtos" pro Perfil da Empresa (Google) a partir do estoque.
 *
 * O GBP não tem API pública de produtos — o cadastro é manual no editor do
 * perfil. Este CSV entrega nome, categoria, preço, descrição, foto e link com
 * UTM por loja, prontos pra copiar. Rodar semanalmente e remover do perfil os
 * que saíram do estoque (coluna `id` facilita o cruzamento).
 *
 * Uso: node scripts/gbp-products-csv.mjs [--limit=20] [--out=docs/local-seo-project/gbp-produtos.csv]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const API = "https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500";
const SITE = "https://www.netcarmultimarcas.com.br";
const LOJAS = [
  { key: "loja_1", nome: "Netcar Multimarcas - Loja 1" },
  { key: "loja_2", nome: "Netcar Multimarcas - Loja 2" },
];

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v = "true"] = arg.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const limit = Number(args.limit || 20);
const out = resolve(args.out || "docs/local-seo-project/gbp-produtos.csv");

function maskPlate(placa) {
  const clean = String(placa || "").replace(/[\s-]/g, "").toUpperCase();
  if (clean.length < 7) return clean;
  return `${clean.slice(0, 3)}-XX${clean.slice(-2)}`;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function vehicleSlug(v) {
  let modelo = String(v.modelo || "").trim();
  if (v.marca && modelo.toLowerCase().startsWith(v.marca.toLowerCase())) {
    modelo = modelo.slice(v.marca.length).trim();
  }
  return [slugify(modelo), v.ano, maskPlate(v.placa).toLowerCase(), v.id]
    .filter(Boolean)
    .join("-");
}

function categoria(v) {
  const c = String(v.categoria || "").toLowerCase();
  if (c.includes("suv")) return "SUV seminovo";
  if (c.includes("pick") || c.includes("picape")) return "Picape seminova";
  if (c.includes("sedan")) return "Sedan seminovo";
  if (c.includes("hatch")) return "Hatch seminovo";
  return "Carro seminovo";
}

function titleCase(text) {
  return String(text || "")
    .split(/\s+/)
    .map((word) =>
      /\d/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function absoluteUrl(url) {
  const s = String(url || "");
  if (/^https?:\/\//.test(s)) return s;
  return `${SITE}/${s.replace(/^\.?\//, "")}`;
}

function descricao(v) {
  const partes = [
    `${titleCase(v.marca)} ${titleCase(v.modelo)} ${v.ano}`,
    v.km ? `${Number(v.km).toLocaleString("pt-BR")} km` : null,
    v.cambio ? `câmbio ${String(v.cambio).toLowerCase()}` : null,
    v.combustivel || null,
    v.cor ? `cor ${String(v.cor).toLowerCase()}` : null,
  ].filter(Boolean);
  return (
    `${partes.join(", ")}. Preço na ficha, fotos reais, troca aceita e financiamento em até 60x, sujeito à análise. ` +
    `Sem carro de leilão ou locadora. Retirada nas lojas da Av. Presidente Vargas, em Esteio.`
  );
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const res = await fetch(API, { headers: { accept: "application/json" } });
if (!res.ok) throw new Error(`API ${res.status}`);
const { data } = await res.json();

const disponiveis = data
  .filter((v) => Number(v.valor) > 0 && v.imagens_site?.capa)
  .sort((a, b) => Number(b.id) - Number(a.id))
  .slice(0, limit);

const header = [
  "loja",
  "id",
  "nome_produto",
  "categoria",
  "preco_brl",
  "descricao",
  "foto_url",
  "botao",
  "link_utm",
];
const rows = [header.join(",")];

for (const loja of LOJAS) {
  for (const v of disponiveis) {
    const nome = `${titleCase(v.marca)} ${titleCase(v.modelo)} ${v.ano}`.slice(0, 58);
    const link = `${SITE}/veiculo/${vehicleSlug(v)}?utm_source=google&utm_medium=organic&utm_campaign=gbp_produtos&utm_content=${loja.key}`;
    rows.push(
      [
        loja.nome,
        v.id,
        nome,
        categoria(v),
        Number(v.valor).toFixed(2),
        descricao(v),
        absoluteUrl(v.imagens_site.capa),
        "Saiba mais",
        link,
      ]
        .map(csvCell)
        .join(","),
    );
  }
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `\uFEFF${rows.join("\n")}\n`, "utf8");
console.log(
  `GBP produtos: ${disponiveis.length} carros x ${LOJAS.length} lojas -> ${out}`,
);
