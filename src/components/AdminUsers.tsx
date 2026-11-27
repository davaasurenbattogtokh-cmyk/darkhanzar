'use client';
import {useEffect,useState} from 'react';
import {Icon} from './Brand';

type Role='admin'|'editor'|'moderator';
const roleLabels:Record<Role,string>={admin:'Админ',editor:'Редактор',moderator:'Хяналтын ажилтан'};
type Admin={id:string;email:string;name:string;role:Role;createdAt:number;primary:boolean};

// Readable random password: no look-alike characters, 16 chars from a 56-symbol alphabet.
function generatePassword(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
 const bytes=crypto.getRandomValues(new Uint32Array(16));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}
async function call(method:string,body?:object){
 const r=await fetch('/api/admin/admins',{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json() as {admins?:Admin[];canManage?:boolean;admin?:Admin;error?:string};
 if(!r.ok)throw Error(d.error||'Хүсэлт амжилтгүй боллоо.');
 return d;
}

export default function AdminUsers(){
 const [admins,setAdmins]=useState<Admin[]>([]),[canManage,setCanManage]=useState(false),[loading,setLoading]=useState(true);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[role,setRole]=useState<Role>('moderator');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<{email:string;password:string}|null>(null);
 const [resetFor,setResetFor]=useState(''),[resetPassword,setResetPassword]=useState('');
 async function load(){setLoading(true);setError('');try{const d=await call('GET');setAdmins(d.admins||[]);setCanManage(!!d.canManage);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setCreated(null);try{await call('POST',{name,email,password,role});setCreated({email:email.trim().toLowerCase(),password});setName('');setEmail('');setPassword('');setShow(false);await load();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 async function savePassword(id:string){setBusy(true);setError('');setCreated(null);try{await call('PUT',{id,password:resetPassword});const a=admins.find(x=>x.id===id);setCreated(a?{email:a.email,password:resetPassword}:null);setResetFor('');setResetPassword('');}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 async function remove(a:Admin){if(!window.confirm(`${a.name} (${a.email})-ийн админ бүртгэлийг устгах уу? Энэ хүн цаашид нэвтэрч чадахгүй.`))return;setBusy(true);setError('');try{await call('DELETE',{id:a.id});await load();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}

 return <>
  {error&&<div className="admin-alert error" role="alert">{error}</div>}
  {created&&<div className="admin-alert success" role="status">
   <div><strong>Нэвтрэх мэдээллийг хадгалаад тухайн хүнд найдвартай замаар дамжуулна уу.</strong> Нууц үгийг дахин харах боломжгүй.<br/>
    Нэвтрэх хаяг: <a href="/login?return_to=%2Fadmin">darkhanzar.mn/login</a> · И-мэйл: <code>{created.email}</code> · Нууц үг: <code>{created.password}</code></div>
   <button onClick={()=>{navigator.clipboard?.writeText(`darkhanzar.mn/login\nИ-мэйл: ${created.email}\nНууц үг: ${created.password}`).catch(()=>{});}}>Хуулах</button>
  </div>}
  <section className="admin-card">
   <div className="admin-card-heading"><h2>Админ, ажилтнууд</h2><span className="admin-muted">{admins.length} хүн</span></div>
   <p className="admin-muted"><b>Админ</b> — зар, баннер, үнэ, Unegui, төлбөр, мэдээг бүгдийг удирдана. <b>Хяналтын ажилтан</b> — хэрэглэгчийн илгээсэн зарыг шалгаж зөвшөөрөх, буцаах. <b>Редактор</b> — зөвхөн бизнес мэдээ бичиж нийтэлнэ. Нэмэх, хасах эрх зөвхөн үндсэн админд бий.</p>
   {loading?<p className="admin-muted">Ачаалж байна…</p>:<div className="management-list">{admins.map(a=><div className="management-row" key={a.id}>
    <div className="management-info"><span className={`status ${a.primary?'status-published':'status-pending'}`}>{a.primary?'Үндсэн админ':roleLabels[a.role]||'Админ'}</span><h3>{a.name}</h3><small>{a.email} · {new Date(a.createdAt).toLocaleDateString('mn-MN',{timeZone:'Asia/Ulaanbaatar'})}</small>
     {resetFor===a.id&&<div className="admin-plan-fields" style={{marginTop:12}}><label>Шинэ нууц үг<input type="text" value={resetPassword} minLength={12} maxLength={128} autoComplete="new-password" onChange={e=>setResetPassword(e.target.value)}/></label><button type="button" className="button button-outline" onClick={()=>setResetPassword(generatePassword())}>Үүсгэх</button><button type="button" className="button button-primary" disabled={busy||resetPassword.length<12} onClick={()=>savePassword(a.id)}>Хадгалах</button><button type="button" className="text-button" onClick={()=>{setResetFor('');setResetPassword('');}}>Болих</button></div>}
    </div>
    {canManage&&!a.primary&&<div className="management-actions"><button className="button button-outline" disabled={busy} onClick={()=>{setResetFor(a.id);setResetPassword(generatePassword());setCreated(null);}}><Icon name="lock"/>Нууц үг солих</button><button className="text-button" disabled={busy} onClick={()=>remove(a)}>Хасах</button></div>}
   </div>)}</div>}
  </section>
  {canManage&&<section className="admin-card">
   <h2>Шинэ ажилтан нэмэх</h2>
   <p className="admin-muted">Нэвтрэх и-мэйл, нууц үгийг та өгнө. Тухайн хүн <b>darkhanzar.mn/login</b> хаягаар нэвтэрч <b>/admin</b> руу орно. Ижил Gmail хаягаар Google-ээр нэвтэрч ч болно.</p>
   <form onSubmit={create}>
    <div className="admin-plan-fields">
     <label>Эрх<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="moderator">Хяналтын ажилтан — зөвхөн зар шалгах</option><option value="editor">Редактор — зөвхөн мэдээ</option><option value="admin">Админ — бүх удирдлага</option></select></label>
     <label>Нэр<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Жишээ: Б. Болд"/></label>
     <label>Нэвтрэх и-мэйл<input required type="email" maxLength={191} value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin2@example.com" autoComplete="off"/></label>
     <label>Нууц үг (12+ тэмдэгт)<input required type={show?'text':'password'} minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
     <button type="button" className="button button-outline" onClick={()=>{setPassword(generatePassword());setShow(true);}}>Нууц үг үүсгэх</button>
     <button type="button" className="text-button" onClick={()=>setShow(!show)}>{show?'Нуух':'Харуулах'}</button>
     <button type="submit" className="button button-primary" disabled={busy}><Icon name="plus"/>{busy?'Түр хүлээнэ үү…':`${roleLabels[role]} нэмэх`}</button>
    </div>
   </form>
  </section>}
 </>;
}
