import { i18n } from "./index.js";
import { languages } from "./languageRegistry.js";
export function intlLocale() {
  const registered=languages.find(l=>l.code===i18n.resolvedLanguage);
  const locale=registered?.intlLocale||"en-IN";
  return Intl.DateTimeFormat.supportedLocalesOf([locale]).length?locale:"en-IN";
}
export function formatNumber(value:number|string|undefined|null,options?:Intl.NumberFormatOptions) {
  if(value===undefined||value===null||value==="")return "";
  const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat(intlLocale(),options).format(number):String(value);
}
export function formatDate(value:string|number|Date|undefined|null,withTime=false) {
  if(value===undefined||value===null||value==="")return "";
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return String(value);
  const dateOnly=typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(intlLocale(),{dateStyle:"medium",...(withTime?{timeStyle:"short" as const}:{}),...(dateOnly?{timeZone:"UTC"}:{})}).format(date);
}
export function pluralCategory(count:number):Intl.LDMLPluralRule {
  return new Intl.PluralRules(intlLocale()).select(count);
}
/** Analytics month buckets are canonical YYYY-MM; their chronological order is unchanged. */
export function formatMonth(value:string) {
  if(!/^\d{4}-\d{2}$/.test(value))return value;
  return new Intl.DateTimeFormat(intlLocale(),{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"-01T00:00:00Z"));
}
