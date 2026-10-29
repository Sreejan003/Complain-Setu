import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import i18next from "i18next";

const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const root=path.join(frontend,"src/i18n");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));
const reviews=read(path.join(root,"reviews.json"));
const registrySource=fs.readFileSync(path.join(root,"languageRegistry.ts"),"utf8").replace('import reviews from "./reviews.json";',"const reviews="+JSON.stringify(reviews)+";");
async function moduleFrom(source){const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ES2022}}).outputText;return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));}
const {languages,namespaces,isProductionEnabled,findLanguage}=await moduleFrom(registrySource);
assert.equal(languages.length,23);
assert.equal(new Set(languages.map(l=>l.code)).size,23);
assert.equal(namespaces.length,10);
assert.equal(findLanguage("mni-Beng"),undefined,"Unconfigured scripts must not silently select a different script");
assert.equal(findLanguage("hi-IN").code,"hi");
assert.equal(findLanguage("ks-Arab-IN").code,"ks-Arab");
assert.deepEqual(languages.filter(l=>l.dir==="rtl").map(l=>l.code),["ur","ks-Arab","sd-Arab"]);
function flat(obj,prefix="",out={}){for(const[k,v]of Object.entries(obj)){const next=prefix?prefix+"."+k:k;if(typeof v==="string")out[next]=v;else flat(v,next,out);}return out;}
const tokens=value=>[...value.matchAll(/\{\{\s*([^} ]+)\s*\}\}/g)].map(m=>m[1]).sort();
const allResources={},coverage=[];
for(const locale of languages){
 assert.equal(Intl.getCanonicalLocales(locale.code)[0],locale.code);
 assert.ok(reviews[locale.code],"Missing review metadata: "+locale.code);
 const resources=allResources[locale.code]={};let translated=0,total=0,fallback=[];
 for(const ns of namespaces){
  const file=path.join(root,"locales",locale.code,ns+".json"),raw=fs.readFileSync(file,"utf8");
  assert.ok(!raw.includes("\uFFFD"),"Broken Unicode: "+file);
  const json=read(file),english=flat(read(path.join(root,"locales/en",ns+".json")));
  const approvedFile=path.join(root,"approved",locale.code,ns+".json");
  const approved=fs.existsSync(approvedFile)?flat(read(approvedFile)):{};
  const values={...flat(json),...approved};resources[ns]=json;
  assert.deepEqual(Object.keys(flat(json)).sort(),Object.keys(english).sort(),"Incomplete resource shape: "+file);
  for(const[key,source]of Object.entries(english)){
   const value=values[key];assert.ok(typeof value==="string"&&value.trim(),"Empty translation: "+locale.code+":"+key);
   assert.deepEqual(tokens(value),tokens(source),"Interpolation changed: "+locale.code+":"+key);
   assert.ok(!/ZXQ\d*ZXQ/.test(value),"Unresolved draft token");
   total++;if(value!==source)translated++;else if(locale.code!=="en")fallback.push(ns+":"+key);
  }
 }
 const enabled=isProductionEnabled(locale);
 if(locale.code!=="en"&&enabled){assert.equal(reviews[locale.code].nativeReviewComplete,true);assert.ok(reviews[locale.code].approvalReference);assert.equal(reviews[locale.code].coverageComplete,true);assert.equal(fallback.length,0,"Production locale still contains English fallback entries");}
 if(locale.code!=="en"){
  const fontRoot=path.join(frontend,"public/fonts",locale.script);
  const css=fs.readFileSync(path.join(fontRoot,"font.css"),"utf8");
  assert.ok(fs.existsSync(path.join(fontRoot,"OFL.txt")),"Missing font license");
  for(const match of css.matchAll(/url\(['"]?([^)'" ]+)/g)){assert.ok(!match[1].startsWith("http"),"Font not self-hosted");const asset=match[1].startsWith("/")?path.join(frontend,"public",match[1]):path.resolve(fontRoot,match[1]);assert.ok(fs.existsSync(asset),"Missing font asset: "+match[1]);}
 }
 coverage.push({locale:locale.code,keys:total,draftTranslated:translated,englishFallback:locale.code==="en"?0:fallback.length,productionEnabled:enabled,review:reviews[locale.code].status});
}
const instance=i18next.createInstance();await instance.init({lng:"en",fallbackLng:"en",resources:allResources,ns:[...namespaces],defaultNS:"common",interpolation:{escapeValue:false},returnEmptyString:false});
for(const locale of languages){await instance.changeLanguage(locale.code);assert.ok(instance.t("common:save"));assert.ok(instance.t("validation:retryLogin",{count:2}).includes("2"));assert.ok(!instance.t("common:language.choose",{language:locale.nativeName}).includes("{{"));}
const englishKeys=new Set(namespaces.flatMap(ns=>Object.keys(flat(allResources.en[ns])).map(key=>ns+":"+key)));
const sourceFiles=fs.readdirSync(path.join(frontend,"src"),{recursive:true}).filter(file=>/\.(?:ts|tsx)$/.test(file)&&!file.startsWith("i18n"));
for(const file of sourceFiles){const source=fs.readFileSync(path.join(frontend,"src",file),"utf8");for(const match of source.matchAll(/\btr\("([^"]+)"\s*[,)]/g))assert.ok(englishKeys.has(match[1]),"Unresolved interface key: "+file+" "+match[1]);const recordSource=source.replaceAll("localizeLabel(card.title)","staticMetricTitle");assert.ok(!/localizeLabel\([^)]*\.(?:title|description|remarks|institutionName|fullName)\b/.test(recordSource),"Original record passed to localization: "+file);}
const report={note:"Resource shape, interpolation and technical checks only. These results do not constitute native-language review.",checksPassed:true,locales:coverage};
fs.writeFileSync(path.join(root,"coverage-report.json"),JSON.stringify(report,null,2)+"\n");
console.table(coverage);console.log("Localization checks passed: 23 locales, 10 namespaces; keys, placeholders, Unicode, font assets, RTL registry, fallback, plural messages, production approval gate, and original-content boundary.");
