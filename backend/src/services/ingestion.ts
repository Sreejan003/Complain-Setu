import { createHash,randomUUID } from "node:crypto";
import { store } from "../db/store.js";
import { effectiveProfile } from "../security/rbac.js";
import { intakeService,IntakeError } from "./intake.js";
import { normalizedIdentifier } from "./institutionResolution.js";
import { IMPORT_FIELDS,type ImportField,type ImportRow,type ImportRun } from "../models/ingestion.js";
import type { Profile } from "../models/types.js";
import { IMPORT_LIMITS,importFail,type ParsedImport } from "./importParsing.js";
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function actor(user:Profile){const current=store.getProfileById(user.id);if(!current?.isActive)importFail("IMPORT_FORBIDDEN",403);const profile=effectiveProfile(current);if(!["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(profile.role))importFail("IMPORT_FORBIDDEN",403);return profile;}
function input(values:ImportRow["values"]){const {identifierNamespace,identifierValue,...fields}=values;return{...fields,...(identifierNamespace||identifierValue?{identifier:{namespace:identifierNamespace,value:identifierValue}}:{})};}
function validate(user:Profile,row:ImportRow){
  const errors=[...row.errors];
  if(!row.values.externalReference?.trim())errors.push("EXTERNAL_REFERENCE_REQUIRED_FOR_IMPORT");
  try{intakeService.prepare(user,input(row.values));}catch(error){if(error instanceof IntakeError)errors.push(error.code);else throw error;}
  return [...new Set(errors)];
}
function canSee(user:Profile,run:ImportRun,visible:Set<string>){return run.ownerId===user.id&&run.ownerBureau===user.bureauId&&run.ownerRegion===user.region&&run.rows.every(row=>!row.intakeId||visible.has(row.intakeId));}
function scoped(user:Profile,id:string){const run=store.getImportRecords().runs.find(row=>row.id===id);if(!run||!canSee(user,run,new Set(intakeService.list(user).map(row=>row.id))))importFail("IMPORT_NOT_FOUND",404);return run;}
function view(user:Profile,run:ImportRun){return{...run,semantics:"partial_success_to_intake_drafts",rows:run.rows.map(row=>({...row,candidates:["Imported","Duplicate"].includes(row.status)?undefined: (()=>{try{return intakeService.candidates(user,{text:row.values.institutionText,locationHint:row.values.locationHint,identifier:input(row.values).identifier});}catch(error){if(error instanceof IntakeError)return undefined;throw error;}})()}))};}
function audit(user:Profile,run:ImportRun,action:string){store.addAuditLog({userId:user.id,userName:user.fullName,action,entityType:"Import",entityId:run.id,details:{format:run.format,version:run.version,status:run.status}});}
function batch(value:unknown){if(typeof value!=="string"||!/^[A-Za-z0-9_.:-]{8,100}$/.test(value))importFail("INVALID_BATCH_KEY");return value;}
function createPreview(user:Profile,format:ImportRun["format"],rows:ImportRow[],batchKey:unknown){
  user=actor(user);const key=batch(batchKey),digest=hash([format,rows.map(row=>({number:row.number,values:IMPORT_FIELDS.map(field=>[field,row.values[field]||""]),errors:row.errors}))]);
  const previous=store.getImportRecords().runs.find(row=>row.ownerId===user.id&&row.batchKey===key);
  if(previous){if(previous.payloadDigest!==digest)importFail("BATCH_PAYLOAD_CHANGED",409);return view(user,scoped(user,previous.id));}
  for(const row of rows){row.errors=validate(user,row);row.status=row.errors.length?"Invalid":"Ready";}
  const now=new Date().toISOString(),run:ImportRun={id:randomUUID(),version:1,ownerId:user.id,ownerBureau:user.bureauId,ownerRegion:user.region,format,batchKey:key,payloadDigest:digest,configurationVersion:store.getIntakeConfiguration().version,status:"Preview",rows,createdAt:now,updatedAt:now};
  return store.transaction(()=>{store.saveImportRun(run);audit(user,run,"IMPORT_PREVIEW_CREATED");return view(user,run);});
}
export const ingestionService={
  authorized(user:Profile){return actor(user);},
  list(user:Profile){user=actor(user);const visible=new Set(intakeService.list(user).map(row=>row.id));return store.getImportRecords().runs.filter(row=>canSee(user,row,visible)).map(({rows,...run})=>({...run,counts:{total:rows.length,imported:rows.filter(row=>row.status==="Imported").length,duplicate:rows.filter(row=>row.status==="Duplicate").length,failed:rows.filter(row=>["Invalid","Failed"].includes(row.status)).length}})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  get(user:Profile,id:string){user=actor(user);return view(user,scoped(user,id));},
  preview(user:Profile,parsed:ParsedImport,mapping:unknown,batchKey:unknown){
    actor(user);
    if(!mapping||typeof mapping!=="object"||Array.isArray(mapping)||Object.keys(mapping).some(key=>!(IMPORT_FIELDS as readonly string[]).includes(key)))importFail("INVALID_FIELD_MAPPING");
    const entries=Object.entries(mapping as Record<ImportField,unknown>);
    if(entries.some(([,value])=>typeof value!=="string"||!parsed.headers.includes(value))||new Set(entries.map(([,value])=>value)).size!==entries.length)importFail("INVALID_FIELD_MAPPING");
    const rows:ImportRow[]=parsed.rows.map((row,index)=>({number:row.number||index+2,values:Object.fromEntries(entries.map(([field,column])=>[field,row.cells[parsed.headers.indexOf(column as string)]||""])),errors:[...row.errors],status:"Ready"}));
    return createPreview(user,parsed.format,rows,batchKey);
  },
  simulateEmail(user:Profile,payload:any){
    actor(user);if(payload?.schema!=="internal-email-fixture-v1"||!Array.isArray(payload.messages)||!payload.messages.length||payload.messages.length>IMPORT_LIMITS.rows)importFail("INVALID_EMAIL_SIMULATION");
    const rows:ImportRow[]=payload.messages.map((message:any,index:number)=>{
      if(!message||typeof message!=="object"||Object.keys(message).some(key=>![...IMPORT_FIELDS,"messageId","subject","body","attachments"].includes(key as any))||message.attachments!==undefined&&(!Array.isArray(message.attachments)||message.attachments.length))importFail("EMAIL_ATTACHMENTS_OR_FIELDS_UNSUPPORTED");
      const values:ImportRow["values"]={};for(const field of IMPORT_FIELDS)if(message[field]!==undefined){if(typeof message[field]!=="string")importFail("INVALID_EMAIL_SIMULATION");values[field]=message[field];}
      if(typeof message.messageId!=="string"||typeof message.subject!=="string"||typeof message.body!=="string")importFail("INVALID_EMAIL_SIMULATION");
      return{number:index+1,values:{...values,sourceChannelId:"email",externalReference:message.messageId,title:message.subject,description:message.body},errors:[],status:"Ready"};
    });return createPreview(user,"email_simulation",rows,payload.batchKey);
  },
  commit(user:Profile,id:string,expected:unknown){
    user=actor(user);return store.transaction(()=>{
      const run=scoped(user,id);if(run.status==="Completed")return view(user,run);
      if(expected!==run.version)importFail("IMPORT_VERSION_CHANGED",409);
      if(run.configurationVersion!==store.getIntakeConfiguration().version)importFail("IMPORT_CONFIGURATION_CHANGED",409);
      for(const row of run.rows){
        if(["Imported","Duplicate"].includes(row.status))continue;
        row.errors=validate(user,{...row,errors:row.errors.filter(code=>!["REFERENCE_UNAVAILABLE"].includes(code))});if(row.errors.length){row.status="Failed";continue;}
        const source=row.values.sourceChannelId!,reference=normalizedIdentifier(row.values.externalReference!);
        const contentHash=hash(IMPORT_FIELDS.map(field=>[field,field==="externalReference"?reference:row.values[field]||""]));
        const receipt=store.getImportRecords().receipts.find(item=>item.sourceChannelId===source&&item.referenceKey===reference);
        if(receipt){if(receipt.ownerId===user.id&&receipt.contentHash===contentHash&&intakeService.list(user).some(record=>record.id===receipt.intakeId)){row.status="Duplicate";row.intakeId=receipt.intakeId;}else{row.status="Failed";row.errors=["REFERENCE_UNAVAILABLE"];}continue;}
        const snapshot=store.exportSnapshot();if(snapshot.intakeRecords?.some(record=>record.metadata.sourceChannelId===source&&record.metadata.normalizedExternalReference===reference)||snapshot.complaints.some(record=>record.metadata?.sourceChannelId===source&&record.metadata.normalizedExternalReference===reference)){row.status="Failed";row.errors=["REFERENCE_UNAVAILABLE"];continue;}
        const record=intakeService.prepare(user,input(row.values));record.metadata.provenance={...record.metadata.provenance,method:run.format==="email_simulation"?"email_simulation":"file_import",importRunId:run.id,importRowNumber:row.number};
        store.saveIntakeRecord(record);store.appendImportReceipt({id:randomUUID(),ownerId:user.id,sourceChannelId:source,referenceKey:reference,contentHash,intakeId:record.id,runId:run.id,rowNumber:row.number,createdAt:new Date().toISOString()});row.intakeId=record.id;row.status="Imported";
      }
      run.version++;run.status=run.rows.every(row=>["Imported","Duplicate"].includes(row.status))?"Completed":"Partial";run.updatedAt=new Date().toISOString();store.saveImportRun(run);audit(user,run,"IMPORT_COMMITTED");return view(user,run);
    });
  },
  errorsCsv(user:Profile,id:string){const run=this.get(user,id);return Buffer.from("row,status,error_codes\r\n"+run.rows.filter(row=>row.errors.length).map(row=>`${row.number},${row.status},${row.errors.join("|")}`).join("\r\n"),"utf8");},
  adapters(user:Profile){actor(user);return[{id:"email_simulation",status:"simulation_only",schema:"internal-email-fixture-v1",live:false},{id:"css",status:"not_connected",live:false},{id:"cpgrams",status:"not_connected",live:false}];}
};
