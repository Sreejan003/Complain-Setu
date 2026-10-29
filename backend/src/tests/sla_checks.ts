import assert from "node:assert/strict";
import type {Store} from "../db/store.js";
import {DEFAULT_ESCALATION_CONFIG} from "../config/constants.js";
import {evaluatePolicySlaCycle} from "../services/slaAlerts.js";
import {DevelopmentNotificationAdapter,type NotificationAdapter} from "../services/slaDelivery.js";
type Result={status:number;body:any};
export async function runSlaChecks({request,check,work,store}:{request:(actor:string,route:string,method?:string,body?:unknown)=>Promise<Result>;check:(name:string,operation:()=>Promise<void>)=>Promise<void>;work:<T>(operation:()=>Promise<T>|T)=>Promise<T>;store:Store}){
  let current:any,id:string,legacyId:string;
  const create=async(title:string,deadline?:string)=>{const response=await request("head","complaints","POST",{institutionId:"north",category:"Faculty Shortage / Irregularities",title,description:"Disposable SLA policy fixture only",receivingBureauId:"RB",assignedOfficerId:"officer",priority:"Medium",expectedDisposalDate:deadline});assert.equal(response.status,201,JSON.stringify(response.body));return response.body.complaint;};
  await check("SLA administration is separated from case access and policy writes are versioned",async()=>{
    for(const actor of["head","officer","authority","institution-user"])assert.equal((await request(actor,"admin/sla-policies")).status,403);
    current=(await request("admin","admin/sla-policies")).body.current;assert.equal(current.version,1);
    const record=await create("SLA_PINNED_DEFAULT");id=record.id;assert.equal(record.sla.policy.days,30);assert.equal(record.sla.configurationVersion,1);
    legacyId="sla-legacy-fixture";
  });
  await check("Policy validation rejects removed historical IDs, bad timezone and stale configuration",async()=>{
    assert.equal((await request("admin","admin/sla-policies","PUT",{...current,reason:"Review invalid metadata",policies:[]})).status,400);
    assert.equal((await request("admin","admin/sla-policies","PUT",{...current,reason:"Review invalid timezone",policies:current.policies.map((row:any)=>({...row,timezone:"Not/AZone"}))})).status,400);
    const custom={...current.policies[0],id:"fixture-business",name:"Fixture business clock",precedence:100,priorities:["Medium"],days:10,calendar:"business",timezone:"Asia/Kolkata",holidays:["2026-11-02"],allowedPauseReasons:["awaiting_response"]};
    const result=await request("admin","admin/sla-policies","PUT",{...current,reason:"Review test policy and permitted pause",policies:[...current.policies,custom],duplicateStorm:{enabled:true,windowDays:7,threshold:2}});assert.equal(result.status,200,JSON.stringify(result.body));current=result.body.current;assert.equal(current.version,2);
    assert.equal((await request("admin","admin/sla-policies","PUT",{...current,version:1,reason:"Stale policy review"})).status,409);
  });
  await check("Existing and legacy deadlines remain pinned until explicitly recalculated",async()=>{
    const pinned=(await request("head",`case-sla/${id}`)).body;assert.equal(pinned.clock.configurationVersion,1);
    const legacy=(await request("head",`case-sla/${legacyId}`)).body;assert.equal(legacy.legacy,true);
    const recalc=await request("head",`case-sla/${legacyId}`,"POST",{action:"recalculate",version:0,reason:"Explicitly adopt reviewed operational policy"});assert.equal(recalc.status,200);assert.equal(recalc.body.clock.configurationVersion,2);assert.equal(recalc.body.clock.policy.id,"fixture-business");
    assert.equal((await request("admin",`case-sla/${id}`)).status,404);assert.equal((await request("peer",`case-sla/${id}`)).status,404);assert.equal((await request("target",`case-sla/${id}`)).status,404);
  });
  await check("Only supervisors may pause with an applied allowed reason; stale and active-recalculation actions fail",async()=>{
    const record=await create("SLA_PAUSE_REVIEW");id=record.id;
    assert.equal((await request("officer",`case-sla/${id}`,"POST",{action:"pause",version:1,reason:"Await source reply",pauseReason:"awaiting_response"})).status,403);
    assert.equal((await request("head",`case-sla/${id}`,"POST",{action:"pause",version:1,reason:"Await source reply",pauseReason:"unknown"})).status,400);
    const paused=await request("head",`case-sla/${id}`,"POST",{action:"pause",version:1,reason:"Await source reply",pauseReason:"awaiting_response"});assert.equal(paused.status,200);assert.equal(paused.body.clock.pauses.length,1);
    assert.equal((await request("head",`case-sla/${id}`,"POST",{action:"resume",version:1,reason:"Source has responded"})).status,409);
    assert.equal((await request("head",`case-sla/${id}`,"POST",{action:"recalculate",version:2,reason:"Review current policy"})).status,400);
    const resumed=await request("head",`case-sla/${id}`,"POST",{action:"resume",version:2,reason:"Source has responded"});assert.equal(resumed.status,200);assert.ok(resumed.body.clock.pauses[0].to);assert.equal(resumed.body.clock.history.at(-1).action,"resume");
  });
  const alertCase=await create("SLA_ALERT_DEDUP","2027-02-10"),due=new Date("2027-02-03T08:00:00Z");
  const cycle=(now:Date,adapters?:NotificationAdapter[])=>work(()=>evaluatePolicySlaCycle({...DEFAULT_ESCALATION_CONFIG,autoEscalateOverdueDays:10000},now,adapters));
  await check("T-7 alert is scoped, deduplicated and honestly disabled by default",async()=>{
    await cycle(due);const rows=(await request("officer","sla-alerts")).body,alert=rows.find((row:any)=>row.kind==="T-7"&&row.caseIds.includes(alertCase.id));assert.ok(alert);assert.ok(alert.deliveries.every((row:any)=>row.status==="disabled"));
    assert.equal((await request("peer","sla-alerts")).body.some((row:any)=>row.caseIds.includes(alertCase.id)),false);
    const count=await work(()=>store.getSlaOperations().deliveries.length);await cycle(due);assert.equal(await work(()=>store.getSlaOperations().deliveries.length),count);
    assert.equal((await request("peer",`sla-alerts/${alert.id}/acknowledge`,"POST",{})).status,404);
    assert.equal((await request("officer",`sla-alerts/${alert.id}/acknowledge`,"POST",{})).status,200);assert.equal((await request("officer",`sla-alerts/${alert.id}/acknowledge`,"POST",{})).status,200);
    await cycle(new Date("2027-02-03T09:00:00Z"));const saved=await work(()=>store.getCoordinationSource(alertCase.id)!);assert.equal(saved.expectedDisposalDate,"2027-02-10");assert.notEqual(saved.status,"Disposed");
  });
  await check("T-3, T-1, due-today and overdue conditions generate distinct review alerts",async()=>{
    for(const [day,kind]of [["2027-02-07","T-3"],["2027-02-09","T-1"],["2027-02-10","DueToday"],["2027-02-11","Overdue"]]){await cycle(new Date(day+"T08:00:00Z"));assert.ok((await request("officer","sla-alerts")).body.some((row:any)=>row.kind===kind&&row.caseIds.includes(alertCase.id)),kind);}
  });
  await check("No-action alerts use human history and newly sealed cases disappear from alerts and notifications",async()=>{
    const rows=(await request("officer","sla-alerts")).body;assert.ok(rows.some((row:any)=>row.kind==="NoAction"&&row.caseIds.includes(alertCase.id)));
    const policy=(await request("authority",`case-security/${alertCase.id}`)).body;
    assert.equal((await request("authority",`case-security/${alertCase.id}`,"PUT",{version:policy.version,level:"sealed",grants:[],reason:"Verify alert access is revoked"})).status,200);
    assert.equal((await request("officer",`case-sla/${alertCase.id}`)).status,404);
    assert.ok(!(await request("officer","sla-alerts")).body.some((row:any)=>row.caseIds.includes(alertCase.id)));
    assert.ok(!(await request("officer","notifications")).body.some((row:any)=>row.referenceId===alertCase.id));
  });
  await check("Confirmed duplicate storms require current full access to every affected case",async()=>{
    const a=await create("SLA_CONFIRMED_DUPLICATE");
    const response=await request("target","complaints","POST",{institutionId:"north",category:"Faculty Shortage / Irregularities",title:"SLA_CROSS_BUREAU_DUPLICATE",description:"Synthetic complaint for human duplicate confirmation",receivingBureauId:"PGRC",priority:"Medium"});assert.equal(response.status,201);const b=response.body.complaint;
    const alert=(await request("authority","overlaps?limit=100")).body.data.find((row:any)=>[row.complaintIdA,row.complaintIdB].includes(a.id)&&[row.complaintIdA,row.complaintIdB].includes(b.id));assert.ok(alert);
    assert.equal((await request("authority",`overlaps/${alert.id}/review`,"POST",{decision:"Confirmed Duplicate",remarks:"Human fixture review confirms duplicate submissions"})).status,200);
    await cycle(new Date());
    assert.ok((await request("authority","sla-alerts")).body.some((row:any)=>row.kind==="DuplicateStorm"&&row.caseIds.includes(a.id)&&row.caseIds.includes(b.id)));
    assert.ok(!(await request("head","sla-alerts")).body.some((row:any)=>row.kind==="DuplicateStorm"&&row.caseIds.includes(a.id)));
  });
  await check("Failed adapter attempts use bounded retries and preserve a final failed status",async()=>{
    const retryCase=await create("SLA_RETRY_FIXTURE","2027-03-10"),failing:NotificationAdapter={channel:"email",send(){throw new Error("Disposable failure");}};const start=new Date("2027-03-03T08:00:00Z");
    await cycle(start,[failing]);const delivery=await work(()=>{const operations=store.getSlaOperations(),alert=operations.alerts.find(row=>row.recipientId==="officer"&&row.kind==="T-7"&&row.caseIds.includes(retryCase.id))!;return operations.deliveries.find(row=>row.alertId===alert.id&&row.channel==="email")!;});assert.equal(delivery.attempts,1);assert.equal(delivery.status,"failed");
    await cycle(new Date(start.getTime()+60000),[failing]);assert.equal(await work(()=>store.getSlaOperations().deliveries.find(row=>row.id===delivery.id)!.attempts),1);
    await cycle(new Date(start.getTime()+120000),[failing]);await cycle(new Date(start.getTime()+360000),[failing]);await cycle(new Date(start.getTime()+420000),[failing]);
    const final=await work(()=>store.getSlaOperations().deliveries.find(row=>row.id===delivery.id)!);assert.equal(final.attempts,3);assert.equal(final.status,"failed");assert.equal(final.nextAttemptAt,undefined);assert.equal(final.history?.length,3);
  });
  await check("Development simulation is never reported as real delivery and is disabled in production",async()=>{
    const previous=process.env.NOTIFICATION_DELIVERY_MODE,environment=process.env.NODE_ENV;try{process.env.NOTIFICATION_DELIVERY_MODE="development";const adapter=new DevelopmentNotificationAdapter("sms");assert.equal(adapter.send({} as any).status,"simulated");process.env.NODE_ENV="production";assert.equal(adapter.send({} as any).status,"disabled");}finally{process.env.NODE_ENV=environment;if(previous===undefined)delete process.env.NOTIFICATION_DELIVERY_MODE;else process.env.NOTIFICATION_DELIVERY_MODE=previous;}
  });
  await check("Rollback appends a new configuration and preserves all applied case policy snapshots",async()=>{
    const result=await request("admin","admin/sla-policies","PUT",{version:current.version,reason:"Restore reviewed operational defaults",rollbackTo:1});assert.equal(result.status,200);assert.equal(result.body.current.version,3);assert.equal(result.body.current.rollbackOf,1);assert.equal(result.body.current.policies.find((row:any)=>row.id==="fixture-business").enabled,false);
    assert.equal((await request("head",`case-sla/${id}`)).body.clock.configurationVersion,2);
  });
}
