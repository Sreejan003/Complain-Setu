import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import yauzl from "yauzl";
import { IMPORT_FIELDS } from "../models/ingestion.js";
export const IMPORT_LIMITS={fileBytes:2*1024*1024,rows:200,columns:32,cellCharacters:20000,zipEntries:64,zipEntryBytes:4*1024*1024,zipTotalBytes:16*1024*1024};
export class ImportError extends Error { constructor(public code:string,public status=400){super(code);} }
export function importFail(code:string,status=400):never{throw new ImportError(code,status);}
export type ParsedImport={format:"csv"|"xlsx";headers:string[];rows:{cells:string[];errors:string[];number?:number}[]};
const decode=(bytes:Buffer)=>{try{return new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{return importFail("UTF8_REQUIRED");}};
async function validateArchive(bytes:Buffer){
  await new Promise<void>((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
    if(error||!zip){reject(new ImportError("MALFORMED_XLSX"));return;}
    let count=0,total=0,finished=false;const names=new Set<string>();
    const fail=(code:string)=>{if(finished)return;finished=true;zip.close();reject(new ImportError(code));};
    zip.on("error",()=>fail("MALFORMED_XLSX"));zip.on("end",()=>{if(!finished){finished=true;resolve();}});
    zip.on("entry",(entry:yauzl.Entry)=>{
      if(++count>IMPORT_LIMITS.zipEntries||entry.uncompressedSize>IMPORT_LIMITS.zipEntryBytes||entry.uncompressedSize/Math.max(1,entry.compressedSize)>300||names.has(entry.fileName)||entry.generalPurposeBitFlag&1){fail("XLSX_ARCHIVE_LIMIT_OR_ENCRYPTION");return;}
      names.add(entry.fileName);
      if(entry.fileName.endsWith("/")){zip.readEntry();return;}
      if(!/^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:core|app)\.xml|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|styles\.xml|sharedStrings\.xml|theme\/theme\d+\.xml|worksheets\/sheet\d+\.xml))$/.test(entry.fileName)){fail("XLSX_UNSUPPORTED_PART");return;}
      zip.openReadStream(entry,(streamError,stream)=>{
        if(streamError||!stream){fail("MALFORMED_XLSX");return;}
        const chunks:Buffer[]=[];let entryBytes=0;
        stream.on("error",()=>fail("MALFORMED_XLSX"));stream.on("data",(chunk:Buffer)=>{entryBytes+=chunk.length;total+=chunk.length;if(entryBytes>IMPORT_LIMITS.zipEntryBytes||total>IMPORT_LIMITS.zipTotalBytes){stream.destroy();fail("XLSX_EXPANSION_LIMIT");}else chunks.push(chunk);});
        stream.on("end",()=>{
          if(finished)return;let xml:string;try{xml=decode(Buffer.concat(chunks));}catch{fail("UTF8_REQUIRED");return;}
          if(/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(xml)){fail("XLSX_EXTERNAL_CONTENT_UNSUPPORTED");return;}
          if(entry.fileName.startsWith("xl/worksheets/"))for(const match of xml.matchAll(/\b(?:r|ref)=["']([A-Z]+)?(\d+)(?::([A-Z]+)(\d+))?["']/g)){
            const column=(text:string)=>[...text].reduce((sum,char)=>sum*26+char.charCodeAt(0)-64,0);
            if(Number(match[2])>IMPORT_LIMITS.rows+1||Number(match[4]||0)>IMPORT_LIMITS.rows+1||column(match[1]||"A")>IMPORT_LIMITS.columns||column(match[3]||"A")>IMPORT_LIMITS.columns){fail("XLSX_DIMENSION_LIMIT");return;}
          }
          zip.readEntry();
        });
      });
    });zip.readEntry();
  }));
}
function tabular(format:ParsedImport["format"],rows:ParsedImport["rows"]):ParsedImport{
  if(rows.length<2||rows.length>IMPORT_LIMITS.rows+1)importFail("IMPORT_ROW_LIMIT");
  const first=rows.shift()!;if(first.errors.length)importFail("INVALID_HEADERS");const headers=first.cells.map(value=>value.trim());
  if(!headers.length||headers.length>IMPORT_LIMITS.columns||headers.some(value=>!value||value.length>100||["__proto__","constructor","prototype"].includes(value))||new Set(headers).size!==headers.length)importFail("INVALID_HEADERS");
  for(const row of rows){if(row.cells.length!==headers.length)row.errors.push("COLUMN_COUNT_MISMATCH");if(row.cells.some(value=>value.length>IMPORT_LIMITS.cellCharacters))row.errors.push("CELL_TOO_LONG");}
  return{format,headers,rows};
}
export async function parseImportFile(file:{buffer:Buffer;originalname:string;mimetype:string}):Promise<ParsedImport>{
  if(!file?.buffer?.length||file.buffer.length>IMPORT_LIMITS.fileBytes)importFail("IMPORT_FILE_LIMIT");
  if(/\.csv$/i.test(file.originalname)){
    if(!["text/csv","text/plain","application/vnd.ms-excel","application/octet-stream"].includes(file.mimetype))importFail("UNSUPPORTED_IMPORT_FORMAT");
    let rows:string[][];try{rows=parse(decode(file.buffer),{bom:true,skip_empty_lines:true,relax_column_count:true,max_record_size:40000,cast:false});}catch(error){if(error instanceof ImportError)throw error;return importFail("MALFORMED_CSV");}
    return tabular("csv",rows.map(cells=>({cells,errors:[]})));
  }
  if(!/\.xlsx$/i.test(file.originalname)||!["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/octet-stream"].includes(file.mimetype)||file.buffer.subarray(0,4).toString("hex")!=="504b0304")importFail("UNSUPPORTED_IMPORT_FORMAT");
  await validateArchive(file.buffer);
  const book=new ExcelJS.Workbook();try{await book.xlsx.load(file.buffer as any);}catch{return importFail("MALFORMED_XLSX");}
  if(book.worksheets.length!==1||book.worksheets[0].state!=="visible")importFail("ONE_VISIBLE_SHEET_REQUIRED");
  const sheet=book.worksheets[0];if(sheet.rowCount>IMPORT_LIMITS.rows+1||sheet.columnCount>IMPORT_LIMITS.columns)importFail("XLSX_DIMENSION_LIMIT");
  const rows:ParsedImport["rows"]=[];
  for(let number=1;number<=sheet.rowCount;number++){
    const errors:string[]=[],cells:string[]=[];
    for(let col=1;col<=sheet.columnCount;col++){
      const value=sheet.getRow(number).getCell(col).value;
      if(value===null||value===undefined)cells.push("");else if(["string","number","boolean"].includes(typeof value))cells.push(String(value));else{cells.push("");errors.push(value instanceof Date?"DATE_MUST_BE_ISO_TEXT":"FORMULA_OR_COMPLEX_CELL_UNSUPPORTED");}
    }
    if(cells.some(Boolean)||errors.length)rows.push({cells,errors,number});
  }
  return tabular("xlsx",rows);
}
export async function importTemplate(format:"csv"|"xlsx"){
  const sample=["complaint","grievance","Faculty Shortage / Irregularities","letter","EXAMPLE-001","2026-01-01","RB","Enter source institution","","Example intake title","Example original complaint text","Medium","","Manually imported source metadata","",""];
  if(format==="csv")return Buffer.from([IMPORT_FIELDS.join(","),sample.map(value=>'"'+value.replaceAll('"','""')+'"').join(",")].join("\r\n"),"utf8");
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Intake");sheet.addRow([...IMPORT_FIELDS]);sheet.addRow(sample);return Buffer.from(await book.xlsx.writeBuffer());
}
