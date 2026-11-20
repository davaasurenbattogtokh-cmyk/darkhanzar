import {scrypt as scryptCallback,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),ttl=7*86400000;
const digest=value=>createHash('sha256').update(value).digest('hex');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeReturn=v=>typeof v==='string'&&/^\/(?!\/)/.test(v)&&!/[\\\r\n]/.test(v)?v:'/';
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64);return `scrypt$${salt}$${hash.toString('hex')}`;}
export async function verifyPassword(password,encoded){
 const match=/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded||'');
 const salt=match?.[1]||'0'.repeat(32),expected=Buffer.from(match?.[2]||'0'.repeat(128),'hex');
 const actual=await scrypt(password,salt,64);return timingSafeEqual(actual,expected)&&!!match;
}
export function sessionCookie(token,secure,expired=false){return `${secure?'__Host-':''}dz_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expired?0:ttl/1000}${secure?'; Secure':''}`;}
export async function authenticatedUser(request,pool){
 const secure=new URL(request.url).protocol==='https:',name=secure?'__Host-dz_session':'dz_session';
 const cookie=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
 if(!/^[a-f0-9]{64}$/.test(cookie||''))return null;
 const [rows]=await pool.execute('SELECT u.id,u.email,u.name,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[digest(cookie),Date.now()]);return rows[0]||null;
}
export function trustedHeaders(request,user){
 const headers=new Headers(request.headers);for(const key of [...headers.keys()])if(key.startsWith('oai-'))headers.delete(key);
 if(user){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');if(user.role==='admin')headers.set('oai-authenticated-user-email',user.email);}
 return headers;
}
function page(kind,next,error=''){
 const register=kind==='register',setup=kind==='setup',logout=kind==='logout';const title=logout?'Гарах':setup?'Админы анхны тохиргоо':register?'Бүртгэл үүсгэх':'Нэвтрэх';
 const form=logout?'<button>Бүртгэлээс гарах</button>':`${setup?'<label>Тохиргооны түлхүүр<input name="setup_token" type="password" required autocomplete="off"></label>':''}${register||setup?'<label>Нэр<input name="name" maxlength="100" required autocomplete="name"></label>':''}<label>И-мэйл<input name="email" type="email" required autocomplete="username" maxlength="191"></label><label>Нууц үг<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register||setup?'new-password':'current-password'}"></label><button>${title}</button>`;
 const html=`<!doctype html><html lang="mn"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Darkhanzar</title><style>body{margin:0;background:#fff5e8;color:#101c45;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{background:white;border-radius:24px;padding:32px;max-width:420px;width:calc(100% - 88px);box-shadow:0 12px 50px #101c4510}h1{font-size:28px}a{color:#101c45}label{display:block;margin:18px 0;font-weight:600}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:8px;border:1px solid #d7dae2;border-radius:10px;font:inherit}button{background:#101c45;color:white;font-weight:700;cursor:pointer}.error{color:#ac2020;background:#fff0ed;padding:12px;border-radius:10px}small{color:#586174;line-height:1.5}</style><main class="card"><a href="/">darkhan<strong style="color:#f28b16">zar</strong></a><h1>${title}</h1>${error?`<p role="alert" class="error">${escape(error)}</p>`:''}<form method="post" action="/api/auth/${kind}"><input type="hidden" name="return_to" value="${escape(next)}">${form}</form><p>${logout?'<a href="/">Буцах</a>':setup?'Тохиргооны түлхүүрийг Hostinger-ийн SETUP_TOKEN утгаас авна.':register?'<a href="/login">Бүртгэлтэй бол нэвтрэх</a>':'<a href="/register">Шинээр бүртгүүлэх</a>'}</p><small>И-мэйл болон утасны дугаар баталгаажуулах үйлчилгээ хараахан холбогдоогүй. Google, Facebook нэвтрэлт тусдаа холболт шаардлагатай.</small></main></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
async function limitedForm(request){
 const type=request.headers.get('content-type')||'';if(!type.startsWith('application/x-www-form-urlencoded'))throw Error('FORM');
 const reader=request.body?.getReader();if(!reader)throw Error('FORM');let text='',size=0;const dec=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error('FORM');}text+=dec.decode(value,{stream:true});}return new URLSearchParams(text+dec.decode());
}
async function rateLimit(pool,key,max){
 const now=Date.now(),reset=now+15*60000,h=digest(key);
 await pool.execute('INSERT INTO auth_limits (key_hash,attempts,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(reset_at<?,1,attempts+1),reset_at=IF(reset_at<?,VALUES(reset_at),reset_at)',[h,reset,now,now]);
 const [rows]=await pool.execute('SELECT attempts FROM auth_limits WHERE key_hash=?',[h]);return rows[0].attempts>max;
}
export async function handleAuth(request,pool,env,ip='unknown'){
 const url=new URL(request.url),kind=url.pathname.slice('/api/auth/'.length),next=safeReturn(url.searchParams.get('return_to'));
 if(['/login','/register','/setup','/logout'].includes(url.pathname)&&request.method==='GET')return page(url.pathname.slice(1),next);
 if(!url.pathname.startsWith('/api/auth/'))return null;
 if(request.method!=='POST'||!['login','register','setup','logout'].includes(kind))return new Response('Not found',{status:404});
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return new Response('Origin rejected',{status:403});
 let form;try{form=await limitedForm(request);}catch{return new Response('Invalid form',{status:400});}
 const destination=safeReturn(form.get('return_to')),secure=url.protocol==='https:';
 if(kind==='logout'){
  const name=secure?'__Host-dz_session':'dz_session',token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  if(token)await pool.execute('DELETE FROM auth_sessions WHERE token_hash=?',[digest(token)]);
  return new Response(null,{status:303,headers:{Location:destination,'Set-Cookie':sessionCookie('',secure,true)}});
 }
 const email=(form.get('email')||'').trim().toLowerCase(),password=form.get('password')||'',name=(form.get('name')||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>191||password.length<12||password.length>128)return page(kind,destination,'И-мэйл болон 12–128 тэмдэгттэй нууц үгээ шалгана уу.');
 if(await rateLimit(pool,'account:'+email,10)||await rateLimit(pool,'ip:'+ip,100))return new Response('Олон оролдлого хийсэн байна. 15 минутын дараа оролдоно уу.',{status:429});
 let user;
 if(kind==='register'||kind==='setup'){
  if(!name||name.length>100)return page(kind,destination,'Нэрээ оруулна уу.');
  if(kind==='setup'){
   const supplied=form.get('setup_token')||'';
   if(!env.SETUP_TOKEN||env.SETUP_TOKEN.length<32||!timingSafeEqual(Buffer.from(digest(supplied)),Buffer.from(digest(env.SETUP_TOKEN)))||email!==(env.ADMIN_EMAIL||'').trim().toLowerCase())return page(kind,destination,'Тохиргооны мэдээлэл таарахгүй байна.');
  }else if(email===(env.ADMIN_EMAIL||'').trim().toLowerCase())return page(kind,destination,'Энэ хаягаар бүртгүүлэх боломжгүй.');
  user={id:crypto.randomUUID(),email,name,role:kind==='setup'?'admin':'user'};
  try{await pool.execute('INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',[user.id,email,name,await hashPassword(password),user.role,Date.now()]);}
  catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;return page(kind,destination,'Бүртгэл үүсгэх боломжгүй. Бүртгэлтэй бол нэвтэрнэ үү.');}
 }else{
  const [rows]=await pool.execute('SELECT id,email,name,role,password_hash FROM auth_users WHERE email=?',[email]);user=rows[0];
  if(!await verifyPassword(password,user?.password_hash))return page(kind,destination,'И-мэйл эсвэл нууц үг буруу байна.');
 }
 const token=randomBytes(32).toString('hex');await pool.execute('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',[digest(token),user.id,Date.now()+ttl]);
 return new Response(null,{status:303,headers:{Location:kind==='setup'?'/admin':destination,'Set-Cookie':sessionCookie(token,secure)}});
}
