import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const LA_JSON =
  process.env.LA_JSON || path.join(process.env.HOME || "", "Downloads/venues_los_angeles_ca.json");

const SET_ID = "los_angeles_1";
const CITIES_VAR = "CITIES_SET_LOS_ANGELES_1";
const MESSAGES_VAR = "VENUE_MESSAGES_SET_LOS_ANGELES_1";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWebsite(u) {
  if (!u || !String(u).trim()) return "";
  return String(u).trim().replace(/^https?:\/\//i, "");
}

function mapVenues(input) {
  const used = new Set();
  const stores = [];
  const messages = {};
  for (const row of input) {
    const base = slugify(row.name) || "venue";
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    stores.push({
      id,
      name: String(row.name || "").trim(),
      subloc: String(row.address || "").trim(),
      phone: String(row.phone || "").trim(),
      email: "",
      website: normalizeWebsite(row.google_maps_url || ""),
      emailNote: "",
      facebook: "",
      facebookNote: "",
    });
    messages[id] = { subject: "", body: String(row.message || "").trim() };
  }
  return { stores, messages };
}

function replaceOrInsertVar(html, varName, serialized) {
  const re = new RegExp(`var ${varName}=([\\s\\S]*?);\\n`);
  const nextDecl = `var ${varName}=${serialized};\n`;
  if (re.test(html)) return html.replace(re, nextDecl);
  const anchor = "function getCities(){";
  const idx = html.indexOf(anchor);
  if (idx < 0) throw new Error("Could not find getCities() anchor for insertion");
  return html.slice(0, idx) + `${nextDecl}` + html.slice(idx);
}

function mustReplace(html, re, replacement, label) {
  const out = html.replace(re, replacement);
  if (out === html) throw new Error(`Failed to replace ${label}`);
  return out;
}

function main() {
  if (!fs.existsSync(LA_JSON)) throw new Error(`Missing ${LA_JSON}`);
  if (!fs.existsSync(INDEX)) throw new Error(`Missing ${INDEX}`);

  const input = JSON.parse(fs.readFileSync(LA_JSON, "utf8"));
  const { stores, messages } = mapVenues(input);
  const cities = [
    {
      id: SET_ID,
      name: "Los Angeles, CA",
      tags: ["major"],
      researched: true,
      stores,
    },
  ];

  let html = fs.readFileSync(INDEX, "utf8");
  html = replaceOrInsertVar(html, CITIES_VAR, JSON.stringify(cities));
  html = replaceOrInsertVar(html, MESSAGES_VAR, JSON.stringify(messages));

  html = mustReplace(
    html,
    /<select id="citySetSelect"[\s\S]*?<\/select>/,
    `<select id="citySetSelect" aria-label="City set" onchange="switchCitySet(this.value)" title="Archived sets are kept in-file; only Los Angeles set one is active.">
      <option value="${SET_ID}">los_angeles_1</option>
    </select>`,
    "city set select"
  );

  html = mustReplace(
    html,
    /var SET_STATE=\{[\s\S]*?\};\nvar ACTIVE_SET="[^"]+";/,
    `var SET_STATE={\n  "${SET_ID}":{s:{},ce:{},tpl:{subject:"",body:""}}\n};\nvar ACTIVE_SET="${SET_ID}";`,
    "set state/active set"
  );

  html = mustReplace(
    html,
    /function getCities\(\)\{[\s\S]*?\}\nfunction getVenueMessages\(\)\{[\s\S]*?\}/,
    `function getCities(){\n  return ${CITIES_VAR};\n}\nfunction getVenueMessages(){\n  return ${MESSAGES_VAR};\n}`,
    "getCities/getVenueMessages"
  );

  html = mustReplace(
    html,
    /function venuesListForCity\(c\)\{[\s\S]*?return\{cafes:cf\.length\?cf:null,stores:sf\.length\?sf:null\};\n\}/,
    `function venuesListForCity(c){\n  return{cafes:c.cafes||null,stores:c.stores||null};\n}`,
    "venuesListForCity"
  );

  html = mustReplace(
    html,
    /function persist\(\)\{[\s\S]*?\n\}/,
    `function persist(){\n  try{\n    localStorage.setItem("bgv_state",JSON.stringify({\n      activeSet:ACTIVE_SET,\n      sets:{\n        "${SET_ID}":{s:SET_STATE["${SET_ID}"].s,ce:SET_STATE["${SET_ID}"].ce,tpl:SET_STATE["${SET_ID}"].tpl}\n      }\n    }));\n  }catch(e){}\n}`,
    "persist"
  );

  html = mustReplace(
    html,
    /function syncTemplateUiForCitySet\(\)\{[\s\S]*?\n\}/,
    `function syncTemplateUiForCitySet(){\n  var tb=document.getElementById("tplToggle"),p=document.getElementById("tplPanel");\n  if(!tb||!p)return;\n  if(ACTIVE_SET==="${SET_ID}"){\n    p.classList.remove("open");\n    tb.className="hbtn";\n    tb.style.display="none";\n    p.style.display="none";\n  }else{\n    tb.style.display="";\n    p.style.display="";\n  }\n}`,
    "syncTemplateUiForCitySet"
  );

  html = mustReplace(
    html,
    /function loadState\(\)\{[\s\S]*?\n\}/,
    `function loadState(){\n  try{\n    var raw=localStorage.getItem("bgv_state");\n    if(raw){\n      var emb=JSON.parse(raw);\n      if(emb&&emb.sets&&emb.sets["${SET_ID}"]){\n        var b=emb.sets["${SET_ID}"];\n        if(emb.activeSet==="${SET_ID}")ACTIVE_SET="${SET_ID}";\n        if(b.s)mergeRecord(SET_STATE["${SET_ID}"].s,b.s);\n        if(b.ce)mergeRecord(SET_STATE["${SET_ID}"].ce,b.ce);\n        if(b.tpl){\n          SET_STATE["${SET_ID}"].tpl.subject=b.tpl.subject!=null?b.tpl.subject:"";\n          SET_STATE["${SET_ID}"].tpl.body=b.tpl.body!=null?b.tpl.body:"";\n        }\n      }else if(emb){\n        if(emb.s)mergeRecord(SET_STATE["${SET_ID}"].s,emb.s);\n        if(emb.ce)mergeRecord(SET_STATE["${SET_ID}"].ce,emb.ce);\n      }\n    }\n  }catch(e){}\n  applyActiveBucket();\n  syncTemplateUiForCitySet();\n}`,
    "loadState"
  );

  html = mustReplace(
    html,
    /function toggleTpl\(\)\{[\s\S]*?\n\}/,
    `function toggleTpl(){\n  if(ACTIVE_SET==="${SET_ID}")return;\n  var p=document.getElementById("tplPanel"),b=document.getElementById("tplToggle");\n  var open=p.classList.toggle("open");\n  b.className="hbtn"+(open?" active":"");\n  if(open){\n    document.getElementById("tplSub").value=TPL.subject;\n    document.getElementById("tplBody").value=TPL.body;\n  }\n}`,
    "toggleTpl"
  );

  html = mustReplace(
    html,
    /function clearStoredState\(\)\{[\s\S]*?\n\}/,
    `function clearStoredState(){\n  if(!confirm("Clear all saved data on this device? Progress, custom emails, and templates for all city sets will be removed. This cannot be undone."))return;\n  try{localStorage.removeItem("bgv_state");}catch(e){}\n  SET_STATE={\n    "${SET_ID}":{s:{},ce:{},tpl:{subject:"",body:""}}\n  };\n  ACTIVE_SET="${SET_ID}";\n  applyActiveBucket();\n  var c=document.getElementById("container");c.innerHTML="";\n  var C=getCities();\n  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);\n  updateUI();\n  updateCitySetSelect();\n  var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");\n  if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;\n  syncTemplateUiForCitySet();\n  showVenueToast("Storage cleared.");\n}`,
    "clearStoredState"
  );

  html = mustReplace(
    html,
    /function switchCitySet\(id\)\{[\s\S]*?\n\}/,
    `function switchCitySet(id){\n  if(id!=="${SET_ID}"||id===ACTIVE_SET)return;\n  ACTIVE_SET=id;\n  applyActiveBucket();\n  var c=document.getElementById("container");c.innerHTML="";\n  var C=getCities();\n  for(var i=0;i<C.length;i++)c.innerHTML+=buildCity(C[i]);\n  updateUI();persist();\n  updateCitySetSelect();\n  syncTemplateUiForCitySet();\n  var p=document.getElementById("tplPanel");\n  if(p&&p.classList.contains("open")){\n    var ts=document.getElementById("tplSub"),tb=document.getElementById("tplBody");\n    if(ts)ts.value=TPL.subject;if(tb)tb.value=TPL.body;\n  }\n  showVenueToast("${SET_ID}");\n}`,
    "switchCitySet"
  );

  fs.writeFileSync(INDEX, html, "utf8");
  console.log(`Applied ${SET_ID}: ${stores.length} venues`);
}

main();
