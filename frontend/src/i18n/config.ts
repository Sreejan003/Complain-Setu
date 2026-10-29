import { findLanguage, isProductionEnabled, languages } from "./languageRegistry.js";
export const preferenceKey="complain_setu_interface_language";
export const previewEnabled=import.meta.env.DEV || import.meta.env.VITE_I18N_PREVIEW==="true";
export const selectableLanguages=languages.filter(l=>isProductionEnabled(l)||previewEnabled);
export function preferredLanguage(): string {
  let persisted:string|null=null;
  try{persisted=localStorage.getItem(preferenceKey);}catch{/* Private browsing can disable storage. */}
  for(const candidate of [persisted,...navigator.languages,"en"].filter(Boolean) as string[]) {
    try{const locale=findLanguage(candidate);if(locale&&selectableLanguages.some(l=>l.code===locale.code))return locale.code;}catch{/* Invalid browser/user locale falls back safely. */}
  }
  return "en";
}
