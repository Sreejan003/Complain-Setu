import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FilePlus2,
  FolderKanban,
  GitMerge,
  ArrowRightLeft,
  Bell,
  BarChart3,
  Settings,
  Sparkles,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";

interface SidebarProps {
  collapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { user } = useAuth();

  const navItems = [
    {
      to: "/",
      label: "Overview Dashboard",
      icon: LayoutDashboard,
      badge: null
    },
    {
      to: "/institutions",
      label: "Institution Directory",
      icon: Building2,
      badge: "30"
    },
    {
      to: "/complaints/register",
      label: "Register Complaint",
      icon: FilePlus2,
      badge: "New"
    },
    {
      to: "/cases",
      label: "Complaint Register / Cases",
      icon: FolderKanban,
      badge: null
    },
    {
      to: "/overlaps",
      label: "Overlap Detection Center",
      icon: GitMerge,
      badge: "10 AI Alerts",
      highlight: true
    },
    {
      to: "/transfers",
      label: "Workflow & Transfers",
      icon: ArrowRightLeft,
      badge: null
    },
    {
      to: "/notifications",
      label: "Notification Center",
      icon: Bell,
      badge: null
    },
    {
      to: "/analytics",
      label: "Reports & Analytics",
      icon: BarChart3,
      badge: "CSV"
    },
    {
      to: "/admin",
      label: "Administration",
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 transition-all duration-200 border-r border-slate-800 flex flex-col justify-between shrink-0 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="py-4">
        {/* User Role Card inside sidebar */}
        {!collapsed && (
          <div className="px-4 mb-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{user?.role}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {user?.designation || user?.email}
              </div>
              {user?.bureauId && (
                <div className="mt-2 text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-amber-300 inline-block font-mono">
                  Bureau: {user.bureauId}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="space-y-1 px-2">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center ${
                    collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5"
                  } rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-aicte-navy-700 text-white shadow-xs"
                      : item.highlight
                      ? "text-amber-300 hover:bg-slate-800 hover:text-amber-200 font-semibold"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    item.highlight ? "text-amber-400" : ""
                  }`}
                />
                {!collapsed && (
                  <div className="ml-3 flex items-center justify-between flex-1">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                          item.highlight
                            ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info inside Sidebar */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AICTE Hybrid Overlap Engine</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Rules + MiniLM-L6-v2 Semantic Embeddings
          </div>
        </div>
      )}
    </aside>
  );
};
