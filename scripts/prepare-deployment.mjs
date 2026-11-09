import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { create } from 'tar';
await mkdir('.local',{recursive:true});
let secrets;
try { secrets=JSON.parse(await readFile('.local/access.json','utf8')); }
catch { secrets={GROUP_CODE:randomBytes(18).toString('base64url'),SESSION_SECRET:randomBytes(48).toString('base64url'),OWNER_KEY:randomBytes(36).toString('base64url')};await writeFile('.local/access.json',JSON.stringify(secrets,null,2)); }
await create({gzip:true,file:'.local/globe-api.tgz',cwd:'functions/globe'},['package.json','package-lock.json','src']);
// This output is for the orchestration tool only; do not print it in chat or commit it.
if(process.argv.includes('--transfer'))process.stdout.write(JSON.stringify({secrets,archive:(await readFile('.local/globe-api.tgz')).toString('base64')}));
else console.log('Prepared .local/globe-api.tgz and local access credentials.');
