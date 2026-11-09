export interface ProfileLink { name:string; url:string }
export interface Place { name:string; country:string; lng:number; lat:number; rank?:number }
export interface Profile { id:string; name:string; food:string; fact:string; links?:ProfileLink[]; city:string; country:string; lng:number; lat:number; photoId?:string; photo?:string; createdAt?:string }
export interface Draft { name:string; food:string; fact:string; links?:ProfileLink[]; city:string; country:string; lng:number; lat:number; photo?:string|null }
