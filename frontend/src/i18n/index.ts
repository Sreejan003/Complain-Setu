import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { languages, namespaces } from "./languageRegistry.js";
import { preferredLanguage, preferenceKey, selectableLanguages } from "./config.js";
import { englishLookup } from "./catalog.js";

const imports=import.meta.glob("./locales/*/*.json");
// Official, reviewed terminology always wins over the draft pack for the same key.
const approvedImports=import.meta.glob("./approved/*/*.json");
const cached=new Map<string,Promise<void>>();
async function loadLanguage(code:string) {
  if(!cached.has(code))cached.set(code,Promise.all(namespaces.map(async ns=>{
    const load=imports[`./locales/${code}/${ns}.json`];
    if(load){const module=await load() as {default:Record<string,string>};i18next.addResourceBundle(code,ns,module.default,true,true);}
    const approved=approvedImports[`./approved/${code}/${ns}.json`];
    if(approved){const module=await approved() as {default:Record<string,string>};i18next.addResourceBundle(code,ns,module.default,true,true);}
  })).then(()=>{}));
  try{await cached.get(code);}catch(error){cached.delete(code);throw error;}
}
function applyDocumentLanguage(code:string) {
  const locale=languages.find(l=>l.code===code)||languages[0];
  document.documentElement.lang=locale.code;
  document.documentElement.dir=locale.dir;
  document.documentElement.dataset.script=locale.script;
  document.documentElement.style.setProperty("--interface-font",`'${locale.font}', 'Nirmala UI', 'Segoe UI', system-ui, sans-serif`);
  if(locale.code!=="en") {
    const fontId="locale-font-"+locale.script;
    if(!document.getElementById(fontId)) {const link=document.createElement("link");link.id=fontId;link.rel="stylesheet";link.href=`/fonts/${locale.script}/font.css`;document.head.appendChild(link);}
  }
}
export const i18nReady=(async()=>{
  await i18next.use(initReactI18next).init({lng:"en",fallbackLng:"en",supportedLngs:languages.map(l=>l.code),load:"currentOnly",ns:[...namespaces],defaultNS:"common",resources:{},interpolation:{escapeValue:false},returnEmptyString:false,react:{useSuspense:false}});
  await loadLanguage("en");
  let language=preferredLanguage();
  try{if(language!=="en")await loadLanguage(language);}catch{language="en";}
  await i18next.changeLanguage(language);applyDocumentLanguage(language);
})();
let selection=0;
export async function changeInterfaceLanguage(code:string) {
  if(!selectableLanguages.some(l=>l.code===code))throw new Error("Language is not approved for this environment.");
  const current=++selection;
  await loadLanguage(code);
  if(current!==selection)return;
  await i18next.changeLanguage(code);applyDocumentLanguage(code);
  try{localStorage.setItem(preferenceKey,code);}catch{/* Session-only switching remains available. */}
}
export function useLocaleRender() { useTranslation(); }
export function tr(key:string,values?:Record<string,unknown>):string {return String(i18next.t(key,values as any));}
/** Only allowlisted interface labels enter this function. Never wrap narratives or audit text. */
export function localizeLabel(value:unknown):string {
  const source=String(value??"");const key=englishLookup[source];return key?tr(key):source;
}
/** Errors are allowlisted UI messages, never raw internal exception details. */
export function localizeError(value:unknown):string {
  const source=String(value??"");
  const key=englishLookup[source];
  if(key)return tr(key);
  if(/^HTTP 403|^Access Denied:/.test(source))return tr("validation:permissionDenied");
  if(/^HTTP 401/.test(source))return tr("validation:sessionExpired");
  const retry=source.match(/^Too many failed login attempts\. Please try again in (\d+) seconds\.$/);
  if(retry)return tr("validation:retryLogin",{count:Number(retry[1])});
  return tr("common:genericError");
}
export { i18next as i18n };
