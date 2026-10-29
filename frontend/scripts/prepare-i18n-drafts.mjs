// Operates only on public interface resources. No case data or external translation API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../src/i18n");
const glossary=JSON.parse(fs.readFileSync(path.join(root,"draftGlossary.json"),"utf8")).terms;
const machineDraftFile=JSON.parse(fs.readFileSync(path.join(root,"machineDrafts.json"),"utf8"));
const machineDrafts=machineDraftFile.locales;
const table=fs.readFileSync(path.join(root,"draftPhrases.tsv"),"utf8").trim().split(/\r?\n/).map(line=>line.split("|"));
const codes=table.shift();
for(const [english,...values] of table)values.forEach((value,i)=>{if(value)glossary[codes[i+1]][english]=value;});
const normalize=s=>s.trim().replace(/\s+/g," ").toLocaleLowerCase("en").replace(/[…]|\.{3}$/g,"");
const aliases={"Bureau":"Bureau/Cell","BUREAU:":"Bureau/Cell","Next Action Date":"Next action date","Notification Centre":"Notification Center","Overview Dashboard":"Dashboard","Administrative":"System Administrator","Administrator":"System Administrator","Institutional User":"Institution", "Next Action:":"Next Action", "Action:":"Actions", "Disposal:":"Disposal", "Officer:":"Officer"};
function flatten(obj,prefix="",out={}){for(const [key,value]of Object.entries(obj)){const next=prefix?prefix+"."+key:key;if(typeof value==="string")out[next]=value;else flatten(value,next,out);}return out;}
function set(obj,key,value){const parts=key.split(".");for(const p of parts.slice(0,-1))obj=obj[p]??={};obj[parts.at(-1)]=value;}
const namespaces=fs.readdirSync(path.join(root,"locales/en")).filter(f=>f.endsWith(".json"));
const english=Object.fromEntries(namespaces.map(ns=>[ns,flatten(JSON.parse(fs.readFileSync(path.join(root,"locales/en",ns),"utf8")))]));
const report={notice:"Draft wording is unreviewed. English fallback entries are explicitly listed and do not count as translated. No language is approved by this generator.",draftSource:machineDraftFile.provenance||"Static glossary and one-off machine drafts; native review still required.",locales:{}};
for(const [code,terms]of Object.entries(glossary)){
 const dictionary=new Map(Object.entries(terms).map(([key,value])=>[normalize(key),value]));
 const aliasesForLocale={};for(const [source,target]of Object.entries(aliases))if(dictionary.has(normalize(target)))aliasesForLocale[normalize(source)]=dictionary.get(normalize(target));
 // Reuse centralized role terminology consistently in every dashboard and administration screen.
 for(const role of ["System Administrator","Competent Authority","Bureau/Cell Head","Case Handling Officer"]){if(terms[role]&&terms.Dashboard)dictionary.set(normalize(role+" Dashboard"),terms[role]+" · "+terms.Dashboard);}
 const translated=[],fallback=[];
 for(const ns of namespaces){const output={};for(const [key,source]of Object.entries(english[ns])){
   const trim=source.trim(), normalized=normalize(source);
   // Human-supplied draft glossary terms take precedence over one-off machine drafts.
   let value=dictionary.get(normalized)||aliasesForLocale[normalized]||machineDrafts[code]?.[source];
   if(!value&&normalized.endsWith(":"))value=dictionary.get(normalized.slice(0,-1));
   if(value&&trim.endsWith(":")&&!value.endsWith(":"))value+=":";
   if(value){value=(source.startsWith(" ")?" ":"")+value+(source.endsWith(" ")?" ":"");translated.push(ns.slice(0,-5)+":"+key);}else{value=source;fallback.push(ns.slice(0,-5)+":"+key);}
   set(output,key,value);
 }fs.writeFileSync(path.join(root,"locales",code,ns),JSON.stringify(output,null,2)+"\n");}
 report.locales[code]={reviewStatus:"draft",nativeReviewComplete:false,translated:translated.length,englishFallback:fallback.length,total:translated.length+fallback.length,fallbackKeys:fallback};
}
fs.writeFileSync(path.join(root,"draftCoverage.json"),JSON.stringify(report,null,2)+"\n");
const inventory=JSON.parse(fs.readFileSync(path.join(root,"inventory.json"),"utf8"));
inventory.keys=Object.fromEntries(Object.entries(english).flatMap(([ns,values])=>Object.entries(values).map(([key,value])=>[ns.slice(0,-5)+":"+key,value])));
fs.writeFileSync(path.join(root,"inventory.json"),JSON.stringify(inventory,null,2)+"\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.locales).map(([code,item])=>[code,{translated:item.translated,englishFallback:item.englishFallback,total:item.total}]))));
