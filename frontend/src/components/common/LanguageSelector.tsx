import React, { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changeInterfaceLanguage, tr } from "../../i18n/index.js";
import { selectableLanguages } from "../../i18n/config.js";
import { isProductionEnabled } from "../../i18n/languageRegistry.js";

export function LanguageSelector() {
  const {i18n}=useTranslation();
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
  const current=selectableLanguages.find(l=>l.code===i18n.resolvedLanguage)||selectableLanguages[0];
  const choices=selectableLanguages.filter(l=>(l.englishName+" "+l.nativeName+" "+l.code).normalize().toLocaleLowerCase().includes(query.normalize().toLocaleLowerCase()));
  function close(){setOpen(false);setQuery("");trigger.current?.focus();}
  useEffect(()=>{if(open)search.current?.focus();},[open]);
  useEffect(()=>{const outside=(event:MouseEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false);};document.addEventListener("mousedown",outside);return()=>document.removeEventListener("mousedown",outside);},[]);
  return <div className="relative shrink-0" ref={root}>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={tr("common:language.choose",{language:current.nativeName})} aria-description={!isProductionEnabled(current)?tr("common:language.unreviewed"):undefined} onClick={()=>setOpen(v=>!v)} className="inline-flex items-center min-h-10 gap-1.5 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-[#17365D] bg-white focus-visible:outline-2 focus-visible:outline-[#17365D]">
      <Globe className="w-4 h-4" aria-hidden="true"/><span lang={current.code} dir={current.dir}>{current.nativeName}</span>{!isProductionEnabled(current)&&<span className="text-xs text-amber-800 hidden md:inline">{tr("common:language.draft")}</span>}<ChevronDown className="w-3 h-3" aria-hidden="true"/>
    </button>
    {open&&<div role="dialog" aria-label={tr("common:language.menu")} className="absolute end-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] border border-slate-200 bg-white shadow-lg rounded-lg z-50 p-3" onKeyDown={e=>{
      if(e.key==="Escape"){e.preventDefault();close();}
      if(e.key==="Tab"){
        const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input,button:not(:disabled)'));
        if(e.shiftKey&&e.target===items[0]){e.preventDefault();items.at(-1)?.focus();}
        else if(!e.shiftKey&&e.target===items.at(-1)){e.preventDefault();items[0]?.focus();}
      }
      if(e.key==="ArrowDown"&&e.target===search.current){e.preventDefault();root.current?.querySelector<HTMLButtonElement>("[data-language-option]")?.focus();}
    }}>
      <label className="block text-sm font-semibold mb-1">{tr("common:language.searchLabel")}
        <input ref={search} type="search" value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 block w-full border border-slate-200 p-2 rounded-lg text-sm" autoComplete="off"/>
      </label>
      <p className="text-xs text-amber-800 mb-2">{!isProductionEnabled(current)?tr("common:language.unreviewed"):""}</p>
      <ul className="max-h-[55vh] overflow-y-auto space-y-1" aria-label={tr("common:language.available")}>
        {choices.map(locale=><li key={locale.code}><button type="button" data-language-option aria-pressed={current.code===locale.code} disabled={busy} className={`w-full text-start px-2 py-2 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-[#17365D] ${current.code===locale.code?"bg-slate-100 font-bold":"hover:bg-slate-50"}`} onKeyDown={e=>{
          if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>("[data-language-option]")||[]);const index=items.indexOf(e.currentTarget);items[e.key==="Home"?0:e.key==="End"?items.length-1:(index+(e.key==="ArrowDown"?1:-1)+items.length)%items.length]?.focus();}
        }} onClick={async()=>{setBusy(true);setError("");try{await changeInterfaceLanguage(locale.code);close();}catch{setError(tr("common:language.loadFailed"));}finally{setBusy(false);}}}>
          <span lang={locale.code} dir={locale.dir}>{locale.nativeName}</span><span className="block text-xs text-slate-500" lang="en" dir="ltr">{locale.englishName}{!isProductionEnabled(locale)?" · "+tr("common:language.draft"):""}</span>
        </button></li>)}
      </ul>
      {!choices.length&&<p className="text-sm" role="status">{tr("common:language.noResults")}</p>}
      {error&&<p className="text-sm text-red-800" role="alert">{error}</p>}
      {busy&&<p className="text-sm" role="status">{tr("common:language.loading")}</p>}
      <button type="button" className="text-sm underline mt-2" onClick={close}>{tr("common:cancel")}</button>
    </div>}
  </div>;
}
