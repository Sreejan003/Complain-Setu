import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { OperationalPostgres, emptyOperationalSnapshot, validateSnapshot } from "./operationalPostgres.js";

/** The caller explicitly selects the authority. Existing PostgreSQL state is never overwritten. */
export async function backfillJson(file: string, target: OperationalPostgres) {
  const resolved=path.resolve(file);const snapshot=JSON.parse(fs.readFileSync(resolved,"utf8"));validateSnapshot(snapshot);
  return target.importSnapshot(snapshot);
}
export async function bootstrapEmpty(target:OperationalPostgres) {
  const email=process.env.BOOTSTRAP_ADMIN_EMAIL,password=process.env.BOOTSTRAP_ADMIN_PASSWORD,name=process.env.BOOTSTRAP_ADMIN_NAME;
  if(!email||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<16||!name?.trim())throw new Error("Bootstrap requires an admin email, name and password of at least 16 characters through environment configuration");
  const snapshot=emptyOperationalSnapshot(),now=new Date().toISOString();
  snapshot.profiles.push({id:randomUUID(),email:email.toLowerCase(),fullName:name.trim(),role:"SYSTEM_ADMIN",isActive:true,passwordHash:await bcrypt.hash(password,12),permissions:[],createdAt:now,updatedAt:now});
  return target.importSnapshot(snapshot);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const target=new OperationalPostgres();
  try{const index=process.argv.indexOf("--from-json");if(index>=0&&process.argv[index+1])console.log(await backfillJson(process.argv[index+1],target));else if(process.argv.includes("--bootstrap-empty"))console.log(await bootstrapEmpty(target));else throw new Error("Specify --from-json <backup.json> or --bootstrap-empty; no data will be selected automatically");}
  catch{console.error("Operational import failed. Existing authority was not overwritten; check configuration, source format, migration and referential integrity.");process.exitCode=1;}
  finally{await target.close();}
}
