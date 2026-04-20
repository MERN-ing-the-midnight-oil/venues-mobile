/**
 * Reads ~/Desktop/venue-messages-set5.json (or SET5_JSON path),
 * builds CITIES_SET_FIVE + VENUE_MESSAGES_SET_FIVE, splices into index.html.
 * Run: node scripts/inject-venue-set5.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const _set5Repo = path.join(ROOT, "venue-messages-set5.json");
const SET5_JSON =
  process.env.SET5_JSON ||
  (fs.existsSync(_set5Repo) ? _set5Repo : path.join(process.env.HOME || "", "Desktop/venue-messages-set5.json"));

/** Optional richer rows (subloc, phone, website, emailNote) keyed by venue id */
const META = {
  rustyscabbard: {
    subloc: "Lane Allen Rd — Lexington staple since 1982, 50+ game library, Wed game nights",
    phone: "(859) 278-6634",
    emailNote: "Some directories list old ISP addresses (unverified); Facebook rustyscabbard82",
  },
  "legendarygames-lex": {
    subloc: "N Ashland Ave (Warehouse Block) — largest play space in area",
    phone: "(859) 523-9430",
    website: "legendarygameslexington.square.site",
    emailNote: "VisitLex listing",
  },
  "tabletoptavern-lex": {
    subloc: "Lexington",
    emailNote: "Contact via Facebook",
  },
  "scificity-knox": { subloc: "Knoxville", emailNote: "orders@sci-fi-city.com" },
  tokengametavern: {
    subloc: "Knoxville (Seven Oaks Dr) — tabletop lounge, bar, arcade",
    phone: "(865) 770-3870",
    website: "tokengametavern.com",
    emailNote: "Contact form on site",
  },
  infinityflux: { subloc: "Chattanooga", website: "infinityflux.net" },
  epikosccg: { subloc: "Chattanooga area (Brainerd / Northgate)", phone: "(423) 531-4184", website: "epikosccg.com" },
  "darkforest-buf": {
    subloc: "North Tonawanda — Buffalo area; Oliver St",
    phone: "(716) 243-2849",
    email: "darkforestgamesnt@gmail.com",
    website: "darkforestgamesnt.com",
    emailNote: "Wargames.com / store listing",
    facebook: "https://www.facebook.com/darkforestgames",
  },
  "casualdragon-buf": { subloc: "Buffalo area", website: "casualdragongames.com" },
  fantasticgames: {
    subloc: "Downtown Boise (N 8th St) — large board game + puzzle selection",
    phone: "(208) 345-0204",
    website: "fantasticgamesboise.com",
    emailNote: "Contact via phone or website",
  },
  "rollplay-mad2": {
    subloc: "Garver Green, Madison",
    phone: "(608) 960-8286",
    website: "rollplay.shop",
    emailNote: "Community game nights",
  },
  "rookroom-dsm": { subloc: "Des Moines", website: "therookroom.com" },
  "mayhem-dsm": { subloc: "Des Moines", website: "mayhemcomics.com" },
  "sente-ict": { subloc: "Wichita", emailNote: "Contact via Facebook" },
  "pinkelephant-ict": { subloc: "Wichita", emailNote: "Contact via Facebook" },
  "hexagonalley-col": { subloc: "Columbus area", emailNote: "Contact via Facebook" },
  cavernsforests: { subloc: "Minerva / NE Ohio board game cafe", emailNote: "Contact via Facebook" },
  "highground-hsv": { subloc: "Huntsville", emailNote: "Contact via Facebook" },
  "thedeep-hsv": { subloc: "Huntsville", emailNote: "Contact via Facebook" },
  "backagain-ct": { subloc: "Newington, CT", emailNote: "Contact via Facebook" },
  "fifteenpct-tac": { subloc: "Tacoma", emailNote: "Contact via Facebook" },
  "dragonshoard-gso": { subloc: "Greensboro, NC", emailNote: "Contact via Facebook" },
  "firefly-col": { subloc: "Westerville / Columbus area", emailNote: "Contact via Facebook" },
  "gameon-fay": { subloc: "Fayetteville, NC", emailNote: "Contact via Facebook" },
  "gamevault-ep": { subloc: "El Paso", website: "gamevaultelpaso.com" },
  "littlewars-br": { subloc: "Baton Rouge", emailNote: "Contact via Facebook" },
  "gamechest-sf": { subloc: "Sioux Falls", emailNote: "Contact via Facebook" },
  hauntedgamecafe: { subloc: "Tucson", emailNote: "Contact via Facebook" },
  villagemeeple: { subloc: "McMurray / Pittsburgh area", website: "villagemeeple.com" },
  "justforfun-peoria": {
    subloc: "Peoria, IL",
    phone: "(309) 686-7720",
    website: "justforfungames.net",
    emailNote: "Contact form on site; Peoria's largest hobby game store",
    facebook: "https://www.facebook.com/JustForFunGames",
  },
  "houserules-gr": { subloc: "Grand Rapids, MI", website: "houseruleslounge.com" },
  "meeples-lyn": { subloc: "Lynn, MA", emailNote: "Contact via Facebook" },
  "courtyardcafe-tal": { subloc: "Tallahassee", emailNote: "Contact via Facebook" },
  "punkouter-gnv": {
    subloc: "Gainesville, FL",
    phone: "(352) 234-3415",
    email: "support@punkouter.com",
    website: "punkouter.com",
    emailNote: "Contact page on site",
    facebook: "https://www.facebook.com/PunkOuterGames",
  },
  "lochcafe-dul": { subloc: "Duluth, MN", emailNote: "Contact via Facebook" },
  "boardlandia-app": { subloc: "Appleton, WI", website: "boardlandia.com" },
  "gnomegames-gb": { subloc: "Green Bay, WI", emailNote: "Contact via Facebook" },
  "summit-fw": { subloc: "Fort Wayne, IN", emailNote: "Contact via Facebook" },
  "sagesportal-spk": { subloc: "Spokane", website: "sagesportalcafe.com" },
  elfnmoon: { subloc: "Indianapolis", website: "elfandmoon.com" },
  hitherto: { subloc: "Greenfield / Indianapolis area", website: "hithertogames.com" },
  "goodgames-indy": { subloc: "Indianapolis", website: "goodgamesna.com" },
  "battlegrounds-pdx": {
    subloc: "NE Sandy Blvd, Portland",
    phone: "(971) 383-3775",
    website: "battlegroundsgamingcafe.com",
  },
  netherworld: { subloc: "Madison, WI", phone: "(608) 255-4263", emailNote: "No website — call" },
  nobleknight: { subloc: "Fitchburg / Madison area", phone: "(608) 758-9901", website: "nobleknight.com" },
  "imboard-mid": { subloc: "Middleton / Madison area", website: "imboardgames.com" },
  "funagain-eugene": { subloc: "Eugene, OR", website: "funagain.com" },
  "mox-sea": {
    subloc: "Ballard, Seattle",
    phone: "(206) 523-9605",
    website: "moxboardinghouse.com/pages/seattle",
    emailNote: "Contact form on site",
  },
  "mox-bel": {
    subloc: "Bellevue, WA",
    phone: "(425) 326-3050",
    website: "moxboardinghouse.com/pages/bellevue",
    emailNote: "Contact form on site",
  },
  meeples: {
    subloc: "West Seattle",
    phone: "(206) 535-7896",
    website: "meeplesgames.com",
  },
};

