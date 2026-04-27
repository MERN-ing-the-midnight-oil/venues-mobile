/**
 * Refreshes CITIES_SET_EIGHT / VENUE_MESSAGES_SET_EIGHT / VENUE_SET_EIGHT_MARK_DONE
 * in index.html from venue-florida-set-eight.json.
 *
 * Run: node scripts/update-florida-set-eight-from-json.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const VENUES_JSON = path.join(ROOT, "venue-florida-set-eight.json");

function normalizeWebsite(w) {
  if (!w || !String(w).trim()) return "";
  return String(w).trim().replace(/^https?:\/\//i, "");
}

function normalizeFb(u) {
  if (!u || !String(u).trim()) return "";
  let s = String(u).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const i = s.toLowerCase().indexOf("facebook.com/");
  if (i >= 0) return s.slice(i);
  return s;
}

function citySlug(cityName) {
  return (
    cityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-fl8"
  );
}

function venueRow(v) {
  return {
    id: v.id,
    name: v.name,
    subloc: v.region || "",
    phone: v.phone != null ? String(v.phone) : "",
    email: v.email != null ? String(v.email) : "",
    website: normalizeWebsite(v.website || ""),
    emailNote: "",
    facebook: normalizeFb(v.facebook || ""),
    facebookNote: "",
  };
}

function buildCitiesAndMessages(venues) {
  const byCity = new Map();
  for (const v of venues) {
    const key = v.city;
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key).push(v);
  }
  const cityNames = [...byCity.keys()].sort((a, b) => a.localeCompare(b));
  const cities = [];
  const messages = {};
  const markDone = {};

  for (const cityName of cityNames) {
    const list = byCity.get(cityName);
    const cafes = [];
    const stores = [];
    for (const v of list) {
      const row = venueRow(v);
      messages[v.id] = { subject: "", body: v.customMessage || "" };
      if (v.contacted === true) {
        const m = v.contactMethod;
        if (m === "email" || m === "facebook" || m === "website") markDone[v.id] = m;
      }
      if (v.kind === "cafe") cafes.push(row);
      else stores.push(row);
    }
    cities.push({
      id: citySlug(cityName),
      name: cityName,
      tags: [],
      researched: true,
      cafes: cafes.length ? cafes : undefined,
      stores: stores.length ? stores : undefined,
    });
  }

  return { cities, messages, markDone };
}

function replaceVarBlock(html, varName, jsonText) {
  const prefix = `var ${varName}=`;
  const start = html.indexOf(prefix);
  if (start < 0) throw new Error(`Could not find ${varName} in index.html`);
  const afterStart = start + prefix.length;
  const end = html.indexOf(";\n", afterStart);
  if (end < 0) throw new Error(`Could not find end of ${varName} block`);
  return html.slice(0, start) + prefix + jsonText + html.slice(end);
}

function main() {
  if (!fs.existsSync(VENUES_JSON)) throw new Error("Missing " + VENUES_JSON);
  if (!fs.existsSync(INDEX)) throw new Error("Missing " + INDEX);

  const venues = JSON.parse(fs.readFileSync(VENUES_JSON, "utf8"));
  const { cities, messages, markDone } = buildCitiesAndMessages(venues);

  let html = fs.readFileSync(INDEX, "utf8");
  html = replaceVarBlock(html, "CITIES_SET_EIGHT", JSON.stringify(cities));
  html = replaceVarBlock(html, "VENUE_MESSAGES_SET_EIGHT", JSON.stringify(messages));
  html = replaceVarBlock(html, "VENUE_SET_EIGHT_MARK_DONE", JSON.stringify(markDone));
  fs.writeFileSync(INDEX, html, "utf8");

  console.log("Updated set eight:", venues.length, "venues,", cities.length, "city sections.");
}

main();
