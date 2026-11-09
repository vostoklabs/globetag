import { auth, digest, equal, HttpError, publicProfile, secret, validateProfile } from './security.mjs';
const inviteId=code=>`i_${digest(code).slice(0,30)}`;
const claimId=visitor=>`c_${visitor}`;
export function createHandler(config,store){
 const sessions=auth(config);
 const group=async()=>{const g=await store.accessGet('group');if(!g)throw new HttpError(503,'The owner needs to configure group access.');return g;};
 const activeInvite=async id=>{const i=await store.accessGet(id);if(!i?.active||(i.expires&&i.expires<=Date.now()))throw new HttpError(401,'This invitation has expired or been revoked. Ask the owner for a new link.');return i;};
 const member=async token=>{const c=sessions.verify(token,'member'),g=await group();if(c.groupEpoch!==g.epoch)throw new HttpError(401,'Group access changed. Open a current invitation.');if(c.inviteId)await activeInvite(c.inviteId);return c;};
 const editGrant=async(id,token)=>{const grant=await store.accessGet(`e_${id}`);if(!grant?.active||grant.expires<=Date.now()||typeof token!=='string'||!equal(grant.hash,digest(token)))throw new HttpError(403,'This edit code is invalid, expired, or revoked. Ask the owner for a new one.');};
 const authorizeEdit=async body=>{
  if(typeof body.visitorToken==='string'&&/^[A-Za-z0-9_-]{32,100}$/.test(body.visitorToken)){
   const claim=await store.accessGet(claimId(digest(body.visitorToken).slice(0,30)));
   if(claim?.profileId===body.id)return;
  }
  await editGrant(body.id,body.editToken);
 };
 return async body=>{
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Expected a JSON request.');
  const {action}=body;
  if(action==='owner'){
   await store.rateLimit('auth',120);
   if(typeof body.ownerKey!=='string'||!equal(body.ownerKey,config.ownerKey))throw new HttpError(401,'The owner key is not valid.');
   return {token:sessions.issue('owner')};
  }
  if(typeof action==='string'&&action.startsWith('owner_')){
   sessions.verify(body.ownerSession,'owner');await store.rateLimit('owner',120);
   if(action==='owner_state'){
    const g=await group(),records=await store.accessList();
    return {group:{name:g.name},invitations:records.filter(r=>r.id.startsWith('i_')).map(({id,label,active,expires,createdAt})=>({id,label,active,expires,createdAt})),profiles:(await store.list()).map(publicProfile),editGrants:records.filter(r=>r.id.startsWith('e_')).map(({id,active,expires})=>({id:id.slice(2),active,expires}))};
   }
   if(action==='owner_rotate_group'){const g=await group(),code=secret();await store.accessSet('group',{...g,codeHash:digest(code),epoch:secret()});return {code};}
   if(action==='owner_create_invite'){
    const code=secret(),id=inviteId(code),days=Number(body.days??30);if(!Number.isInteger(days)||days<1||days>365)throw new HttpError(400,'Choose an expiry from 1 to 365 days.');
    const label=String(body.label||'Discord invitation').trim().slice(0,80),expires=Date.now()+days*86400000;
    await store.accessCreate(id,{label,active:true,expires,createdAt:new Date().toISOString()});return {id,code,expires};
   }
   if(action==='owner_revoke_invite'){
    if(typeof body.id!=='string'||!body.id.startsWith('i_'))throw new HttpError(400,'Invalid invitation.');const i=await store.accessGet(body.id);if(!i)throw new HttpError(404,'Invitation not found.');await store.accessSet(body.id,{...i,active:false});return {ok:true};
   }
   if(action==='owner_issue_edit'){
    await store.get(body.id);const code=secret(),hours=Number(body.hours??24);if(!Number.isInteger(hours)||hours<1||hours>168)throw new HttpError(400,'Choose an expiry from 1 to 168 hours.');const expires=Date.now()+hours*3600000;
    await store.accessSet(`e_${body.id}`,{hash:digest(code),active:true,expires});return {id:body.id,code,expires};
   }
   if(action==='owner_revoke_edit'){await store.get(body.id);await store.accessSet(`e_${body.id}`,{hash:'',active:false,expires:0});return {ok:true};}
   if(action==='owner_delete'){const row=await store.get(body.id);if(row.photoId)await store.removePhoto(row.photoId);await store.remove(row.$id);await store.accessSet(`e_${row.$id}`,{hash:'',active:false,expires:0});return {ok:true};}
   if(action==='owner_export')return {profiles:(await store.list()).map(publicProfile),exportedAt:new Date().toISOString()};
   throw new HttpError(400,'Unknown owner action.');
  }
  if(action==='join'){
   await store.rateLimit('auth',120);
   if(typeof body.code!=='string'||body.code.length>200)throw new HttpError(401,'Enter a valid invitation or group code.');
   if(typeof body.visitorToken!=='string'||!(/^[A-Za-z0-9_-]{32,100}$/).test(body.visitorToken))throw new HttpError(400,'A browser visitor code is required.');
   const g=await group(),visitorId=digest(body.visitorToken).slice(0,30);let invitation;
   if(!equal(digest(body.code),g.codeHash)){invitation=inviteId(body.code);await activeInvite(invitation);}
   const claim=await store.accessGet(claimId(visitorId));
   return {token:sessions.issue('member',{visitorId,inviteId:invitation,groupEpoch:g.epoch}),visitorCode:visitorId.slice(0,12).toUpperCase(),ownId:claim?.profileId??null,canCreate:!!invitation&&!claim};
  }
  // Edit codes authorize this marker only, independently of the viewing invitation.
  if(action==='edit_open'){await store.rateLimit('auth',120);await authorizeEdit(body);return {profile:publicProfile(await store.get(body.id))};}
  if(action==='save'&&body.id){
   await store.rateLimit('writes',240);await authorizeEdit(body);
   const existing=await store.get(body.id),profile=validateProfile(body.profile);let photoId=existing.photoId||'',uploaded='';
   if(body.profile.photo===null)photoId='';else if(body.profile.photo!==undefined){uploaded=await store.upload(body.profile.photo);photoId=uploaded;}
   let row;try{row=await store.save(existing.$id,{publicJson:JSON.stringify(profile),photoId,editHash:existing.editHash},true);}catch(e){if(uploaded)await store.removePhoto(uploaded).catch(()=>{});throw e;}
   if(existing.photoId&&existing.photoId!==photoId)await store.removePhoto(existing.photoId).catch(()=>{});
   return {profile:publicProfile(row)};
  }
  const claims=await member(body.session),ownClaim=await store.accessGet(claimId(claims.visitorId));
  if(action==='list')return {profiles:(await store.list()).map(publicProfile),ownId:ownClaim?.profileId??null,canCreate:!!claims.inviteId&&!ownClaim,visitorCode:claims.visitorId.slice(0,12).toUpperCase()};
  if(action==='save'){
   if(!claims.inviteId)throw new HttpError(403,'This is a view-only group code. Ask the owner for an invitation to add a marker.');
   await store.rateLimit('writes',240);const profile=validateProfile(body.profile),id=`p_${claims.visitorId}`;
   try{await store.accessCreate(claimId(claims.visitorId),{profileId:id});}catch(e){if(e.code===409)throw new HttpError(409,'This browser already has a marker. Ask the owner for its edit code.');throw e;}
   let uploaded='';
   try{if(body.profile.photo)uploaded=await store.upload(body.profile.photo);const row=await store.save(id,{publicJson:JSON.stringify(profile),photoId:uploaded,editHash:''},false);return {profile:publicProfile(row)};}
   catch(e){if(uploaded)await store.removePhoto(uploaded).catch(()=>{});await store.accessRemove(claimId(claims.visitorId));throw e;}
  }
  if(action==='photo'){const row=await store.get(body.id);return {photo:row.photoId?await store.photo(row.photoId):null};}
  throw new HttpError(403,'This invitation permits viewing and adding one marker only. Editing requires a code from the owner.');
 };
}
