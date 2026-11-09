import { auth, digest, equal, HttpError, publicProfile, secret, validateProfile } from './security.mjs';
export function createHandler(config,store){
 const sessions=auth(config);
 return async body=>{
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Expected a JSON request.');
  const {action}=body;
  if(action==='join'||action==='owner'){
   await store.rateLimit('auth',120);
   if(action==='join'){
    if(typeof body.code!=='string'||body.code.length>200||!equal(body.code,config.groupCode))throw new HttpError(401,'That community code isn’t right. Try again.');
    return {token:sessions.issue('member')};
   }
   if(typeof body.ownerKey!=='string'||!equal(body.ownerKey,config.ownerKey))throw new HttpError(401,'The owner key is not valid.');
   return {token:sessions.issue('owner'),session:sessions.issue('member')};
  }
  sessions.verify(body.session,'member');
  if(action==='list')return {profiles:(await store.list()).map(publicProfile)};
  if(action==='export'){sessions.verify(body.ownerSession,'owner');return {profiles:(await store.list()).map(publicProfile),exportedAt:new Date().toISOString()};}
  if(action==='save'){
   await store.rateLimit('writes',240);
   const profile=validateProfile(body.profile);let existing;
   if(body.id){existing=await store.get(body.id);if(typeof body.editToken!=='string'||!equal(digest(body.editToken),existing.editHash))throw new HttpError(403,'This edit link doesn’t own that pin.');}
   const editToken=existing?body.editToken:secret();const id=existing?.$id||`p_${secret().slice(0,30)}`;let photoId=existing?.photoId||'';let uploaded='';
   if(body.profile.photo===null)photoId='';
   else if(body.profile.photo!==undefined){uploaded=await store.upload(body.profile.photo);photoId=uploaded;}
   let row;
   try{row=await store.save(id,{publicJson:JSON.stringify(profile),editHash:digest(editToken),photoId},!!existing);}catch(e){if(uploaded)await store.removePhoto(uploaded).catch(()=>{});throw e;}
   if(existing?.photoId&&existing.photoId!==photoId)await store.removePhoto(existing.photoId).catch(()=>{});
   return {profile:publicProfile(row),editToken};
  }
  if(action==='delete'){
   const existing=await store.get(body.id);
   if(body.ownerSession)sessions.verify(body.ownerSession,'owner');
   else if(typeof body.editToken!=='string'||!equal(digest(body.editToken),existing.editHash))throw new HttpError(403,'This edit link doesn’t own that pin.');
   // Delete the image first so removal never leaves a publicly retrievable profile photo.
   if(existing.photoId)await store.removePhoto(existing.photoId);
   await store.remove(existing.$id);return {ok:true};
  }
  if(action==='photo'){
   const row=await store.get(body.id);return {photo:row.photoId?await store.photo(row.photoId):null};
  }
  throw new HttpError(400,'Unknown action.');
 };
}
