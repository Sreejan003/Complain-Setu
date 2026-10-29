export type NavigationItem = { key: string; to: string; label: string; icon: string; group: "main" | "operations" | "insights" | "system" };
const items: NavigationItem[] = [
  { key: "dashboard", to: "/", label: "Dashboard", icon: "dashboard", group: "main" },
  { key: "institutions", to: "/institution-dashboard", label: "Institution Dashboard", icon: "institutions", group: "main" },
  { key: "register", to: "/complaints/register", label: "Register Complaint", icon: "register", group: "main" },
  { key: "cases", to: "/cases", label: "Complaint Register", icon: "cases", group: "main" },
  { key: "intake", to: "/intake", label: "Case Intake", icon: "register", group: "main" },
  { key: "intake-config", to: "/admin/intake", label: "Case Intake Configuration", icon: "settings", group: "system" },
  { key: "assignment", to: "/bureau/dashboard?view=unassigned", label: "Officer Assignment", icon: "assignment", group: "operations" },
  { key: "coordination", to: "/coordination", label: "Bureau Coordination", icon: "coordination", group: "operations" },
  { key: "overlaps", to: "/overlaps", label: "Overlap Detection", icon: "overlaps", group: "operations" },
  { key: "transfers", to: "/transfers", label: "Workflow & Transfers", icon: "transfers", group: "operations" },
  { key: "reports", to: "/analytics", label: "Reports & Analytics", icon: "reports", group: "insights" },
  { key: "users", to: "/admin/dashboard#users", label: "User Management", icon: "users", group: "system" },
  { key: "permissions", to: "/admin/dashboard#permissions", label: "Roles & Permissions", icon: "permissions", group: "system" },
  { key: "bureaus", to: "/admin/dashboard#bureaus", label: "Bureau/Cell Management", icon: "institutions", group: "system" },
  { key: "audit", to: "/admin/dashboard#audit", label: "Audit Logs", icon: "audit", group: "system" },
  { key: "notifications", to: "/notifications", label: "Notification Center", icon: "notifications", group: "system" },
  { key: "settings", to: "/admin", label: "System Settings", icon: "settings", group: "system" },
];
const roleKeys: Record<string, string[]> = {
  SYSTEM_ADMIN: ["dashboard", "institutions", "users", "permissions", "bureaus", "audit", "settings", "intake-config", "notifications"],
  COMPETENT_AUTHORITY: ["dashboard", "institutions", "cases", "intake", "coordination", "overlaps", "transfers", "reports", "notifications"],
  BUREAU_HEAD: ["dashboard", "institutions", "register", "cases", "intake", "assignment", "coordination", "overlaps", "transfers", "reports", "notifications"],
  CASE_OFFICER: ["dashboard", "institutions", "cases", "intake", "coordination", "overlaps", "reports", "notifications"],
  "Institutional User": ["institutions", "register", "notifications"],
};
export function navigationForRole(role: string): NavigationItem[] {
  const dashboard = ({ SYSTEM_ADMIN: "/admin/dashboard", COMPETENT_AUTHORITY: "/authority/dashboard", BUREAU_HEAD: "/bureau/dashboard", CASE_OFFICER: "/officer/dashboard" } as Record<string, string>)[role];
  return items.filter(item => (roleKeys[role] || []).includes(item.key)).map(item => ({ ...item,
    to: item.key === "dashboard" ? dashboard : item.to,
    label: item.key === "cases" && role === "CASE_OFFICER" ? "My Assigned Cases" : item.key === "reports" && role === "CASE_OFFICER" ? "My Case Reports" : item.key === "reports" && role === "BUREAU_HEAD" ? "Bureau Reports" : item.label,
  }));
}
export function navigationActive(item: NavigationItem, pathname: string, search = "", hash = "") {
  const target = new URL(item.to, "http://navigation.local");
  if (target.hash) return pathname === target.pathname && hash === target.hash;
  if (target.search) return pathname === target.pathname && new URLSearchParams(search).get("view") === target.searchParams.get("view");
  if (item.key === "dashboard") return pathname === target.pathname && !(pathname === "/admin/dashboard" && ["#users", "#permissions", "#bureaus", "#audit"].includes(hash)) && !(pathname === "/bureau/dashboard" && new URLSearchParams(search).get("view") === "unassigned");
  if (item.key === "reports" && pathname === "/reports") return true;
  if (item.key === "settings") return pathname === target.pathname;
  if (item.key === "institutions") return pathname === target.pathname || pathname.startsWith("/institutions/");
  return pathname === target.pathname || pathname.startsWith(target.pathname + "/");
}
