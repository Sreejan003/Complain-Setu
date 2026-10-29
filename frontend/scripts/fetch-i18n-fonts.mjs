// Build-time download of public OFL fonts. Never reads application records or credentials.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const fonts={Deva:"Noto Sans Devanagari",Gujr:"Noto Sans Gujarati",Taml:"Noto Sans Tamil",Telu:"Noto Sans Telugu",Beng:"Noto Sans Bengali",Knda:"Noto Sans Kannada",Mlym:"Noto Sans Malayalam",Guru:"Noto Sans Gurmukhi",Orya:"Noto Sans Oriya",Mtei:"Noto Sans Meetei Mayek",Olck:"Noto Sans Ol Chiki",Arab:"Noto Naskh Arabic"};
const headers={"User-Agent":"Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"};
async function get(url){const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Font request failed: ${response.status} ${url}`);return response;}
for(const [script,family]of Object.entries(fonts)){
  const dir=path.resolve("public/fonts",script);await fs.mkdir(dir,{recursive:true});
  const source=`https://fonts.googleapis.com/css2?family=${family.replaceAll(" ","+")}:wght@400;600&display=swap`;
  let css=await (await get(source)).text();
  for(const url of new Set(Array.from(css.matchAll(/url\((https:[^)]+)\)/g),m=>m[1]))){
    const name=crypto.createHash("sha256").update(url).digest("hex").slice(0,16)+path.extname(new URL(url).pathname);
    await fs.writeFile(path.join(dir,name),Buffer.from(await (await get(url)).arrayBuffer()));css=css.replaceAll(url,"./"+name);
  }
  const license=`https://raw.githubusercontent.com/google/fonts/main/ofl/${family.toLowerCase().replaceAll(" ","")}/OFL.txt`;
  await fs.writeFile(path.join(dir,"OFL.txt"),await (await get(license)).text());
  await fs.writeFile(path.join(dir,"font.css"),`/* ${family}; source: ${source}; license: ./OFL.txt */\n`+css);
  console.log(`${script}: ${family} downloaded locally with license`);
}
