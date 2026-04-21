/**
 * Builds CITIES_SET_SIX from ~/Downloads/venues.html, splices into index.html,
 * activates only city set 6 (sets 1–5 remain in file as archive, not selectable),
 * and fixes iOS Gmail handoff (opener, not noopener).
 *
 * Run: node scripts/apply-city-set-six.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const VENUES_HTML =
  process.env.VENUES_HTML || path.join(process.env.HOME || "", "Downloads/venues.html");

function normalizeFb(u) {
  if (!u || !String(u).trim()) return "";
  let s = String(u).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const i = s.toLowerCase().indexOf("facebook.com/");
  if (i >= 0) return s.slice(i);
  return s;
}

function normalizeWebsite(w) {
  if (!w || !String(w).trim()) return "";
  return String(w).trim().replace(/^https?:\/\//i, "");
}

function loadCitiesFromVenuesHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const start = html.indexOf('[{"id":');
  const end = html.indexOf("\n\n// ─── STATE", start);
  if (start < 0 || end < 0) throw new Error("Could not find VENUE DATA JSON in venues.html");
  const data = JSON.parse(html.slice(start, end).trim());
  const seenVenue = new Map();
  for (const c of data) {
    for (const sec of ["cafes", "stores"]) {
      if (!c[sec]) continue;
      for (let i = c[sec].length - 1; i >= 0; i--) {
        const v = c[sec][i];
        if (seenVenue.has(v.id)) c[sec].splice(i, 1);
        else seenVenue.set(v.id, c.id);
      }
    }
  }
  const out = [];
  for (const c of data) {
    const cafes = (c.cafes || []).map(normalizeVenue);
    const stores = (c.stores || []).map(normalizeVenue);
    if (!cafes.length && !stores.length) continue;
    out.push({
      id: c.id,
      name: c.name,
      tags: c.tags || [],
      researched: true,
      cafes: cafes.length ? cafes : undefined,
      stores: stores.length ? stores : undefined,
    });
  }
  return out;
}

function normalizeVenue(v) {
  return {
    id: v.id,
    name: v.name,
    subloc: v.subloc != null ? String(v.subloc) : "",
    phone: v.phone != null ? String(v.phone) : "",
    email: v.email != null ? String(v.email) : "",
    website: normalizeWebsite(v.website || ""),
    emailNote: v.emailNote != null ? String(v.emailNote) : "",
    facebook: normalizeFb(v.facebook || ""),
    facebookNote: v.facebookNote != null ? String(v.facebookNote) : "",
  };
}

function insertAfterVenueMessagesFive(html) {
  const m5 = "var VENUE_MESSAGES_SET_FIVE=";
  const start5 = html.indexOf(m5);
  if (start5 < 0) throw new Error("VENUE_MESSAGES_SET_FIVE not found");
  let i = start5 + m5.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== "{") throw new Error("Expected { after SET_FIVE");
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
        return html.slice(0, i) + "\nvar VENUE_MESSAGES_SET_SIX={};\n" + html.slice(i);
      }
    }
  }
  throw new Error("Unclosed VENUE_MESSAGES_SET_FIVE");
}

function main() {
  if (!fs.existsSync(VENUES_HTML)) throw new Error("Missing " + VENUES_HTML);
  if (!fs.existsSync(INDEX)) throw new Error("Missing index.html");

  const cities = loadCitiesFromVenuesHtml(VENUES_HTML);
  let html = fs.readFileSync(INDEX, "utf8");

  if (html.includes("var CITIES_SET_SIX=")) {
    console.error("CITIES_SET_SIX already present — abort.");
    process.exit(1);
  }

  const anchor = "\n\nvar SET_STATE=";
  const insertAt = html.indexOf(anchor);
  if (insertAt < 0) throw new Error("SET_STATE anchor not found");

  html =
    html.slice(0, insertAt) +
    "\n\nvar CITIES_SET_SIX=" +
    JSON.stringify(cities) +
    ";" +
    html.slice(insertAt);

  html = insertAfterVenueMessagesFive(html);

  const blocks = [
    [
      `<select id="citySetSelect" aria-label="City set" onchange="switchCitySet(this.value)">
      <option value="1">City set one</option>
      <option value="2">City set two</option>
      <option value="3">City set three</option>
      <option value="4">City set four</option>
      <option value="5">City set five</option>
    </select>`,
      `<select id="citySetSelect" aria-label="City set" onchange="switchCitySet(this.value)" title="Sets 1–5 are archived in this file; only set 6 is active.">
      <option value="6">City set six (nationwide)</option>
    </select>`,
    ],
    [
      `/** City sets 3–5: hide venues with no email (dataset or saved) and no Facebook URL. */
