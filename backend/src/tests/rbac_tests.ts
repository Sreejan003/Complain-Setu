import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

// Run against a disposable database; never seed/reset the user's database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iicmcs-rbac-"));
process.env.DATA_DIR = dir;
process.env.PORT = "0";
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
    for(const route of ["complaints","complaints/rb-own","analytics/dashboard","analytics/export-csv","institutions/inst","overlaps","transfers"]) assert.equal((await request("admin",route)).status,403);
    assert.equal((await request("admin","complaints/rb-own/status","PATCH",{status:"Under Process",remarks:"forbidden"})).status,403);
    assert.equal((await request("admin","admin/summary")).status,200);
  });
  await test("Officer and heads cannot use direct IDs to cross scope",async()=>{
    for(const route of ["complaints/rb-other","complaints/rb-other/history","complaints/rb-other/documents"]) assert.equal((await request("officer",route)).status,404);
    assert.equal((await request("rb-head","complaints/pgrc/status","PATCH",{status:"Under Process",remarks:"forbidden"})).status,404);
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
  console.log(`${passed} RBAC integration scenarios passed; live database untouched.`);
} finally {
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
