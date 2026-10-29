import {createHash} from "node:crypto";
import fs from "node:fs";
import type {AuditLog} from "../models/types.js";
import type {AuditIntegrity,AuditCheckpoint} from "../models/auditIntegrity.js";
/** JSON-domain canonical form: sorted object keys; array order is significant. */
export function deterministicJson(value:unknown):string{
  const json=JSON.parse(JSON.stringify(value));
  const encode=(item:any):string=>item===null||typeof item!=="object"?JSON.stringify(item):Array.isArray(item)?"["+item.map(encode).join(",")+"]":"{"+Object.keys(item).sort().map(key=>JSON.stringify(key)+":"+encode(item[key])).join(",")+"}";
  return encode(json);
}
export const auditDigest=(value:unknown)=>createHash("sha256").update(deterministicJson(value)).digest("hex");
const genesis=(legacyCount:number,legacyDigest:string)=>auditDigest({schema:"sha256-global-v1",scope:"operational-global",legacyCount,legacyDigest});
export function externalAuditCheckpoint():AuditCheckpoint|undefined{
  const file=process.env.AUDIT_CHECKPOINT_FILE;if(!file)return undefined;
  try{if(fs.statSync(file).size>8192)throw new Error();return JSON.parse(fs.readFileSync(file,"utf8")) as AuditCheckpoint;}catch{throw Object.assign(new Error("Independent audit checkpoint is unavailable."),{code:"AUDIT_CHECKPOINT_UNAVAILABLE"});}
}
export function initializeAuditIntegrity(logs:AuditLog[]):AuditIntegrity{const legacyDigest=auditDigest(logs);return{schema:"sha256-global-v1",scope:"operational-global",legacyCount:logs.length,legacyDigest,genesisHash:genesis(logs.length,legacyDigest),entries:[],checkpoints:[]};}
type Verification={valid:boolean;code:string;sequence?:number;entries?:number;legacyCount?:number;head?:string;genesisHash?:string;legacyDigest?:string;externalCheckpoint?:"not_configured"|"verified"};
export function verifyAuditIntegrity(logs:AuditLog[],state:AuditIntegrity|undefined,external?:AuditCheckpoint,allowPending=false):Verification{
  const fail=(code:string,sequence?:number):Verification=>({valid:false,code,sequence:Number.isSafeInteger(sequence)?sequence:undefined});
  try{
    if(!state||state.schema!=="sha256-global-v1"||state.scope!=="operational-global"||!Number.isSafeInteger(state.legacyCount)||state.legacyCount<0||!Array.isArray(state.entries)||!Array.isArray(state.checkpoints)||logs.length<state.legacyCount)return fail("MALFORMED_AUDIT_STATE");
    if(state.legacyDigest!==auditDigest(logs.slice(0,state.legacyCount))||state.genesisHash!==genesis(state.legacyCount,state.legacyDigest))return fail("LEGACY_ANCHOR_MISMATCH",0);
    const covered=state.legacyCount+state.entries.length;if(logs.length<covered||!allowPending&&logs.length!==covered)return fail("EVENT_COUNT_MISMATCH");
    const ids=new Set(logs.slice(0,state.legacyCount).map(log=>log.id));for(const log of logs.slice(state.legacyCount)){if(!log||typeof log.id!=="string"||!log.id||ids.has(log.id))return fail("MALFORMED_OR_DUPLICATE_EVENT");ids.add(log.id);}
    let previous=state.genesisHash;
    for(let index=0;index<state.entries.length;index++){
      const entry=state.entries[index],sequence=index+1,event=logs[state.legacyCount+index];
      if(!entry||entry.sequence!==sequence||entry.auditId!==event.id||entry.eventHash!==auditDigest(event)||entry.previousHash!==previous||entry.hash!==auditDigest({sequence,auditId:entry.auditId,eventHash:entry.eventHash,previousHash:previous}))return fail("CHAIN_MISMATCH",sequence);
      previous=entry.hash;
    }
    const checkpoints=[...state.checkpoints,...(external?[external]:[])];
    for(const checkpoint of checkpoints){if(!checkpoint||!Number.isSafeInteger(checkpoint.sequence)||checkpoint.sequence<0||checkpoint.sequence>state.entries.length||checkpoint.genesisHash!==state.genesisHash||checkpoint.legacyDigest!==state.legacyDigest||checkpoint.hash!==(checkpoint.sequence===0?state.genesisHash:state.entries[checkpoint.sequence-1].hash))return fail("CHECKPOINT_MISMATCH",checkpoint?.sequence);}
    return{valid:true,code:"VERIFIED",entries:state.entries.length,legacyCount:state.legacyCount,head:previous,genesisHash:state.genesisHash,legacyDigest:state.legacyDigest,externalCheckpoint:external?"verified":"not_configured"};
  }catch{return fail("MALFORMED_AUDIT_STATE");}
}
/** Called within the same domain commit as the audited mutation. Never repairs a broken chain. */
export function appendPendingAuditEvents(logs:AuditLog[],state:AuditIntegrity,external?:AuditCheckpoint){
  const verification=verifyAuditIntegrity(logs,state,external,true);if(!verification.valid)throw Object.assign(new Error("Audit integrity check failed; writes are blocked."),{code:verification.code});
  for(const event of logs.slice(state.legacyCount+state.entries.length)){
    const sequence=state.entries.length+1,previousHash=state.entries.at(-1)?.hash||state.genesisHash,eventHash=auditDigest(event);
    state.entries.push({sequence,auditId:event.id,eventHash,previousHash,hash:auditDigest({sequence,auditId:event.id,eventHash,previousHash})});
  }
}