function venueHasEmailOrFacebook(v){
  var em=(CE[v.id]||(v.email||"")).trim();
  var fb=(v.facebook||"").trim();
  return em.length>0||fb.length>0;
}
/** Set three roster = keys in VENUE_MESSAGES_SET_THREE (the export); still require a contact channel. */
function isVenueInSetThreeExport(vid){
  var vm=getVenueMessages();
  return vid&&vm[vid]!=null;
}
function venuesListForCity(c){
  if(ACTIVE_SET!=="3"&&ACTIVE_SET!=="4"&&ACTIVE_SET!=="5")return{cafes:c.cafes||null,stores:c.stores||null};
  var cf=[],sf=[],i,v;
  if(c.cafes)for(i=0;i<c.cafes.length;i++){v=c.cafes[i];if(isVenueInSetThreeExport(v.id)&&venueHasEmailOrFacebook(v))cf.push(v);}
  if(c.stores)for(i=0;i<c.stores.length;i++){v=c.stores[i];if(isVenueInSetThreeExport(v.id)&&venueHasEmailOrFacebook(v))sf.push(v);}
  return{cafes:cf.length?cf:null,stores:sf.length?sf:null};
}`,
      `function venuesListForCity(c){
  return{cafes:c.cafes||null,stores:c.stores||null};
}`,
    ],
    [
      `function getCities(){
  if(ACTIVE_SET==="5")return CITIES_SET_FIVE;
  if(ACTIVE_SET==="4")return CITIES_SET_FOUR;
  if(ACTIVE_SET==="3")return CITIES_SET_THREE;
  return ACTIVE_SET==="2"?CITIES_SET_TWO:CITIES_SET_ONE;
}`,
      `function getCities(){
  return CITIES_SET_SIX;
}`,
    ],
    [
      `function getVenueMessages(){
  if(ACTIVE_SET==="5")return VENUE_MESSAGES_SET_FIVE;
  if(ACTIVE_SET==="4")return VENUE_MESSAGES_SET_FOUR;
  if(ACTIVE_SET==="3")return VENUE_MESSAGES_SET_THREE;
  return ACTIVE_SET==="2"?VENUE_MESSAGES_SET_TWO:VENUE_MESSAGES_SET_ONE;
}`,
      `function getVenueMessages(){
  return VENUE_MESSAGES_SET_SIX;
}`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5"){
    var c3=vid&&getVenueMessages()[vid];
    if(!c3)return{subject:"",body:""};
    return{subject:(c3.subject||"").trim(),body:(c3.body||"").trim()};
  }
  var custom=vid&&getVenueMessages()[vid];`,
      `  var custom=vid&&getVenueMessages()[vid];`,
    ],
    [
      `        "4":{s:SET_STATE["4"].s,ce:SET_STATE["4"].ce,tpl:SET_STATE["4"].tpl},
        "5":{s:SET_STATE["5"].s,ce:SET_STATE["5"].ce,tpl:SET_STATE["5"].tpl}
      }
    }));`,
      `        "6":{s:SET_STATE["6"].s,ce:SET_STATE["6"].ce,tpl:SET_STATE["6"].tpl}
      }
    }));`,
    ],
    [
      `      if(emb.sets){
        if(emb.activeSet==="1"||emb.activeSet==="2"||emb.activeSet==="3"||emb.activeSet==="4"||emb.activeSet==="5")ACTIVE_SET=emb.activeSet;
        function mergeSet(k){
          var b=emb.sets[k];if(!b)return;
          if(b.s)mergeRecord(SET_STATE[k].s,b.s);
          if(b.ce)mergeRecord(SET_STATE[k].ce,b.ce);
          if(b.tpl){
            SET_STATE[k].tpl.subject=b.tpl.subject!=null?b.tpl.subject:"";
            SET_STATE[k].tpl.body=b.tpl.body!=null?b.tpl.body:"";
          }
        }
        mergeSet("1");mergeSet("2");mergeSet("3");mergeSet("4");mergeSet("5");
      }else{
        if(emb.s)mergeRecord(SET_STATE["1"].s,emb.s);
        if(emb.ce)mergeRecord(SET_STATE["1"].ce,emb.ce);
        if(emb.tpl){
          SET_STATE["1"].tpl.subject=emb.tpl.subject!=null?emb.tpl.subject:"";
          SET_STATE["1"].tpl.body=emb.tpl.body!=null?emb.tpl.body:"";
        }
      }`,
      `      if(emb.sets){
        ACTIVE_SET="6";
        function mergeSet(k){
          var b=emb.sets[k];if(!b)return;
          if(b.s)mergeRecord(SET_STATE[k].s,b.s);
          if(b.ce)mergeRecord(SET_STATE[k].ce,b.ce);
          if(b.tpl){
            SET_STATE[k].tpl.subject=b.tpl.subject!=null?b.tpl.subject:"";
            SET_STATE[k].tpl.body=b.tpl.body!=null?b.tpl.body:"";
          }
        }
        mergeSet("6");
        for(var lk=1;lk<=5;lk++){
          var lb=emb.sets[String(lk)];
          if(!lb||!lb.s)continue;
          for(var sk in lb.s){
            if(Object.prototype.hasOwnProperty.call(lb.s,sk)&&!SET_STATE["6"].s[sk])
              SET_STATE["6"].s[sk]=lb.s[sk];
          }
          if(lb.ce)mergeRecord(SET_STATE["6"].ce,lb.ce);
        }
      }else{
        if(emb.s)mergeRecord(SET_STATE["6"].s,emb.s);
        if(emb.ce)mergeRecord(SET_STATE["6"].ce,emb.ce);
        if(emb.tpl){
          SET_STATE["6"].tpl.subject=emb.tpl.subject!=null?emb.tpl.subject:"";
          SET_STATE["6"].tpl.body=emb.tpl.body!=null?emb.tpl.body:"";
        }
      }`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5"){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{`,
      `  if(false){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{`,
    ],
    [
      `  if(ACTIVE_SET==="3"||ACTIVE_SET==="4"||ACTIVE_SET==="5")return;`,
      `  if(false)return;`,
    ],
    [
      `var SET_STATE={
  "1":{s:{},ce:{},tpl:{subject:"",body:""}},
  "2":{s:{},ce:{},tpl:{subject:"",body:""}},
  "3":{s:{},ce:{},tpl:{subject:"",body:""}},
  "4":{s:{},ce:{},tpl:{subject:"",body:""}},
  "5":{s:{},ce:{},tpl:{subject:"",body:""}}
};`,
      `var SET_STATE={
  "6":{s:{},ce:{},tpl:{subject:"",body:""}}
};`,
    ],
    [
      `var ACTIVE_SET="1";`,
      `var ACTIVE_SET="6";`,
    ],
    [
      `    "4":{s:{},ce:{},tpl:{subject:"",body:""}},
    "5":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="1";`,
      `    "6":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="6";`,
    ],
    [
      `  if((id!=="1"&&id!=="2"&&id!=="3"&&id!=="4"&&id!=="5")||id===ACTIVE_SET)return;`,
      `  if(id!=="6"||id===ACTIVE_SET)return;`,
    ],
    [
      `  var setLabels={"1":"City set one","2":"City set two","3":"City set three","4":"City set four","5":"City set five"};`,
      `  var setLabels={"6":"City set six"};`,
    ],
    [
      `    a.rel="noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  if(isAndroid()){`,
      `    a.target="_blank";
    a.rel="opener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  if(isAndroid()){`,
    ],
  ];

  for (const [a, b] of blocks) {
    if (!html.includes(a)) {
      console.error("Missing anchor:\n", a.slice(0, 220));
      process.exit(1);
    }
    html = html.replace(a, b);
  }

  const persistSix = [
    `      sets:{
        "1":{s:SET_STATE["1"].s,ce:SET_STATE["1"].ce,tpl:SET_STATE["1"].tpl},
        "2":{s:SET_STATE["2"].s,ce:SET_STATE["2"].ce,tpl:SET_STATE["2"].tpl},
        "3":{s:SET_STATE["3"].s,ce:SET_STATE["3"].ce,tpl:SET_STATE["3"].tpl},
        "4":{s:SET_STATE["4"].s,ce:SET_STATE["4"].ce,tpl:SET_STATE["4"].tpl},
        "5":{s:SET_STATE["5"].s,ce:SET_STATE["5"].ce,tpl:SET_STATE["5"].tpl}
      }`,
    `      sets:{
        "6":{s:SET_STATE["6"].s,ce:SET_STATE["6"].ce,tpl:SET_STATE["6"].tpl}
      }`,
  ];
  if (html.includes(persistSix[0])) html = html.replace(persistSix[0], persistSix[1]);

  fs.writeFileSync(INDEX, html, "utf8");
  const nv = cities.reduce((n, c) => n + (c.cafes || []).length + (c.stores || []).length, 0);
  console.log("OK:", cities.length, "cities,", nv, "venues");
}

main();