const CITY_GROUPS = [
  { city: { id: "lexington-ky", name: "Lexington, KY", tags: ["major", "college"], researched: true }, keys: ["rustyscabbard", "legendarygames-lex", "tabletoptavern-lex"] },
  { city: { id: "knoxville-tn", name: "Knoxville, TN", tags: ["major", "college"], researched: true }, keys: ["scificity-knox", "tokengametavern"] },
  { city: { id: "chattanooga-tn", name: "Chattanooga, TN", tags: ["major", "college"], researched: true }, keys: ["infinityflux", "epikosccg"] },
  { city: { id: "buffalo-ny", name: "Buffalo, NY", tags: ["major", "college"], researched: true }, keys: ["darkforest-buf", "casualdragon-buf"] },
  { city: { id: "boise-id", name: "Boise, ID", tags: ["major", "college"], researched: true }, keys: ["fantasticgames"] },
  { city: { id: "madison-wi", name: "Madison, WI", tags: ["major", "college"], researched: true }, keys: ["rollplay-mad2", "netherworld", "nobleknight", "imboard-mid"] },
  { city: { id: "des-moines-ia", name: "Des Moines, IA", tags: ["major", "college"], researched: true }, keys: ["rookroom-dsm", "mayhem-dsm"] },
  { city: { id: "wichita-ks", name: "Wichita, KS", tags: ["major", "college"], researched: true }, keys: ["sente-ict", "pinkelephant-ict"] },
  { city: { id: "columbus-oh", name: "Columbus, OH area", tags: ["major", "college"], researched: true }, keys: ["hexagonalley-col", "firefly-col"] },
  { city: { id: "ne-ohio", name: "Northeast Ohio", tags: ["major"], researched: true }, keys: ["cavernsforests"] },
  { city: { id: "huntsville-al", name: "Huntsville, AL", tags: ["major", "college"], researched: true }, keys: ["highground-hsv", "thedeep-hsv"] },
  { city: { id: "hartford-ct", name: "Hartford, CT area", tags: ["major"], researched: true }, keys: ["backagain-ct"] },
  { city: { id: "tacoma-wa", name: "Tacoma, WA", tags: ["major", "college"], researched: true }, keys: ["fifteenpct-tac"] },
  { city: { id: "greensboro-nc", name: "Greensboro, NC", tags: ["major", "college"], researched: true }, keys: ["dragonshoard-gso"] },
  { city: { id: "fayetteville-nc", name: "Fayetteville, NC", tags: ["major", "college"], researched: true }, keys: ["gameon-fay"] },
  { city: { id: "el-paso-tx", name: "El Paso, TX", tags: ["major", "college"], researched: true }, keys: ["gamevault-ep"] },
  { city: { id: "baton-rouge-la", name: "Baton Rouge, LA", tags: ["major", "college"], researched: true }, keys: ["littlewars-br"] },
  { city: { id: "sioux-falls-sd", name: "Sioux Falls, SD", tags: ["major", "college"], researched: true }, keys: ["gamechest-sf"] },
  { city: { id: "tucson-az", name: "Tucson, AZ", tags: ["major", "college"], researched: true }, keys: ["hauntedgamecafe"] },
  { city: { id: "pittsburgh-pa", name: "Pittsburgh, PA area", tags: ["major", "college"], researched: true }, keys: ["villagemeeple"] },
  { city: { id: "peoria-il", name: "Peoria, IL", tags: ["major", "college"], researched: true }, keys: ["justforfun-peoria"] },
  { city: { id: "grand-rapids-mi", name: "Grand Rapids, MI", tags: ["major", "college"], researched: true }, keys: ["houserules-gr"] },
  { city: { id: "lynn-ma", name: "Lynn, MA", tags: ["major", "college"], researched: true }, keys: ["meeples-lyn"] },
  { city: { id: "tallahassee-fl", name: "Tallahassee, FL", tags: ["major", "college"], researched: true }, keys: ["courtyardcafe-tal"] },
  { city: { id: "gainesville-fl", name: "Gainesville, FL", tags: ["major", "college"], researched: true }, keys: ["punkouter-gnv"] },
  { city: { id: "duluth-mn", name: "Duluth, MN", tags: ["major", "college"], researched: true }, keys: ["lochcafe-dul"] },
  { city: { id: "appleton-wi", name: "Appleton, WI", tags: ["major", "college"], researched: true }, keys: ["boardlandia-app"] },
  { city: { id: "green-bay-wi", name: "Green Bay, WI", tags: ["major", "college"], researched: true }, keys: ["gnomegames-gb"] },
  { city: { id: "fort-wayne-in", name: "Fort Wayne, IN", tags: ["major", "college"], researched: true }, keys: ["summit-fw"] },
  { city: { id: "spokane-wa", name: "Spokane, WA", tags: ["major", "college"], researched: true }, keys: ["sagesportal-spk"] },
  { city: { id: "indianapolis-in", name: "Indianapolis, IN", tags: ["major", "college"], researched: true }, keys: ["elfnmoon", "hitherto", "goodgames-indy"] },
  { city: { id: "portland-or", name: "Portland, OR", tags: ["major", "college"], researched: true }, keys: ["battlegrounds-pdx"] },
  { city: { id: "eugene-or", name: "Eugene, OR", tags: ["major", "college"], researched: true }, keys: ["funagain-eugene"] },
  { city: { id: "seattle-wa", name: "Seattle, WA area", tags: ["major", "college"], researched: true }, keys: ["mox-sea", "mox-bel", "meeples"] },
];

