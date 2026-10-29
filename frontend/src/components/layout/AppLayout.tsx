import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar.js";
import { Sidebar } from "./Sidebar.js";
import { ModalFrame, LoadingSkeleton } from "../ui/Interface.js";
import { tr, useLocaleRender } from "../../i18n/index.js";

export const AppLayout: React.FC = () => {
  useLocaleRender();
  const [collapsed, setCollapsed] = useState(false), [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 1023px)").matches), [drawer, setDrawer] = useState(false);
  const location = useLocation(), main = useRef<HTMLElement>(null);
  useEffect(() => { const media = window.matchMedia("(max-width: 1023px)"); const change = () => { setMobile(media.matches); setDrawer(false); }; media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  useEffect(() => { setDrawer(false); main.current?.scrollTo({ top: 0 }); }, [location.pathname]);
  return <div className="app-shell h-dvh flex flex-col overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
    <a href="#main-content" className="skip-link">{tr("navigation:ui.skipToContent")}</a>
    <div className="gov-tricolor-bar shrink-0"/>
    <div className="bg-aicte-navy-900 text-slate-200 px-4 md:px-6 py-1 flex justify-between gap-3 text-[10px] sm:text-[11px] shrink-0"><span>भारत सरकार <span className="mx-2 text-slate-400">/</span>{tr("navigation:governmentOfIndia")}<span className="hidden md:inline mx-3 text-slate-400">·</span><span className="hidden md:inline">{tr("navigation:ministryOfEducation")}</span></span><span className="text-amber-200 text-[10px] font-medium tracking-wide">{tr("navigation:demoEnvironment")}</span></div>
    <div className="flex flex-1 min-h-0">
      {!mobile && <Sidebar collapsed={collapsed}/>}
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar onToggleSidebar={() => mobile ? setDrawer(v => !v) : setCollapsed(v => !v)} navigationExpanded={mobile ? drawer : !collapsed}/>
        <main ref={main} id="main-content" tabIndex={-1} className="app-content flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 xl:p-8"><div className="max-w-[1536px] mx-auto"><React.Suspense fallback={<LoadingSkeleton label={tr("dashboard:loadingAuthorizedRecords")}/>}><Outlet/></React.Suspense></div><footer className="flex flex-wrap justify-between gap-2 mt-10 pt-5 border-t border-slate-200 text-xs text-slate-500"><span>{tr("navigation:aicte")}</span><span>AICTE · IICMCS</span></footer></main>
      </div>
    </div>
    {mobile && drawer && <ModalFrame className="fixed inset-0 z-50 flex bg-slate-950/50" onClose={() => setDrawer(false)}><h2 className="sr-only">{tr("navigation:ui.primaryNavigation")}</h2><Sidebar collapsed={false} mobile onClose={() => setDrawer(false)}/><button className="flex-1" tabIndex={-1} onClick={() => setDrawer(false)} aria-label={tr("navigation:ui.closeNavigation")}/></ModalFrame>}
  </div>;
};
