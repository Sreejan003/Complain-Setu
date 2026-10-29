export function dashboardPath(role: string) {
  return ({SYSTEM_ADMIN:"/admin/dashboard",COMPETENT_AUTHORITY:"/authority/dashboard",BUREAU_HEAD:"/bureau/dashboard",CASE_OFFICER:"/officer/dashboard","Institutional User":"/institution-dashboard"} as Record<string,string>)[role] || "/login";
}
/** Navigation guard only. Backend capabilities and scope remain authoritative. */
export function canVisit(role: string, path: string) {
  if(dashboardPath(role)==="/login")return false;
  if(path==="/"||path==="/notifications")return true;
  if(path.endsWith("/dashboard"))return path===dashboardPath(role);
  if(path==="/admin")return role==="SYSTEM_ADMIN";
  if(path==="/admin/intake")return role==="SYSTEM_ADMIN";
  if(path==="/admin/confidentiality")return role==="SYSTEM_ADMIN";
  if(path==="/admin/overlap-settings")return role==="SYSTEM_ADMIN";
  if(path==="/admin/sla-policies")return role==="SYSTEM_ADMIN";
  if(path==="/reports")return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  if(path==="/sla-alerts")return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  if(path==="/admin/audit-integrity")return role==="SYSTEM_ADMIN";
  if(path==="/intake")return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  if(path==="/imports")return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  if(path==="/institution-dashboard"||path==="/institutions"||path.startsWith("/institutions/"))return true;
  if(role==="SYSTEM_ADMIN")return false;
  if(path==="/coordination"||path.startsWith("/coordination/"))return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  if(path==="/complaints/register")return ["COMPETENT_AUTHORITY","BUREAU_HEAD","Institutional User"].includes(role);
  if(["/overlaps","/transfers","/analytics"].includes(path))return ["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role);
  return path.startsWith("/cases")||path.startsWith("/institutions/");
}
