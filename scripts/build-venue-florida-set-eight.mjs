/**
 * Builds venue-florida-set-eight.json from Florida export batches in Downloads.
 * Includes only venues whose ids are not already in venue-florida-set-seven.json.
 * Uses customMessage/emailVerbiage from the source files (new copy). Normalizes phones for display.
 *
 * Run: node scripts/build-venue-florida-set-eight.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "venue-florida-set-eight.json");
const SET_SEVEN = path.join(ROOT, "venue-florida-set-seven.json");

const DOWNLOAD_FILES = [
  path.join(process.env.HOME, "Downloads/florida-venues.json"),
  path.join(process.env.HOME, "Downloads/florida-venues-batch2.json"),
  path.join(process.env.HOME, "Downloads/florida-venues-batch3.json"),
  path.join(process.env.HOME, "Downloads/florida-venues-batch4 (1).json"),
  path.join(process.env.HOME, "Downloads/florida-venues-batch5.json"),
];

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['".,()/+]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPhone(p) {
  if (p == null) return null;
  const raw = String(p).trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const r = digits.slice(1);
    return `(${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function normalizeVenue(v) {
  const hasLegacyId = !!(v.id && String(v.id).trim());
  const city = String(v.city || "").trim();
  const state = String(v.state || "").trim();
  const cityState = city && state ? `${city}, ${state}` : city;
  const derivedId = `${slug(v.name)}-${slug(cityState || "fl")}`;
  const email = v.email != null && String(v.email).trim() ? String(v.email).trim() : null;
  const facebook =
    v.facebook != null && String(v.facebook).trim() ? String(v.facebook).trim() : null;
  const website =
    v.website != null && String(v.website).trim() ? String(v.website).trim() : null;
  const phone = formatPhone(v.phone);
  const kind = v.kind === "cafe" ? "cafe" : "store";
  const contactMethod = v.contactMethod || (email ? "email" : facebook ? "facebook" : website ? "website" : phone ? "phone_or_search" : "phone_or_search");
  return {
    id: hasLegacyId ? String(v.id).trim() : derivedId,
    name: v.name,
    city: cityState || String(v.city || "").trim(),
    region: v.region || "Florida",
    kind,
    email,
    facebook,
    phone,
    website,
    contactMethod: contactMethod === "phone" ? "phone_or_search" : contactMethod,
    notes: v.notes != null ? String(v.notes) : "",
    contacted: v.contacted === true,
    customMessage:
      v.customMessage != null
        ? String(v.customMessage)
        : v.emailVerbiage != null
          ? String(v.emailVerbiage)
          : "",
  };
}

function main() {
  const seven = JSON.parse(fs.readFileSync(SET_SEVEN, "utf8"));
  const sevenIds = new Set(seven.map((x) => x.id));

  const byId = new Map();
  const used = new Set();
  for (const f of DOWNLOAD_FILES) {
    if (!fs.existsSync(f)) throw new Error("Missing file: " + f);
    const arr = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!Array.isArray(arr)) throw new Error("Expected array in " + f);
    for (const v of arr) {
      if (!v || !v.name || !v.city) continue;
      const nv = normalizeVenue(v);
      if (!nv.id) continue;
      if (sevenIds.has(nv.id)) continue;
      let id = nv.id;
      let n = 2;
      while (used.has(id)) {
        id = `${nv.id}-${n}`;
        n++;
      }
      used.add(id);
      byId.set(id, { ...nv, id });
    }
  }

  let list = [...byId.values()];

  /** Same strip mall as Meeple Movers (set seven); source had no phone. */
  list = list.map((x) =>
    x.id === "board-game-cafe-ocala" && !x.phone ? { ...x, phone: "(352) 572-5637" } : x
  );

  list.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

  fs.writeFileSync(OUT, JSON.stringify(list, null, 2) + "\n", "utf8");
  console.log("Wrote", OUT, "—", list.length, "venues (not in set seven).");
}

main();
