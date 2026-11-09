import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export const equal=(a,b)=>timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));
export const secret=()=>randomBytes(32).toString('base64url');
export function auth(config){
 if(!config.sessionSecret||config.sessionSecret.length<32||!config.ownerKey||config.ownerKey.length<32)throw new HttpError(503,'The globe owner needs to finish the server configuration.');
 const signature=body=>createHmac('sha256',config.sessionSecret).update(body).digest('base64url');
 const issue=(scope,claims={},now=Date.now())=>{const body=Buffer.from(JSON.stringify({...claims,v:2,scope,exp:now+(scope==='owner'?3600000:7*86400000),ownerEpoch:scope==='owner'?digest(config.ownerKey):undefined})).toString('base64url');return `${body}.${signature(body)}`;};
 const verify=(token,scope,now=Date.now())=>{try{if(typeof token!=='string'||token.length>2000)throw Error();const parts=token.split('.');if(parts.length!==2||!equal(signature(parts[0]),parts[1]))throw Error();const claims=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(claims.v!==2||claims.scope!==scope||!Number.isFinite(claims.exp)||claims.exp<=now||(scope==='owner'&&claims.ownerEpoch!==digest(config.ownerKey)))throw Error();return claims;}catch{throw new HttpError(401,'Your access has expired. Open your invitation again.');}};
 return {issue,verify};
}
export function validateProfile(value){
 if(!value||typeof value!=='object')throw new HttpError(400,'A profile is required.');
 const result={};
 for(const [key,max] of [['name',60],['city',100],['country',100],['food',120],['fact',600]]){
  if(['food','fact'].includes(key)&&value[key]==null)value={...value,[key]:''};
  if(typeof value[key]!=='string'||(['name','city','country'].includes(key)&&!value[key].trim())||value[key].length>max)throw new HttpError(400,`Please enter a valid ${key} (up to ${max} characters).`);
  result[key]=value[key].trim();
 }
 for(const [key,max] of [['lng',180],['lat',90]]){if(typeof value[key]!=='number'||!Number.isFinite(value[key])||Math.abs(value[key])>max)throw new HttpError(400,'Choose a valid location.');result[key]=Math.round(value[key]*100)/100;}
 const links=value.links??[];
 if(!Array.isArray(links)||links.length>5)throw new HttpError(400,'Add up to five profile links.');
 result.links=links.map(link=>{
  if(!link||typeof link.name!=='string'||!link.name.trim()||link.name.length>60||typeof link.url!=='string'||link.url.length>500)throw new HttpError(400,'Each link needs a name (up to 60 characters) and URL (up to 500 characters).');
  let url;try{url=new URL(link.url.trim());}catch{throw new HttpError(400,'Enter a full link starting with https:// or http://.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new HttpError(400,'Use an http:// or https:// link without login credentials.');
  return {name:link.name.trim(),url:url.href};
 });
 if(JSON.stringify(result).length>6000)throw new HttpError(400,'Your profile is too long. Shorten your links or text.');
 return result;
}
export const publicProfile=row=>({...JSON.parse(row.publicJson),id:row.$id,photoId:row.photoId||undefined,createdAt:row.$createdAt});
