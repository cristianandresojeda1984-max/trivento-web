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
    return { data: {}, body: raw.trim(), frontmatter: "" };
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
    if (value === "" || /^[|>][+-]?\d*$/.test(value)) {
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

  return { data, body: body.trim(), frontmatter };
}

function unquote(value) {
  const v = (value || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parsea a mano el campo "galeria" (lista de objetos foto/descripcion) que
 * Decap CMS guarda en el frontmatter como YAML anidado, algo así:
 *
 *   galeria:
 *     - foto: /images/uploads/proyectos/a.jpg
 *       descripcion: Una descripción breve
 *     - foto: /images/uploads/proyectos/b.jpg
 *
 * parseFrontmatter() de arriba es deliberadamente simple (solo key: value
 * planos) y no entiende listas anidadas, así que esto se procesa aparte
 * directamente sobre el texto crudo del frontmatter.
 */
function parseGaleria(frontmatter) {
  if (!frontmatter) return [];
  const lines = frontmatter.split("\n");
  const items = [];
  let collecting = false;
  let current = null;

  lines.forEach((line) => {
    if (/^galeria:\s*(\[\s*\])?\s*$/.test(line) && /\[\s*\]/.test(line)) {
      collecting = false;
      return;
    }
    if (/^galeria:\s*$/.test(line)) {
      collecting = true;
      return;
    }
    if (!collecting) return;

    const fotoMatch = line.match(/^\s*-\s*foto:\s*(.*)$/);
    if (fotoMatch) {
      if (current) items.push(current);
      current = { foto: unquote(fotoMatch[1]), descripcion: "" };
      return;
    }

    const descMatch = line.match(/^\s+descripcion:\s*(.*)$/);
    if (descMatch && current) {
      current.descripcion = unquote(descMatch[1]);
      return;
    }

    // Línea nueva de nivel superior (sin indentar): termina la lista.
    if (/^[A-Za-z0-9_]+:/.test(line)) {
      if (current) {
        items.push(current);
        current = null;
      }
      collecting = false;
    }
  });

  if (current) items.push(current);
  return items.filter((item) => item.foto);
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
        body: body || "",
        slug: file.replace(/\.md$/, ""),
      };
    });
}

function readProyectos() {
  const dir = path.join(ROOT, "content", "proyectos");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, body, frontmatter } = parseFrontmatter(raw);
      return {
        title: data.title || "",
        categoria: data.categoria || "",
        ubicacion: data.ubicacion || "",
        anio: data.anio || "",
        image: data.image || "",
        excerpt: data.excerpt || body.replace(/[#*_>`]/g, "").slice(0, 160),
        galeria: parseGaleria(frontmatter),
        slug: file.replace(/\.md$/, ""),
      };
    });
}

function readClientes() {
  const dir = path.join(ROOT, "content", "clientes");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        nombre: data.nombre || "",
        logo: data.logo || "",
        testimonio: data.testimonio || body || "",
        slug: file.replace(/\.md$/, ""),
      };
    });
}

function readConfig() {
  const file = path.join(ROOT, "content", "config.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.warn("⚠ No se pudo leer content/config.json:", e.message);
    return {};
  }
}

function writeJson(name, items) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(items, null, 2));
  const count = Array.isArray(items) ? items.length : Object.keys(items).length;
  console.log(`✓ data/${name} (${count} elemento${count === 1 ? "" : "s"})`);
}

const eventos = readCollection("eventos");
const noticias = readCollection("noticias");
const proyectos = readProyectos();
const clientes = readClientes();
const config = readConfig();

writeJson("eventos.json", eventos);
writeJson("noticias.json", noticias);
writeJson("proyectos.json", proyectos);
writeJson("clientes.json", clientes);
writeJson("config.json", config);
