'use client';
import {useEffect,useState} from 'react';

type Run={id:string;trigger:string;status:string;startedAt:number;finishedAt:number;result:{imported?:number;skipped?:number;already?:number;seen?:number;reasons?:Record<string,number>;error?:string;detail?:string}};
type Status={configured:boolean;running:boolean;imported:number;schedule:string;runs:Run[]};
const reasonLabels:Record<string,string>={no_phone:'утасгүй',no_photo:'зураггүй',photo_unavailable:'зураг татагдаагүй'};
const when=(ms:number)=>ms?new Date(ms).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';

// Admin → Зар, төлбөр: status of the daily Facebook page import, with a "check now" button.
export default function FacebookImportAdmin(){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/admin/facebook-import',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Төлөв уншиж чадсангүй.');setStatus(d);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(!status?.running)return;const t=setInterval(load,5000);return()=>clearInterval(t);},[status?.running]);
 async function runNow(){setBusy(true);setError('');try{const r=await fetch('/api/admin/facebook-import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(!r.ok)throw Error(d.error||'Эхлүүлж чадсангүй.');setStatus(d);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="admin-card">
  <div className="admin-card-heading"><h2>Facebook пейжийн зар</h2>{status?.configured&&<button className="button button-primary" disabled={busy||status.running} onClick={runNow}>{status.running?'Шалгаж байна…':'Одоо шалгах'}</button>}</div>
  <p className="admin-muted">facebook.com/Darkhanzar пейжид орсон <b>зурагтай, утасны дугаартай</b> постуудыг {status?.schedule||'өдөр бүр 08:00'}-д шалгаж, админы нэр дээр зар болгон нийтэлнэ. Ангилал, үнэ, байршлыг постын текстээс автоматаар таньдаг. Буруу таньсан бол «Миний зарууд»-аас засна.</p>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  {!status?<p className="admin-muted">Ачаалж байна…</p>:!status.configured?<div className="admin-alert" role="status">Facebook пейжийн холболт хийгдээгүй байна. Серверт пейжийн токен тохируулсны дараа ажиллана.</div>:<>
   <p><b>Нийт оруулсан:</b> {status.imported} зар</p>
   {status.runs.length>0&&<div className="management-list">{status.runs.map(r=><div className="management-row" key={r.id}><div className="management-info">
    <span className={`status ${r.status==='ok'?'status-published':r.status==='failed'?'status-rejected':'status-pending'}`}>{r.status==='ok'?'Амжилттай':r.status==='failed'?'Алдаа':'Явагдаж байна'}</span>
    <h3>{r.trigger==='daily'?'Өдрийн шалгалт':'Гараар шалгасан'} · {when(r.startedAt)}</h3>
    <small>{r.status==='failed'?`${r.result.error||''} ${r.result.detail||''}`:r.status==='ok'?`${r.result.imported||0} шинэ зар · ${r.result.seen||0} пост шалгасан${r.result.skipped?` · ${r.result.skipped} алгассан (${Object.entries(r.result.reasons||{}).map(([k,v])=>`${reasonLabels[k]||k} ${v}`).join(', ')})`:''}`:'…'}</small>
   </div></div>)}</div>}
  </>}
 </section>;
}
