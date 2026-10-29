import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, FilePlus2, FolderKanban, GitMerge, ArrowRightLeft, Bell, BarChart3, Settings, ShieldCheck, Users, ClipboardList, PanelsTopLeft, X } from "lucide-react";
import { tr, localizeLabel, useLocaleRender } from "../../i18n/index.js";
import { useAuth } from "../../context/AuthContext.js";
import { navigationForRole, navigationActive } from "./navigation.js";
const icons: Record<string, React.ElementType> = { dashboard: LayoutDashboard, institutions: Building2, register: FilePlus2, cases: FolderKanban, assignment: Users, coordination: PanelsTopLeft, overlaps: GitMerge, transfers: ArrowRightLeft, reports: BarChart3, users: Users, permissions: ShieldCheck, audit: ClipboardList, notifications: Bell, settings: Settings };
export function Sidebar({ collapsed, mobile = false, onClose }: { collapsed: boolean; mobile?: boolean; onClose?: () => void }) {
  useLocaleRender();
  const { user } = useAuth(), location = useLocation();
  const items = navigationForRole(user?.role || "");
  return <aside id="app-navigation" aria-label={tr("navigation:ui.primaryNavigation")} className={`bg-aicte-navy-900 text-white flex flex-col shrink-0 h-full ${collapsed ? "w-[76px]" : "w-[248px]"} ${mobile ? "w-[min(288px,85vw)]" : ""}`}>
    <div className={`flex items-center gap-3 px-5 h-[83px] border-b border-white/10 shrink-0 ${collapsed ? "justify-center px-0" : ""}`}>
      <div className="w-9 h-9 bg-white/10 border border-white/15 rounded-lg grid place-items-center shrink-0"><ShieldCheck className="w-5 h-5 text-teal-200" aria-hidden="true"/></div>
      {!collapsed && <div className="min-w-0"><p className="font-semibold text-[17px] tracking-tight">Complain Setu</p><p className="text-[11px] text-slate-300">AICTE · IICMCS</p></div>}
      {mobile && <button className="icon-button ms-auto text-white" onClick={onClose} aria-label={tr("navigation:ui.closeNavigation")}><X className="w-5 h-5"/></button>}
    </div>
    <nav className="flex-1 overflow-y-auto px-3 pb-5" aria-label={tr("navigation:ui.primaryNavigation")}>
      {(["main", "operations", "insights", "system"] as const).filter(group => items.some(item => item.group === group)).map(group => <div key={group} className={collapsed ? "mt-5 pt-3 border-t border-white/10 first:border-0 first:pt-0" : ""}>
        {!collapsed && <h2 className="nav-group-label">{tr("navigation:ui.groups." + group)}</h2>}
        <div className="space-y-1">{items.filter(item => item.group === group).map(item => { const Icon = icons[item.icon]; const label = item.key === "intake" ? tr("complaints:intake.title") : item.key === "intake-config" ? tr("complaints:intake.configurationTitle") : item.key === "coordination" ? tr("workflow:crossBureau.title") : localizeLabel(item.label); return <Link key={item.key} to={item.to} onClick={onClose} className={`nav-link ${collapsed ? "justify-center px-0" : ""}`} aria-current={navigationActive(item, location.pathname, location.search, location.hash) ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}><Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true"/>{!collapsed && <span className="leading-snug">{label}</span>}</Link>; })}</div>
      </div>)}
    </nav>
    {!collapsed && <div className="border-t border-white/10 px-5 py-4 text-xs"><p className="font-medium text-slate-200">{localizeLabel(user?.role)}</p><p className="text-slate-300 mt-1"><bdi dir="ltr">{user?.bureauId || "AICTE"}</bdi>{user?.region ? <> · <bdi dir="auto">{user.region}</bdi></> : null}</p></div>}
  </aside>;
}
