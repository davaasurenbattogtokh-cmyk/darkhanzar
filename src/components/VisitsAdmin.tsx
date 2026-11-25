'use client';
import {useEffect,useState} from 'react';

type Count={visitors:number;views:number};
type Row={name:string;title?:string;visitors:number;views:number};
type Stats={days:number;online:number;today:Count;yesterday:Count;period:Count;series:({day:string}&Count)[];pages:Row[];referrers:Row[];devices:Row[]};
const deviceLabels:Record<string,string>={mobile:'Гар утас',desktop:'Компьютер',tablet:'Таблет'};
const nf=new Intl.NumberFormat('mn-MN');
function pageLabel(r:Row){
 if(r.title)return `Зар: ${r.title}`;
 if(/\?ad=UN-/.test(r.name))return 'Unegui зар';
 let path=r.name;try{path=decodeURI(r.name);}catch{}
 return path==='/'?'Нүүр хуудас':path;
}

// Admin → Хандалт: visitors and page views counted by the site itself.
export default function VisitsAdmin(){
 const [days,setDays]=useState(30),[stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const load=()=>fetch(`/api/admin/visits?days=${days}`,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Статистик уншиж чадсангүй.');if(alive){setStats(d);setError('');}}).catch(e=>{if(alive)setError((e as Error).message);});
  load();const t=setInterval(load,60000);
  return()=>{alive=false;clearInterval(t);};
 },[days]);
 if(error&&!stats)return <div className="admin-alert error" role="alert">{error}</div>;
 if(!stats)return <p className="admin-muted">Ачаалж байна…</p>;
 const max=Math.max(1,...stats.series.map(s=>s.views));
 const table=(title:string,rows:Row[],label:(r:Row)=>string,empty:string)=><section className="admin-card"><h2>{title}</h2>{rows.length?<table className="visits-table"><thead><tr><th></th><th>Зочин</th><th>Үзэлт</th></tr></thead><tbody>{rows.map(r=><tr key={r.name}><td title={r.name}>{label(r)}</td><td>{nf.format(r.visitors)}</td><td>{nf.format(r.views)}</td></tr>)}</tbody></table>:<p className="admin-muted">{empty}</p>}</section>;
 return <>
  <div className="visits-cards">
   <div className="visits-card live"><span>Яг одоо</span><strong>{nf.format(stats.online)}</strong><small>сүүлийн 5 минутад</small></div>
   <div className="visits-card"><span>Өнөөдөр</span><strong>{nf.format(stats.today.visitors)}</strong><small>зочин · {nf.format(stats.today.views)} үзэлт</small></div>
   <div className="visits-card"><span>Өчигдөр</span><strong>{nf.format(stats.yesterday.visitors)}</strong><small>зочин · {nf.format(stats.yesterday.views)} үзэлт</small></div>
   <div className="visits-card"><span>Сүүлийн {stats.days} хоног</span><strong>{nf.format(stats.period.visitors)}</strong><small>зочин · {nf.format(stats.period.views)} үзэлт</small></div>
  </div>
  <section className="admin-card">
   <div className="admin-card-heading"><h2>Өдөр тутмын хандалт</h2><div className="visits-range">{[7,30,90].map(d=><button key={d} className={d===days?'selected':''} onClick={()=>setDays(d)}>{d} хоног</button>)}</div></div>
   <div className="visits-chart" role="img" aria-label="Өдөр тутмын үзэлт, зочны тоо">{stats.series.map(s=><div key={s.day} className="visits-bar" title={`${s.day}: ${s.visitors} зочин, ${s.views} үзэлт`}><i style={{height:`${s.views/max*100}%`}}/><b style={{height:`${s.visitors/max*100}%`}}/></div>)}</div>
   <div className="visits-axis"><span>{stats.series[0]?.day}</span><span className="visits-legend"><b/>Зочин <i/>Үзэлт</span><span>{stats.series.at(-1)?.day}</span></div>
   <p className="admin-muted">Зочин гэдэг нь тухайн өдөр сайтад орсон давтагдашгүй хүн (нэг төхөөрөмж). Робот, хайлтын системийг тооцохгүй. IP хаяг хадгалагдахгүй.</p>
  </section>
  <div className="visits-grid">
   {table('Их үзсэн хуудас, зар',stats.pages,pageLabel,'Одоохондоо мэдээлэл алга.')}
   {table('Хаанаас орж ирсэн',stats.referrers,r=>r.name,'Гадны холбоосоор орж ирсэн зочин алга (шууд хаягаар орсон).')}
   {table('Төхөөрөмж',stats.devices,r=>deviceLabels[r.name]||r.name,'Одоохондоо мэдээлэл алга.')}
  </div>
 </>;
}
