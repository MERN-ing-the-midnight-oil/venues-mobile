/**
 * Builds city set three from Downloads/venue-messages.json + venue-messages-set3.json
 * (set3 wins on duplicate keys). Venues must exist in CITIES_SET_TWO; keys are normalized
 * with the same aliases as rebuild-nationwide-set-two.mjs.
 */
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOWNLOADS = `${process.env.HOME}/Downloads`;
const INDEX = `${ROOT}/index.html`;

const MSG_A = `${DOWNLOADS}/venue-messages.json`;
const MSG_B = `${DOWNLOADS}/venue-messages-set3.json`;

const MESSAGE_KEY_ALIASES = {
  "zulu-lynnwood": "zulu-lynwood",
  "bonus-round": "bonusround",
  snakeschicago: "snakeslattes-chi",
  stayandplay: "stayplay",
  paladinsleague: "paladins",
  battlegroundspdx: "battlegrounds-pdx",
  enchantedgrounds: "enchanted-hr",
  beyondtheboard: "beyondboard-mke",
  gamepointcafe: "gamepoint",
  elysiumgames: "elysium-den",
  dogoodergames: "dogooder",
  goldengameguild: "goldenguild",
  battlegroundcafe: "battleground-mpls",
  "gamekeep-nash": "gamekeep",
};

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
  return { start, end: i, expr: html.slice(start, i) };
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

function collectVenueIds(cityData) {
  const ids = new Set();
  for (const c of cityData) {
    for (const v of c.cafes || []) ids.add(v.id);
    for (const v of c.stores || []) ids.add(v.id);
  }
  return ids;
}

function filterCitiesForVenues(cityData, keepIds) {
  const out = [];
  for (const c of cityData) {
    const cafes = (c.cafes || []).filter((v) => keepIds.has(v.id));
    const stores = (c.stores || []).filter((v) => keepIds.has(v.id));
    if (!cafes.length && !stores.length) continue;
    out.push({
      ...c,
      cafes,
      stores,
    });
  }
  return out;
}

function main() {
  if (!fs.existsSync(MSG_A)) throw new Error(`Missing ${MSG_A}`);
  if (!fs.existsSync(MSG_B)) throw new Error(`Missing ${MSG_B}`);

  let index = fs.readFileSync(INDEX, "utf8");
  const { expr: cities2expr } = extractJsArraySource(index, "CITIES_SET_TWO");
  const cityData = (0, eval)(cities2expr);
  const allVenueIds = collectVenueIds(cityData);

  const msgA = JSON.parse(fs.readFileSync(MSG_A, "utf8"));
  const msgB = JSON.parse(fs.readFileSync(MSG_B, "utf8"));
  const mergedRaw = { ...msgA, ...msgB };

  const bodiesByCanon = {};
  const skipped = [];
  for (const [jsonKey, body] of Object.entries(mergedRaw)) {
    const canon = MESSAGE_KEY_ALIASES[jsonKey] || jsonKey;
    const text = typeof body === "string" ? body : body?.body;
    if (text == null) {
      skipped.push({ jsonKey, reason: "no body" });
      continue;
    }
    if (!allVenueIds.has(canon)) {
      skipped.push({ jsonKey, canon, reason: "not in CITIES_SET_TWO" });
      continue;
    }
    bodiesByCanon[canon] = text;
  }
  if (skipped.length) console.warn("Skipped keys:", skipped);

  const keepIds = new Set(Object.keys(bodiesByCanon));
  const citiesThree = filterCitiesForVenues(cityData, keepIds);
  const filteredIds = collectVenueIds(citiesThree);

  const citiesJs = `/** City set three — venues with repaired email / Facebook (catch-up list) */\nvar CITIES_SET_THREE=[\n${citiesThree.map(cityToJs).join(",\n")}\n];`;

  const entries = Object.entries(bodiesByCanon)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, body]) => `  ${JSON.stringify(id)}:{body:${escapeJsString(body)}}`);
  const messagesJs = `/** Per-venue messages for city set three (same shape as set one). */\nvar VENUE_MESSAGES_SET_THREE={\n${entries.join(",\n")}\n};`;

  if (index.includes("var CITIES_SET_THREE=")) {
    index = index.replace(/\/\*\* City set three[\s\S]*?\];\n/, citiesJs + "\n");
    const m3Start = index.indexOf("/** Per-venue messages for city set three");
    const m3End = index.indexOf("\n};\nfunction getCities", m3Start);
    if (m3Start < 0 || m3End < 0) throw new Error("VENUE_MESSAGES_SET_THREE block not found for replace");
    index = index.slice(0, m3Start) + messagesJs + index.slice(m3End + "\n};".length);
  } else {
    const { end: cities2End } = extractJsArraySource(index, "CITIES_SET_TWO");
    index = index.slice(0, cities2End) + "\n\n" + citiesJs + index.slice(cities2End);

    const m2 = index.indexOf("var VENUE_MESSAGES_SET_TWO=");
    if (m2 < 0) throw new Error("VENUE_MESSAGES_SET_TWO not found");
    const msg2Close = "\n};\nfunction getCities";
    const closeIdx = index.indexOf(msg2Close, m2);
    if (closeIdx < 0) throw new Error("VENUE_MESSAGES_SET_TWO close anchor not found");
    const messages2End = closeIdx + "\n};".length;
    index = index.slice(0, messages2End) + "\n\n" + messagesJs + index.slice(messages2End);
  }

  fs.writeFileSync(INDEX, index, "utf8");
  console.log(
    "City set three:",
    citiesThree.length,
    "cities,",
    filteredIds.size,
    "venues,",
    Object.keys(bodiesByCanon).length,
    "messages"
  );
}

main();
