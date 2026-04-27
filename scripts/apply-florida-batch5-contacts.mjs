/**
 * Merges florida-venues-batch5.json (contact fields + optional message verbiage)
 * into index.html: CITIES_SET_EIGHT + VENUE_MESSAGES_SET_EIGHT.
 *
 * Usage:
 *   node scripts/apply-florida-batch5-contacts.mjs /path/to/florida-venues-batch5.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");

function skipQuotedString(html, i) {
  const q = html[i];
  if (q !== '"' && q !== "'") return i;
  for (let j = i + 1; j < html.length; j++) {
    if (html[j] === "\\") {
      j++;
      continue;
    }
    if (html[j] === q) return j + 1;
  }
  return html.length;
}

/** Top-level `[` … `]` only; skips quoted strings so inner `]` in JSON objects does not end early. */
function extractJsArraySource(html, varName) {
  const prefix = `var ${varName}=`;
  const idx = html.indexOf(prefix);
  if (idx < 0) throw new Error(`${varName} not found`);
  let i = idx + prefix.length;
  while (html[i] === " " || html[i] === "\n") i++;
  if (html[i] !== "[") throw new Error(`expected [ after ${varName}`);
  const start = i;
  let depth = 0;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '"' || c === "'") {
      i = skipQuotedString(html, i) - 1;
      continue;
    }
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
  return html.slice(start, i);
}

function extractBraceJson(html, varName) {
  const prefix = `var ${varName}=`;
  const start = html.indexOf(prefix);
  if (start < 0) throw new Error(`${varName} not found`);
  let i = start + prefix.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== "{") throw new Error(varName + ": expected {");
  let depth = 0;
  const objStart = i;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      for (i++; i < html.length; i++) {
        if (html[i] === "\\") {
          i++;
          continue;
        }
        if (html[i] === q) break;
      }
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(html.slice(objStart, i + 1));
      }
    }
  }
  throw new Error(varName + ": unclosed");
}

function replaceVarTopLevelValue(html, varName, openChar, closeChar, serialized) {
  const prefix = `var ${varName}=`;
  const si = html.indexOf(prefix);
  if (si < 0) throw new Error(`missing ${varName}`);
  let i = si + prefix.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== openChar) throw new Error(`${varName}: expected ${openChar}`);
  const valueStart = i;
  let depth = 0;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === '"' || ch === "'") {
      i = skipQuotedString(html, i) - 1;
      continue;
    }
    if (openChar === "[" && ch === "[") depth++;
    else if (openChar === "[" && ch === "]") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    } else if (openChar === "{" && ch === "{") depth++;
    else if (openChar === "{" && ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  let end = i;
  while (html[end] === ";" || html[end] === "\n" || html[end] === "\r") end++;
  return html.slice(0, valueStart) + serialized + ";" + html.slice(end);
}

function normalizeWebsite(w) {
  if (!w || !String(w).trim()) return "";
  return String(w).trim().replace(/^https?:\/\//i, "");
}

function normalizeFb(u) {
  if (!u || !String(u).trim()) return "";
  let s = String(u).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const j = s.toLowerCase().indexOf("facebook.com/");
  if (j >= 0) return s.slice(j);
  return s;
}

function nameNorm(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(name) {
  return new Set(nameNorm(name).split(" ").filter((t) => t.length > 1));
}

/** How well venue name covers batch name tokens (batch is the research row). */
function matchScore(venueName, batchName) {
  if (nameNorm(venueName) === nameNorm(batchName)) return 1;
  const V = tokenSet(venueName);
  const B = tokenSet(batchName);
  if (B.size === 0) return 0;
  let hit = 0;
  for (const t of B) if (V.has(t)) hit++;
  return hit / B.size;
}

function allVenuesInCity(city) {
  return [...(city.cafes || []), ...(city.stores || [])];
}

function findVenueIdsForBatch(cities, batch) {
  const cityKey = `${batch.city}, ${batch.state}`;
  const city = cities.find((c) => c.name === cityKey);
  if (!city) return { ids: [], warn: `no city ${cityKey}` };
  const venues = allVenuesInCity(city);
  const scored = venues.map((v) => ({ id: v.id, name: v.name, s: matchScore(v.name, batch.name) }));
  const max = Math.max(...scored.map((x) => x.s), 0);
  const MIN = 0.55;
  if (max < MIN) return { ids: [], warn: `no venue ≥${MIN} in ${cityKey} for "${batch.name}"` };
  return { ids: scored.filter((x) => x.s === max).map((x) => x.id), warn: null };
}

function applyBatchToVenue(v, batch) {
  v.email = batch.email != null && String(batch.email).trim() ? String(batch.email).trim() : "";
  v.facebook = normalizeFb(batch.facebookUrl || "");
  v.website = normalizeWebsite(batch.websiteContactUrl || "");
}

function messageBodyFromBatch(batch) {
  if (batch.contactMethod === "email" && batch.emailVerbiage) return String(batch.emailVerbiage);
  if (batch.facebookVerbiage) return String(batch.facebookVerbiage);
  if (batch.emailVerbiage) return String(batch.emailVerbiage);
  return null;
}

function findVenueById(cities, id) {
  for (const c of cities) {
    for (const k of ["cafes", "stores"]) {
      const arr = c[k];
      if (!arr) continue;
      const v = arr.find((x) => x.id === id);
      if (v) return v;
    }
  }
  return null;
}

function main() {
  const batchPath = process.argv[2] || path.join(process.env.HOME || "", "Downloads/florida-venues-batch5.json");
  if (!fs.existsSync(batchPath)) throw new Error("Missing batch file: " + batchPath);
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
  if (!Array.isArray(batch)) throw new Error("Batch must be a JSON array");

  let html = fs.readFileSync(INDEX, "utf8");
  const cities = new Function("return " + extractJsArraySource(html, "CITIES_SET_EIGHT"))();
  const messages = extractBraceJson(html, "VENUE_MESSAGES_SET_EIGHT");

  const applied = [];
  const warnings = [];

  for (const row of batch) {
    const { ids, warn } = findVenueIdsForBatch(cities, row);
    if (warn) {
      warnings.push(warn);
      continue;
    }
    const body = messageBodyFromBatch(row);
    for (const id of ids) {
      const v = findVenueById(cities, id);
      if (!v) continue;
      applyBatchToVenue(v, row);
      if (body) {
        if (!messages[id]) messages[id] = { subject: "", body: "" };
        messages[id].subject = messages[id].subject != null ? String(messages[id].subject) : "";
        messages[id].body = body;
      }
      applied.push({ id, name: v.name, city: row.city + ", " + row.state });
    }
  }

  html = replaceVarTopLevelValue(html, "CITIES_SET_EIGHT", "[", "]", JSON.stringify(cities));
  html = replaceVarTopLevelValue(html, "VENUE_MESSAGES_SET_EIGHT", "{", "}", JSON.stringify(messages));

  fs.writeFileSync(INDEX, html, "utf8");

  console.log("Updated", INDEX);
  console.log("Venue rows touched:", applied.length);
  for (const w of warnings) console.warn("WARN:", w);
  for (const a of applied) console.log("  ", a.id, "—", a.name);
}

main();
