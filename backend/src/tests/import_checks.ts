import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { parseImportFile,importTemplate,IMPORT_LIMITS } from "../services/importParsing.js";
import type { Store } from "../db/store.js";
type Result={status:number;body:any};
export async function runImportChecks(context:{request:(actor:string,route:string,method?:string,body?:unknown)=>Promise<Result>;check:(name:string,operation:()=>Promise<void>)=>Promise<void>;work:<T>(operation:()=>Promise<T>|T)=>Promise<T>;store:Store;base:string;tokens:Record<string,string>}){
  const{request,check,work,store,base,tokens}=context;
  const fields=["recordKind","caseTypeId","category","sourceChannelId","externalReference","sourceReceivedDate","bureauId","institutionText","title","description","priority"],mapping=Object.fromEntries(fields.map(key=>[key,key]));
  const values=(ref:string,changes:Record<string,string>={}):Record<string,string>=>({recordKind:"complaint",caseTypeId:"grievance",category:"Faculty Shortage / Irregularities",sourceChannelId:"letter",externalReference:ref,sourceReceivedDate:"2026-01-02",bureauId:"RB",institutionText:"National Technical Institute",title:"IMPORT_UNICODE_FIXTURE",description:"हिन्दी தமிழ் ગુજરાતી తెలుగు বাংলা ಕನ್ನಡ\nOriginal quoted, source text",priority:"Medium",...changes});
  const csv=(rows:Record<string,string>[],headers=fields)=>Buffer.from([headers.join(","),...rows.map(row=>headers.map(key=>'"'+(row[key]||"").replaceAll('"','""')+'"').join(","))].join("\r\n"));
  async function upload(actor:string,path:string,bytes:Buffer,extra:Record<string,string>={},name="fixture.csv",mime="text/csv"){
    const form=new FormData();form.set("file",new Blob([new Uint8Array(bytes)],{type:mime}),name);for(const[key,value]of Object.entries(extra))form.set(key,value);
    const response=await fetch(base+"imports/"+path,{method:"POST",headers:tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`}:{},body:form});return{status:response.status,body:await response.json() as any};
  }
  await check("Import access rejects anonymous, system administration, institutions and other owners",async()=>{
    assert.equal((await request("","imports")).status,401);for(const actor of ["admin","institution-user"])assert.equal((await upload(actor,"inspect",csv([values("IMP-A")]))).status,403);
    assert.equal((await request("officer","imports/adapters/css","POST",{})).status,501);assert.equal((await request("officer","imports/adapters/cpgrams","POST",{})).status,501);
    assert.ok((await request("officer","imports/capabilities")).body.adapters.every((row:any)=>row.live===false));
  });
  await check("CSV and workbook parsers reject malformed files, excessive dimensions and unsupported parts",async()=>{
    for(const file of [{buffer:Buffer.from('a,a\n1,2'),originalname:"x.csv",mimetype:"text/csv"},{buffer:Buffer.from('a\n"unclosed'),originalname:"x.csv",mimetype:"text/csv"},{buffer:Buffer.from([255,254,253]),originalname:"x.csv",mimetype:"text/csv"},{buffer:Buffer.alloc(IMPORT_LIMITS.fileBytes+1),originalname:"x.csv",mimetype:"text/csv"},{buffer:Buffer.from("fake excel"),originalname:"x.xlsx",mimetype:"application/octet-stream"}])await assert.rejects(parseImportFile(file));
    await assert.rejects(parseImportFile({buffer:csv(Array.from({length:201},(_,index)=>values("OVER-"+index))),originalname:"limit.csv",mimetype:"text/csv"}));
    const book=new ExcelJS.Workbook();book.addWorksheet("one").addRow(["a"]);book.addWorksheet("two").addRow(["a"]);await assert.rejects(parseImportFile({buffer:Buffer.from(await book.xlsx.writeBuffer()),originalname:"two.xlsx",mimetype:"application/octet-stream"}));
    const linked=new ExcelJS.Workbook();linked.addWorksheet("Intake").getCell("A1").value={text:"unsafe link",hyperlink:"https://example.test/untrusted"};await assert.rejects(parseImportFile({buffer:Buffer.from(await linked.xlsx.writeBuffer()),originalname:"links.xlsx",mimetype:"application/octet-stream"}));
    for(const format of ["csv","xlsx"] as const){const template=await importTemplate(format);const parsed=await parseImportFile({buffer:template,originalname:`template.${format}`,mimetype:format==="csv"?"text/csv":"application/octet-stream"});assert.ok(parsed.headers.includes("externalReference"));assert.equal(parsed.rows.length,1);}
  });
  const bytes=csv([values("IMPORT-ONE"),values("IMPORT-BAD",{sourceReceivedDate:"2026-02-30"})]),batch="fixture-"+randomUUID();let run:any;
  await check("Preview maps fields, preserves Unicode and leaves ambiguous institutions unresolved without creating intake",async()=>{
    const before=await work(()=>store.getIntakeRecords().length),inspected=await upload("officer","inspect",bytes);assert.equal(inspected.status,200);assert.deepEqual(inspected.body.headers,fields);
    const result=await upload("officer","preview",bytes,{mapping:JSON.stringify(mapping),batchKey:batch});assert.equal(result.status,200);run=result.body;assert.equal(run.rows[0].status,"Ready");assert.equal(run.rows[0].candidates.ambiguous,true);assert.equal(run.rows[1].status,"Invalid");assert.ok(run.rows[1].errors.includes("INVALID_SOURCE_DATE"));assert.equal(run.rows[0].values.description,values("x").description);assert.equal(await work(()=>store.getIntakeRecords().length),before);
    assert.equal((await request("peer",`imports/${run.id}`)).status,404);assert.equal((await request("head",`imports/${run.id}`)).status,404);
  });
  await check("Partial-success commits create only valid unresolved drafts with source provenance and no complaint",async()=>{
    const before=await work(()=>store.exportSnapshot()),result=await request("officer",`imports/${run.id}/commit`,"POST",{version:run.version});assert.equal(result.status,200);run=result.body;assert.equal(run.status,"Partial");assert.equal(run.rows[0].status,"Imported");assert.equal(run.rows[1].status,"Failed");
    const after=await work(()=>store.exportSnapshot());assert.equal(after.complaints.length,before.complaints.length);assert.equal(after.intakeRecords!.length,before.intakeRecords!.length+1);
    const draft=after.intakeRecords!.find(row=>row.id===run.rows[0].intakeId)!;assert.equal(draft.status,"NeedsInstitutionResolution");assert.equal(draft.institutionId,undefined);assert.equal(draft.description,values("x").description);assert.equal(draft.metadata.provenance.importRunId,run.id);assert.equal(draft.metadata.provenance.method,"file_import");assert.equal(draft.textAnalysis?.translation.status,"not_requested");
    const errors=await fetch(base+`imports/${run.id}/errors.csv`,{headers:{Authorization:`Bearer ${tokens.officer}`}});assert.equal(errors.status,200);const text=await errors.text();assert.ok(text.includes("INVALID_SOURCE_DATE"));assert.ok(!text.includes("Original quoted"));
  });
  await check("Batch replay, corrected batches and concurrent commits deduplicate source references",async()=>{
    const retry=await upload("officer","preview",bytes,{mapping:JSON.stringify(Object.fromEntries(Object.entries(mapping).reverse())),batchKey:batch});assert.equal(retry.status,200);assert.equal(retry.body.id,run.id);
    assert.equal((await upload("officer","preview",csv([values("IMPORT-CHANGED")]),{mapping:JSON.stringify(mapping),batchKey:batch})).status,409);
    const corrected=await upload("officer","preview",csv([values("IMPORT-ONE"),values("IMPORT-BAD")]),{mapping:JSON.stringify(mapping),batchKey:"corrected-"+randomUUID()});assert.equal(corrected.status,200);
    const outcomes=await Promise.all([request("officer",`imports/${corrected.body.id}/commit`,"POST",{version:1}),request("officer",`imports/${corrected.body.id}/commit`,"POST",{version:1})]);assert.ok(outcomes.every(row=>row.status===200));assert.deepEqual(outcomes[0].body.rows.map((row:any)=>row.status),["Duplicate","Imported"]);
    assert.equal(await work(()=>store.getImportRecords().receipts.filter(row=>row.referenceKey.startsWith("IMPORT-")).length),2);
    const other=await upload("peer","preview",csv([values("IMPORT-ONE")]),{mapping:JSON.stringify(mapping),batchKey:"peer-"+randomUUID()});assert.equal(other.status,200);const blocked=await request("peer",`imports/${other.body.id}/commit`,"POST",{version:1});assert.equal(blocked.body.rows[0].status,"Failed");assert.equal(blocked.body.rows[0].intakeId,undefined);assert.deepEqual(blocked.body.rows[0].errors,["REFERENCE_UNAVAILABLE"]);
  });
  await check("XLSX formulas become explicit row errors while literal CSV formula-like text remains inert and unchanged",async()=>{
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Intake");sheet.addRow(fields);sheet.addRow(fields.map(key=>values("IMPORT-XLSX")[key]));sheet.addRow(fields.map(key=>values("IMPORT-FORMULA")[key]));sheet.getRow(3).getCell(fields.indexOf("title")+1).value={formula:"1+1",result:2};
    const preview=await upload("officer","preview",Buffer.from(await book.xlsx.writeBuffer()),{mapping:JSON.stringify(mapping),batchKey:"xlsx-"+randomUUID()},"fixture.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");assert.equal(preview.status,200,JSON.stringify(preview.body));assert.ok(preview.body.rows[1].errors.includes("FORMULA_OR_COMPLEX_CELL_UNSUPPORTED"));const committed=await request("officer",`imports/${preview.body.id}/commit`,"POST",{version:1});assert.equal(committed.body.rows[0].status,"Imported");assert.equal(committed.body.rows[1].status,"Failed");
    const literal=await upload("officer","preview",csv([values("IMPORT-LITERAL",{title:'=HYPERLINK("https://example.test","literal")'})]),{mapping:JSON.stringify(mapping),batchKey:"literal-"+randomUUID()});const result=await request("officer",`imports/${literal.body.id}/commit`,"POST",{version:1});assert.equal(result.body.rows[0].status,"Imported");assert.equal(await work(()=>store.getIntakeRecords().find(row=>row.id===result.body.rows[0].intakeId)?.title),'=HYPERLINK("https://example.test","literal")');
  });
  await check("Email fixture uses the shared pipeline, disallows attachments and never enables a mailbox",async()=>{
    const payload={schema:"internal-email-fixture-v1",batchKey:"email-"+randomUUID(),messages:[{...values("ignored"),messageId:"IMPORT-EMAIL",subject:"Simulated email only",body:"Original simulated message — ગુજરાતી",attachments:[]}]};
    const preview=await request("officer","imports/email-simulation","POST",payload);assert.equal(preview.status,200);assert.equal(preview.body.rows[0].values.sourceChannelId,"email");const result=await request("officer",`imports/${preview.body.id}/commit`,"POST",{version:1});assert.equal(result.body.status,"Completed");assert.equal(await work(()=>store.getIntakeRecords().find(row=>row.id===result.body.rows[0].intakeId)?.metadata.provenance.method),"email_simulation");
    assert.equal((await request("officer","imports/email-simulation","POST",{...payload,messages:[{...payload.messages[0],attachments:[{name:"unsupported.pdf"}]}]})).status,400);
  });
  await check("Registered sealed import records disappear from private run access and error downloads",async()=>{
    const intakeId=run.rows[0].intakeId,resolved=await request("officer",`intake/${intakeId}/resolve`,"POST",{version:1,institutionId:"north",reason:"Explicit source institution verified by test official"});assert.equal(resolved.status,200);const registered=await request("head",`intake/${intakeId}/register`,"POST",{version:resolved.body.version});assert.equal(registered.status,201);
    const id=registered.body.complaint.id,policy=(await request("authority",`case-security/${id}`)).body;assert.equal((await request("authority",`case-security/${id}`,"PUT",{version:policy.version,level:"sealed",grants:[],reason:"Protect imported source from indirect disclosure"})).status,200);
    assert.equal((await request("officer",`imports/${run.id}`)).status,404);assert.ok(!(await request("officer","imports")).body.some((row:any)=>row.id===run.id));const errorReport=await fetch(base+`imports/${run.id}/errors.csv`,{headers:{Authorization:`Bearer ${tokens.officer}`}});assert.equal(errorReport.status,404);
  });
}
