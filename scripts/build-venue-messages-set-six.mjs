/**
 * Fills VENUE_MESSAGES_SET_SIX in index.html:
 * 1. Merges archived VENUE_MESSAGES_SET_ONE … _FIVE from index.html
 * 2. Overlays venue-messages-set5.json (or VENUE_MESSAGES_EXPORT) — your per-venue `message` + `subject`
 * 3. Optionally overlays venue-messages-set6.json if present (wins on duplicate keys)
 * 4. Default body for city-set-six venues still missing copy
 *
 * Run: node scripts/build-venue-messages-set-six.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const EXPORT_JSON =
  process.env.VENUE_MESSAGES_EXPORT || path.join(ROOT, "venue-messages-set5.json");
const EXPORT_JSON_SIX = path.join(ROOT, "venue-messages-set6.json");

/** Map city-set-six id → archived message id (when names differ). */
const ID_ALIASES = {
  sagesportal: "sagesportal-spk",
};

function extractBraceJson(html, varName) {
  const prefix = `var ${varName}=`;
  const start = html.indexOf(prefix);
  if (start < 0) return {};
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

function extractCitiesSix(html) {
  const m = html.match(/var CITIES_SET_SIX=(\[[\s\S]*?\]);\s*\n\s*var SET_STATE=/);
  if (!m) throw new Error("CITIES_SET_SIX: could not slice before SET_STATE");
  return JSON.parse(m[1]);
}

function normalizeMsg(v) {
  if (!v || typeof v !== "object") return null;
  const subject = (v.subject != null ? String(v.subject) : "").trim();
  const body = (v.body != null ? String(v.body) : v.message != null ? String(v.message) : "").trim();
  if (!body) return null;
  return { subject, body };
}

function mergeMessageLayers(m1, m2, m3, m4, m5) {
  const out = {};
  for (const L of [m1, m2, m3, m4, m5]) {
    for (const [k, raw] of Object.entries(L || {})) {
      const n = normalizeMsg(raw);
      if (n) out[k] = n;
    }
  }
  return out;
}

function collectVenueIds(cities) {
  const ids = [];
  for (const c of cities) {
    for (const v of c.cafes || []) ids.push(v.id);
    for (const v of c.stores || []) ids.push(v.id);
  }
  return ids;
}

function venueNameById(cities, id) {
  for (const c of cities) {
    for (const v of [...(c.cafes || []), ...(c.stores || [])]) {
      if (v.id === id) return v.name || id;
    }
  }
  return id;
}

function defaultBody(name) {
  return (
    `Hi there — hope things are going well at ${name}.\n\n` +
    `Would you give MeepleUp a try with your regulars? It's a free app I built for groups that game together consistently — players RSVP between sessions, nominate games from a shared library, vote on what to play, and show up knowing what's on the table. BoardGameGeek library sync and photo shelf scan are built in.\n\n` +
    `MeepleUp is an early-release solo project (1,000+ hours). If anything feels off, I'd rather hear it at contact@meepleup.com than in a public review. If it works for your crowd, passing it to another owner you trust would mean a lot.\n\n` +
    `meepleup.com or search \"MeepleUp\" on the App Store / Google Play.\n\n` +
    `Thanks,\nRhys Smoker`
  );
}

function lookupMerged(merged, id) {
  if (merged[id]) return merged[id];
  const alt = ID_ALIASES[id];
  if (alt && merged[alt]) return merged[alt];
  return null;
}

/** Per-venue export JSON: { "venueId": { "subject"?, "message" or "body" } } — wins over archived sets. */
function mergePerVenueExport(merged, filePath, idsFromExport) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const [k, raw] of Object.entries(data)) {
    const n = normalizeMsg(raw);
    if (!n) continue;
    merged[k] = n;
    if (idsFromExport) idsFromExport.add(k);
  }
}

function main() {
  const html = fs.readFileSync(INDEX, "utf8");
  const cities = extractCitiesSix(html);
  const m1 = extractBraceJson(html, "VENUE_MESSAGES_SET_ONE");
  const m2 = extractBraceJson(html, "VENUE_MESSAGES_SET_TWO");
  const m3 = extractBraceJson(html, "VENUE_MESSAGES_SET_THREE");
  const m4 = extractBraceJson(html, "VENUE_MESSAGES_SET_FOUR");
  const m5 = extractBraceJson(html, "VENUE_MESSAGES_SET_FIVE");
  const merged = mergeMessageLayers(m1, m2, m3, m4, m5);
  const fromExportKeys = new Set();
  mergePerVenueExport(merged, EXPORT_JSON, fromExportKeys);
  mergePerVenueExport(merged, EXPORT_JSON_SIX, fromExportKeys);

  const out = {};
  const ids = collectVenueIds(cities);
  let fromExport = 0,
    fromArchive = 0,
    defaulted = 0;
  for (const id of ids) {
    const hit = lookupMerged(merged, id);
    if (hit) {
      out[id] = { subject: hit.subject || "", body: hit.body };
      if (fromExportKeys.has(id)) fromExport++;
      else fromArchive++;
    } else {
      const name = venueNameById(cities, id);
      out[id] = { subject: "", body: defaultBody(name) };
      defaulted++;
    }
  }

  const sixJs = "var VENUE_MESSAGES_SET_SIX=" + JSON.stringify(out) + ";";
  const re = /var VENUE_MESSAGES_SET_SIX=\{[\s\S]*?\};/;
  if (!re.test(html)) throw new Error("VENUE_MESSAGES_SET_SIX block not found");
  const next = html.replace(re, sixJs);
  fs.writeFileSync(INDEX, next, "utf8");
  console.log(
    "VENUE_MESSAGES_SET_SIX:",
    Object.keys(out).length,
    "venues;",
    fromExport,
    "from export JSON;",
    fromArchive,
    "from archived sets only;",
    defaulted,
    "default bodies"
  );
  if (!fs.existsSync(EXPORT_JSON)) console.warn("No export file at", EXPORT_JSON, "(set VENUE_MESSAGES_EXPORT to override)");
}

main();
