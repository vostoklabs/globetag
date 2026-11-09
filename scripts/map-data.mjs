import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../public/data/', import.meta.url);
await mkdir(root, { recursive:true });
const base='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
for (const [file, source] of [['countries','ne_110m_admin_0_countries'],['lakes','ne_110m_lakes'],['cities','ne_10m_populated_places_simple']]) {
 const r=await fetch(`${base}${source}.geojson`); if(!r.ok) throw Error(`Map data download failed: ${r.status}`);
 const geo=await r.json();
 if(file==='cities') {
  const places=geo.features.map(f=>({name:f.properties.name,country:f.properties.adm0name,lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],rank:f.properties.scalerank ?? 8})).filter(p=>p.name&&p.country);
  await writeFile(new URL('places.json',root),JSON.stringify(places));
  geo.features=geo.features.map(f=>({...f,properties:{name:f.properties.name,rank:f.properties.scalerank??8}}));
 } else geo.features=geo.features.map(f=>({...f,properties:{name:f.properties.NAME??f.properties.name}}));
 await writeFile(new URL(`${file}.geojson`,root),JSON.stringify(geo));
 console.log(`Saved ${file}: ${geo.features.length} features`);
}
