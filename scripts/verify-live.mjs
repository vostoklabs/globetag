import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from '../functions/globe/node_modules/sharp/lib/index.js';
const secrets=JSON.parse(await readFile('.local/access.json','utf8'));
const url='https://globetag-6af1e4cc.fra.appwrite.run';
const call=async(data,origin='https://vostoklabs.github.io')=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(data),signal:AbortSignal.timeout(45000)});return {status:r.status,...await r.json()};};
const outsider=await call({action:'list'});assert.equal(outsider.status,401,JSON.stringify(outsider));
const owner=await call({action:'owner',ownerKey:secrets.OWNER_KEY},'null');assert.equal(owner.status,200,JSON.stringify(owner));const ownerSession=owner.token;
assert.equal((await call({action:'owner_state',ownerSession},'null')).status,200);
const invite=await call({action:'owner_create_invite',ownerSession,label:'Temporary v2 verification',days:1},'null');assert.equal(invite.status,200,JSON.stringify(invite));
const visitorToken=randomBytes(32).toString('hex');let saved;
try{
 const join=await call({action:'join',code:invite.code,visitorToken});assert.equal(join.status,200,JSON.stringify(join));const session=join.token;
 const image=await sharp({create:{width:64,height:64,channels:3,background:'#d76340'}}).jpeg().toBuffer();
 const profile={name:'Temporary permission test',city:'Zagreb',country:'Croatia',lng:15.98,lat:45.81,food:'',fact:'',links:[{name:'Test profile link',url:'https://example.com/'}],photo:`data:image/jpeg;base64,${image.toString('base64')}`};
 saved=await call({action:'save',session,profile});assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.editToken,undefined);const id=saved.profile.id;
 assert.equal((await call({action:'save',session,profile})).status,409);
 assert.equal((await call({action:'save',session,id,profile})).status,403);
 assert.equal((await call({action:'save',visitorToken,id,profile:{...profile,photo:undefined}})).status,200);
 assert.equal((await call({action:'edit_open',visitorToken,id})).profile.links[0].name,'Test profile link');
 assert.equal((await call({action:'edit_open',visitorToken:randomBytes(32).toString('hex'),id})).status,403);
 assert.equal((await call({action:'delete',session,id})).status,403);
 const same=await call({action:'join',code:invite.code,visitorToken});assert.equal(same.canCreate,false);assert.equal(same.ownId,id);
 const photo=await call({action:'photo',session,id});assert.equal(photo.status,200);assert.ok(photo.photo.startsWith('data:image/jpeg;base64,'));
 const direct=await fetch(`https://fra.cloud.appwrite.io/v1/storage/buckets/portraits/files/${saved.profile.photoId}/view?project=6af1e4cc00106a7d44aa`);assert.ok([401,403,404].includes(direct.status));
 const grant=await call({action:'owner_issue_edit',ownerSession,id},'null');assert.equal(grant.status,200,JSON.stringify(grant));
 const updated=await call({action:'save',id,editToken:grant.code,profile:{...profile,food:'Updated with owner code',photo:undefined}});assert.equal(updated.status,200,JSON.stringify(updated));
 assert.equal((await call({action:'list',session:grant.code})).status,401);
 await call({action:'owner_revoke_edit',ownerSession,id},'null');assert.equal((await call({action:'edit_open',id,editToken:grant.code})).status,403);
 await call({action:'owner_revoke_invite',ownerSession,id:invite.id},'null');assert.equal((await call({action:'list',session})).status,401);
 console.log('PASS: local owner origin, invitations, one marker per visitor, remembered browser editing and stranger denial, private photos, owner-issued edits, edit revocation, and invitation revocation.');
}finally{
 if(saved?.profile?.id){const r=await call({action:'owner_delete',ownerSession,id:saved.profile.id},'null');assert.equal(r.status,200,JSON.stringify(r));console.log('Removed temporary marker and photo.');}
 await call({action:'owner_revoke_invite',ownerSession,id:invite.id},'null');
}
