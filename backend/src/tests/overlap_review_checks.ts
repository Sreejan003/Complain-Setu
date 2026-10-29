import assert from "node:assert/strict";
import type { Store } from "../db/store.js";
type Result = { status: number; body: any };
export async function runOverlapChecks(context: {
  request: (actor: string, route: string, method?: string, body?: unknown) => Promise<Result>;
  check: (name: string, operation: () => Promise<void>) => Promise<void>;
  work: <T>(operation: () => Promise<T> | T) => Promise<T>; store: Store;
}) {
  const { request, check, work, store } = context;
  let config = (await request("admin", "admin/overlap-settings")).body.current;
  await check("Overlap configuration is administrator-only and rejects invalid weights, windows and thresholds", async () => {
    for (const actor of ["officer","head","authority","institution-user"]) { assert.equal((await request(actor,"admin/overlap-settings")).status,403); assert.equal((await request(actor,"admin/overlap-settings","PUT",{...config,reason:"Forbidden change"})).status,403); }
    for (const changes of [{dateWindowDays:0},{dateWindowDays:1.5},{weights:{...config.weights,text:-1}},{weights:{...config.weights,unknown:1}},{duplicateScoreThreshold:0},{embeddingRelatedThreshold:101}]) assert.equal((await request("admin","admin/overlap-settings","PUT",{...config,...changes,reason:"Reject invalid engineering settings"})).status,400);
  });
  await check("Configuration versions and rollback append immutable history and reject stale writes", async () => {
    const changed=await request("admin","admin/overlap-settings","PUT",{...config,dateWindowDays:90,reason:"Synthetic short review window"}); assert.equal(changed.status,200); assert.equal(changed.body.current.version,2);
    assert.equal((await request("admin","admin/overlap-settings","PUT",{...config,reason:"Stale version rejected"})).status,409);
    const rollback=await request("admin","admin/overlap-settings","PUT",{version:2,rollbackTo:1,reason:"Restore default settings as a new version"}); assert.equal(rollback.status,200); config=rollback.body.current; assert.equal(config.version,3); assert.equal(config.rollbackOf,1); assert.equal(config.dateWindowDays,180); assert.equal(rollback.body.history.length,3); assert.equal(rollback.body.history[1].dateWindowDays,90);
  });
  async function create(actor:string,title:string,description:string,bureau:string) {
    const response=await request(actor,"complaints","POST",{institutionId:"north",category:"Faculty Shortage / Irregularities",title,description,receivingBureauId:bureau,assignedOfficerId:bureau==="RB"?"officer":undefined,priority:"Medium"}); assert.equal(response.status,201,JSON.stringify(response.body)); return response.body.complaint;
  }
  const a=await create("head","OVERLAP_REVIEW_FIXTURE ocean","Seashells coral reef aquatic ecology investigation","RB");
  const b=await create("target","Basketball tournament","Athletes basketball tournament gymnasium scoreboard","PGRC");
  let alert:any;
  await check("Same-institution/category open cross-Bureau cases trigger review without declaring duplication", async () => {
    const all=(await request("authority","overlaps?limit=100")).body.data;
    alert=all.find((row:any)=>[row.complaintIdA,row.complaintIdB].includes(a.id)&&[row.complaintIdA,row.complaintIdB].includes(b.id)); assert.ok(alert); assert.equal(alert.assessment.mandatoryReview,true); assert.equal(alert.assessment.relationshipCandidate,"undetermined"); assert.equal(alert.assessment.configurationVersion,3); assert.equal(alert.alertStatus,"Pending Review");
    const limited=(await request("head",`overlaps/${alert.id}`)).body.alert; assert.equal(limited.assessment,undefined); assert.equal(limited.explanation,undefined); assert.equal((await request("head",`overlaps/${alert.id}/feedback`)).body.length,0);
    assert.equal((await request("admin",`overlaps/${alert.id}`)).status,403);
  });
  await check("Explicit entity codes enforce case scope, versions, normalized uniqueness and no person fields", async () => {
    assert.equal((await request("peer",`case-overlap/${a.id}`)).status,404);
    assert.equal((await request("admin",`case-overlap/${a.id}`)).status,404);
    assert.equal((await request("target",`case-overlap/${a.id}/entities`,"PUT",{version:0,entities:[],reason:"Cross-Bureau edit denied"})).status,404);
    const entities=[{kind:"department",namespace:"campus",value:"ＣＳＥ"}];
    const result=await request("officer",`case-overlap/${a.id}/entities`,"PUT",{version:0,entities,reason:"Verified institutional department code"}); assert.equal(result.status,200); assert.equal(result.body.version,1); assert.equal(result.body.entities[0].value,"CSE");
    assert.equal((await request("officer",`case-overlap/${a.id}/entities`,"PUT",{version:0,entities,reason:"Stale code edit"})).status,409);
    assert.equal((await request("officer",`case-overlap/${a.id}/entities`,"PUT",{version:1,entities:[...entities,...entities],reason:"Duplicate code rejected"})).status,400);
    assert.equal((await request("officer",`case-overlap/${a.id}/entities`,"PUT",{version:1,entities:[{kind:"person",namespace:"identity",value:"x"}],reason:"Identity extraction not supported"})).status,400);
  });
  await check("Repeated and concurrent rescans create no duplicate alerts or notifications", async () => {
    const before=await work(()=>({alerts:store.exportSnapshot().overlapAlerts.length,notifications:store.exportSnapshot().notifications.length}));
    const scans=await Promise.all([request("head",`case-overlap/${a.id}/rescan`,"POST",{reason:"First idempotent rescan"}),request("head",`case-overlap/${a.id}/rescan`,"POST",{reason:"Repeated idempotent rescan"})]);
    assert.ok(scans.every(row=>row.status===200)); assert.ok(scans.every(row=>row.body.created===false));
    const after=await work(()=>({alerts:store.exportSnapshot().overlapAlerts.length,notifications:store.exportSnapshot().notifications.length})); assert.deepEqual(after,before);
  });
  await check("Review retries are idempotent, feedback remains immutable and a rescan preserves decisions", async () => {
    const body={decision:"Marked Unrelated",remarks:"Distinct synthetic matters verified by an authorized reviewer",requestId:"synthetic-review-001",expectedUpdatedAt:alert.updatedAt};
    const first=await request("authority",`overlaps/${alert.id}/review`,"POST",body); assert.equal(first.status,200);
    const retry=await request("authority",`overlaps/${alert.id}/review`,"POST",body); assert.equal(retry.status,200);
    const feedback=(await request("authority",`overlaps/${alert.id}/feedback`)).body; assert.equal(feedback.length,1); assert.equal(feedback[0].configurationVersion,3); assert.equal(feedback[0].algorithmVersion,"signals-v2");
    assert.equal((await request("authority",`overlaps/${alert.id}/review`,"POST",{...body,decision:"Confirmed Duplicate"})).status,400);
    assert.equal((await request("authority",`overlaps/${alert.id}/review`,"POST",{...body,linkAsRelated:true})).status,400);
    assert.equal((await request("authority",`overlaps/${alert.id}/review`,"POST",{...body,requestId:"synthetic-review-002",decision:"Confirmed Related"})).status,400);
    assert.equal((await request("authority",`case-overlap/${a.id}/rescan`,"POST",{reason:"Retain explicit reviewer decision"})).status,200);
    const kept=(await request("authority",`overlaps/${alert.id}`)).body.alert; assert.equal(kept.alertStatus,"Marked Unrelated"); assert.equal(kept.reviewedAt,first.body.reviewedAt); assert.deepEqual((await request("authority",`overlaps/${alert.id}/feedback`)).body,feedback);
  });
  await check("Sealed counterparts are excluded from rescans and direct annotation access", async () => {
    const policy=(await request("authority",`case-security/${b.id}`)).body;
    assert.equal((await request("authority",`case-security/${b.id}`,"PUT",{version:policy.version,level:"sealed",grants:[],reason:"Seal counterpart for boundary fixture"})).status,200);
    assert.equal((await request("head",`overlaps/${alert.id}`)).status,404); assert.equal((await request("target",`case-overlap/${b.id}`)).status,404);
    assert.equal((await request("target",`case-overlap/${b.id}/rescan`,"POST",{reason:"Sealed rescan denied"})).status,404);
    const rescan=await request("head",`case-overlap/${a.id}/rescan`,"POST",{reason:"No protected existence disclosure"}); assert.equal(rescan.status,200); assert.equal(rescan.body.created,false);
  });
}
