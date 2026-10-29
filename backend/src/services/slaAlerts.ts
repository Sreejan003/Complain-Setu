import{randomUUID}from"node:crypto";
import{store}from"../db/store.js";
import{effectiveProfile,mayRead,requestScope}from"../security/rbac.js";
import{auditDigest}from"../security/auditChain.js";
import{civilDistance,clockDeadline,policyDay}from"./slaCalendar.js";
import{DevelopmentNotificationAdapter,type NotificationAdapter}from"./slaDelivery.js";
import type{Complaint,Profile}from"../models/types.js";
import type{SlaAlert,SlaAlertKind,SlaDelivery}from"../models/slaPolicy.js";
import type{EscalationConfig}from"../config/constants.js";
import{SlaPolicyError}from"./slaPolicies.js";
function visible(user:Profile,alert:SlaAlert){return alert.recipientId===user.id&&alert.caseIds.every(id=>{const record=store.getCoordinationSource(id);return!!record&&mayRead(user,record,store.getComplaintRegion(record));});}
function actor(user:Profile){const current=store.getProfileById(user.id);if(!current?.isActive)throw new SlaPolicyError("SLA_ALERT_NOT_FOUND",404);return effectiveProfile(current);}
export const slaAlertService={
  list(user:Profile){user=actor(user);return store.getSlaOperations().alerts.filter(row=>visible(user,row)).map(row=>({...row,deliveries:store.getSlaOperations().deliveries.filter(delivery=>delivery.alertId===row.id)}));},
  acknowledge(user:Profile,id:string){return store.transaction(()=>{user=actor(user);const alert=store.getSlaOperations().alerts.find(row=>row.id===id&&visible(user,row));if(!alert)throw new SlaPolicyError("SLA_ALERT_NOT_FOUND",404);if(!alert.acknowledgedAt){alert.acknowledgedAt=new Date().toISOString();alert.acknowledgedBy=user.id;store.saveSlaAlert(alert);store.addAuditLog({userId:user.id,userName:user.fullName,action:"SLA_ALERT_ACKNOWLEDGED",entityType:"Complaint",entityId:alert.caseIds[0],details:{alertId:id,kind:alert.kind}});}return alert;});}
};
export function evaluatePolicySlaCycle(config:EscalationConfig,now=new Date(),adapters:NotificationAdapter[]=[new DevelopmentNotificationAdapter("email"),new DevelopmentNotificationAdapter("sms")]){
  return requestScope.exit(()=>store.transaction(()=>{
    const settings=store.getSlaPolicyConfiguration(),snapshot=store.exportSnapshot(),cases=snapshot.complaints.filter(row=>row.sla&&row.status!=="Disposed"),profiles=store.getProfiles().map(effectiveProfile).filter(row=>row.isActive&&["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(row.role));
    let overdueCount=0,approachingCount=0,notificationsCreated=0,autoEscalatedCount=0;
    function flag(kind:SlaAlertKind,records:Complaint[],contextKey:string){
      for(const user of profiles.filter(profile=>records.every(record=>mayRead(profile,record,store.getComplaintRegion(record))))){
        const ids=records.map(row=>row.id).sort(),key=auditDigest([kind,user.id,ids,contextKey,settings.version]),operations=store.getSlaOperations();let alert=operations.alerts.find(row=>row.key===key);
        if(alert?.acknowledgedAt)continue;
        const recent=operations.alerts.filter(row=>row.recipientId===user.id&&row.kind===kind&&(kind==="DuplicateStorm"?row.caseIds.some(id=>records.some(record=>store.getCoordinationSource(id)?.institutionId===record.institutionId)):row.caseIds.some(id=>ids.includes(id)))).some(row=>Date.parse(row.lastNotifiedAt)>now.getTime()-settings.cooldownHours*3600000&&row.key!==key);
        if(recent||alert&&Date.parse(alert.lastNotifiedAt)>now.getTime()-settings.cooldownHours*3600000)continue;
        alert??={id:randomUUID(),key,kind,caseIds:ids,recipientId:user.id,configurationVersion:settings.version,createdAt:now.toISOString(),lastNotifiedAt:"",notificationCount:0};alert.lastNotifiedAt=now.toISOString();alert.notificationCount++;store.saveSlaAlert(alert);
        store.addNotification({id:randomUUID(),recipientId:user.id,title:"Operational SLA review: "+kind,message:"An authorized case deadline or workload condition requires review. Acknowledgement does not pause or close the case.",notificationType:kind==="Overdue"?"Overdue":kind==="NoAction"||kind==="DuplicateStorm"?"Status Update":"Deadline",referenceId:ids[0],referenceType:"complaint",slaAlertId:alert.id,isRead:false,createdAt:now.toISOString()});notificationsCreated++;
        for(const channel of["email","sms"]as const)store.saveSlaDelivery({id:randomUUID(),alertId:alert.id,recipientId:user.id,channel,status:"pending",attempts:0,createdAt:now.toISOString(),updatedAt:now.toISOString()});
      }
    }
    for(const record of cases){
      const clock=record.sla!,today=policyDay(now,clock.policy.timezone),deadline=clockDeadline(clock,today);
      if(deadline!==record.expectedDisposalDate){clock.version++;clock.history.push({at:now.toISOString(),actorId:"system-sla-scheduler",action:"PauseAdvanced",reason:"Recorded allowed pause advances the operational deadline; no source obligation is removed.",previousDeadline:record.expectedDisposalDate,deadline,configurationVersion:clock.configurationVersion});store.saveCaseSla(record.id,clock,deadline);store.addAuditLog({userName:"Operational SLA monitor",action:"SLA_PAUSE_DEADLINE_ADVANCED",entityType:"Complaint",entityId:record.id,details:{deadline,clockVersion:clock.version}});record.expectedDisposalDate=deadline;}
      const remaining=civilDistance(today,deadline),paused=clock.pauses.some(row=>!row.to);if(remaining<0)overdueCount++;else if(remaining<=config.approachingDeadlineDays)approachingCount++;if(paused)continue;
      if(remaining<0){flag("Overdue",[record],deadline);if(-remaining>=config.autoEscalateOverdueDays&&record.status!=="Escalated"){
        store.updateComplaintStatus(record.id,{status:"Escalated",remarks:"Automated escalation under the configured operational overdue threshold; no statutory rule asserted."},{id:"system-sla-scheduler",fullName:"Operational SLA monitor",role:"Administrator",email:"",passwordHash:"",isActive:true,createdAt:now.toISOString(),updatedAt:now.toISOString()});autoEscalatedCount++;
      }}else if(remaining===0)flag("DueToday",[record],deadline);else if(settings.reminderDays.includes(remaining))flag(("T-"+remaining)as SlaAlertKind,[record],deadline);
      const history=snapshot.caseHistory.filter(row=>row.complaintId===record.id&&row.performedBy!=="system-sla-scheduler").map(row=>row.createdAt).filter(value=>Number.isFinite(Date.parse(value))),last=[record.createdAt,...history].sort().at(-1)||record.receivedDate;
      if(civilDistance(policyDay(new Date(last),clock.policy.timezone),today)>=settings.inactivityDays)flag("NoAction",[record],last);
    }
    for(const record of snapshot.complaints.filter(row=>!row.sla&&row.status!=="Disposed")){
      const recent=snapshot.caseHistory.filter(row=>row.complaintId===record.id&&row.performedBy!=="system-sla-scheduler").map(row=>row.createdAt).filter(value=>Number.isFinite(Date.parse(value))),last=[record.createdAt,...recent].filter(value=>Number.isFinite(Date.parse(value))).sort().at(-1)||record.receivedDate;
      if(Number.isFinite(Date.parse(last))&&civilDistance(policyDay(new Date(last),"UTC"),policyDay(now,"UTC"))>=settings.inactivityDays)flag("NoAction",[record],last);
    }
    if(settings.duplicateStorm.enabled){
      const since=now.getTime()-settings.duplicateStorm.windowDays*86400000,duplicates=snapshot.relatedCases.filter(row=>row.relationshipType==="Duplicate"&&Date.parse(row.createdAt)>=since);
      for(const institutionId of new Set(snapshot.complaints.map(row=>row.institutionId))){const ids=new Set<string>();for(const pair of duplicates){const a=snapshot.complaints.find(row=>row.id===pair.complaintIdA),b=snapshot.complaints.find(row=>row.id===pair.complaintIdB);if(a?.institutionId===institutionId&&b?.institutionId===institutionId){ids.add(a.id);ids.add(b.id);}}const records=snapshot.complaints.filter(row=>ids.has(row.id));if(records.length>=settings.duplicateStorm.threshold)flag("DuplicateStorm",records,"reviewer-confirmed-duplicate-submissions");}
    }
    for(const delivery of store.getSlaOperations().deliveries.filter(row=>["pending","failed"].includes(row.status)&&(!row.nextAttemptAt||Date.parse(row.nextAttemptAt)<=now.getTime())&&row.attempts<3)){
      const user=profiles.find(row=>row.id===delivery.recipientId),alert=store.getSlaOperations().alerts.find(row=>row.id===delivery.alertId);
      if(!user||!alert||!visible(user,alert)){delivery.status="disabled";delivery.errorCode="RECIPIENT_ACCESS_CHANGED";}else{
        const adapter=adapters.find(row=>row.channel===delivery.channel);let result:{status:"simulated"|"disabled"|"failed";errorCode?:string};try{result=adapter?adapter.send(delivery):{status:"disabled",errorCode:"ADAPTER_NOT_CONFIGURED"};}catch{result={status:"failed",errorCode:"ADAPTER_FAILED"};}delivery.status=result.status;delivery.errorCode=result.errorCode;
      }
      delivery.attempts++;delivery.updatedAt=now.toISOString();delivery.history??=[];delivery.history.push({at:now.toISOString(),attempt:delivery.attempts,status:delivery.status as "simulated"|"disabled"|"failed",errorCode:delivery.errorCode});delivery.nextAttemptAt=delivery.status==="failed"&&delivery.attempts<3?new Date(now.getTime()+Math.pow(2,delivery.attempts)*60000).toISOString():undefined;store.saveSlaDelivery(delivery);
    }
    return{timestamp:now.toISOString(),scannedComplaints:cases.length,overdueCount,approachingCount,notificationsCreated,autoEscalatedCount};
  }));
}
