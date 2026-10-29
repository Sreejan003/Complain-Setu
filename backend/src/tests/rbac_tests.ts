import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

// Run against a disposable database; never seed/reset the user's database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iicmcs-rbac-"));
process.env.DATA_DIR = dir;
process.env.PORT = process.env.RBAC_UI_SERVER === "true" ? process.env.RBAC_UI_PORT || "52901" : "0";
if(process.env.RBAC_UI_SERVER === "true") process.env.CORS_ORIGIN=`http://127.0.0.1:${process.env.PORT}`;
process.env.NODE_ENV = "test";
const timestamp = new Date().toISOString();
const password = "RbacTestOnly!2026";
const hash = bcrypt.hashSync(password, 4);
const user = (id:string,role:string,bureauId?:string,extra={}) => ({id,role,bureauId,email:`${id}@example.test`,fullName:id,passwordHash:hash,isActive:true,permissions:["APPROVE_TRANSFERS","APPROVE_ESCALATIONS","COORDINATE_CROSS_BUREAU"],createdAt:timestamp,updatedAt:timestamp,...extra});
const users = [user("admin","SYSTEM_ADMIN"),user("authority","COMPETENT_AUTHORITY"),user("rb-head","BUREAU_HEAD","RB"),user("pgrc-head","BUREAU_HEAD","PGRC"),user("officer","CASE_OFFICER","RB"),user("other","CASE_OFFICER","RB"),user("unscoped","CASE_OFFICER"),user("disabled","CASE_OFFICER","RB",{isActive:false})];
const complaint = (id:string,bureau:string,assignedOfficerId:string) => ({id,complaintId:id,institutionId:"inst",aictePermanentId:"PERM-1",institutionName:"Test Institution",category:"Faculty Shortage / Irregularities",title:`Title ${id}`,description:`Confidential ${id}`,receivedDate:timestamp.slice(0,10),expectedDisposalDate:"2099-01-01",receivingBureauId:bureau,currentBureauId:bureau,assignedOfficerId,status:"Pending",priority:"Medium",hasOverlapAlert:true,createdAt:timestamp,updatedAt:timestamp});
const cases = [complaint("rb-own","RB","officer"),complaint("rb-other","RB","other"),complaint("pgrc","PGRC","external")];
fs.writeFileSync(path.join(dir,"db.json"),JSON.stringify({profiles:users,institutions:[{id:"inst",aictePermanentId:"PERM-1",name:"Test Institution",region:"Test Region"}],complaints:cases,caseHistory:[],caseTransfers:[],relatedCases:[],notifications:[],auditLogs:[],documents:[],overlapAlerts:[{id:"overlap",alertId:"OVL-1",institutionId:"inst",complaintIdA:"rb-own",complaintIdB:"pgrc",complaintDescA:"Confidential rb-own",complaintDescB:"Confidential pgrc",bureauA:"RB",bureauB:"PGRC",alertStatus:"Pending Review",createdAt:timestamp}],meta:{lastReset:timestamp,version:"1"}}));
const {default:app,server} = await import("../server.js");
if (!server.listening) await new Promise<void>(resolve=>server.once("listening",()=>resolve()));
const address = server.address() as {port:number};
const base = `http://127.0.0.1:${address.port}/api/`;
const tokens:Record<string,string> = {};
let passed=0;
async function request(actor:string,route:string,method="GET",body?:unknown) {
  const res=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:res.headers.get("content-type")?.includes("json")?await res.json():await res.text()};
}
async function test(name:string,fn:()=>Promise<void>){await fn();passed++;console.log(`PASS ${name}`);}
try {
  for (const id of ["admin","authority","rb-head","pgrc-head","officer","other","unscoped"]) {
    const r=await request("", "auth/login","POST",{email:`${id}@example.test`,password});
    assert.equal(r.status,200);tokens[id]=r.body.token;
  }
  await test("Authentication required and disabled accounts rejected",async()=>{
    assert.equal((await request("","complaints")).status,401);
    assert.equal((await request("","auth/login","POST",{email:"disabled@example.test",password})).status,401);
  });
  await test("All four roles receive correct scoped case totals",async()=>{
    for(const [id,total] of [["authority",3],["rb-head",2],["pgrc-head",1],["officer",1],["unscoped",0]] as const){
      const r=await request(id,"complaints?institutionId=inst&assignedOfficerId=other");
      assert.equal(r.status,200);
      // Explicit filters intersect scope and never broaden it.
      if(id==="officer"||id==="unscoped") assert.equal(r.body.pagination.total,0);
      const all=await request(id,"complaints");assert.equal(all.body.pagination.total,total);
    }
  });
  await test("Administrator cannot read or decide complaints",async()=>{
    for(const route of ["complaints","complaints/rb-own","analytics/dashboard","analytics/export-csv","overlaps","transfers"]) assert.equal((await request("admin",route)).status,403);
    assert.equal((await request("admin","complaints/rb-own/status","PATCH",{status:"Under Process",remarks:"forbidden"})).status,403);
    assert.equal((await request("admin","admin/summary")).status,200);
  });
  await test("Officer and heads cannot use direct IDs to cross scope",async()=>{
    for(const route of ["complaints/rb-other","complaints/rb-other/history","complaints/rb-other/documents"]) assert.equal((await request("officer",route)).status,404);
    assert.equal((await request("rb-head","complaints/pgrc/status","PATCH",{status:"Under Process",remarks:"forbidden"})).status,404);
  });
  await test("All official roles share institution aggregates while case content remains separately authorized",async()=>{
    for(const [actor,authorized] of [["admin",0],["authority",3],["rb-head",2],["officer",1]] as const){
      const directory=await request(actor,"institutions?search=PERM-1");assert.equal(directory.status,200);assert.equal(directory.body.data.length,1);assert.equal(directory.body.data[0].totalComplaintsCount,3);
      const metrics=await request(actor,"institutions/inst/dashboard-metrics");assert.equal(metrics.status,200);assert.equal(metrics.body.kpis.totalComplaints,3);assert.equal(metrics.body.bureauInvolvement.length,2);
      const profile=await request(actor,"institutions/PERM-1");assert.equal(profile.status,200);assert.equal(profile.body.complaints.length,authorized);
      const text=JSON.stringify(metrics.body);if(actor==="admin")assert.ok(!text.includes("Confidential"));if(actor==="officer")assert.ok(!text.includes("Confidential rb-other")&&!text.includes("Confidential pgrc"));
      assert.equal((await request(actor,"institutions?bureau=NONEXISTENT")).body.pagination.total,0);
      assert.equal((await request(actor,"institutions?complaintStatus=Disposed")).body.pagination.total,0);
      assert.equal((await request(actor,"institutions?state=MissingState")).body.pagination.total,0);
    }
    const {requestScope}=await import("../security/rbac.js");const {store}=await import("../db/store.js");
    for(const role of ["SYSTEM_ADMIN","COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"]){
      requestScope.run({...users[0],role,region:"Different Region"} as any,()=>{assert.equal(store.getInstitutions({}).pagination.total,0);assert.equal(store.getInstitutionById("inst"),undefined);assert.equal(store.getInstitutionOverview("inst"),undefined);});
    }
    assert.equal((await request("admin","institutions/inst/documents")).body.length,0);
  });
  await test("Reports, dashboard counts and CSV use the same scope",async()=>{
    const d=await request("officer","analytics/role-dashboard");assert.equal(d.body.kpi.totalComplaints,1);
    const csv=await request("officer","analytics/export-csv");assert.equal(csv.status,200);assert.ok(csv.body.includes('"rb-own"'));assert.ok(!csv.body.includes('"rb-other"'));assert.ok(!csv.body.includes('"pgrc"'));
  });
  await test("Related overlap view redacts the other bureau narrative",async()=>{
    const r=await request("officer","overlaps/overlap");assert.equal(r.status,200);assert.equal(r.body.alert.complaintDescB,"");assert.ok(!r.body.complaintB);
    assert.equal((await request("other","overlaps/overlap")).status,404);
    assert.equal((await request("officer","overlaps/overlap/review","POST",{decision:"Resolved",remarks:"forbidden"})).status,403);
  });
  await test("Officer updates assigned cases but cannot self-assign or approve disposal",async()=>{
    assert.equal((await request("officer","complaints/rb-own/status","PATCH",{status:"Under Process",remarks:"Investigation begun",nextAction:"Request records",nextActionDate:"2098-12-01"})).status,200);
    assert.equal((await request("officer","complaints/rb-own/status","PATCH",{status:"Disposed",remarks:"forbidden"})).status,403);
    assert.equal((await request("officer","complaints/rb-own/status","PATCH",{assignedOfficerId:"other",remarks:"forbidden"})).status,403);
    const h=await request("officer","complaints/rb-own/history");assert.equal(h.body[0].performedBy,"officer");
  });
  await test("Heads can assign only eligible officers in their bureau",async()=>{
    assert.equal((await request("rb-head","complaints/rb-other/status","PATCH",{assignedOfficerId:"authority",remarks:"forbidden"})).status,400);
    assert.equal((await request("rb-head","complaints/rb-other/status","PATCH",{assignedOfficerId:"officer",remarks:"Workload reassignment"})).status,200);
    const users=await request("rb-head","admin/users");assert.ok(users.body.every((u:any)=>u.bureauId==="RB"&&u.role==="CASE_OFFICER"&&!u.passwordHash));
  });
  await test("Transfer ownership changes only after receiving head approval",async()=>{
    assert.equal((await request("officer","transfers","POST",{complaintId:"rb-own",toBureauId:"PGRC",transferReason:"forbidden"})).status,403);
    const t=await request("rb-head","transfers","POST",{complaintId:"rb-own",toBureauId:"PGRC",transferReason:"Jurisdiction review"});assert.equal(t.status,201);assert.equal(t.body.acceptanceStatus,"Pending");
    assert.equal((await request("officer","complaints/rb-own")).status,200);
    assert.equal((await request("rb-head",`transfers/${t.body.id}/respond`,"PATCH",{action:"Accepted",remarks:"forbidden"})).status,403);
    assert.equal((await request("pgrc-head",`transfers/${t.body.id}/respond`,"PATCH",{action:"Accepted",remarks:"Accepted jurisdiction"})).status,200);
    assert.equal((await request("officer","complaints/rb-own")).status,404);
  });
  await test("Administration denies self-elevation and preserves audit and data",async()=>{
    assert.equal((await request("officer","admin/users","POST",{role:"SYSTEM_ADMIN"})).status,403);
    assert.equal((await request("admin","admin/users/admin","PUT",{})).status,403);
    assert.equal((await request("admin","admin/reset-demo-data","POST",{})).status,403);
    const logs=await request("admin","admin/audit-logs");assert.ok(logs.body.some((l:any)=>l.action==="LOGIN_SUCCESS"));assert.ok(logs.body.every((l:any)=>l.entityType!=="Complaint"));
    const cases=await request("authority","complaints");assert.equal(cases.body.pagination.total,3);
  });
  await test("Officer requests preserve case state and enter the action timeline",async()=>{
    const before=await request("other","complaints/rb-other");
    // This case was reassigned above; the previous officer has lost access.
    assert.equal(before.status,404);
    const r=await request("officer","complaints/rb-other/requests","POST",{type:"Escalation",remarks:"Please review the jurisdiction decision"});
    assert.equal(r.status,201);
    const c=await request("officer","complaints/rb-other");assert.equal(c.body.complaint.status,"Pending");
    assert.ok(c.body.history.some((h:any)=>h.actionType==="Escalation Requested"));
  });
  await test("Account administration persists scope and revokes disabled sessions",async()=>{
    const body={email:"new-officer@example.test",fullName:"New officer",role:"CASE_OFFICER",bureauId:"RB",region:"",isActive:true,password};
    const created=await request("admin","admin/users","POST",body);assert.equal(created.status,201);assert.ok(!created.body.passwordHash);
    const login=await request("","auth/login","POST",{email:body.email,password});assert.equal(login.status,200);tokens.new=login.body.token;
    assert.equal((await request("new","complaints")).body.pagination.total,0);
    assert.equal((await request("admin",`admin/users/${created.body.id}`,"PUT",{...body,isActive:false,password:""})).status,200);
    assert.equal((await request("new","auth/me")).status,403);
  });
  await test("Nondelegated supervisory accounts cannot approve transfers",async()=>{
    const body={email:"limited-head@example.test",fullName:"Limited head",role:"BUREAU_HEAD",bureauId:"RB",region:"",isActive:true,password,permissions:[]};
    assert.equal((await request("admin","admin/users","POST",body)).status,201);
    const login=await request("","auth/login","POST",{email:body.email,password});tokens.limited=login.body.token;
    assert.equal((await request("limited","transfers/anything/respond","PATCH",{action:"Accepted",remarks:"forbidden"})).status,403);
  });
  await test("Logout invalidates the server session token",async()=>{
    assert.equal((await request("other","auth/logout","POST",{})).status,200);
    assert.equal((await request("other","auth/me")).status,403);
  });
  await test("Structured escalation review updates request, case and attributed audit together",async()=>{
    const list=await request("authority","complaints/rb-other/requests");
    const pending=list.body.find((r:any)=>r.type==="Escalation"&&r.status==="Pending");assert.ok(pending?.canReview);
    const c=await request("authority","complaints/rb-other");
    const decision=await request("authority",`complaints/rb-other/requests/${pending.id}/decision`,"PATCH",{decision:"Approved",remarks:"Escalation authorized",caseVersion:c.body.complaint.updatedAt});
    assert.equal(decision.status,200);assert.equal(decision.body.status,"Approved");assert.equal(decision.body.reviewedBy,"authority");
    const after=await request("officer","complaints/rb-other");assert.equal(after.body.complaint.status,"Escalated");assert.ok(after.body.history.some((h:any)=>h.actionType==="Escalation Request Approved"));
    assert.equal((await request("authority",`complaints/rb-other/requests/${pending.id}/decision`,"PATCH",{decision:"Approved",remarks:"Replay",caseVersion:after.body.complaint.updatedAt})).status,409);
  });
  await test("Officer dashboard uses next action date, not disposal date, for due-today actions",async()=>{
    assert.equal((await request("officer","complaints/rb-other/status","PATCH",{remarks:"Plan next action",nextAction:"Review records today",nextActionDate:timestamp.slice(0,10)})).status,200);
    const d=await request("officer","analytics/role-dashboard?view=today");
    assert.equal(d.body.metrics.find((m:any)=>m.label==="Actions Due Today").value,1);assert.equal(d.body.cases.pagination.total,1);
    assert.equal(d.body.cases.data[0].id,"rb-other");assert.notEqual(d.body.cases.data[0].expectedDisposalDate,timestamp.slice(0,10));
    const actions=(await request("officer","complaints/rb-other")).body.allowedActions;
    assert.equal(actions.assign,false);assert.equal(actions.transfer,false);assert.equal(actions.request,true);assert.ok(!actions.permittedStatuses.includes("Disposed"));
  });
  await test("Eligible-officer lookup is scoped and administration rejects officer delegations",async()=>{
    assert.equal((await request("officer","complaints/rb-other/eligible-officers")).status,403);
    const eligible=await request("rb-head","complaints/rb-other/eligible-officers");assert.equal(eligible.status,200);assert.ok(eligible.body.every((p:any)=>p.bureauId==="RB"));
    assert.equal((await request("admin","admin/users","POST",{email:"bad-flags@example.test",fullName:"Invalid officer",role:"CASE_OFFICER",bureauId:"RB",isActive:true,password,permissions:["APPROVE_TRANSFERS"]})).status,400);
    const users=await request("admin","admin/users?paginated=true&limit=2&page=1&role=CASE_OFFICER");assert.equal(users.body.data.length,2);assert.ok(users.body.pagination.total>2);assert.ok(users.body.data.every((u:any)=>!u.passwordHash));
    const summary=await request("admin","admin/summary");assert.ok(Number.isInteger(summary.body.inactiveUsers));
  });
  await test("Stale requests cannot apply an old recommendation and can be explicitly rejected",async()=>{
    const r=await request("officer","complaints/rb-other/requests","POST",{type:"Coordination",remarks:"Please coordinate"});assert.equal(r.status,201);
    assert.equal((await request("officer","complaints/rb-other/status","PATCH",{remarks:"New facts recorded",nextAction:"Updated task"})).status,200);
    const c=(await request("authority","complaints/rb-other")).body.complaint;
    const path=`complaints/rb-other/requests/${r.body.id}/decision`;
    assert.equal((await request("authority",path,"PATCH",{decision:"Approved",remarks:"Stale approval",caseVersion:c.updatedAt})).status,409);
    assert.equal((await request("authority",path,"PATCH",{decision:"Rejected",remarks:"Superseded by updated case facts",caseVersion:c.updatedAt})).status,200);
    assert.equal((await request("officer","complaints/rb-other/requests")).body.find((q:any)=>q.id===r.body.id).status,"Rejected");
  });
  await test("Bureau and region filters and delegations never enlarge authority scope",async()=>{
    const body={email:"scoped-authority@example.test",fullName:"Scoped authority",role:"COMPETENT_AUTHORITY",bureauId:"PGRC",region:"Different Region",isActive:true,password,permissions:["APPROVE_TRANSFERS"]};
    const created=await request("admin","admin/users","POST",body);assert.equal(created.status,201);
    const login=await request("","auth/login","POST",{email:body.email,password});tokens.scoped=login.body.token;
    assert.equal((await request("scoped","analytics/role-dashboard?bureau=RB&region=Test%20Region")).body.kpi.totalComplaints,0);
    assert.equal((await request("scoped","complaints/rb-other")).status,404);
    const changed=await request("admin",`admin/users/${created.body.id}`,"PUT",{...body,permissions:[],password:""});assert.equal(changed.status,200);
    assert.equal((await request("scoped","auth/me")).status,403);
  });
  await test("Transfer request and rejection preserve case status, ownership and timeline truth",async()=>{
    const c=(await request("rb-head","complaints/rb-other")).body.complaint;
    const t=await request("rb-head","transfers","POST",{complaintId:c.id,toBureauId:"PGRC",transferReason:"Review bureau jurisdiction"});assert.equal(t.status,201);
    const pending=(await request("rb-head","complaints/rb-other")).body;
    assert.equal(pending.complaint.status,c.status);assert.equal(pending.complaint.currentBureauId,"RB");assert.ok(pending.history.some((h:any)=>h.actionType==="Transfer Requested"&&h.toStatus===c.status));
    assert.equal((await request("pgrc-head",`transfers/${t.body.id}/respond`,"PATCH",{action:"Rejected",remarks:"Current bureau retains jurisdiction"})).status,200);
    const after=(await request("officer","complaints/rb-other")).body.complaint;assert.equal(after.status,c.status);assert.equal(after.currentBureauId,"RB");
  });
  await test("Ordinary URL token transport is rejected",async()=>{
    assert.equal((await request("",`analytics/export-csv?token=${encodeURIComponent(tokens.officer)}`)).status,401);
  });
  await test("Evidence metadata and file downloads enforce assigned-case scope",async()=>{
    const {store}=await import("../db/store.js");
    fs.mkdirSync(path.join(dir,"uploads"),{recursive:true});fs.writeFileSync(path.join(dir,"uploads","evidence.pdf"),"%PDF-1.4 test evidence");
    store.addDocument({id:"evidence",complaintId:"rb-other",fileName:"evidence.pdf",originalName:"evidence.pdf",fileSize:22,mimeType:"application/pdf",fileUrl:"",documentType:"Complaint Evidence",uploadedBy:"officer",uploadedByName:"Officer",uploadedAt:timestamp});
    assert.equal((await request("admin","complaints/rb-other/documents/evidence/download")).status,403);
    assert.equal((await request("pgrc-head","complaints/rb-other/documents/evidence/download")).status,404);
    const file=await request("officer","complaints/rb-other/documents/evidence/download");assert.equal(file.status,200);assert.ok(file.body.startsWith("%PDF"));
    assert.equal((await request("officer","complaints/rb-other/status","PATCH",{status:"Under Process",remarks:"Try to undo supervisory escalation"})).status,403);
  });
  await test("Unknown role accounts cannot authenticate",async()=>{
    const {store}=await import("../db/store.js");
    store.saveProfile({...users[0],id:"unknown",email:"unknown@example.test",role:"UNRECOGNIZED" as any});
    assert.equal((await request("","auth/login","POST",{email:"unknown@example.test",password})).status,401);
  });
  await test("CSV export spans all result pages without exposing other scoped cases",async()=>{
    const {store}=await import("../db/store.js");
    // Fixture-only rows in this process's explicitly disposable DATA_DIR.
    const previous=(store as any).data.complaints;
    try {
      (store as any).data.complaints=[...previous,...Array.from({length:105},(_,i)=>({...cases[0],id:`export-${i}`,complaintId:`EXPORT-${i}`,currentBureauId:"RB",assignedOfficerId:"officer"}))];
      const csv=await request("officer","analytics/export-csv");assert.equal(csv.status,200);assert.ok(csv.body.includes('"EXPORT-104"'));assert.ok(!csv.body.includes('"pgrc"'));
      const dashboard=await request("officer","analytics/role-dashboard?view=all&page=2");assert.equal(dashboard.body.cases.data.length,10);assert.equal(dashboard.body.kpi.totalComplaints,106);
    } finally {(store as any).data.complaints=previous;}
  });
  await test("Failed local-store transactions roll back memory and disk",async()=>{
    const {store}=await import("../db/store.js");
    const before=fs.readFileSync(path.join(dir,"db.json"),"utf8");const name=store.getProfileById("officer")!.fullName;
    assert.throws(()=>store.transaction(()=>{store.saveProfile({...store.getProfileById("officer")!,fullName:"Not committed"});throw new Error("Simulated workflow failure");}));
    assert.equal(store.getProfileById("officer")!.fullName,name);assert.equal(fs.readFileSync(path.join(dir,"db.json"),"utf8"),before);
  });
  await test("Live events and request notifications do not leak across assignments",async()=>{
    const relogin=await request("","auth/login","POST",{email:"other@example.test",password});tokens.other=relogin.body.token;
    const a=new AbortController(),b=new AbortController();
    try {
      const own=await fetch(base+"complaints/stream/live",{headers:{Authorization:`Bearer ${tokens.officer}`},signal:a.signal});
      const unrelated=await fetch(base+"complaints/stream/live",{headers:{Authorization:`Bearer ${tokens.other}`},signal:b.signal});
      const ownReader=own.body!.getReader(),otherReader=unrelated.body!.getReader();await ownReader.read();await otherReader.read();
      const {broadcastCaseEvent}=await import("../routes/complaints.js");broadcastCaseEvent({type:"CASE_UPDATED",complaintId:"rb-other"});
      const event=await Promise.race([ownReader.read(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("Missing scoped live event")),1500))]);assert.ok(new TextDecoder().decode(event.value).includes("rb-other"));
      const leaked=await Promise.race([otherReader.read().then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),150))]);assert.equal(leaked,false);
      const notifications=await request("other","notifications");assert.ok(notifications.body.every((n:any)=>n.referenceId!=="rb-other"));
    } finally {a.abort();b.abort();}
  });
  await test("Disposal recommendations require a supervisor and reopening remains authority-only",async()=>{
    const submitted=await request("officer","complaints/rb-other/requests","POST",{type:"Disposal",remarks:"Investigation complete; recommend disposal"});assert.equal(submitted.status,201);
    const before=(await request("rb-head","complaints/rb-other")).body.complaint;assert.equal(before.status,"Escalated");
    const path=`complaints/rb-other/requests/${submitted.body.id}/decision`;
    assert.equal((await request("officer",path,"PATCH",{decision:"Approved",remarks:"Self approval",caseVersion:before.updatedAt})).status,403);
    assert.equal((await request("rb-head",path,"PATCH",{decision:"Approved",remarks:"Disposal approved after review",caseVersion:before.updatedAt})).status,200);
    assert.equal((await request("officer","complaints/rb-other")).body.complaint.status,"Disposed");
    assert.equal((await request("rb-head","complaints/rb-other/status","PATCH",{status:"Under Process",remarks:"Head cannot reopen"})).status,403);
    assert.equal((await request("authority","complaints/rb-other/status","PATCH",{status:"Under Process",remarks:"Authorized reopening for new evidence"})).status,200);
  });
  await test("Transfer recommendations retain a personal receipt without granting former case access",async()=>{
    const submitted=await request("officer","complaints/rb-other/requests","POST",{type:"Transfer",remarks:"Request jurisdiction review",destinationBureauId:"PGRC"});assert.equal(submitted.status,201);
    const c=(await request("rb-head","complaints/rb-other")).body.complaint;
    const approved=await request("rb-head",`complaints/rb-other/requests/${submitted.body.id}/decision`,"PATCH",{decision:"Approved",remarks:"Approve transfer request for destination review",caseVersion:c.updatedAt});assert.equal(approved.status,200);assert.ok(approved.body.transferId);
    assert.equal((await request("officer","complaints/rb-other")).body.complaint.currentBureauId,"RB");
    assert.equal((await request("pgrc-head",`transfers/${approved.body.transferId}/respond`,"PATCH",{action:"Accepted",remarks:"Destination accepts jurisdiction"})).status,200);
    assert.equal((await request("officer","complaints/rb-other")).status,404);
    const dashboard=(await request("officer","analytics/role-dashboard")).body;
    const receipt=dashboard.requests.data.find((r:any)=>r.id===submitted.body.id);assert.equal(receipt.status,"Approved");assert.equal(receipt.caseAccessible,false);assert.equal(dashboard.kpi.totalComplaints,0);
    // Return the disposable fixture case through the same controlled workflow for UI inspection.
    const returned=await request("pgrc-head","transfers","POST",{complaintId:"rb-other",toBureauId:"RB",toOfficerId:"officer",transferReason:"Joint review confirms RB jurisdiction"});assert.equal(returned.status,201);
    assert.equal((await request("rb-head",`transfers/${returned.body.id}/respond`,"PATCH",{action:"Accepted",remarks:"RB accepts return assignment"})).status,200);
  });
  await test("Every role KPI opens a queue with the population it counts",async()=>{
    for(const actor of ["authority","rb-head","officer"]) {
      const initial=(await request(actor,"analytics/role-dashboard")).body;
      for(const metric of initial.metrics) {
        const filtered=(await request(actor,`analytics/role-dashboard?view=${metric.view}`)).body;
        const actual=["decisions","overlaps"].includes(metric.view)?filtered.decisions.pagination.total:filtered.cases.pagination.total;
        assert.equal(actual,metric.value,`${actor}: ${metric.label}`);
      }
    }
  });
  await test("Legacy aliases normalize centrally and regional Bureau Heads remain restricted",async()=>{
    const {store}=await import("../db/store.js");
    store.saveProfile({...users[4],id:"legacy",role:"Regulation Bureau Officer",bureauId:undefined,email:"legacy@example.test"});
    const legacy=await request("","auth/login","POST",{email:"legacy@example.test",password});assert.equal(legacy.status,200);assert.equal(legacy.body.user.role,"CASE_OFFICER");assert.equal(legacy.body.user.bureauId,"RB");
    const body={email:"regional-head@example.test",fullName:"Regional Head",role:"BUREAU_HEAD",bureauId:"RB",region:"Outside Region",isActive:true,password,permissions:["APPROVE_TRANSFERS"]};
    assert.equal((await request("admin","admin/users","POST",body)).status,201);
    tokens.regional=(await request("","auth/login","POST",{email:body.email,password})).body.token;
    assert.equal((await request("regional","complaints/rb-other")).status,404);assert.equal((await request("regional","analytics/role-dashboard?region=Test%20Region&bureau=RB")).body.kpi.totalComplaints,0);
  });
  await test("SLA settings persist and manual system monitoring runs without granting case content access",async()=>{
    const config=(await request("admin","admin/sla-config")).body;
    assert.equal((await request("officer","admin/sla-config","PUT",{approachingDeadlineDays:4})).status,403);
    assert.equal((await request("admin","admin/sla-config","PUT",{...config,approachingDeadlineDays:4})).status,200);
    const {Store}=await import("../db/store.js");assert.equal(new Store().getSlaSettings()?.approachingDeadlineDays,4);
    assert.equal((await request("officer","analytics/role-dashboard")).body.threshold,4);
    const run=await request("admin","admin/run-sla-scheduler","POST",{});assert.equal(run.status,200);assert.ok(run.body.result.scannedComplaints>0);
    assert.equal((await request("admin","complaints/rb-other")).status,403);
    assert.equal((await request("admin","admin/sla-config","PUT",config)).status,200);
  });
  const {coordinationScenarios}=await import("./coordination_scenarios.js");
  await test("Cross-Bureau collaborative coordination lifecycle and record isolation",()=>coordinationScenarios(request,tokens,base,password));
  console.log(`${passed} RBAC integration scenarios passed; live database untouched.`);
} finally {
  if(process.env.RBAC_UI_SERVER==="true") {
    const express=(await import("express")).default;
    const root=path.resolve("../frontend/dist");
    app.post("/__test/shutdown",(_req,res)=>{res.json({closed:true});server.close(()=>process.exit(0));});
    app.use(express.static(root));app.get("*",(_req,res)=>res.sendFile(path.join(root,"index.html")));
    console.log(`Isolated UI fixture available at http://127.0.0.1:${address.port}`);
  } else await new Promise<void>(resolve=>server.close(()=>resolve()));
}
