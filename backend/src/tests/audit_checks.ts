import assert from "node:assert/strict";
import {verifyAuditIntegrity} from "../security/auditChain.js";
import fs from "node:fs";
import path from "node:path";
import type {Store} from "../db/store.js";
type Result={status:number;body:any};
export async function runAuditChecks(context:{request:(actor:string,route:string,method?:string,body?:unknown)=>Promise<Result>;check:(name:string,operation:()=>Promise<void>)=>Promise<void>;work:<T>(operation:()=>Promise<T>|T)=>Promise<T>;store:Store}){
  const{request,check,work,store}=context;
  await check("Audit verifier is administrator-only and verification reads do not recursively append events",async()=>{
    for(const actor of["head","officer","authority","institution-user"])assert.equal((await request(actor,"admin/audit-integrity")).status,403);
    const before=await work(()=>store.exportSnapshot().auditLogs.length);for(let i=0;i<3;i++){const result=await request("admin","admin/audit-integrity");assert.equal(result.status,200);assert.equal(result.body.valid,true);assert.equal(result.body.scope,"operational-global");assert.equal(result.body.externalCheckpoint,"not_configured");assert.ok(!JSON.stringify(result.body).includes("Original fixture"));}assert.equal(await work(()=>store.exportSnapshot().auditLogs.length),before);
  });
  const created=await request("head","complaints","POST",{institutionId:"north",category:"Faculty Shortage / Irregularities",title:"AUDIT_READ_FIXTURE",description:"Original fixture narrative must not enter read audit metadata",receivingBureauId:"RB",assignedOfficerId:"officer",priority:"Medium"});assert.equal(created.status,201);const id=created.body.complaint.id;
  await check("Concurrent authorized record views append ordered unique events without complaint text",async()=>{
    const before=await work(()=>store.exportSnapshot().auditIntegrity!.entries.length);
    const views=await Promise.all(Array.from({length:12},()=>request("officer",`complaints/${id}`)));assert.ok(views.every(row=>row.status===200));
    const data=await work(()=>store.exportSnapshot());assert.equal(data.auditIntegrity!.entries.length,before+12);assert.equal(verifyAuditIntegrity(data.auditLogs,data.auditIntegrity).valid,true);
    const reads=data.auditLogs.filter(row=>row.action==="CASE_VIEWED"&&row.entityId===id);assert.equal(reads.length,12);assert.ok(reads.every(row=>!JSON.stringify(row).includes("Original fixture narrative")));assert.equal(new Set(data.auditIntegrity!.entries.map(row=>row.sequence)).size,data.auditIntegrity!.entries.length);
    const count=data.auditLogs.length;assert.equal((await request("peer",`complaints/${id}`)).status,404);assert.equal(await work(()=>store.exportSnapshot().auditLogs.length),count);
  });
  await check("Checkpoint export anchors its preceding head and chains its creation atomically",async()=>{
    const before=(await request("admin","admin/audit-integrity")).body,checkpoint=await request("admin","admin/audit-integrity/checkpoints","POST",{});assert.equal(checkpoint.status,200);assert.equal(checkpoint.body.sequence,before.entries);assert.equal(checkpoint.body.hash,before.head);
    const data=await work(()=>store.exportSnapshot());assert.equal(data.auditIntegrity!.checkpoints.length,1);assert.equal(data.auditIntegrity!.entries.length,before.entries+1);assert.equal(verifyAuditIntegrity(data.auditLogs,data.auditIntegrity,checkpoint.body).valid,true);assert.equal(data.auditLogs.at(-1)?.action,"AUDIT_CHECKPOINT_CREATED");
  });
  await check("Protected verification reports the sequence of alteration and detects malformed or missing history",async()=>{
    const data=await work(()=>store.exportSnapshot()),altered=structuredClone(data);altered.auditLogs[altered.auditIntegrity!.legacyCount].action="TAMPERED";const result=verifyAuditIntegrity(altered.auditLogs,altered.auditIntegrity);assert.equal(result.valid,false);assert.equal(result.sequence,1);
    assert.equal(verifyAuditIntegrity(data.auditLogs.slice(0,-1),data.auditIntegrity).valid,false);assert.equal(verifyAuditIntegrity(data.auditLogs,{...data.auditIntegrity!,entries:[null]} as any).valid,false);
  });
  await check("An independently configured checkpoint is verified and a mismatch blocks writes without repair",async()=>{
    const snapshot=await work(()=>store.exportSnapshot()),checkpoint=snapshot.auditIntegrity!.checkpoints[0],file=path.join(process.env.DATA_DIR!,"independent-audit-fixture.json"),previous=process.env.AUDIT_CHECKPOINT_FILE;
    try{fs.writeFileSync(file,JSON.stringify(checkpoint));process.env.AUDIT_CHECKPOINT_FILE=file;
      const valid=await request("admin","admin/audit-integrity");assert.equal(valid.body.valid,true);assert.equal(valid.body.externalCheckpoint,"verified");
      fs.writeFileSync(file,JSON.stringify({...checkpoint,hash:"0".repeat(64)}));const failed=await request("admin","admin/audit-integrity");assert.equal(failed.body.valid,false);assert.equal(failed.body.code,"CHECKPOINT_MISMATCH");
      await work(()=>{const profile=structuredClone(store.getProfileById("officer")!);assert.throws(()=>store.saveProfile({...profile,role:"SYSTEM_ADMIN"}));assert.equal(store.getProfileById("officer")!.role,profile.role,"A failed write must not leave a privilege change in memory");});
      const before=await work(()=>store.exportSnapshot().auditLogs.length);assert.equal((await request("officer",`complaints/${id}`)).status,500);assert.equal(await work(()=>store.exportSnapshot().auditLogs.length),before);
    }finally{if(previous===undefined)delete process.env.AUDIT_CHECKPOINT_FILE;else process.env.AUDIT_CHECKPOINT_FILE=previous;fs.unlinkSync(file);}
    assert.equal((await request("admin","admin/audit-integrity")).body.valid,true);
  });
}
