'use client';
import {useEffect,useRef,useState} from 'react';
import {Icon} from './Brand';
import NewsBody from './news/NewsBody';
import {newsCategories,newsCategoryLabel} from '@/lib/news-categories.mjs';
import '../app/news/news.css';

type Article={id:string;slug:string;title:string;summary:string;body:string;category:string;cover:string;status:'draft'|'published';featured:boolean;author:string;views:number;updatedAt:number;publishedAt:number};
type Draft={id?:string;title:string;summary:string;body:string;category:string;cover:string;featured:boolean};
const empty=():Draft=>({title:'',summary:'',body:'',category:newsCategories[0].id,cover:'',featured:false});
const date=(ms:number)=>ms?new Date(ms).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';

async function api(method:string,body?:object){
 const r=await fetch('/api/admin/news',{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json() as {items?:Article[];item?:Article;error?:string};
 if(!r.ok)throw Error(d.error||'Хүсэлт амжилтгүй боллоо.');
 return d;
}
async function uploadImage(file:File){
 if(file.size>5*1024*1024)throw Error('Зураг 5MB-аас бага байна.');
 const form=new FormData();form.set('file',file);
 const r=await fetch('/api/admin/news/upload',{method:'POST',body:form});const d=await r.json() as {url?:string;error?:string};
 if(!r.ok||!d.url)throw Error(d.error||'Зураг байршуулж чадсангүй.');
 return d.url;
}

export default function NewsAdmin(){
 const [items,setItems]=useState<Article[]>([]),[loading,setLoading]=useState(true),[filter,setFilter]=useState<'all'|'published'|'draft'>('all');
 const [draft,setDraft]=useState<Draft|null>(null),[preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const bodyRef=useRef<HTMLTextAreaElement>(null);
 async function load(){setLoading(true);try{setItems((await api('GET')).items||[]);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 const edit=(a?:Article)=>{setError('');setNotice('');setPreview(false);setDraft(a?{id:a.id,title:a.title,summary:a.summary,body:a.body,category:a.category,cover:a.cover,featured:a.featured}:empty());window.scrollTo({top:0});};
 const set=<K extends keyof Draft>(k:K,v:Draft[K])=>setDraft(d=>d&&{...d,[k]:v});
 function wrap(before:string,after=before,placeholder='текст'){
  const el=bodyRef.current;if(!el||!draft)return;
  const s=el.selectionStart,e=el.selectionEnd,sel=draft.body.slice(s,e)||placeholder;
  set('body',draft.body.slice(0,s)+before+sel+after+draft.body.slice(e));
  requestAnimationFrame(()=>{el.focus();el.setSelectionRange(s+before.length,s+before.length+sel.length);});
 }
 function linePrefix(prefix:string){
  const el=bodyRef.current;if(!el||!draft)return;
  const s=el.selectionStart,start=draft.body.lastIndexOf('\n',s-1)+1;
  set('body',draft.body.slice(0,start)+prefix+draft.body.slice(start));
  requestAnimationFrame(()=>{el.focus();el.setSelectionRange(s+prefix.length,s+prefix.length);});
 }
 async function insertImage(file?:File){
  if(!file||!draft)return;setBusy(true);setError('');
  try{const url=await uploadImage(file);const el=bodyRef.current;const at=el?el.selectionStart:draft.body.length;
   set('body',draft.body.slice(0,at)+`\n\n![Зургийн тайлбар](${url})\n\n`+draft.body.slice(at));}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function setCover(file?:File){if(!file)return;setBusy(true);setError('');try{set('cover',await uploadImage(file));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(status:'draft'|'published'){
  if(!draft)return;setBusy(true);setError('');setNotice('');
  try{const payload={...draft,status};const d=draft.id?await api('PUT',payload):await api('POST',payload);
   setDraft(null);await load();
   setNotice(status==='published'?`Мэдээ нийтлэгдлээ: darkhanzar.mn/news/${d.item!.slug}`:'Ноорог хадгалагдлаа.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function remove(a:Article){if(!window.confirm(`«${a.title}» мэдээг бүр мөсөн устгах уу?`))return;setBusy(true);try{await api('DELETE',{id:a.id});await load();setNotice('Мэдээ устгагдлаа.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const shown=items.filter(a=>filter==='all'||a.status===filter);

 if(draft)return <>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  <section className="admin-card">
   <div className="admin-card-heading"><h2>{draft.id?'Мэдээ засах':'Шинэ мэдээ'}</h2><button className="text-button" onClick={()=>{if(window.confirm('Хадгалаагүй өөрчлөлт алга болно. Гарах уу?'))setDraft(null);}}>← Жагсаалт руу</button></div>
   <div className="admin-form-grid">
    <label>Гарчиг<input value={draft.title} maxLength={200} onChange={e=>set('title',e.target.value)} placeholder="Мэдээний гарчиг"/><small>{draft.title.length}/200</small></label>
    <label>Ангилал<select value={draft.category} onChange={e=>set('category',e.target.value)}>{newsCategories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Товч агуулга (lead)<textarea rows={3} maxLength={400} value={draft.summary} onChange={e=>set('summary',e.target.value)} placeholder="Хоосон орхивол бичвэрийн эхнээс автоматаар авна. Facebook-т хуваалцахад харагдана."/><small>{draft.summary.length}/400</small></label>
    <div><b>Нүүр зураг</b><p className="admin-muted">1200 × 630 px орчим, 5MB хүртэл. Facebook-т хуваалцахад энэ зураг гарна.</p>
     {draft.cover?<img src={draft.cover} alt="" style={{width:'100%',maxWidth:360,borderRadius:10,display:'block',marginBottom:8}}/>:null}
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><label className={`button button-outline ${busy?'disabled':''}`}><Icon name="upload"/>Зураг сонгох<input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e=>{setCover(e.target.files?.[0]);e.target.value='';}}/></label>{draft.cover&&<button className="text-button" onClick={()=>set('cover','')}>Арилгах</button>}</div>
    </div>
   </div>
  </section>
  <section className="admin-card">
   <div className="admin-card-heading"><h2>Бичвэр</h2><div style={{display:'flex',gap:8}}><button className={`button ${preview?'button-outline':'button-navy'}`} onClick={()=>setPreview(false)}>Засах</button><button className={`button ${preview?'button-navy':'button-outline'}`} onClick={()=>setPreview(true)}>Урьдчилан харах</button></div></div>
   {preview?<div className="news-site" style={{minHeight:0}}><article className="news-article"><h1>{draft.title||'Гарчиг'}</h1>{draft.summary&&<p className="news-lead-text">{draft.summary}</p>}{draft.cover&&<img className="news-article-cover" src={draft.cover} alt=""/>}<NewsBody body={draft.body}/></article></div>:<>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}} role="toolbar" aria-label="Форматлах">
     <button className="button button-outline" onClick={()=>linePrefix('## ')}>Гарчиг</button>
     <button className="button button-outline" onClick={()=>linePrefix('### ')}>Дэд гарчиг</button>
     <button className="button button-outline" onClick={()=>wrap('**')}><b>B</b></button>
     <button className="button button-outline" onClick={()=>wrap('*')}><i>I</i></button>
     <button className="button button-outline" onClick={()=>linePrefix('- ')}>• Жагсаалт</button>
     <button className="button button-outline" onClick={()=>linePrefix('> ')}>❝ Ишлэл</button>
     <button className="button button-outline" onClick={()=>{const url=window.prompt('Холбоосын хаяг (https://…)');if(url)wrap('[',`](${url})`,'холбоос');}}>Холбоос</button>
     <label className={`button button-outline ${busy?'disabled':''}`}><Icon name="images"/>Зураг оруулах<input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e=>{insertImage(e.target.files?.[0]);e.target.value='';}}/></label>
    </div>
    <textarea ref={bodyRef} rows={20} value={draft.body} onChange={e=>set('body',e.target.value)} placeholder={'Мэдээний бичвэр. Догол мөр хооронд хоосон мөр үлдээнэ.\n\n## Дэд гарчиг\n**тод**, *налуу*, [холбоос](https://…)\n- жагсаалт\n> ишлэл'} style={{fontFamily:'ui-monospace,Consolas,monospace',fontSize:15,lineHeight:1.6}}/>
    <small className="admin-muted">Догол мөр хооронд хоосон мөр үлдээнэ. ## гарчиг · **тод** · *налуу* · - жагсаалт · &gt; ишлэл</small>
   </>}
  </section>
  <section className="admin-card">
   <label className="admin-check"><input type="checkbox" checked={draft.featured} onChange={e=>set('featured',e.target.checked)}/>Нүүр хуудсанд онцлох нийтлэл болгох</label>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>
    <button className="button button-outline" disabled={busy} onClick={()=>save('draft')}>Ноорог хадгалах</button>
    <button className="button button-primary" disabled={busy} onClick={()=>save('published')}><Icon name="check-circle"/>{busy?'Түр хүлээнэ үү…':'Нийтлэх'}</button>
   </div>
   <p className="admin-muted">Нийтэлсэн мэдээг дахин засаж хадгалахад нийтэлсэн огноо өөрчлөгдөхгүй. «Ноорог хадгалах» нь нийтэлсэн мэдээг сайтаас нууна.</p>
  </section>
 </>;

 return <>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  {notice&&<div className="admin-alert success" role="status">{notice}</div>}
  <section className="admin-card">
   <div className="admin-card-heading"><h2>Мэдээнүүд</h2><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} style={{width:'auto'}}><option value="all">Бүгд ({items.length})</option><option value="published">Нийтлэгдсэн</option><option value="draft">Ноорог</option></select><a className="button button-outline" href="/news" target="_blank" rel="noopener">Сайт харах</a><button className="button button-primary" onClick={()=>edit()}><Icon name="plus"/>Шинэ мэдээ</button></div></div>
   {loading?<p className="admin-muted">Ачаалж байна…</p>:!shown.length?<div className="empty-state compact"><Icon name="images"/><h3>Мэдээ алга</h3><p>«Шинэ мэдээ» товчоор анхны мэдээгээ бичээрэй.</p></div>:
   <div className="management-list">{shown.map(a=><div className="management-row" key={a.id}>
    {a.cover?<img className="management-photo" src={a.cover} alt="" style={{objectFit:'cover'}}/>:<div className="management-photo" style={{display:'grid',placeItems:'center',background:'#f2f4f8'}}><Icon name="images"/></div>}
    <div className="management-info"><span className={`status ${a.status==='published'?'status-published':'status-pending'}`}>{a.status==='published'?'Нийтлэгдсэн':'Ноорог'}{a.featured?' · Онцлох':''}</span><h3>{a.title}</h3><small>{newsCategoryLabel(a.category)} · {a.author} · {a.status==='published'?`нийтэлсэн ${date(a.publishedAt)}`:`зассан ${date(a.updatedAt)}`} · {a.views} уншсан</small></div>
    <div className="management-actions"><button className="button button-outline" disabled={busy} onClick={()=>edit(a)}><Icon name="edit"/>Засах</button>{a.status==='published'&&<a className="text-button" href={`/news/${a.slug}`} target="_blank" rel="noopener">Харах</a>}<button className="text-button" disabled={busy} onClick={()=>remove(a)}>Устгах</button></div>
   </div>)}</div>}
  </section>
 </>;
}
