/**
 * Injects CITIES_SET_SEVEN + VENUE_MESSAGES_SET_SEVEN from venue-florida-set-seven.json
 * and wires index.html (set 7 alongside nationwide set 6).
 *
 * Run: node scripts/inject-florida-set-seven.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const VENUES_JSON = path.join(ROOT, "venue-florida-set-seven.json");

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
      .replace(/^-|-$/g, "") + "-fl7"
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

function main() {
  if (!fs.existsSync(VENUES_JSON)) throw new Error("Missing " + VENUES_JSON);
  let html = fs.readFileSync(INDEX, "utf8");
  if (html.includes("var CITIES_SET_SEVEN=")) {
    console.error("CITIES_SET_SEVEN already present — abort.");
    process.exit(1);
  }

  const venues = JSON.parse(fs.readFileSync(VENUES_JSON, "utf8"));
  const { cities, messages, markDone } = buildCitiesAndMessages(venues);

  const bundle =
    "\n\nvar CITIES_SET_SEVEN=" +
    JSON.stringify(cities) +
    ";\nvar VENUE_MESSAGES_SET_SEVEN=" +
    JSON.stringify(messages) +
    ";\nvar VENUE_SET_SEVEN_MARK_DONE=" +
    JSON.stringify(markDone) +
    ";";

  const anchor = "\n\nfunction getCities(){";
  const ai = html.indexOf(anchor);
  if (ai < 0) throw new Error("anchor not found: function getCities");
  html = html.slice(0, ai) + bundle + html.slice(ai);

  html = html.replace(
    `var SET_STATE={
  "6":{s:{},ce:{},tpl:{subject:"",body:""}}
};`,
    `var SET_STATE={
  "6":{s:{},ce:{},tpl:{subject:"",body:""}},
  "7":{s:{},ce:{},tpl:{subject:"",body:""}}
};`
  );

  html = html.replace(
    `      sets:{
        "6":{s:SET_STATE["6"].s,ce:SET_STATE["6"].ce,tpl:SET_STATE["6"].tpl}
      }`,
    `      sets:{
        "6":{s:SET_STATE["6"].s,ce:SET_STATE["6"].ce,tpl:SET_STATE["6"].tpl},
        "7":{s:SET_STATE["7"].s,ce:SET_STATE["7"].ce,tpl:SET_STATE["7"].tpl}
      }`
  );

  html = html.replace(
    `function getCities(){
  return CITIES_SET_SIX;
}
function getVenueMessages(){
  return VENUE_MESSAGES_SET_SIX;
}
/** City set six: require a contact channel and a per-venue message row. */
function venueHasEmailOrFacebook(v){
  var em=(CE[v.id]||(v.email||"")).trim();
  var fb=(v.facebook||"").trim();
  return em.length>0||fb.length>0;
}
function venuesListForCity(c){
  if(ACTIVE_SET!=="6")return{cafes:c.cafes||null,stores:c.stores||null};
  var vm=getVenueMessages(),cf=[],sf=[],i,v,row,body;
  if(c.cafes)for(i=0;i<c.cafes.length;i++){
    v=c.cafes[i];row=vm[v.id];body=row&&String(row.body||"").trim();
    if(body&&venueHasEmailOrFacebook(v))cf.push(v);
  }
  if(c.stores)for(i=0;i<c.stores.length;i++){
    v=c.stores[i];row=vm[v.id];body=row&&String(row.body||"").trim();
    if(body&&venueHasEmailOrFacebook(v))sf.push(v);
  }
  return{cafes:cf.length?cf:null,stores:sf.length?sf:null};
}`,
    `function getCities(){
  return ACTIVE_SET==="7"?CITIES_SET_SEVEN:CITIES_SET_SIX;
}
function getVenueMessages(){
  return ACTIVE_SET==="7"?VENUE_MESSAGES_SET_SEVEN:VENUE_MESSAGES_SET_SIX;
}
/** City set six: email or Facebook + per-venue message. Set seven: also counts website. */
function venueHasEmailOrFacebook(v){
  var em=(CE[v.id]||(v.email||"")).trim();
  var fb=(v.facebook||"").trim();
  return em.length>0||fb.length>0;
}
function venueHasOutreachChannelSeven(v){
  if(venueHasEmailOrFacebook(v))return true;
  var web=(v.website||"").trim();
  return web.length>0;
}
function venuesListForCity(c){
  if(ACTIVE_SET!=="6"&&ACTIVE_SET!=="7")return{cafes:c.cafes||null,stores:c.stores||null};
  var vm=getVenueMessages(),cf=[],sf=[],i,v,row,body,chan;
  chan=ACTIVE_SET==="7"?venueHasOutreachChannelSeven:venueHasEmailOrFacebook;
  if(c.cafes)for(i=0;i<c.cafes.length;i++){
    v=c.cafes[i];row=vm[v.id];body=row&&String(row.body||"").trim();
    if(body&&chan(v))cf.push(v);
  }
  if(c.stores)for(i=0;i<c.stores.length;i++){
    v=c.stores[i];row=vm[v.id];body=row&&String(row.body||"").trim();
    if(body&&chan(v))sf.push(v);
  }
  return{cafes:cf.length?cf:null,stores:sf.length?sf:null};
}`
  );

  html = html.replace(
    `  if(ACTIVE_SET==="6"){
    var c6=vid&&getVenueMessages()[vid];
    var tplSub=TPL&&TPL.subject?String(TPL.subject).trim():"";
    if(!c6)o={subject:tplSub,body:""};
    else{
      var sub6=(c6.subject||"").trim(),bod6=(c6.body||"").trim();
      if(!sub6&&tplSub)sub6=tplSub;
      o={subject:sub6,body:bod6};
    }
  }else{`,
    `  if(ACTIVE_SET==="6"||ACTIVE_SET==="7"){
    var c6=vid&&getVenueMessages()[vid];
    var tplSub=TPL&&TPL.subject?String(TPL.subject).trim():"";
    if(!c6)o={subject:tplSub,body:""};
    else{
      var sub6=(c6.subject||"").trim(),bod6=(c6.body||"").trim();
      if(!sub6&&tplSub)sub6=tplSub;
      o={subject:sub6,body:bod6};
    }
  }else{`
  );

  html = html.replace(
    `    showVenueToast("No message body for this venue — check VENUE_MESSAGES_SET_SIX in the source.");`,
    `    showVenueToast("No message body for this venue — check per-venue messages in the source.");`
  );

  html = html.replace(
    `/** City set six uses per-venue copy in VENUE_MESSAGES_SET_SIX (no global template). */
function syncTemplateUiForCitySet(){
  var tb=document.getElementById("tplToggle"),p=document.getElementById("tplPanel");
  if(!tb||!p)return;
  if(ACTIVE_SET==="6"){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{
    tb.style.display="";
    p.style.display="";
  }
}`,
    `/** City sets six and seven use per-venue copy (no global template). */
function syncTemplateUiForCitySet(){
  var tb=document.getElementById("tplToggle"),p=document.getElementById("tplPanel");
  if(!tb||!p)return;
  if(ACTIVE_SET==="6"||ACTIVE_SET==="7"){
    p.classList.remove("open");
    tb.className="hbtn";
    tb.style.display="none";
    p.style.display="none";
  }else{
    tb.style.display="";
    p.style.display="";
  }
}`
  );

  html = html.replace(
    `function toggleTpl(){
  if(ACTIVE_SET==="6")return;`,
    `function toggleTpl(){
  if(ACTIVE_SET==="6"||ACTIVE_SET==="7")return;`
  );

  html = html.replace(
    `function loadState(){
  try{
    var raw=localStorage.getItem("bgv_state");
    if(raw){
      var emb=JSON.parse(raw);
      if(emb.sets){
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
      }
    }
  }catch(e){}
  applyActiveBucket();
  syncTemplateUiForCitySet();
}`,
    `function seedFloridaSetSevenProgress(){
  try{
    if(localStorage.getItem("bgv_fl7_seeded"))return;
    var d=VENUE_SET_SEVEN_MARK_DONE,vid,field,k,sk;
    for(vid in d){
      if(!Object.prototype.hasOwnProperty.call(d,vid))continue;
      field=d[vid];
      if(field!=="email"&&field!=="facebook"&&field!=="website")continue;
      sk=vid+"__"+field;
      k=SET_STATE["7"].s;
      if(!k[sk])k[sk]={checked:true,date:today(),note:""};
    }
    localStorage.setItem("bgv_fl7_seeded","1");
  }catch(e){}
}
function loadState(){
  try{
    var raw=localStorage.getItem("bgv_state");
    if(raw){
      var emb=JSON.parse(raw);
      if(emb.sets){
        if(emb.activeSet==="6"||emb.activeSet==="7")ACTIVE_SET=emb.activeSet;
        else ACTIVE_SET="6";
        function mergeSet(k){
          var b=emb.sets[k];if(!b)return;
          if(!SET_STATE[k])return;
          if(b.s)mergeRecord(SET_STATE[k].s,b.s);
          if(b.ce)mergeRecord(SET_STATE[k].ce,b.ce);
          if(b.tpl){
            SET_STATE[k].tpl.subject=b.tpl.subject!=null?b.tpl.subject:"";
            SET_STATE[k].tpl.body=b.tpl.body!=null?b.tpl.body:"";
          }
        }
        mergeSet("6");
        mergeSet("7");
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
      }
    }
  }catch(e){}
  seedFloridaSetSevenProgress();
  applyActiveBucket();
  syncTemplateUiForCitySet();
}`
  );

  html = html.replace(
    `function clearStoredState(){
  if(!confirm("Clear all saved data on this device? Progress, custom emails, and templates for all city sets will be removed. This cannot be undone."))return;
  try{localStorage.removeItem("bgv_state");}catch(e){}
  SET_STATE={
    "6":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="6";
  applyActiveBucket();
  var c=document.getElementById("container");c.innerHTML="";
  var C=getCities();
  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);
  updateUI();
  updateCitySetSelect();
  var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");
  if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;
  syncTemplateUiForCitySet();
  showVenueToast("Storage cleared.");
}`,
    `function clearStoredState(){
  if(!confirm("Clear all saved data on this device? Progress, custom emails, and templates for all city sets will be removed. This cannot be undone."))return;
  try{localStorage.removeItem("bgv_state");}catch(e){}
  try{localStorage.removeItem("bgv_fl7_seeded");}catch(e){}
  SET_STATE={
    "6":{s:{},ce:{},tpl:{subject:"",body:""}},
    "7":{s:{},ce:{},tpl:{subject:"",body:""}}
  };
  ACTIVE_SET="6";
  applyActiveBucket();
  seedFloridaSetSevenProgress();
  var c=document.getElementById("container");c.innerHTML="";
  var C=getCities();
  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);
  updateUI();
  updateCitySetSelect();
  var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");
  if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;
  syncTemplateUiForCitySet();
  showVenueToast("Storage cleared.");
}`
  );

  html = html.replace(
    `function switchCitySet(id){
  if(id!=="6"||id===ACTIVE_SET)return;
  ACTIVE_SET=id;
  applyActiveBucket();
  var c=document.getElementById("container");c.innerHTML="";
  var C=getCities();
  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);
  updateUI();persist();
  updateCitySetSelect();
  syncTemplateUiForCitySet();
  var p=document.getElementById("tplPanel");
  if(p&&p.classList.contains("open")){
    var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");
    if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;
  }
  var setLabels={"6":"City set six"};
  showVenueToast(setLabels[ACTIVE_SET]||"");
}`,
    `function switchCitySet(id){
  if((id!=="6"&&id!=="7")||id===ACTIVE_SET)return;
  ACTIVE_SET=id;
  applyActiveBucket();
  var c=document.getElementById("container");c.innerHTML="";
  var C=getCities();
  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);
  updateUI();persist();
  updateCitySetSelect();
  syncTemplateUiForCitySet();
  var p=document.getElementById("tplPanel");
  if(p&&p.classList.contains("open")){
    var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");
    if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;
  }
  var setLabels={"6":"City set six (nationwide)","7":"City set seven (Florida)"};
  showVenueToast(setLabels[ACTIVE_SET]||"");
}`
  );

  html = html.replace(
    `<select id="citySetSelect" aria-label="City set" onchange="switchCitySet(this.value)" title="Sets 1–5 are archived in this file; only set 6 is active.">
      <option value="6">City set six (nationwide)</option>
    </select>`,
    `<select id="citySetSelect" aria-label="City set" onchange="switchCitySet(this.value)" title="Sets 1–5 are archived in this file; sets 6–7 are active.">
      <option value="6">City set six (nationwide)</option>
      <option value="7">City set seven (Florida)</option>
    </select>`
  );

  fs.writeFileSync(INDEX, html);
  console.log("Injected Florida set seven:", venues.length, "venues,", cities.length, "city sections.");
}

main();
