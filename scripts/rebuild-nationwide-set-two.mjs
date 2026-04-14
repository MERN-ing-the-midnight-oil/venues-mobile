/**
 * Regenerates CITIES_SET_TWO, VENUE_MESSAGES_SET_TWO, and venue-messages.json
 * from Downloads/venues.html + merged venue message JSON (with ID aliases).
 */
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOWNLOADS = `${process.env.HOME}/Downloads`;

const VENUES_HTML = `${DOWNLOADS}/venues.html`;
const MSG_MAIN_DOWNLOADS = `${DOWNLOADS}/venue-messages.json`;
const MSG_MAIN_PROJECT = `${ROOT}/venue-messages.json`;
const MSG_NEW = `${DOWNLOADS}/venue-messages-new-cities.json`;

/** JSON export keys -> ids used in venues.html cityData */
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
  if (idx < 0) throw new Error("const cityData not found");
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
  return `  {id:${escapeJsString(c.id)},name:${escapeJsString(c.name)},tags:${tags},researched:${c.researched !== false},\n   cafes:[${cafeStr ? "\n     " + cafeStr + "\n    " : ""}],\n   stores:[${storeStr ? "\n     " + storeStr + "\n    " : ""}]}`;
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
  const html = fs.readFileSync(VENUES_HTML, "utf8");
  const cityData = parseCityData(html);
  const venueIds = collectVenueIds(cityData);

  const msgMainPath = fs.existsSync(MSG_MAIN_DOWNLOADS) ? MSG_MAIN_DOWNLOADS : MSG_MAIN_PROJECT;
  if (!fs.existsSync(msgMainPath)) throw new Error("No base venue-messages.json (Downloads or project)");
  const msgMain = JSON.parse(fs.readFileSync(msgMainPath, "utf8"));
  const msgNew = JSON.parse(fs.readFileSync(MSG_NEW, "utf8"));
  const merged = { ...msgMain, ...msgNew };

  const outMessages = {};
  const unresolved = [];
  for (const [jsonKey, body] of Object.entries(merged)) {
    const canon = MESSAGE_KEY_ALIASES[jsonKey] || jsonKey;
    if (!venueIds.has(canon)) {
      unresolved.push({ jsonKey, canon });
      continue;
    }
    const text = typeof body === "string" ? body : body?.body;
    if (text == null) {
      unresolved.push({ jsonKey, canon, reason: "no body" });
      continue;
    }
    outMessages[canon] = { body: text };
  }
  if (unresolved.length) {
    console.error("Unresolved message keys:", unresolved);
    process.exit(1);
  }

  const citiesJs = `/** City set two — nationwide venues from venues.html (cityData) */\nvar CITIES_SET_TWO=[\n${cityData.map(cityToJs).join(",\n")}\n];`;

  const entries = Object.entries(outMessages)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, o]) => `  ${JSON.stringify(id)}:{body:${escapeJsString(o.body)}}`);
  const messagesJs = `/** Per-venue messages for city set two (same shape as set one). */\nvar VENUE_MESSAGES_SET_TWO={\n${entries.join(",\n")}\n};`;

  fs.writeFileSync(`${ROOT}/venue-messages.json`, JSON.stringify(outMessages, null, 2) + "\n", "utf8");

  const indexPath = `${ROOT}/index.html`;
  let index = fs.readFileSync(indexPath, "utf8");

  const cRe = /\/\*\* City set two[\s\S]*?\];/;
  if (!cRe.test(index)) throw new Error("CITIES_SET_TWO block not found");
  index = index.replace(cRe, citiesJs);

  const mRe = /\/\*\* Per-venue messages for city set two[\s\S]*?\};/;
  if (!mRe.test(index)) throw new Error("VENUE_MESSAGES_SET_TWO block not found");
  index = index.replace(mRe, messagesJs);

  fs.writeFileSync(indexPath, index, "utf8");
  console.log(
    "Wrote venue-messages.json and updated index.html:",
    cityData.length,
    "cities,",
    venueIds.size,
    "venues,",
    Object.keys(outMessages).length,
    "custom messages"
  );
}

main();
