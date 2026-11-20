export const SOURCES=[
 {slug:'darhan-uul',id:457,location:'Дархан-Уул'},
 {slug:'selenge',id:475,location:'Сэлэнгэ'},
];
const categories={1720:'property',1816:'cars',3664:'fashion',1724:'jobs',1745:'kids',1727:'computers',1726:'phones',3663:'electronics',3666:'home',3711:'equipment',2451:'hobby',4049:'health',1725:'services'};
export function* walk(value){
 if(!value||typeof value!=='object')return;
 yield value;
 for(const child of Object.values(value))yield* walk(child);
}
export function safeImage(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['cdn1.unegui.mn','cdn2.unegui.mn','www.unegui.mn'].includes(u.hostname)&&u.pathname.startsWith('/media/')?u.href:null;}catch{return null;}
}
export function sourceURL(value){
 try{const u=new URL(value,'https://www.unegui.mn');return u.origin==='https://www.unegui.mn'&&!u.search&&!u.hash&&/^\/adv\/\d+_[^/]+\/$/.test(u.pathname)?u.href:null;}catch{return null;}
}
export function cityFromText(text){
 const v=String(text).normalize('NFKC').toLowerCase();
 if(/сүхбаатар\s*(дүүрэг|аймаг)|sukhbaatar\s*(district|province)/u.test(v))return null;
 const khutul=/(?:^|[^а-яa-z])(?:хөтөл|khutul|hutul|hotol|khotol)/u.test(v);
 const sukhbaatar=/(?:^|[^а-яa-z])(?:сүхбаатар|sukhbaatar|suhbaatar)/u.test(v);
 if(khutul===sukhbaatar)return null;
 return khutul?'khutul':'sukhbaatar';
}
export function* sourceObjects(html){
 const chunks=[];
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
  const s=match[1];if(!s.startsWith('self.__next_f.push('))continue;
  try{const c=JSON.parse(s.slice('self.__next_f.push('.length,-1));if(typeof c[1]==='string')chunks.push(c[1]);}catch{}
 }
 for(const line of chunks.join('').split('\n')){
  try{yield* walk(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}
 }
}
export function parsePage(html,source){
 let data;
 for(const value of sourceObjects(html))if(value.location_ids?.length===1&&value.location_ids[0]===source.id&&Array.isArray(value.adverts)&&Number.isInteger(value.location_count)){data=value;break;}
 if(!data||data.location_count<0)throw Error('SOURCE_FORMAT_CHANGED');
 const regional=data.adverts.filter(a=>a.location===source.location);
 const records=regional.map(a=>{
  const ancestors=a.rubric?.ancestors||[],root=ancestors[0]?.id||a.rubric?.id;
  const category=categories[root]||(ancestors[0]?.name==='Үнэгүй өгнө'?'free':ancestors[0]?.name==='Мал амьтан, ургамал'?'animals':null);
  if(!category)throw Error('SOURCE_CATEGORY_CHANGED');
  const url=sourceURL(a.url),id=String(a.id);
  if(!url||!/^\d+$/.test(id)||!url.includes(`/adv/${id}_`)||typeof a.title!=='string')throw Error('SOURCE_INVALID_RECORD');
  const raw=String(a.price_without_currency??''),amount=(!a.currency||a.currency==='MNT')&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):null;
  const region=source.id===457?'darkhanuul':cityFromText(a.title);
  return {id,title:a.title.slice(0,300),category,subcategory:ancestors.slice(1).map(x=>x.name).join(' / '),price:Number.isFinite(amount)?amount:null,priceLabel:String(a.price||'Үнэ тохирно').slice(0,100),region,location:region==='khutul'?'Хөтөл':region==='sukhbaatar'?'Сүхбаатар хот':source.location,publishedLabel:String(a.published||'').slice(0,80),url,features:(a.features||[]).map(f=>f.text).filter(x=>typeof x==='string').slice(0,20),sourcePromotion:String(a.ad_type?.text||'').slice(0,80),images:[...new Set((a.images||[]).map(safeImage).filter(Boolean))].slice(0,30),thumbnail:safeImage(a.first_thumb)};
 });
 // next_page is source supplied, but may be an API cursor: only use its boolean
 // presence. All fetch URLs are built from the fixed public search path.
 return {records,expected:data.location_count,hasNext:!!data.next_page,totalPages:Number(data.total_pages)||1};
}
export function detailCity(html,id){
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  for(const value of walk(data)){
   const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
   if(types.includes('Product')&&String(value.sku)===id)return cityFromText(`${value.name||''} ${value.description||''}`);
  }
 }
 return null;
}

// Extract only public specifications from the exact advertised item. Seller,
// contact, VIN and IMEI objects are deliberately never copied.
export function parseDetail(html,id){
 for(const value of sourceObjects(html)){
  if(String(value.id)!==String(id)||!Array.isArray(value.features)||!Array.isArray(value.categories)||typeof value.description!=='string')continue;
  const attributes=Object.create(null);
  for(const feature of value.features.slice(0,80)){
   const name=typeof feature.name==='string'?feature.name.trim().slice(0,80):'';
   if(!name||['__proto__','prototype','constructor'].includes(name)||/vin|imei|утасны дугаар|регистр|имэйл|e-?mail/i.test(name))continue;
   const values=typeof feature.value==='string'||typeof feature.value==='number'?[feature.value]:Array.isArray(feature.values)?feature.values.map(v=>typeof v==='object'?v?.name??v?.value:v):[];
   const text=values.filter(v=>typeof v==='string'||typeof v==='number').map(v=>String(v).trim()).filter(Boolean).join(' | ').slice(0,400);
   if(text)attributes[name]=text;
  }
  const path=value.categories.filter(c=>typeof c.name==='string').map(c=>c.name.slice(0,100));
  if(value.categories[0]?.id===1816&&value.categories[1]?.id===1817){
   if(path[2])attributes['Брэнд']=path[2];
   if(path[3])attributes['Загвар']=path[3];
  }
  return {attributes,subcategory:path.slice(1).join(' / '),city:cityFromText(`${value.name||''} ${value.location?.name||''} ${value.description}`),detailStatus:value.is_closed?'closed':'available'};
 }
 // Some categories expose JSON-LD only. Their unknown specs stay unknown.
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  for(const value of walk(data))if(String(value.sku)===String(id)&&[value['@type']].flat().includes('Product'))return {attributes:{},city:cityFromText(`${value.name||''} ${value.description||''}`),detailStatus:'available'};
 }
 throw Error('SOURCE_DETAIL_FORMAT_CHANGED');
}
