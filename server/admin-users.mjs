import {hashPassword} from './node/auth.mjs';

// Additional administrators. Only the primary admin (ADMIN_EMAIL) can create, re-password or remove them;
// every admin can see the list. Accounts are created directly with credentials chosen by the primary admin.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=128;

export async function handleAdmins(request,env,identity,sameOrigin){
 const one=(sql,...args)=>env.DB.prepare(sql).bind(...args).first();
 const list=async(sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results||[];
 const primaryEmail=(env.ADMIN_EMAIL||'').trim().toLowerCase();
 if(request.method==='GET'){
  const rows=await list("SELECT id,email,name,created_at FROM auth_users WHERE role='admin' ORDER BY created_at");
  return json({admins:rows.map(r=>({id:r.id,email:r.email,name:r.name,createdAt:Number(r.created_at),primary:r.email===primaryEmail})),canManage:identity.primary===true});
 }
 if(identity.primary!==true)return json({error:'Админ нэмэх, хасах эрх зөвхөн үндсэн админд бий.'},403);
 if(!sameOrigin)return json({error:'Хүсэлтийн эх сурвалж буруу байна.'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON хүсэлт шаардлагатай.'},415);
 const raw=await request.text();if(raw.length>4096)return json({error:'Мэдээлэл хэт их байна.'},413);
 let input;try{input=JSON.parse(raw);}catch{return json({error:'Хүсэлт буруу байна.'},400);}
 const audit=action=>env.DB.prepare('INSERT INTO admin_audit (actor_id,action,settings_revision,created_at) VALUES (?,?,0,?)').bind(identity.userId,action.slice(0,191),new Date().toISOString()).run();
 const target=async id=>typeof id==='string'&&id.length<=191?one("SELECT id,email,name FROM auth_users WHERE id=? AND role='admin'",id):null;

 if(request.method==='POST'){
  const name=typeof input.name==='string'?input.name.trim():'',email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(!name||name.length>100)return json({error:'Нэрээ оруулна уу (100 хүртэл тэмдэгт).'},400);
  if(!EMAIL.test(email)||email.length>191)return json({error:'Нэвтрэх и-мэйл хаяг буруу байна.'},400);
  if(!validPassword(input.password))return json({error:'Нууц үг 12–128 тэмдэгттэй байна.'},400);
  if(await one('SELECT id FROM auth_users WHERE email=?',email))return json({error:'Энэ и-мэйлээр бүртгэл аль хэдийн байна. Өөр и-мэйл сонгоно уу.'},409);
  const admin={id:crypto.randomUUID(),email,name,createdAt:Date.now(),primary:false};
  try{await env.DB.prepare("INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,'admin',?)").bind(admin.id,email,name,await hashPassword(input.password),admin.createdAt).run();}
  catch(error){if(error?.code==='ER_DUP_ENTRY'||/UNIQUE/i.test(error?.message||''))return json({error:'Энэ и-мэйлээр бүртгэл аль хэдийн байна. Өөр и-мэйл сонгоно уу.'},409);throw error;}
  await audit('admin.create:'+email);
  return json({admin},201);
 }
 if(request.method==='PUT'){
  const admin=await target(input.id);if(!admin)return json({error:'Админ олдсонгүй.'},404);
  if(admin.email===primaryEmail)return json({error:'Үндсэн админы нууц үгийг энд солихгүй.'},403);
  if(!validPassword(input.password))return json({error:'Нууц үг 12–128 тэмдэгттэй байна.'},400);
  await env.DB.batch([
   env.DB.prepare('UPDATE auth_users SET password_hash=? WHERE id=?').bind(await hashPassword(input.password),admin.id),
   env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(admin.id),
  ]);
  await audit('admin.password:'+admin.email);
  return json({ok:true});
 }
 if(request.method==='DELETE'){
  const admin=await target(input.id);if(!admin)return json({error:'Админ олдсонгүй.'},404);
  if(admin.email===primaryEmail)return json({error:'Үндсэн админыг хасах боломжгүй.'},403);
  await env.DB.batch([
   env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(admin.id),
   env.DB.prepare('DELETE FROM auth_identities WHERE user_id=?').bind(admin.id),
   env.DB.prepare("DELETE FROM auth_users WHERE id=? AND role='admin'").bind(admin.id),
  ]);
  await audit('admin.remove:'+admin.email);
  return json({ok:true});
 }
 return json({error:'Хүсэлтийн арга дэмжигдэхгүй байна.'},405);
}
