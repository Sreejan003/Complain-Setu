import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type {ReportData} from "../models/reporting.js";
import {ReportError} from "./reporting.js";
export const REPORT_HEADERS=["Complaint ID","Institution","Institution ID","Region","Current Bureau","Status","Priority","Case type","Source","Received date","Operational deadline"];
export function reportValues(data:ReportData){return data.rows.map(row=>[row.reference,row.institution,row.institutionId,row.region??"",row.bureau,row.status,row.priority,row.caseType??"",row.source??"",row.receivedDate,row.deadline]);}
function csvCell(value:string){return '"'+(/^[\s]*[=+\-@]/.test(value)||/^[\t\r\n]/.test(value)?"'":"")+value.replace(/"/g,'""')+'"';}
export async function reportFile(data:ReportData,format:string){
  // Refuse oversized synchronous packs rather than silently truncate or block the server indefinitely.
  if(data.total>5000)throw new ReportError("REPORT_TOO_LARGE_USE_NARROWER_FILTERS",413);
  if(format==="csv")return{type:"text/csv; charset=utf-8",bytes:Buffer.from("\uFEFF"+[REPORT_HEADERS,...reportValues(data)].map(row=>row.map(csvCell).join(",")).join("\r\n"))};
  if(format==="xlsx"){
    const workbook=new ExcelJS.Workbook();workbook.creator="Complain Setu";const sheet=workbook.addWorksheet("Authorized cases");sheet.addRow(REPORT_HEADERS);for(const row of reportValues(data))sheet.addRow(row);sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:"A1",to:"K1"};sheet.columns.forEach(column=>{column.width=26;});
    const summary=workbook.addWorksheet("Scope and coverage");summary.addRows([["Generated at",data.generatedAt],["Total authorized matching cases",data.total],["Region metadata missing",data.missing.region],["Case type metadata missing",data.missing.caseType],["Source metadata missing",data.missing.source],["Received date missing or invalid",data.missing.receivedDate],["Filters",JSON.stringify(data.filters)],["Region","Matching cases"],...data.regions.map(row=>[row.region??"Unknown / unassigned",row.count])]);return{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",bytes:Buffer.from(await workbook.xlsx.writeBuffer())};
  }
  if(format!=="pdf")throw new ReportError("INVALID_REPORT_FORMAT");
  const doc=new PDFDocument({size:"A4",margin:42,compress:true,info:{Title:"Authorized case report",Author:"Complain Setu"}}),chunks:Buffer[]=[];const result=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  doc.fontSize(17).text("Complain Setu - authorized case report").moveDown();doc.fontSize(10).text("Generated (UTC): "+data.generatedAt).text("Total matching cases: "+data.total).text("Missing region / case type / source / received date: "+[data.missing.region,data.missing.caseType,data.missing.source,data.missing.receivedDate].join(" / ")).moveDown();
  doc.text("This PDF provides counts and stable internal case identifiers. Use the same-filter CSV or Excel ledger for original Unicode institution names, source labels and full ledger fields. No narratives or identity details are included.").moveDown();
  doc.text("Filters (UTF-8 JSON) and the complete ledger are embedded in report.csv and scope.json.").moveDown();
  const csv=await reportFile(data,"csv");doc.file(csv.bytes,{name:"report.csv",description:"Authorized matching cases; UTF-8 CSV"});doc.file(Buffer.from(JSON.stringify({generatedAt:data.generatedAt,filters:data.filters,total:data.total,missing:data.missing,regions:data.regions},null,2)),{name:"scope.json",description:"Exact report scope, coverage and regional counts; UTF-8 JSON"});
  for(const [index,row]of data.rows.entries()){doc.fontSize(9).text(`${index+1}. Case internal ID: ${row.id.replace(/[^\x20-\x7e]/g,character=>"\\u"+character.charCodeAt(0).toString(16).padStart(4,"0"))}`).text(`Status: ${row.status} | Priority: ${row.priority} | Received: ${row.receivedDate} | Deadline: ${row.deadline}`).moveDown(0.7);}
  if(!data.rows.length)doc.text("Zero cases match the current authorized filters.");doc.end();return{type:"application/pdf",bytes:await result};
}