function normalizeFb(u) {
  if (!u || !String(u).trim()) return "";
  let s = String(u).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const i = s.toLowerCase().indexOf("facebook.com/");
  if (i >= 0) return s.slice(i);
  if (s.toLowerCase().indexOf("fb.com/") === 0) return "facebook.com/" + s.slice(7);
  return s;
}

function venueRow(key, j) {
  const m = META[key] || {};
  const email = (j.email || m.email || "").trim();
  const facebook = normalizeFb(j.facebook || m.facebook || "");
  return {
    id: key,
    name: j.name,
    subloc: m.subloc != null ? m.subloc : "",
    phone: m.phone != null ? m.phone : "",
    email,
    website: m.website != null ? m.website : "",
    emailNote: m.emailNote != null ? m.emailNote : "",
    facebook,
    facebookNote: m.facebookNote != null ? m.facebookNote : "",
  };
}

function buildCities(messages) {
  const seen = new Set();
  const cities = [];
  for (const g of CITY_GROUPS) {
    const cafes = [];
    for (const k of g.keys) {
      if (!messages[k]) throw new Error(`Missing message for venue id: ${k}`);
      cafes.push(venueRow(k, messages[k]));
      seen.add(k);
    }
    cities.push({
      ...g.city,
      cafes,
      stores: [],
    });
  }
  const all = new Set(Object.keys(messages));
  for (const k of all) {
    if (!seen.has(k)) throw new Error(`Venue ${k} not placed in CITY_GROUPS`);
  }
  return cities;
}

