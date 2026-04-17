/**
 * Merges a venue export (name, email, facebook, message) into index.html
 * CITIES_SET_THREE + VENUE_MESSAGES_SET_THREE.
 *
 * Usage: node scripts/apply-set3-venue-json.mjs /path/to/venue-messages-set3.json
 */
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const INDEX = `${ROOT}/index.html`;

function extractJsArraySource(html, varName) {
  const prefix = `var ${varName}=`;
  const idx = html.indexOf(prefix);
  if (idx < 0) throw new Error(`${varName} not found`);
  let i = idx + prefix.length;
  while (html[i] === " " || html[i] === "\n") i++;
  if (html[i] !== "[") throw new Error(`expected [ after ${varName}`);
  let depth = 0;
  const start = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        i++;
        if (html[i] === ";") i++;
        break;
      }
    }
  }
  return { blockStart: idx, blockEnd: i, expr: html.slice(start, i) };
}

function normalizeFacebook(fb) {
  if (!fb || !String(fb).trim()) return "";
  return String(fb)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
}

function pickStr(htmlVal, jsonVal) {
  const J = jsonVal != null && String(jsonVal).trim() !== "" ? String(jsonVal).trim() : "";
  if (J) return J;
  return htmlVal != null ? String(htmlVal) : "";
}

function escapeJsString(s) {
  return JSON.stringify(s);
}

function venueToJs(v) {
  const keys = ["id", "name", "subloc", "phone", "email", "website", "emailNote", "facebook", "facebookNote"];
  const parts = [];
  for (const k of keys) {
    if (v[k] !== undefined) parts.push(`${k}:${escapeJsString(String(v[k]))}`);
  }
  return `{${parts.join(",")}}`;
}

function cityToJs(c) {
  const cafeStr = (c.cafes || []).map(venueToJs).join(",\n     ");
  const storeStr = (c.stores || []).map(venueToJs).join(",\n     ");
  const tags = JSON.stringify(c.tags || []);
  const researched = c.researched !== false;
  return `  {id:${escapeJsString(c.id)},name:${escapeJsString(c.name)},tags:${tags},researched:${researched},\n   cafes:[${cafeStr ? "\n     " + cafeStr + "\n    " : ""}],\n   stores:[${storeStr ? "\n     " + storeStr + "\n    " : ""}]}`;
}

function indexVenueById(cityData) {
  const m = new Map();
  for (const c of cityData) {
    for (const v of c.cafes || []) m.set(v.id, v);
    for (const v of c.stores || []) m.set(v.id, v);
  }
  return m;
}

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error("Usage: node scripts/apply-set3-venue-json.mjs <path-to-json>");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  let index = fs.readFileSync(INDEX, "utf8");

  const { blockStart: cStart, blockEnd: cEnd, expr: citiesExpr } = extractJsArraySource(index, "CITIES_SET_THREE");
  const citiesThree = (0, eval)(citiesExpr);
  const byId = indexVenueById(citiesThree);

  const messages = {};
  const missingIds = [];

  for (const [vid, entry] of Object.entries(raw)) {
    const v = byId.get(vid);
    if (!v) {
      missingIds.push(vid);
      continue;
    }
    if (entry.name != null && String(entry.name).trim()) v.name = String(entry.name).trim();
    v.email = pickStr(v.email, entry.email);
    const fbNorm = normalizeFacebook(entry.facebook);
    if (fbNorm) v.facebook = fbNorm;
    const msg = entry.message != null ? String(entry.message).trim() : "";
    if (msg) messages[vid] = msg;
  }

  if (missingIds.length) {
    console.warn("JSON keys not found in CITIES_SET_THREE:", missingIds.join(", "));
  }

  const citiesJs = `/** City set three — full list from venues.html; contacts merged with city set two when missing; FB URLs normalized */\nvar CITIES_SET_THREE=[\n${citiesThree.map(cityToJs).join(",\n")}\n];`;

  const entries = Object.entries(messages)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, body]) => `  ${JSON.stringify(id)}:{body:${escapeJsString(body)}}`);
  const messagesJs = `/** Per-venue messages for city set three (from venue export JSON). */\nvar VENUE_MESSAGES_SET_THREE={\n${entries.join(",\n")}\n};`;

  if (!index.includes("var CITIES_SET_THREE=")) throw new Error("CITIES_SET_THREE not found");
  index = index.replace(/\/\*\* City set three[\s\S]*?\];\n/, citiesJs + "\n");

  const m3Start = index.indexOf("/** Per-venue messages for city set three");
  if (m3Start < 0) throw new Error("VENUE_MESSAGES_SET_THREE comment not found");
  const fnStart = index.indexOf("\nfunction getCities()", m3Start);
  if (fnStart < 0) throw new Error("function getCities not found after VENUE_MESSAGES_SET_THREE");
  index = index.slice(0, m3Start) + messagesJs + index.slice(fnStart);

  fs.writeFileSync(INDEX, index, "utf8");
  console.log(
    "Updated city set 3:",
    Object.keys(messages).length,
    "venue messages;",
    Object.keys(raw).length - missingIds.length,
    "venues merged from JSON"
  );
}

main();
