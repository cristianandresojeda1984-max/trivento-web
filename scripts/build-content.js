#!/usr/bin/env node
/**
 * build-content.js
 *
 * Corre en cada deploy de Netlify (ver netlify.toml).
 * Lee las entradas que Decap CMS va guardando como Markdown con
 * frontmatter en content/eventos/*.md y content/noticias/*.md,
 * y genera data/eventos.json + data/noticias.json, que es lo que
 * index.html consume por fetch() para pintar las tarjetas.
 *
 * Sin dependencias externas (no requiere npm install) para que el
 * build de Netlify sea rápido y no publique node_modules.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: raw.trim() };
  }
  const [, frontmatter, body] = match;
  const data = {};
  let currentKey = null;

  frontmatter.split("\n").forEach((line) => {
    if (!line.trim()) return;

    // Continuación de un valor multilínea (bloque | o >), indentado
    if (/^\s+/.test(line) && currentKey) {
      data[currentKey] = ((data[currentKey] || "") + "\n" + line.trim()).trim();
      return;
    }

    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) return;
    const key = kv[1];
    let value = kv[2].trim();

    // Bloques multilínea estilo YAML (| o >): el valor real viene en las líneas siguientes
    if (value === "|" || value === ">" || value === "") {
      currentKey = key;
      data[key] = "";
      return;
    }

    currentKey = key;
    // Quita comillas simples/dobles que rodean el valor
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  });

  return { data, body: body.trim() };
}

function readCollection(folder) {
  const dir = path.join(ROOT, "content", folder);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        title: data.title || "",
        date: data.date || "",
        image: data.image || "",
        excerpt: data.excerpt || body.replace(/[#*_>`]/g, "").slice(0, 160),
        slug: file.replace(/\.md$/, ""),
      };
    });
}

function writeJson(name, items) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(items, null, 2));
  console.log(`✓ data/${name} (${items.length} elemento${items.length === 1 ? "" : "s"})`);
}

const eventos = readCollection("eventos");
const noticias = readCollection("noticias");

writeJson("eventos.json", eventos);
writeJson("noticias.json", noticias);
