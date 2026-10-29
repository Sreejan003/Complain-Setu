import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Store } from "../db/store.js";
type Result={status:number;body:any};
export async function runCaseFamilyChecks(context:{request:(actor:string,route:string,method?:string,body?:unknown)=>Promise<Result>;check:(name:string,operation:()=>Promise<void>)=>Promise<void>;work:<T>(operation:()=>Promise<T>|T)=>Promise<T>;store:Store;base:string;tokens:Record<string,string>}) {
  const {request,check,work,store,base,tokens}=context;
  async function create(actor:string,bureau:string,title:string,institutionId="north"){
    const result=await request(actor,"complaints","POST",{institutionId,category:"Faculty Shortage / Irregularities",title,description:"Synthetic family review; original evidence and source obligations retained.",receivingBureauId:bureau,assignedOfficerId:bureau==="RB"?"officer":undefined,priority:"Medium"});assert.equal(result.status,201,JSON.stringify(result.body));return result.body.complaint;
  }
  const a=await create("head","RB","FAMILY_SOURCE_FIXTURE"),b=await create("target","PGRC","FAMILY_CANONICAL_FIXTURE"),c=await create("head","RB","FAMILY_SECOND_ROOT"),other=await create("head","RB","FAMILY_OTHER_INSTITUTION","south");
  const prepare=(sourceId=a.id,canonicalId=b.id,overrides={})=>request("authority","case-family/merges/prepare","POST",{sourceId,canonicalId,reason:"Synthetic reviewed canonical case selection",requestId:randomUUID(),...overrides});
  await check("Family nodes and relationships enforce assignment, Bureau, region and official-role boundaries",async()=>{
    for(const actor of ["admin","institution-user"])assert.equal((await request(actor,"case-family/institutions/north")).status,403);
    const mine=(await request("officer","case-family/institutions/north")).body;assert.ok(mine.nodes.some((row:any)=>row.id===a.id));assert.ok(!mine.nodes.some((row:any)=>row.id===b.id));assert.ok(!JSON.stringify(mine).includes(b.complaintId));
    assert.equal((await request("peer",`case-family/cases/${a.id}`)).status,404);assert.equal((await request("regional","case-family/institutions/south")).status,404);
    for(const actor of ["officer","head","target","admin"])assert.equal((await request(actor,"case-family/merges/prepare","POST",{sourceId:a.id,canonicalId:b.id,reason:"Unauthorized test action",requestId:randomUUID()})).status,403);
  });
  await check("Merge preparation rejects self, cross-institution and unavailable records",async()=>{
    assert.equal((await prepare(a.id,a.id)).status,400);assert.equal((await prepare(a.id,other.id)).status,400);assert.equal((await prepare(a.id,"unknown")).status,404);
    assert.equal((await prepare(a.id,b.id,{reason:"short"})).status,400);
  });
  let proposal:any;
  await check("Preparation is persistent, replay-safe and cannot apply without explicit review or a current snapshot",async()=>{
    const key=randomUUID(),first=await prepare(a.id,b.id,{requestId:key});assert.equal(first.status,200);proposal=first.body;
    assert.equal((await prepare(a.id,b.id,{requestId:key})).body.id,proposal.id);
    assert.equal((await request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:proposal.preparedHash,reviewed:false})).status,400);
    assert.equal((await request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:"stale",reviewed:true})).status,400);
    assert.equal((await request("officer",`case-overlap/${a.id}/entities`,"PUT",{version:0,entities:[{kind:"department",namespace:"campus",value:"CSE"}],reason:"New verified institutional evidence code"})).status,200);
    assert.equal((await request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:proposal.preparedHash,reviewed:true})).status,409);
    assert.equal((await work(()=>store.getCaseFamilyRecords().merges.length)),0);
  });
  const form=new FormData();form.set("file",new Blob(["%PDF-1.4\nSynthetic original family evidence\n%%EOF"],{type:"application/pdf"}),"family-evidence.pdf");
  const uploaded=await fetch(base+`complaints/${a.id}/documents`,{method:"POST",headers:{Authorization:`Bearer ${tokens.head}`},body:form});assert.equal(uploaded.status,201);const document=await uploaded.json() as any;
  const workflow=await request("officer",`complaints/${a.id}/requests`,"POST",{type:"Escalation",remarks:"Unresolved synthetic escalation request remains on source"});assert.equal(workflow.status,201);
  const staff=await request("admin","admin/users","POST",{email:"family-pgrc@example.test",fullName:"Synthetic PGRC family fixture",role:"CASE_OFFICER",bureauId:"PGRC",region:"",isActive:true,password:"DisposableFamilyOnly!2026",permissions:[]});assert.equal(staff.status,201);
  let session=(await request("officer","coordination","POST",{complaintId:a.id,targetBureaus:["PGRC"],reason:"Synthetic source work preservation",assistance:"Verification"})).body;
  async function coordination(actor:string,action:string,input:any){const result=await request(actor,`coordination/${session.id}/actions/${action}`,"POST",{...input,version:session.version,requestId:randomUUID(),remarks:"Synthetic family preservation task workflow"});assert.equal(result.status,200,JSON.stringify(result.body));session=result.body;}
  await coordination("head","originDecision",{decision:"Approved"});await coordination("target","targetDecision",{bureauId:"PGRC",decision:"Accepted"});await coordination("target","assign",{bureauId:"PGRC",officerIds:[staff.body.id]});await coordination("head","createTask",{officerId:"officer",title:"Unresolved original source verification",dueDate:"2099-01-01"});
  let merge:any,before:any;
  await check("Reviewed canonical merge retains every original ID, deadline, evidence, workflow request and coordination task",async()=>{
    const all=(await request("authority","overlaps?limit=100")).body.data,overlap=all.find((row:any)=>[row.complaintIdA,row.complaintIdB].includes(a.id)&&[row.complaintIdA,row.complaintIdB].includes(b.id));assert.ok(overlap);
    assert.equal((await request("authority",`overlaps/${overlap.id}/review`,"POST",{decision:"Confirmed Related",remarks:"Keep explicit related link separate from canonical merge",linkAsRelated:true})).status,200);
    proposal=(await prepare()).body;
    before=await work(()=>store.exportSnapshot());
    const result=await request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:proposal.preparedHash,reviewed:true});assert.equal(result.status,200,JSON.stringify(result.body));merge=result.body.merge;
    const after=await work(()=>store.exportSnapshot());assert.deepEqual(after.complaints,before.complaints);assert.deepEqual(after.documents,before.documents);assert.deepEqual(after.workflowRequests,before.workflowRequests);assert.deepEqual(after.coordinationSessions,before.coordinationSessions);assert.deepEqual(after.caseTransfers,before.caseTransfers);assert.deepEqual(after.relatedCases,before.relatedCases);
    assert.equal((await request("head",`complaints/${a.id}`)).body.complaint.id,a.id);assert.equal((await request("head",`complaints/${encodeURIComponent(a.complaintId)}`)).body.complaint.id,a.id);
    const download=await fetch(base+`complaints/${a.id}/documents/${document.id}/download`,{headers:{Authorization:`Bearer ${tokens.head}`}});assert.equal(download.status,200);assert.equal(await download.text(),"%PDF-1.4\nSynthetic original family evidence\n%%EOF");
    const graph=(await request("authority","case-family/institutions/north")).body;assert.ok(graph.edges.some((row:any)=>row.id===merge.id&&row.kind==="merged"));assert.ok(graph.edges.some((row:any)=>row.kind==="related"));assert.ok(graph.coordination.some((row:any)=>row.id===session.id));assert.equal(graph.merges.find((row:any)=>row.id===merge.id).reversal,undefined);
    assert.equal((await request("authority",`case-family/cases/${a.id}`)).body.canonical.id,b.id);
  });
  await check("Confirmation retries and simultaneous confirmations create only one merge and two case-history entries",async()=>{
    const results=await Promise.all([request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:proposal.preparedHash,reviewed:true}),request("authority",`case-family/merges/${proposal.id}/confirm`,"POST",{preparedHash:proposal.preparedHash,reviewed:true})]);assert.ok(results.every(row=>row.status===200&&row.body.merge.id===merge.id));
    const snapshot=await work(()=>store.exportSnapshot());assert.equal(snapshot.caseMerges?.length,1);assert.equal(snapshot.caseHistory.filter(row=>row.familyMergeId===merge.id).length,2);
    assert.equal((await prepare(a.id,b.id)).status,409);assert.equal((await prepare(b.id,a.id)).status,409);
  });
  await check("Chained families require explicit roots, reject cycles and preserve descendant provenance",async()=>{
    const p=(await prepare(b.id,c.id)).body;const result=await request("authority",`case-family/merges/${p.id}/confirm`,"POST",{preparedHash:p.preparedHash,reviewed:true});assert.equal(result.status,200);assert.deepEqual(result.body.merge.preservedCaseIds.sort(),[a.id,b.id,c.id].sort());
    assert.equal((await prepare(c.id,a.id)).status,409);
    const reverse=await request("authority",`case-family/merges/${result.body.merge.id}/reverse`,"POST",{reason:"Correct secondary root selection after review",requestId:randomUUID(),reviewed:true});assert.equal(reverse.status,200);
  });
  await check("Sealing a canonical case hides graph edges, merge history, timeline events and direct canonical context",async()=>{
    const policy=(await request("authority",`case-security/${b.id}`)).body;assert.equal((await request("authority",`case-security/${b.id}`,"PUT",{version:policy.version,level:"sealed",grants:[],reason:"Synthetic canonical sensitivity isolation"})).status,200);
    const graph=(await request("head","case-family/institutions/north")).body;assert.ok(!JSON.stringify(graph).includes(b.id));assert.ok(!graph.edges.some((row:any)=>row.id===merge.id));assert.ok(!graph.merges.some((row:any)=>row.id===merge.id));assert.equal((await request("head",`case-family/cases/${a.id}`)).body.canonical,undefined);
    const source=(await request("head",`complaints/${a.id}`)).body;assert.ok(!source.history.some((row:any)=>row.familyMergeId===merge.id));assert.ok(!JSON.stringify((await request("head","analytics/role-dashboard")).body).includes(merge.id));
    assert.equal((await request("target",`case-family/cases/${b.id}`)).status,404);
    assert.equal((await fetch(base+`complaints/${b.id}/documents/${document.id}/download`,{headers:{Authorization:`Bearer ${tokens.head}`}})).status,404);
  });
  await check("Audited reversal preserves merge history and original work; repeated different reversals are rejected",async()=>{
    const body={reason:"Correct original canonical relationship after review",requestId:randomUUID(),reviewed:true};const result=await request("authority",`case-family/merges/${merge.id}/reverse`,"POST",body);assert.equal(result.status,200);
    assert.equal((await request("authority",`case-family/merges/${merge.id}/reverse`,"POST",body)).body.id,result.body.id);assert.equal((await request("authority",`case-family/merges/${merge.id}/reverse`,"POST",{...body,requestId:randomUUID()})).status,409);
    const family=(await request("authority","case-family/institutions/north")).body;assert.ok(!family.edges.some((row:any)=>row.kind==="merged"));assert.ok(family.merges.find((row:any)=>row.id===merge.id).reversal);
    const after=await work(()=>store.exportSnapshot());assert.deepEqual(after.documents,before.documents);assert.deepEqual(after.workflowRequests,before.workflowRequests);assert.deepEqual(after.coordinationSessions,before.coordinationSessions);assert.deepEqual(after.relatedCases,before.relatedCases);assert.equal(after.caseMerges?.length,2);assert.equal(after.mergeReversals?.length,2);
    // Retain one active relation for restart/SQL cycle verification; no original content is changed.
    const p=(await prepare(c.id,a.id)).body;const final=await request("authority",`case-family/merges/${p.id}/confirm`,"POST",{preparedHash:p.preparedHash,reviewed:true});assert.equal(final.status,200);
  });
}
