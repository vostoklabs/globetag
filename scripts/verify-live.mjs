import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from '../functions/globe/node_modules/sharp/lib/index.js';
const secrets=JSON.parse(await readFile('.local/access.json','utf8'));
const url='https://globetag-6af1e4cc.fra.appwrite.run';
const call=async data=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://vostoklabs.github.io'},body:JSON.stringify(data),signal:AbortSignal.timeout(45000)});const body=await r.json();return {status:r.status,...body};};
const unauth=await call({action:'list'});assert.equal(unauth.status,401,JSON.stringify(unauth));
assert.equal((await call({action:'join',code:'wrong'})).status,401);
const join=await call({action:'join',code:secrets.GROUP_CODE});assert.equal(join.status,200,JSON.stringify(join));const session=join.token;
const image=await sharp({create:{width:64,height:64,channels:3,background:'#d76340'}}).jpeg().toBuffer();
const profile={name:'Temporary verification pin',city:'Zagreb',country:'Croatia',lng:15.98,lat:45.81,food:'Test food',fact:'Temporary automated verification; removed after testing.',photo:`data:image/jpeg;base64,${image.toString('base64')}`};
let saved;
try{
 saved=await call({action:'save',session,profile});assert.equal(saved.status,200,JSON.stringify(saved));const id=saved.profile.id;
 const list=await call({action:'list',session});assert.ok(list.profiles.some(p=>p.id===id));assert.ok(!JSON.stringify(list).includes(saved.editToken));assert.ok(!JSON.stringify(list).includes('editHash'));
 assert.equal((await call({action:'save',session,id,editToken:'wrong',profile})).status,403);
 assert.equal((await call({action:'delete',session,id,editToken:'wrong'})).status,403);
 const photo=await call({action:'photo',session,id});assert.equal(photo.status,200);assert.ok(photo.photo.startsWith('data:image/jpeg;base64,'));
 const direct=await fetch(`https://fra.cloud.appwrite.io/v1/storage/buckets/portraits/files/${saved.profile.photoId}/view?project=6af1e4cc00106a7d44aa`);assert.ok([401,403,404].includes(direct.status));
 const updated=await call({action:'save',session,id,editToken:saved.editToken,profile:{...profile,food:'Updated',photo:undefined}});assert.equal(updated.status,200,JSON.stringify(updated));assert.equal(updated.profile.food,'Updated');
 const owner=await call({action:'owner',ownerKey:secrets.OWNER_KEY});assert.equal(owner.status,200);const exported=await call({action:'export',session,ownerSession:owner.token});assert.equal(exported.status,200);
 const badOrigin=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://untrusted.example'},body:JSON.stringify({action:'list',session})});assert.equal(badOrigin.status,403);
 console.log('PASS: access code, private listing, create/update, photo upload/read, direct storage denial, ownership checks, owner export, and origin restriction.');
}finally{if(saved?.profile?.id){const removed=await call({action:'delete',session,id:saved.profile.id,editToken:saved.editToken});assert.equal(removed.status,200,JSON.stringify(removed));console.log('Removed temporary verification pin and photo.');}}
