import { randomUUID } from "node:crypto";
import { execFile, spawn, ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
const execute = promisify(execFile);

/** Real native PostgreSQL binaries from the pinned development runtime. Never creates a system account/service. */
export async function isolatedPostgres() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setu-pg-integration-"));
  const reservation = net.createServer();
  await new Promise<void>((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const password = randomUUID(), platform = process.platform === "win32" ? "windows" : process.platform;
  const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
  const passwordFile = directory + ".password"; fs.writeFileSync(passwordFile,password,{flag:"wx",mode:0o600});
  try { await execute(binaries.initdb,["-D",directory,"-U","setu_test",`--pwfile=${passwordFile}`,"--auth=scram-sha-256","--encoding=UTF8","--locale=C"],{windowsHide:true,timeout:45000}); }
  finally { fs.unlinkSync(passwordFile); }
  let child:ChildProcess|undefined, exited:Promise<void>|undefined;
  const cluster = {
    getPgClient(database="postgres",host="127.0.0.1"){return new pg.Client({user:"setu_test",password,port,host,database});},
    async start(){
      if(child&&child.exitCode===null)throw new Error("Test cluster is already running");
      child=spawn(binaries.postgres,["-D",directory,"-p",String(port),"-h","127.0.0.1"],{windowsHide:true,stdio:["ignore","pipe","pipe"],env:{...process.env,LC_MESSAGES:"C"}});
      const processHandle=child;exited=new Promise(resolve=>processHandle.once("exit",()=>resolve()));
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Isolated PostgreSQL startup timed out")),30000);processHandle.once("error",()=>{clearTimeout(timer);reject(new Error("Isolated PostgreSQL could not start"));});processHandle.once("exit",()=>{clearTimeout(timer);reject(new Error("Isolated PostgreSQL exited before readiness"));});processHandle.stderr?.on("data",chunk=>{if(chunk.toString().includes("database system is ready to accept connections")){clearTimeout(timer);resolve();}});});
    },
    async stop(){if(!child||child.exitCode!==null)return;await execute(binaries.pg_ctl,["stop","-D",directory,"-m","fast","-w","-t","10"],{windowsHide:true,timeout:15000});await exited;}
  };
  await cluster.start();
  return { cluster, directory, connectionString: `postgresql://setu_test:${password}@127.0.0.1:${port}/postgres`,
    async stop() { await cluster.stop(); const resolved = path.resolve(directory), root = path.resolve(os.tmpdir()); if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith("setu-pg-integration-")) throw new Error("Refusing to clean an unrecognized test directory"); fs.rmSync(resolved, { recursive: true, force: true }); }
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = await isolatedPostgres();
  try { const client = runtime.cluster.getPgClient(); await client.connect(); try { const result = await client.query("SELECT current_setting('server_version') AS version"); console.log(`PASS isolated PostgreSQL runtime ${result.rows[0].version}; operational database untouched.`); } finally { await client.end(); } }
  finally { await runtime.stop(); }
}
