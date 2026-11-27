'use client';
import {useEffect,useMemo,useState} from 'react';
import {listingMoney,type Listing} from '@/lib/data';
import {Icon} from './Brand';

type Item=Listing&{promotedUntil?:number;updatedAt?:number};
const until=(ms?:number)=>ms?new Date(ms).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';

// Admin → Зар, төлбөр: post own ads (published at once) and make any live ad featured for free.
export default function FeaturedAdmin(){
 const [items,setItems]=useState<Item[]>([]),[query,setQuery]=useState(''),[days,setDays]=useState<Record<string,number>>({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false);
 async function load(){try{const r=await fetch('/api/admin/listings?scope=published',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Зар ачаалж чадсангүй.');setItems(d.items);}catch(e){setError((e as Error).message);}finally{setLoaded(true);}}
 useEffect(()=>{load();},[]);
 async function feature(item:Item,count:number){
  if(count===0&&!confirm(`«${item.title}» зарын онцгой хугацааг дуусгах уу? Төлбөрөөр онцгой болсон бол тэр хугацаа ч дуусна.`))return;
  setBusy(item.id);setError('');setNotice('');
  try{const r=await fetch('/api/admin/listings/feature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,days:count})});const d=await r.json();if(!r.ok)throw Error(d.error||'Амжилтгүй.');setNotice(count?`«${item.title}» ${until(d.promotedUntil)} хүртэл онцгой боллоо.`:`«${item.title}» онцгой биш боллоо.`);await load();}
  catch(e){setError((e as Error).message);}finally{setBusy('');}
 }
 const now=Date.now();
 const shown=useMemo(()=>{const q=query.trim().toLocaleLowerCase('mn');return items.filter(i=>!q||`${i.title} ${i.seller} ${i.phone||''}`.toLocaleLowerCase('mn').includes(q)).slice(0,60);},[items,query]);
 const featuredCount=items.filter(i=>(i.promotedUntil||0)>now).length;
 return <section className="admin-card">
  <div className="admin-card-heading"><div><h2>Зар оруулах, онцгой болгох</h2><p className="admin-muted">Админы оруулсан зар хяналтгүйгээр шууд нийтлэгдэнэ. Сайтын аль ч зарыг төлбөргүйгээр онцгой болгож болно. Онцгой зар нүүр хуудасны дээд хэсэгт гарна.</p></div>
   <a className="button button-primary" href="/?post=1" target="_blank" rel="noopener"><Icon name="plus"/>Шинэ зар оруулах</a></div>
  <div className="featured-admin-tools"><input type="search" placeholder="Гарчиг, нэр, утсаар хайх" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Зар хайх"/><span>{items.length} нийтлэгдсэн · {featuredCount} онцгой</span></div>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}{notice&&<div className="admin-alert success" role="status">{notice}</div>}
  {!loaded?<p className="admin-muted">Ачаалж байна…</p>:!shown.length?<p className="admin-muted">Зар олдсонгүй.</p>:<div className="featured-admin-list">{shown.map(item=>{const active=(item.promotedUntil||0)>now,count=days[item.id]??7;return <article key={item.id} className={active?'is-featured':''}>
   {item.images[0]?<img src={item.images[0]} alt=""/>:<span className="featured-admin-noimg"/>}
   <div className="featured-admin-info"><h3><a href={`/?ad=${item.id}`} target="_blank" rel="noopener">{item.title}</a></h3><small>{item.seller} · {listingMoney(item)}{item.phone?` · ${item.phone}`:''}</small>{active&&<span className="featured-admin-badge"><Icon name="featured"/>Онцгой · {until(item.promotedUntil)} хүртэл</span>}</div>
   <div className="featured-admin-actions"><select value={count} onChange={e=>setDays({...days,[item.id]:Number(e.target.value)})} aria-label="Онцгой байх хоног">{[1,3,7,14,30,90].map(d=><option key={d} value={d}>{d} хоног</option>)}</select>
    <button className="button button-navy" disabled={!!busy} onClick={()=>feature(item,count)}>{busy===item.id?'…':active?'Сунгах':'Онцгой болгох'}</button>
    {active&&<button className="text-button" disabled={!!busy} onClick={()=>feature(item,0)}>Цуцлах</button>}</div>
  </article>;})}</div>}
 </section>;
}
