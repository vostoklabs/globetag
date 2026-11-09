import { Client, TablesDB, Storage, Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import sharp from 'sharp';
import { createHandler } from './handler.mjs';
import { HttpError } from './security.mjs';
const databaseId='small-world',tableId='profiles',bucketId='portraits';
export default async ({req,res,error})=>{
 const origin=req.headers.origin||'';
 const allowed=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 if(origin&&!allowed.includes(origin))return res.json({error:'This website origin is not allowed.'},403,headers);
 if(req.method==='OPTIONS')return res.text('',204,headers);
 if(req.method!=='POST')return res.json({error:'Use POST.'},405,headers);
 try{
  if((req.bodyText||'').length>900000)throw new HttpError(413,'That photo is too large.');
  const client=new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT||process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(req.headers['x-appwrite-key']);
  const db=new TablesDB(client),storage=new Storage(client);const base={databaseId,tableId};
  const store={
   async list(){const rows=[];let cursor;do{const page=await db.listRows({...base,queries:[Query.limit(100),Query.orderAsc('$id'),...(cursor?[Query.cursorAfter(cursor)]:[])]});rows.push(...page.rows);if(page.rows.length<100)break;cursor=page.rows.at(-1).$id;}while(true);return rows;},
   async get(id){if(typeof id!=='string'||!(/^[a-zA-Z0-9_-]{1,36}$/).test(id))throw new HttpError(400,'Invalid pin ID.');try{return await db.getRow({...base,rowId:id});}catch(e){if(e.code===404)throw new HttpError(404,'That pin no longer exists.');throw e;}},
   save(id,data,exists){return exists?db.updateRow({...base,rowId:id,data}):db.createRow({...base,rowId:id,data,permissions:[]});},
   remove(id){return db.deleteRow({...base,rowId:id});},
   async removePhoto(fileId){try{await storage.deleteFile({bucketId,fileId});}catch(e){if(e.code!==404)throw e;}},
   async upload(data){
    if(typeof data!=='string'||data.length>750000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw new HttpError(400,'Choose a JPG, PNG or WebP photo under 500 KB after resizing.');
    let image;try{image=await sharp(Buffer.from(data.split(',')[1],'base64'),{limitInputPixels:20000000}).rotate().resize(512,512,{fit:'cover'}).jpeg({quality:80}).toBuffer();}catch{throw new HttpError(400,'That image could not be read. Try another photo.');}
    const file=await storage.createFile({bucketId,fileId:ID.unique(),file:InputFile.fromBuffer(image,'portrait.jpg'),permissions:[]});return file.$id;
   },
   async photo(fileId){const data=await storage.getFileDownload({bucketId,fileId});return `data:image/jpeg;base64,${Buffer.from(data).toString('base64')}`;},
   async rateLimit(kind,max){
    const minute=Math.floor(Date.now()/60000),rowId=`${kind}-${minute}`;const rateBase={databaseId,tableId:'rate_limits'};
    try{await db.createRow({...rateBase,rowId,data:{count:0,expires:minute+10},permissions:[]});}catch(e){if(e.code!==409)throw e;}
    const row=await db.incrementRowColumn({...rateBase,rowId,column:'count',value:1});
    if(row.count>max)throw new HttpError(429,'The globe is busy. Please try again in a minute.');
    // Bounded cleanup keeps the persistent limiter from accumulating forever.
    if(row.count===1){const old=await db.listRows({...rateBase,queries:[Query.lessThan('expires',minute),Query.limit(100)]});await Promise.all(old.rows.map(r=>db.deleteRow({...rateBase,rowId:r.$id})));}
   }
  };
  const handle=createHandler({groupCode:process.env.GROUP_CODE,sessionSecret:process.env.SESSION_SECRET,ownerKey:process.env.OWNER_KEY},store);
  let body;try{body=req.bodyJson;}catch{throw new HttpError(400,'Invalid JSON.');}
  return res.json(await handle(body),200,headers);
 }catch(e){if(!(e instanceof HttpError))error(`Backend failure: ${e.code||'unknown'}`);return res.json({error:e instanceof HttpError?e.message:'The globe could not complete that request. Please try again.'},e.status||500,headers);}
};
