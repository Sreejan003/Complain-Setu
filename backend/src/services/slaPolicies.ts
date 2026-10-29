import{randomUUID}from"node:crypto";
import{store}from"../db/store.js";
import{authorize,effectiveProfile,mayRead}from"../security/rbac.js";
import{COMPLAINT_CATEGORIES,PRIORITIES}from"../config/constants.js";
import{defaultSlaPolicies}from"../config/slaPolicy.js";
import{clockDeadline,initialCaseSla,policyDay,validCivilDate}from"./slaCalendar.js";
import type{Profile}from"../models/types.js";
import type{SlaPolicy,SlaPolicyConfiguration}from"../models/slaPolicy.js";
export class SlaPolicyError extends Error{constructor(public code:string,public status=400){super(code);}}
function fail(code:string,status=400):never{throw new SlaPolicyError(code,status);}
function text(value:unknown,max=1000){if(typeof value!=="string"||value.trim().length<5||value.length>max)fail("SLA_REASON_REQUIRED");return value.trim();}
function actor(user:Profile,admin=false){const stored=store.getProfileById(user.id);if(!stored?.isActive)fail("SLA_FORBIDDEN",403);const current=effectiveProfile(stored);if(admin&&current.role!=="SYSTEM_ADMIN")fail("SLA_CONFIG_FORBIDDEN",403);return current;}
function context(user:Profile,id:string){const profile=actor(user),complaint=store.getComplaintById(id);if(!complaint||!mayRead(profile,complaint,store.getComplaintRegion(complaint)))fail("SLA_NOT_FOUND",404);return{profile,complaint};}
function policyInput(input:any):SlaPolicy{
  if(!input||typeof input.id!=="string"||!/^[a-z][a-z0-9_-]{0,59}$/.test(input.id)||typeof input.enabled!=="boolean"||!Number.isInteger(input.precedence)||input.precedence<0||input.precedence>10000||!validCivilDate(input.effectiveFrom)||input.effectiveTo!==undefined&&(!validCivilDate(input.effectiveTo)||input.effectiveTo<input.effectiveFrom)||!Number.isInteger(input.days)||input.days<1||input.days>3650||!["calendar","business"].includes(input.calendar)||!["received_date","source_received_date"].includes(input.startBasis))fail("INVALID_SLA_POLICY");
  if(typeof input.timezone!=="string")fail("INVALID_SLA_TIMEZONE");try{new Intl.DateTimeFormat("en",{timeZone:input.timezone}).format();}catch{fail("INVALID_SLA_TIMEZONE");}
  const list=(value:unknown,max:number,valid:(item:string)=>boolean)=>{if(!Array.isArray(value)||value.length>max||value.some(item=>typeof item!=="string"||!valid(item))||new Set(value).size!==value.length)fail("INVALID_SLA_SELECTOR");return [...value] as string[];};
  const intake=store.getIntakeConfiguration();
  return{id:input.id,name:text(input.name,150),enabled:input.enabled,precedence:input.precedence,effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo||undefined,days:input.days,calendar:input.calendar,timezone:input.timezone,startBasis:input.startBasis,
    categories:list(input.categories,50,item=>(COMPLAINT_CATEGORIES as readonly string[]).includes(item)),caseTypes:list(input.caseTypes,40,item=>intake.caseTypes.some(row=>row.id===item)),sources:list(input.sources,30,item=>intake.channels.some(row=>row.id===item)),priorities:list(input.priorities,4,item=>(PRIORITIES as readonly string[]).includes(item)),holidays:list(input.holidays,1000,validCivilDate),allowedPauseReasons:list(input.allowedPauseReasons,30,item=>/^[a-z][a-z0-9_]{2,59}$/.test(item)),reference:input.reference?text(input.reference,1000):undefined};
}
export const slaPolicyService={
  configuration(user:Profile){actor(user,true);return{current:store.getSlaPolicyConfiguration(),history:store.getSlaPolicyHistory(),defaults:defaultSlaPolicies(),caseTypes:store.getIntakeConfiguration().caseTypes,sources:store.getIntakeConfiguration().channels,categories:COMPLAINT_CATEGORIES,priorities:PRIORITIES};},
  configure(user:Profile,input:any){return store.transaction(()=>{const profile=actor(user,true),current=store.getSlaPolicyConfiguration(),reason=text(input?.reason);if(input?.version!==current.version)fail("SLA_CONFIGURATION_CHANGED",409);
    const rollback=input.rollbackTo===undefined?undefined:store.getSlaPolicyHistory().find(row=>row.version===input.rollbackTo);if(input.rollbackTo!==undefined&&!rollback)fail("SLA_ROLLBACK_NOT_FOUND",404);const source=rollback||input;
    if(!Array.isArray(source.policies)||!source.policies.length||source.policies.length>60)fail("INVALID_SLA_POLICY");const policies:SlaPolicy[]=source.policies.map(policyInput);if(rollback)for(const old of current.policies)if(!policies.some(row=>row.id===old.id))policies.push({...old,enabled:false});if(new Set(policies.map(row=>row.id)).size!==policies.length||current.policies.some(row=>!policies.some(next=>next.id===row.id)))fail("SLA_POLICY_IDS_MUST_REMAIN");
    if(!Array.isArray(source.reminderDays)||source.reminderDays.length>3||source.reminderDays.some((day:any)=>![7,3,1].includes(day))||new Set(source.reminderDays).size!==source.reminderDays.length||!Number.isInteger(source.inactivityDays)||source.inactivityDays<1||source.inactivityDays>3650||!Number.isInteger(source.cooldownHours)||source.cooldownHours<1||source.cooldownHours>8760||typeof source.duplicateStorm?.enabled!=="boolean"||!Number.isInteger(source.duplicateStorm.windowDays)||source.duplicateStorm.windowDays<1||source.duplicateStorm.windowDays>365||!Number.isInteger(source.duplicateStorm.threshold)||source.duplicateStorm.threshold<2||source.duplicateStorm.threshold>1000)fail("INVALID_SLA_ALERT_SETTINGS");
    const config:SlaPolicyConfiguration={id:randomUUID(),version:current.version+1,changedBy:profile.id,changedAt:new Date().toISOString(),reason,rollbackOf:rollback?.version,policies,reminderDays:[...source.reminderDays],inactivityDays:source.inactivityDays,cooldownHours:source.cooldownHours,duplicateStorm:{...source.duplicateStorm}};
    store.saveSlaPolicyConfiguration(config);store.addAuditLog({userId:profile.id,userName:profile.fullName,action:rollback?"SLA_POLICY_ROLLED_BACK":"SLA_POLICY_CONFIGURED",entityType:"Configuration",entityId:config.id,details:{version:config.version,rollbackOf:rollback?.version,reason}});return this.configuration(profile);});},
  view(user:Profile,id:string){const{profile,complaint}=context(user,id);return{clock:complaint.sla,deadline:complaint.expectedDisposalDate,legacy:!complaint.sla,canManage:["COMPETENT_AUTHORITY","BUREAU_HEAD"].includes(profile.role)&&authorize(profile,"case.update",complaint,{region:store.getComplaintRegion(complaint)})};},
  act(user:Profile,id:string,input:any){return store.transaction(()=>{const{profile,complaint}=context(user,id);if(!["COMPETENT_AUTHORITY","BUREAU_HEAD"].includes(profile.role)||!authorize(profile,"case.update",complaint,{region:store.getComplaintRegion(complaint)}))fail("SLA_ACTION_FORBIDDEN",403);const reason=text(input?.reason),previous=complaint.expectedDisposalDate,old=complaint.sla;if(input.version!==(old?.version||0))fail("SLA_CLOCK_CHANGED",409);
    let clock=old?structuredClone(old):undefined;const now=new Date();
    if(input.action==="recalculate"){
      if(clock?.pauses.some(row=>!row.to))fail("SLA_RESUME_BEFORE_RECALCULATION");
      const next=initialCaseSla(store.getSlaPolicyConfiguration(),complaint,profile.id,now);next.version=(clock?.version||0)+1;next.pauses=clock?.pauses||[];next.history=clock?.history||[];clock=next;
    }else{
      if(!clock)fail("SLA_LEGACY_REVIEW_REQUIRED");const today=policyDay(now,clock.policy.timezone);
      if(input.action==="pause"){if(clock.pauses.some(row=>!row.to)||clock.pauses.length>=120||!clock.policy.allowedPauseReasons.includes(input.pauseReason))fail("SLA_PAUSE_NOT_ALLOWED");clock.pauses.push({from:today,reason:input.pauseReason,actorId:profile.id,calendar:clock.policy.calendar,holidays:[...clock.policy.holidays],timezone:clock.policy.timezone});}
      else if(input.action==="resume"){const pause=clock.pauses.find(row=>!row.to);if(!pause)fail("SLA_NOT_PAUSED");pause.to=today;}else fail("INVALID_SLA_ACTION");clock.version++;
    }
    const deadline=clockDeadline(clock,policyDay(now,clock.policy.timezone));clock.history.push({at:now.toISOString(),actorId:profile.id,action:input.action,reason,previousDeadline:previous,deadline,configurationVersion:clock.configurationVersion});store.saveCaseSla(id,clock,deadline);
    store.addCaseHistory({id:randomUUID(),complaintId:complaint.id,actionType:"SLA policy action",remarks:`${input.action}: independent operational deadline ${previous} → ${deadline}.`,performedBy:profile.id,performedByName:profile.fullName,createdAt:now.toISOString()});store.addAuditLog({userId:profile.id,userName:profile.fullName,action:"SLA_CLOCK_"+String(input.action).toUpperCase(),entityType:"Complaint",entityId:complaint.id,details:{reason,version:clock.version,configurationVersion:clock.configurationVersion,previousDeadline:previous,deadline,pauseReason:input.pauseReason}});return this.view(profile,id);
  });}
};
