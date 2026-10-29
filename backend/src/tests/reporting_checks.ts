import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {parse} from "csv-parse/sync";
import fs from "node:fs";
import type {Store} from "../db/store.js";
import {reportPeriod,reporting,runReportScheduleCycle} from "../services/reporting.js";
import {reportFile} from "../services/reportFiles.js";
type Result={status:number;body:any};
export async function runReportingChecks({request,check,work,store,base,tokens}:{request:(actor:string,route:string,method?:string,body?:unknown)=>Promise<Result>;check:(name:string,operation:()=>Promise<void>)=>Promise<void>;work:<T>(operation:()=>Promise<T>|T)=>Promise<T>;store:Store;base:string;tokens:Record<string,string>}){
  const preview=(actor="head",body:unknown={filters:{}})=>request(actor,"reports/preview","POST",body);
  const download=(actor:string,route:string,body?:unknown)=>fetch(base+"reports/"+route,{method:body===undefined?"GET":"POST",headers:{Authorization:`Bearer ${tokens[actor]}`,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const created=await request("head","complaints","POST",{institutionId:"north",category:"Faculty Shortage / Irregularities",title:"REPORT_VISIBLE_FIXTURE",description:"This original narrative must not enter a report ledger",receivingBureauId:"RB",assignedOfficerId:"officer",priority:"Medium"});assert.equal(created.status,201);const id=created.body.complaint.id;
  await check("Reporting rejects administrative/institution users and invalid dates or period inputs",async()=>{
    for(const actor of["admin","institution-user"])assert.equal((await preview(actor)).status,403);
    assert.equal((await preview("head",{filters:{receivedFrom:"2026-02-30"}})).status,400);assert.equal((await preview("head",{filters:{receivedFrom:"2026-03-01",receivedTo:"2026-02-01"}})).status,400);assert.equal((await preview("head",{period:{basis:"calendar",kind:"quarter",year:2027,index:5}})).status,400);
    assert.deepEqual(reportPeriod({basis:"financial",kind:"quarter",year:2026,index:4}),{from:"2027-01-01",to:"2027-03-31",label:"financial 2026 quarter 4 (UTC received dates)"});assert.equal(reportPeriod({basis:"calendar",kind:"month",year:2028,index:2}).to,"2028-02-29");assert.equal(reportPeriod({basis:"financial",kind:"year",year:2026}).to,"2027-03-31");
  });
  await check("Regional grid and table counts distinguish zero, unknown and missing historical metadata",async()=>{
    const zero=await request("authority","institutions","POST",{aictePermanentId:"REPORT-ZERO-ONLY",name:"Zero region institution",institutionType:"Engineering",address:"Fixture only",city:"Fixture",state:"Fixture State",region:"Zero region"});assert.equal(zero.status,201);
    const unknown=await request("target","complaints","POST",{institutionId:"south",category:"Faculty Shortage / Irregularities",title:"REPORT_UNKNOWN_REGION",description:"Synthetic case with missing institution region",receivingBureauId:"PGRC",priority:"Medium"});assert.equal(unknown.status,201);
    const result=(await preview("authority")).body;assert.equal(result.total,result.rows.length);assert.equal(result.regions.reduce((sum:number,row:any)=>sum+row.count,0),result.total);assert.equal(result.regions.find((row:any)=>row.region===null).count,1);assert.equal(result.regions.find((row:any)=>row.region==="Zero region").count,0);assert.ok(result.missing.caseType>0);
    const regional=(await preview("regional")).body;assert.ok(regional.regions.every((row:any)=>row.region===null||row.region==="North"));assert.equal((await preview("authority",{filters:{unknownRegion:true}})).body.total,1);assert.equal((await preview("authority",{filters:{region:"Zero region"}})).body.total,0);
  });
  await check("All report filters narrow the same currently authorized case set without inferring legacy type/source",async()=>{
    const all=(await preview("head")).body;const audit=await work(()=>store.exportSnapshot().auditLogs.filter(row=>row.action==="REPORT_PREVIEWED"));assert.ok(audit.length>0);assert.ok(!JSON.stringify(audit).includes("original narrative"));for(const filters of[{institution:"north"},{bureau:"RB"},{status:"Pending"},{caseType:"grievance"},{source:"letter"},{receivedFrom:new Date().toISOString().slice(0,10)}]){const report=(await preview("head",{filters})).body;assert.ok(report.rows.every((row:any)=>all.rows.some((record:any)=>record.id===row.id)));assert.equal(report.total,report.rows.length);}
    const now=new Date(),period={basis:"calendar",kind:"quarter",year:now.getUTCFullYear(),index:Math.floor(now.getUTCMonth()/3)+1},legacy=(await request("head","analytics/performance-report?period=current-quarter&bureau=RB")).body;
    assert.equal(legacy.kpi.totalComplaints,(await preview("head",{filters:{bureau:"RB"},period})).body.total);
    const officer=(await preview("officer")).body;assert.ok(officer.rows.some((row:any)=>row.id===id));assert.ok(!(await preview("peer")).body.rows.some((row:any)=>row.id===id));assert.equal((await preview("head",{filters:{bureau:"PGRC"}})).body.total,0);
  });
  await check("CSV, binary Excel and PDF exports agree with preview and omit narratives",async()=>{
    const body={filters:{institution:"north",bureau:"RB"}},report=(await preview("head",body)).body;
    const csv=await download("head","export/csv",body);assert.equal(csv.status,200);const text=await csv.text(),rows=parse(text,{bom:true,columns:true});assert.equal(rows.length,report.total);assert.ok(!text.includes("original narrative"));
    const xlsx=await download("head","export/xlsx",body);assert.equal(xlsx.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as any);assert.equal(workbook.getWorksheet("Authorized cases")!.rowCount-1,report.total);assert.equal(workbook.getWorksheet("Scope and coverage")!.getCell("B2").value,report.total);
    const pdf=await download("head","export/pdf",body);assert.equal(pdf.status,200);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),"%PDF-");assert.ok(bytes.includes(Buffer.from("report.csv")));assert.ok(bytes.includes(Buffer.from("scope.json")));if(process.env.REPORT_PDF_PROOF)fs.writeFileSync(process.env.REPORT_PDF_PROOF,bytes);
    const fixture=structuredClone(report);fixture.rows[0].institution=" =SUM(1,1) हिन्दी தமிழ்";const safeCsv=(await reportFile(fixture,"csv")).bytes.toString();assert.ok(safeCsv.includes("' =SUM"));const safeBook=new ExcelJS.Workbook();await safeBook.xlsx.load((await reportFile(fixture,"xlsx")).bytes as any);assert.equal(safeBook.getWorksheet("Authorized cases")!.getCell("B2").type,ExcelJS.ValueType.String);
    assert.equal((await download("admin","export/csv",body)).status,403);assert.equal((await download("head","export/unknown",body)).status,400);
  });
  let schedule:any,pack:any;
  await check("Private schedules persist versions and generate each closed period idempotently",async()=>{
    const response=await request("head","reports/schedules","POST",{name:"Private monthly fixture",enabled:true,frequency:"monthly",basis:"calendar",filters:{bureau:"RB"}});assert.equal(response.status,200);schedule=response.body;
    assert.equal((await request("peer","reports/schedules")).body.schedules.some((row:any)=>row.id===schedule.id),false);assert.equal((await request("peer",`reports/schedules/${schedule.id}/generate`,"POST",{})).status,404);
    const repeated=await Promise.all([request("head",`reports/schedules/${schedule.id}/generate`,"POST",{}),request("head",`reports/schedules/${schedule.id}/generate`,"POST",{})]);assert.ok(repeated.every(row=>row.status===200));assert.equal(repeated[0].body.id,repeated[1].body.id);
    const now=new Date(),future=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));pack=await work(()=>reporting.generate(store.getProfileById("head")!,schedule.id,future));assert.ok(pack.data.rows.some((row:any)=>row.id===id));const again=await work(()=>reporting.generate(store.getProfileById("head")!,schedule.id,future));assert.equal(again.id,pack.id);
    const next=await request("head","reports/schedules","POST",{...schedule,enabled:false});assert.equal(next.status,200);assert.equal(next.body.version,2);assert.equal((await request("head","reports/schedules","POST",{...schedule,enabled:true})).status,409);assert.equal((await request("head",`reports/schedules/${schedule.id}/generate`,"POST",{})).status,404);
  });
  await check("Scheduled pack downloads are private and retain audited download history",async()=>{
    assert.equal((await download("peer",`packs/${pack.id}/csv`)).status,404);assert.equal((await download("head",`packs/${pack.id}/csv`)).status,200);const state=(await request("head","reports/schedules")).body;assert.equal(state.packs.find((row:any)=>row.id===pack.id).downloads.length,1);
  });
  await check("New confidentiality restrictions revoke existing report pack and direct export access",async()=>{
    const policy=(await request("authority",`case-security/${id}`)).body;assert.equal((await request("authority",`case-security/${id}`,"PUT",{version:policy.version,level:"sealed",grants:[],reason:"Report fixture access revoked"})).status,200);
    assert.equal((await download("head",`packs/${pack.id}/xlsx`)).status,404);assert.ok(!(await request("head","reports/schedules")).body.packs.some((row:any)=>row.id===pack.id));assert.ok(!(await preview("head")).body.rows.some((row:any)=>row.id===id));
    const file=await download("head","export/csv",{filters:{}});assert.ok(!(await file.text()).includes(created.body.complaint.complaintId));
  });
  await check("Quarterly scheduler rechecks current owner access and deduplicates repeated background runs",async()=>{
    const response=await request("officer","reports/schedules","POST",{name:"Private quarterly fixture",enabled:true,frequency:"quarterly",basis:"financial",filters:{}});assert.equal(response.status,200);
    const a=await work(()=>runReportScheduleCycle()),b=await work(()=>runReportScheduleCycle());assert.equal(a.generated,1);assert.equal(b.generated,0);
    await work(()=>store.saveProfile({...store.getProfileById("officer")!,isActive:false}));assert.equal((await work(()=>runReportScheduleCycle())).unavailable,1);await work(()=>store.saveProfile({...store.getProfileById("officer")!,isActive:true}));
  });
}