function buildVenueMessages(messages) {
  const out = {};
  for (const [k, v] of Object.entries(messages)) {
    out[k] = {
      subject: (v.subject != null ? v.subject : "").trim(),
      body: (v.message != null ? v.message : v.body || "").trim(),
    };
  }
  return out;
}

/** Find end index (exclusive) of `var name = { ... };` with string-aware brace matching */
function endOfBraceAssignment(html, varName) {
  const prefix = `var ${varName}=`;
  const start = html.indexOf(prefix);
  if (start < 0) throw new Error(`Missing ${varName}`);
  let i = start + prefix.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== "{") throw new Error(`Expected { after ${varName}`);
  let depth = 0;
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
        i++;
        while (i < html.length && /\s/.test(html[i])) i++;
        if (html[i] === ";") i++;
        return i;
      }
    }
  }
  throw new Error(`Unclosed brace for ${varName}`);
}

function main() {
  if (!fs.existsSync(SET5_JSON)) throw new Error(`Set 5 JSON not found: ${SET5_JSON}`);
  const messages = JSON.parse(fs.readFileSync(SET5_JSON, "utf8"));
  const cities = buildCities(messages);
  const venueMessages = buildVenueMessages(messages);

  let html = fs.readFileSync(INDEX, "utf8");

  if (html.includes("var CITIES_SET_FIVE=")) {
    console.error("CITIES_SET_FIVE already present — abort");
    process.exit(1);
  }

  const setStateAnchor = "\n\nvar SET_STATE=";
  const insertCitiesIdx = html.indexOf(setStateAnchor);
  if (insertCitiesIdx < 0) throw new Error("Could not find anchor before SET_STATE (need ];\n\nvar SET_STATE=)");

  const citiesJs = `var CITIES_SET_FIVE=${JSON.stringify(cities, null, 2)};`;
  html = html.slice(0, insertCitiesIdx) + "\n\n" + citiesJs + html.slice(insertCitiesIdx);

  const mEnd = endOfBraceAssignment(html, "VENUE_MESSAGES_SET_FOUR");
  const msgJs = `var VENUE_MESSAGES_SET_FIVE=${JSON.stringify(venueMessages)};\n`;
  html = html.slice(0, mEnd) + "\n" + msgJs + html.slice(mEnd);

  const patches = [
    ['<option value="4">City set four</option>', '<option value="4">City set four</option>\n      <option value="5">City set five</option>'],
    [
      '  "4":{s:{},ce:{},tpl:{subject:"",body:""}}\n};',
      '  "4":{s:{},ce:{},tpl:{subject:"",body:""}},\n  "5":{s:{},ce:{},tpl:{subject:"",body:""}}\n};',
    ],
    [
      `function getCities(){
  if(ACTIVE_SET==="4")return CITIES_SET_FOUR;
  if(ACTIVE_SET==="3")return CITIES_SET_THREE;
  return ACTIVE_SET==="2"?CITIES_SET_TWO:CITIES_SET_ONE;
}`,
      `function getCities(){
  if(ACTIVE_SET==="5")return CITIES_SET_FIVE;
  if(ACTIVE_SET==="4")return CITIES_SET_FOUR;
  if(ACTIVE_SET==="3")return CITIES_SET_THREE;
  return ACTIVE_SET==="2"?CITIES_SET_TWO:CITIES_SET_ONE;
}`,
    ],
    [
      `function getVenueMessages(){
  if(ACTIVE_SET==="4")return VENUE_MESSAGES_SET_FOUR;
  if(ACTIVE_SET==="3")return VENUE_MESSAGES_SET_THREE;
  return ACTIVE_SET==="2"?VENUE_MESSAGES_SET_TWO:VENUE_MESSAGES_SET_ONE;
}`,
      `function getVenueMessages(){
  if(ACTIVE_SET==="5")return VENUE_MESSAGES_SET_FIVE;
  if(ACTIVE_SET==="4")return VENUE_MESSAGES_SET_FOUR;
  if(ACTIVE_SET==="3")return VENUE_MESSAGES_SET_THREE;
  return ACTIVE_SET==="2"?VENUE_MESSAGES_SET_TWO:VENUE_MESSAGES_SET_ONE;
}`,
    ],
    [
      `  if(ACTIVE_SET!=="3"&&ACTIVE_SET!=="4")return{cafes:c.cafes||null,stores:c.stores||null};`,
      `  if(ACTIVE_SET!=="3"&&ACTIVE_SET!=="4"&&ACTIVE_SET!=="5")return{cafes:c.cafes||null,stores:c.stores||null};`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"){
    var c3=vid&&getVenueMessages()[vid];
    if(!c3)return{subject:"",body:""};
    return{subject:(c3.subject||"").trim(),body:(c3.body||"").trim()};
  }`,
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5"){
    var c3=vid&&getVenueMessages()[vid];
    if(!c3)return{subject:"",body:""};
    return{subject:(c3.subject||"").trim(),body:(c3.body||"").trim()};
  }`,
    ],
    [
      `        "4":{s:SET_STATE["4"].s,ce:SET_STATE["4"].ce,tpl:SET_STATE["4"].tpl}
      }
    }));`,
      `        "4":{s:SET_STATE["4"].s,ce:SET_STATE["4"].ce,tpl:SET_STATE["4"].tpl},
        "5":{s:SET_STATE["5"].s,ce:SET_STATE["5"].ce,tpl:SET_STATE["5"].tpl}
      }
    }));`,
    ],
    [
      `        if(emb.activeSet==="1"||emb.activeSet==="2"||emb.activeSet==="3"||emb.activeSet==="4")ACTIVE_SET=emb.activeSet;`,
      `        if(emb.activeSet==="1"||emb.activeSet==="2"||emb.activeSet==="3"||emb.activeSet==="4"||emb.activeSet==="5")ACTIVE_SET=emb.activeSet;`,
    ],
    [
      `        mergeSet("1");mergeSet("2");mergeSet("3");mergeSet("4");`,
      `        mergeSet("1");mergeSet("2");mergeSet("3");mergeSet("4");mergeSet("5");`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4")return;`,
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5")return;`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{`,
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5"){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{`,
    ],
    [
      `    "4":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="1";`,
      `    "4":{s:{},ce:{},tpl:{subject:"",body:""}},
    "5":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="1";`,
    ],
    [
      `  if((id!=="1"&&id!=="2"&&id!=="3"&&id!=="4")||id===ACTIVE_SET)return;`,
      `  if((id!=="1"&&id!=="2"&&id!=="3"&&id!=="4"&&id!=="5")||id===ACTIVE_SET)return;`,
    ],
    [
      `  var setLabels={"1":"City set one","2":"City set two","3":"City set three","4":"City set four"};`,
      `  var setLabels={"1":"City set one","2":"City set two","3":"City set three","4":"City set four","5":"City set five"};`,
    ],
  ];

  for (const [a, b] of patches) {
    if (!html.includes(a)) throw new Error(`Patch anchor not found:\n${a.slice(0, 120)}…`);
    html = html.replace(a, b);
  }

  fs.writeFileSync(INDEX, html, "utf8");
  console.log("Updated", INDEX, "—", Object.keys(venueMessages).length, "venues,", cities.length, "cities");
}

main();
