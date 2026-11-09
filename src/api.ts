import type { Draft, Profile } from './types';
export const apiUrl = import.meta.env.VITE_API_URL?.trim();
export const demo = !apiUrl;
const key = demo ? 'small-world-demo' : 'small-world-live-v2';
export const storageKey=key;
export const readLocal = <T,>(name:string,fallback:T):T => {try{return JSON.parse(localStorage.getItem(`${key}:${name}`)||'null')??fallback;}catch{return fallback;}};
export const writeLocal=(name:string,value:unknown)=>localStorage.setItem(`${key}:${name}`,JSON.stringify(value));
const examples:Profile[]=[
 {id:'sample-1',name:'Mia K.',city:'Zagreb',country:'Croatia',lng:15.98,lat:45.81,food:'Štrukli, always.',fact:'A cannon fires from a tower here every day at noon.'},
 {id:'sample-2',name:'Oliver',city:'Copenhagen',country:'Denmark',lng:12.57,lat:55.68,food:'A really good cinnamon bun',fact:'Our busiest cycling bridge has its own bicycle counter.'},
 {id:'sample-3',name:'Sofia',city:'Lisbon',country:'Portugal',lng:-9.14,lat:38.72,food:'Pastéis de nata',fact:'Some of our trams are older than our grandparents.'},
 {id:'sample-4',name:'Ren',city:'Kyoto',country:'Japan',lng:135.77,lat:35.01,food:'Matcha everything',fact:'The river stepping stones include little stone turtles.'},
 {id:'sample-5',name:'Amara',city:'Nairobi',country:'Kenya',lng:36.82,lat:-1.29,food:'Nyama choma',fact:'There is a national park right beside the city.'},
 {id:'sample-6',name:'Leo',city:'São Paulo',country:'Brazil',lng:-46.63,lat:-23.55,food:'Pão de queijo',fact:'Sunday turns a huge avenue into a place to walk and dance.'},
 {id:'sample-7',name:'Jules',city:'Montréal',country:'Canada',lng:-73.57,lat:45.5,food:'A warm bagel',fact:'There is a whole network of pedestrian tunnels under downtown.'}
];
export async function request(action:string,data:Record<string,unknown>={}):Promise<any> {
 if(demo){
  let profiles=readLocal<Profile[]>('profiles',examples);
  if(action==='join')return {token:'demo-session',canCreate:!readLocal('created',false),ownId:readLocal('createdId',null),visitorCode:'DEMO-BROWSER'};
  if(action==='list')return {profiles,canCreate:!readLocal('created',false),ownId:readLocal('createdId',null),visitorCode:'DEMO-BROWSER'};
  if(action==='edit_open'){
   const p=profiles.find(p=>p.id===data.id);
   if(data.id!==readLocal('createdId',null)||!p)throw Error('This browser does not own that marker.');
   return {profile:p};
  }
  if(action==='save'){
   if(data.id&&data.id!==readLocal('createdId',null))throw Error('This browser does not own that marker.');
   if(!data.id&&readLocal('created',false))throw Error('This browser already has a marker.');
   const draft=data.profile as Draft,id=(data.id as string)||crypto.randomUUID();
   const old=profiles.find(p=>p.id===id),profile={...old,...draft,id,photo:draft.photo===null?undefined:draft.photo??old?.photo};
   profiles=[...profiles.filter(p=>p.id!==id),profile];writeLocal('profiles',profiles);writeLocal('created',true);writeLocal('createdId',id);return {profile};
  }
  if(action==='photo')return {};
  throw Error('This action is available after connecting Appwrite.');
 }
 let visitorToken=readLocal<string>('visitorToken','');
 if(!visitorToken){const bytes=crypto.getRandomValues(new Uint8Array(32));visitorToken=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');writeLocal('visitorToken',visitorToken);}
 const response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,session:readLocal('session',''),visitorToken,...data}),signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
 if(!response.ok)throw Object.assign(new Error(result.error||'Could not complete the request.'),{status:response.status});
 return result;
}
export async function compressPhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, or WebP photo.');
 if(file.size>12*1024*1024)throw Error('Choose a photo under 12 MB.');
 const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d')!;const side=Math.min(bitmap.width,bitmap.height);
 ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,512,512);bitmap.close();
 return canvas.toDataURL('image/jpeg',0.8);
}
