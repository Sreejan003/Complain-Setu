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
  ShieldCheck,
  Building
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarProps {
  collapsed: boolean;
}

// Role-based navigation items (strictly official, no promotional badges)
const ALL_NAV_ITEMS: NavItem[] = [
  { to: "/",                     label: "Overview Dashboard",        icon: LayoutDashboard },
  { to: "/institution-dashboard",label: "Single-Window Portal",      icon: Building2 },
  { to: "/complaints/register",  label: "Register Complaint",        icon: FilePlus2 },
  { to: "/cases",                label: "Complaint Register",        icon: FolderKanban },
  { to: "/overlaps",             label: "Overlap Detection",         icon: GitMerge },
  { to: "/transfers",            label: "Workflow & Transfers",      icon: ArrowRightLeft },
  { to: "/notifications",        label: "Notification Center",       icon: Bell },
  { to: "/analytics",            label: "Reports & Analytics",       icon: BarChart3 },
  { to: "/admin",                label: "Administration",            icon: Settings },
];

const ROLE_NAV_KEYS: Record<string, string[]> = {
  Administrator: [
    "/", "/institution-dashboard", "/complaints/register",
    "/cases", "/overlaps", "/transfers", "/notifications", "/analytics", "/admin"
  ],
  "Senior Management": [
    "/", "/institution-dashboard", "/cases",
    "/overlaps", "/analytics", "/notifications"
  ],
  "Regulation Bureau Officer": [
    "/", "/institution-dashboard", "/complaints/register",
    "/cases", "/overlaps", "/transfers", "/notifications", "/analytics"
  ],
  "PGRC Officer": [
    "/", "/institution-dashboard", "/complaints/register",
    "/cases", "/overlaps", "/transfers", "/notifications", "/analytics"
  ],
  "Regional Officer": [
    "/", "/institution-dashboard", "/complaints/register",
    "/cases", "/overlaps", "/transfers", "/notifications", "/analytics"
  ],
  "Institutional User": [
    "/institution-dashboard", "/complaints/register", "/notifications"
  ],
};

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const allowedKeys = ROLE_NAV_KEYS[role] ?? ALL_NAV_ITEMS.map(i => i.to);

  const navItems = ALL_NAV_ITEMS
    .filter(item => allowedKeys.includes(item.to))
    .map(item => {
      if (item.to === "/cases") {
        const label = role.includes("Officer")
          ? "My Assigned Cases"
          : role === "Institutional User"
          ? "Institution Grievances"
          : "Complaint Register";
        return { ...item, label };
      }
      return item;
    });

  return (
    <aside
      className={`bg-[#002147] text-slate-200 transition-all duration-150 border-r border-[#001733] flex flex-col justify-between shrink-0 select-none ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="py-2.5">
        {/* Officer Assignment Context Box */}
        {!collapsed && user && (
          <div className="px-3 mb-2.5">
            <div className="bg-[#0b2545] border border-[#163860] rounded-xs p-2 text-xs">
              <div className="flex items-center space-x-1.5 text-white font-semibold text-[11px] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{user.role}</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                {user.fullName}
              </div>
              {user.bureauId && (
                <div className="mt-1 text-[10px] bg-[#12375b] text-amber-300 px-1.5 py-0.2 rounded-xs inline-block font-mono border border-[#1d4b73]">
                  BUREAU: {user.bureauId}
                </div>
              )}
              {user.role === "Institutional User" && user.institutionName && (
                <div className="mt-1 text-[10px] text-slate-300 truncate">
                  {user.institutionName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-0.5 px-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center ${
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                  } rounded-xs text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#0b2545] text-white border-l-3 border-[#ff9933] font-semibold"
                      : "text-slate-300 hover:bg-[#08203e] hover:text-white"
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0 text-slate-300" />
                {!collapsed && (
                  <span className="ml-2.5 truncate text-[12px]">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info */}
      {!collapsed && (
        <div className="p-3 border-t border-[#001733] text-[10px] text-slate-400 bg-[#001c3d]">
          <div className="font-semibold text-slate-300">AICTE Grievance Portal</div>
          <div>NIC Standard Architecture</div>
          <div className="text-slate-500 mt-0.5">v2.6.4 (SIH 2026 Edition)</div>
        </div>
      )}
    </aside>
  );
};
