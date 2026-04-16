/**
 * City set three = full cityData from ~/Downloads/venues.html (all cities/venues).
 * Contact fields: prefers venues.html; fills empty email/facebook/phone/website/notes from index CITIES_SET_TWO when missing.
 * Facebook URLs are normalized to host/path (no https://) for the mobile app.
 * Messages: ~/Downloads/venue-messages-new-cities.json merged with venue-messages-set3.json (set3 wins on duplicate keys).
 * Keys are normalized with the same aliases as rebuild-nationwide-set-two.mjs.
 */
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOWNLOADS = `${process.env.HOME}/Downloads`;
const INDEX = `${ROOT}/index.html`;

const VENUES_HTML = `${DOWNLOADS}/venues.html`;
const MSG_NEW_CITIES = `${DOWNLOADS}/venue-messages-new-cities.json`;
const MSG_SET3 = `${DOWNLOADS}/venue-messages-set3.json`;

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

function parseCityData(html) {
  const prefix = "const cityData = ";
  const idx = html.indexOf(prefix);
  if (idx < 0) throw new Error("const cityData not found in venues.html");
  let arrStart = idx + prefix.length;
  while (html[arrStart] === " " || html[arrStart] === "\n") arrStart++;
  let depth = 0;
  let i = arrStart;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const expr = html.slice(arrStart, i);
  return (0, eval)(`(${expr})`);
}

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

function indexVenueMap(cityData) {
  const m = new Map();
  for (const c of cityData) {
    for (const v of c.cafes || []) m.set(v.id, v);
    for (const v of c.stores || []) m.set(v.id, v);
  }
  return m;
}

function pickStr(a, b) {
  const A = a != null && String(a).trim() !== "" ? String(a).trim() : "";
  const B = b != null && String(b).trim() !== "" ? String(b).trim() : "";
  return A || B;
}

/** Strip scheme/www so paths match mobile facebookPathToMMeUrl expectations. */
function normalizeFacebook(fb) {
  if (!fb || !String(fb).trim()) return "";
  return String(fb)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
}

function mergeVenue(htmlVenue, oldVenue) {
  if (!oldVenue) {
    return {
      ...htmlVenue,
      email: htmlVenue.email != null ? String(htmlVenue.email) : "",
      facebook: normalizeFacebook(htmlVenue.facebook),
      phone: htmlVenue.phone != null ? String(htmlVenue.phone) : "",
      website: htmlVenue.website != null ? String(htmlVenue.website) : "",
      emailNote: htmlVenue.emailNote != null ? String(htmlVenue.emailNote) : "",
      facebookNote: htmlVenue.facebookNote != null ? String(htmlVenue.facebookNote) : "",
    };
  }
  return {
    ...htmlVenue,
    email: pickStr(htmlVenue.email, oldVenue.email),
    facebook: normalizeFacebook(pickStr(htmlVenue.facebook, oldVenue.facebook)),
    phone: pickStr(htmlVenue.phone, oldVenue.phone),
    website: pickStr(htmlVenue.website, oldVenue.website),
    emailNote: pickStr(htmlVenue.emailNote, oldVenue.emailNote),
    facebookNote: pickStr(htmlVenue.facebookNote, oldVenue.facebookNote),
  };
}

function mergeCityData(htmlCities, indexMap) {
  return htmlCities.map((c) => ({
    ...c,
    cafes: (c.cafes || []).map((v) => mergeVenue(v, indexMap.get(v.id))),
    stores: (c.stores || []).map((v) => mergeVenue(v, indexMap.get(v.id))),
  }));
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

function main() {
  if (!fs.existsSync(VENUES_HTML)) throw new Error(`Missing ${VENUES_HTML}`);
  if (!fs.existsSync(MSG_NEW_CITIES)) throw new Error(`Missing ${MSG_NEW_CITIES}`);
  if (!fs.existsSync(MSG_SET3)) throw new Error(`Missing ${MSG_SET3}`);

  const venuesHtml = fs.readFileSync(VENUES_HTML, "utf8");
  const htmlCities = parseCityData(venuesHtml);

  let index = fs.readFileSync(INDEX, "utf8");
  const { expr: cities2expr } = extractJsArraySource(index, "CITIES_SET_TWO");
  const citiesTwo = (0, eval)(cities2expr);
  const indexMap = indexVenueMap(citiesTwo);

  const citiesThree = mergeCityData(htmlCities, indexMap);
  const venueIds = collectVenueIds(citiesThree);

  const msgNew = JSON.parse(fs.readFileSync(MSG_NEW_CITIES, "utf8"));
  const msgSet3 = JSON.parse(fs.readFileSync(MSG_SET3, "utf8"));
  const mergedRaw = { ...msgNew, ...msgSet3 };

  const bodiesByCanon = {};
  const skipped = [];
  for (const [jsonKey, body] of Object.entries(mergedRaw)) {
    const canon = MESSAGE_KEY_ALIASES[jsonKey] || jsonKey;
    const text = typeof body === "string" ? body : body?.body;
    if (text == null) {
      skipped.push({ jsonKey, reason: "no body" });
      continue;
    }
    if (!venueIds.has(canon)) {
      skipped.push({ jsonKey, canon, reason: "not in venues.html cityData" });
      continue;
    }
    bodiesByCanon[canon] = text;
  }
  if (skipped.length) console.warn("Skipped message keys:", skipped.length, skipped.slice(0, 15));

  const citiesJs = `/** City set three — full list from venues.html; contacts merged with city set two when missing; FB URLs normalized */\nvar CITIES_SET_THREE=[\n${citiesThree.map(cityToJs).join(",\n")}\n];`;

  const entries = Object.entries(bodiesByCanon)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, body]) => `  ${JSON.stringify(id)}:{body:${escapeJsString(body)}}`);
  const messagesJs = `/** Per-venue messages for city set three (new-cities + set3; set3 wins overlaps). */\nvar VENUE_MESSAGES_SET_THREE={\n${entries.join(",\n")}\n};`;

  if (index.includes("var CITIES_SET_THREE=")) {
    index = index.replace(/\/\*\* City set three[\s\S]*?\];\n/, citiesJs + "\n");
    const m3Start = index.indexOf("/** Per-venue messages for city set three");
    const m3End = index.indexOf("\n};\nfunction getCities", m3Start);
    if (m3Start < 0 || m3End < 0) throw new Error("VENUE_MESSAGES_SET_THREE block not found for replace");
    index = index.slice(0, m3Start) + messagesJs + index.slice(m3End + "\n};".length);
  } else {
    throw new Error("CITIES_SET_THREE not found — add block once or restore index.html");
  }

  fs.writeFileSync(INDEX, index, "utf8");
  console.log(
    "City set three:",
    citiesThree.length,
    "cities,",
    venueIds.size,
    "venues,",
    Object.keys(bodiesByCanon).length,
    "custom messages"
  );
}

main();
