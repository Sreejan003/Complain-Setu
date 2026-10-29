import type{SlaPolicyConfiguration}from"../models/slaPolicy.js";
import{SLA_DAYS}from"./constants.js";
export function defaultSlaPolicies():SlaPolicyConfiguration{
  return{id:"sla-policies-default-1",version:1,changedBy:"system-default",changedAt:"2026-01-01T00:00:00Z",reason:"Existing priority deadlines preserved as operational defaults; no verified statutory basis asserted.",
    policies:Object.entries(SLA_DAYS).map(([priority,days],index)=>({id:"operational-"+priority.toLowerCase(),name:priority+" priority operational default",enabled:true,precedence:index,effectiveFrom:"1900-01-01",categories:[],caseTypes:["grievance"],sources:[],priorities:[priority],days,calendar:"calendar",timezone:"UTC",holidays:[],startBasis:"received_date",allowedPauseReasons:[]})),
    reminderDays:[7,3,1],inactivityDays:14,cooldownHours:24,duplicateStorm:{enabled:false,windowDays:7,threshold:5}};
}
