import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import type { Place, Profile } from './types';
maplibregl.setWorkerUrl(workerUrl);
interface Props { profiles:Profile[]; places:Place[]; selected:Profile|null; onSelect:(p:Profile)=>void; pickMode:boolean; onPick:(lng:number,lat:number)=>void }
export default function Globe({profiles,places,selected,onSelect,pickMode,onPick}:Props){
 const container=useRef<HTMLDivElement>(null);const map=useRef<maplibregl.Map|null>(null);const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false);
 const callbacks=useRef({onSelect,onPick,pickMode});callbacks.current={onSelect,onPick,pickMode};
 useEffect(()=>{
  if(!container.current)return;
  let m:maplibregl.Map;
  try{m=new maplibregl.Map({container:container.current,center:[20,25],zoom:1.45,minZoom:0.8,maxZoom:6.5,attributionControl:false,renderWorldCopies:false,style:{version:8,projection:{type:'globe'},sources:{countries:{type:'geojson',data:`${import.meta.env.BASE_URL}data/countries.geojson`},lakes:{type:'geojson',data:`${import.meta.env.BASE_URL}data/lakes.geojson`}},layers:[{id:'water',type:'background',paint:{'background-color':'#bfd7da'}},{id:'land',type:'fill',source:'countries',paint:{'fill-color':'#eeeadd'}},{id:'borders',type:'line',source:'countries',paint:{'line-color':'#a5afa2','line-width':0.65}},{id:'lakes',type:'fill',source:'lakes',paint:{'fill-color':'#bfd7da'}}]}});}catch{setFailed(true);return;}
  map.current=m;m.on('load',()=>setReady(true));m.on('error',()=>setFailed(true));
  m.on('click',e=>{if(callbacks.current.pickMode)callbacks.current.onPick(Math.round(e.lngLat.lng*100)/100,Math.round(e.lngLat.lat*100)/100);});
  const observer=new ResizeObserver(()=>m.resize());observer.observe(container.current);
  return()=>{observer.disconnect();m.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  if(!ready||!map.current)return; const m=map.current;
  const grouped=new Map<string,Profile[]>();profiles.forEach(p=>{const k=`${p.lng.toFixed(2)},${p.lat.toFixed(2)}`;grouped.set(k,[...(grouped.get(k)||[]),p]);});
  const markers=[...grouped.values()].map(group=>{let index=0;const p=group[0];const el=document.createElement('button');el.className='person-pin';el.textContent=group.length>1?String(group.length):p.name.slice(0,1).toUpperCase();el.title=group.map(p=>p.name).join(', ');el.setAttribute('aria-label',`Meet ${group.map(p=>p.name).join(' and ')} in ${p.city}`);el.onclick=e=>{e.stopPropagation();callbacks.current.onSelect(group[index%group.length]);index++;};return new maplibregl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(m);});
  return()=>markers.forEach(marker=>marker.remove());
 },[ready,profiles]);
 useEffect(()=>{
  if(!ready||!map.current||!places.length)return;const m=map.current;let labels:maplibregl.Marker[]=[];
  const render=()=>{labels.forEach(l=>l.remove());labels=[];const zoom=m.getZoom();if(zoom<2.5)return;const bounds=m.getBounds();const visible=places.filter(p=>(p.rank??8)<(zoom>4.5?10:zoom>3.5?5:2)&&bounds.contains([p.lng,p.lat])).sort((a,b)=>(a.rank??8)-(b.rank??8)).slice(0,45);
   labels=visible.map(p=>{const el=document.createElement('span');el.className='city-label';el.textContent=p.name;return new maplibregl.Marker({element:el,anchor:'left',offset:[5,0]}).setLngLat([p.lng,p.lat]).addTo(m);});};
  render();m.on('moveend',render);return()=>{m.off('moveend',render);labels.forEach(l=>l.remove());};
 },[ready,places]);
 useEffect(()=>{if(selected&&map.current)map.current.flyTo({center:[selected.lng,selected.lat],zoom:Math.max(map.current.getZoom(),3.2),duration:1200});},[selected]);
 useEffect(()=>{if(map.current)map.current.getCanvas().style.cursor=pickMode?'crosshair':'';},[pickMode]);
 return <div className="globe-wrap"><div ref={container} className="map" aria-label="Interactive community globe"/>{failed&&<div className="map-error">The globe couldn’t load. Try a browser with WebGL enabled. You can still browse people in the list.</div>}<div className="map-heading"><span className="eyebrow">A FEW PIXELS. A WHOLE PLANET.</span><h1>Good people,<br/><em>everywhere.</em></h1><p>A little world for our creative corner of the internet.</p></div><div className="map-bottom"><span>{pickMode?'Click near your city to place your pin':'Drag to explore · Scroll to get closer'}</span><div className="map-controls"><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={18}/></button><button aria-label="Reset globe" onClick={()=>map.current?.flyTo({center:[20,25],zoom:1.45})}><RotateCcw size={17}/></button></div></div><a className="attribution" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Map data: Natural Earth</a></div>;
}
