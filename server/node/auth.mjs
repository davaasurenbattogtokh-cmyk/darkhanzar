import {scrypt as scryptCallback,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
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
// Google sign-in (OpenID Connect authorization code + PKCE). Enabled only when both env values are set.
export const googleReady=env=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(env?.GOOGLE_CLIENT_ID||'')&&!!env?.GOOGLE_CLIENT_SECRET;
const oauthCookie=(value,secure,expired=false)=>`${secure?'__Host-':''}dz_oauth=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expired?0:600}${secure?'; Secure':''}`;
const readCookie=(request,name)=>(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
// Facebook Login (manual OAuth code flow). Accounts are linked by Facebook user id, never by email alone.
export const facebookReady=env=>/^\d{5,20}$/.test(env?.FACEBOOK_APP_ID||'')&&/^[a-f0-9]{32}$/i.test(env?.FACEBOOK_APP_SECRET||'');
const facebookCookie=(value,secure,expired=false)=>`${secure?'__Host-':''}dz_fboauth=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expired?0:600}${secure?'; Secure':''}`;
const sameText=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&a.length>0&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
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
function page(kind,next,error='',google=false,facebook=false){
 const register=kind==='register',setup=kind==='setup',logout=kind==='logout';const title=logout?'Гарах':setup?'Админы анхны тохиргоо':register?'Бүртгэл үүсгэх':'Нэвтрэх';
 const verb=register?'бүртгүүлэх':'нэвтрэх',social=!setup&&!logout;
 const googleLink=(social&&google?`<a class="google" href="/api/auth/google?return_to=${encodeURIComponent(next)}">Google-ээр ${verb}</a>`:'')+(social&&facebook?`<a class="google" href="/api/auth/facebook?return_to=${encodeURIComponent(next)}">Facebook-ээр ${verb}</a>`:'')+(social&&(google||facebook)?'<p class="or">эсвэл и-мэйлээр</p>':'');
 const form=logout?'<button>Бүртгэлээс гарах</button>':`${setup?'<label>Тохиргооны түлхүүр<input name="setup_token" type="password" required autocomplete="off"></label>':''}${register||setup?'<label>Нэр<input name="name" maxlength="100" required autocomplete="name"></label>':''}<label>И-мэйл<input name="email" type="email" required autocomplete="username" maxlength="191"></label><label>Нууц үг<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register||setup?'new-password':'current-password'}"></label><button>${title}</button>`;
 const html=`<!doctype html><html lang="mn"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Darkhanzar</title><style>body{margin:0;background:#fff5e8;color:#101c45;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{background:white;border-radius:24px;padding:32px;max-width:420px;width:calc(100% - 88px);box-shadow:0 12px 50px #101c4510}h1{font-size:28px}a{color:#101c45}label{display:block;margin:18px 0;font-weight:600}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:8px;border:1px solid #d7dae2;border-radius:10px;font:inherit}button{background:#101c45;color:white;font-weight:700;cursor:pointer}.error{color:#ac2020;background:#fff0ed;padding:12px;border-radius:10px}small{color:#586174;line-height:1.5}.google{display:block;text-align:center;padding:14px;border:1px solid #d7dae2;border-radius:10px;text-decoration:none;font-weight:700;margin-top:8px}.or{text-align:center;color:#586174;margin:18px 0 0}</style><main class="card"><a href="/">darkhan<strong style="color:#f28b16">zar</strong></a><h1>${title}</h1>${error?`<p role="alert" class="error">${escape(error)}</p>`:''}${googleLink}<form method="post" action="/api/auth/${kind}"><input type="hidden" name="return_to" value="${escape(next)}">${form}</form><p>${logout?'<a href="/">Буцах</a>':setup?'Тохиргооны түлхүүрийг Hostinger-ийн SETUP_TOKEN утгаас авна.':register?'<a href="/login">Бүртгэлтэй бол нэвтрэх</a>':'<a href="/register">Шинээр бүртгүүлэх</a>'}</p><small>И-мэйл болон утасны дугаар баталгаажуулах үйлчилгээ хараахан холбогдоогүй.${google&&facebook?'':` ${[!google&&'Google',!facebook&&'Facebook'].filter(Boolean).join(', ')} нэвтрэлт тусдаа холболт шаардлагатай.`}</small>${setup||logout?'':'<p><small><a href="/privacy">Нууцлалын бодлого</a> · <a href="/terms">Үйлчилгээний нөхцөл</a></small></p>'}</main></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'}});
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
async function newSession(pool,user,secure,location,extraCookie){
 const token=randomBytes(32).toString('hex');await pool.execute('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',[digest(token),user.id,Date.now()+ttl]);
 const headers=new Headers({Location:location,'Cache-Control':'no-store'});headers.append('Set-Cookie',sessionCookie(token,secure));if(extraCookie)headers.append('Set-Cookie',extraCookie);
 return new Response(null,{status:303,headers});
}
async function googleStart(url,env,next,secure){
 const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 return new Response(null,{status:302,headers:{Location:target.href,'Cache-Control':'no-store','Set-Cookie':oauthCookie(`${state}.${verifier}.${Buffer.from(next).toString('base64url')}`,secure)}});
}
async function googleCallback(request,url,pool,env,ip,secure,fetcher){
 const [state,verifier,encodedReturn]=(readCookie(request,(secure?'__Host-':'')+'dz_oauth')||'').split('.');
 const clear=oauthCookie('',secure,true);
 const fail=message=>{const response=page('login','/',message,googleReady(env),facebookReady(env));response.headers.append('Set-Cookie',clear);return response;};
 if(!googleReady(env))return fail('Google нэвтрэлт одоогоор тохируулагдаагүй байна.');
 if(!verifier||!sameText(url.searchParams.get('state'),state))return fail('Нэвтрэх хугацаа дууссан эсвэл хүсэлт таарахгүй байна. Дахин оролдоно уу.');
 const code=url.searchParams.get('code');if(url.searchParams.get('error')||!code)return fail('Google-ээр нэвтрэхийг цуцаллаа.');
 if(await rateLimit(pool,'ip:'+ip,100))return new Response('Олон оролдлого хийсэн байна. 15 минутын дараа оролдоно уу.',{status:429});
 let claims;
 try{
  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be trusted without a separate signature check (OIDC Core 3.1.3.7).
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:url.origin+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok||typeof data.id_token!=='string')throw Error('token');
  claims=JSON.parse(Buffer.from(data.id_token.split('.')[1]||'','base64url').toString('utf8'));
 }catch{return fail('Google-тэй холбогдож чадсангүй. Дахин оролдоно уу.');}
 const email=typeof claims?.email==='string'?claims.email.trim().toLowerCase():'';
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims?.iss)||claims.aud!==env.GOOGLE_CLIENT_ID||!(Number(claims.exp)*1000>Date.now()))return fail('Google-ийн хариу баталгаажсангүй. Дахин оролдоно уу.');
 if(claims.email_verified!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>191)return fail('Google бүртгэлийн и-мэйл баталгаажаагүй байна.');
 let [rows]=await pool.execute('SELECT id,email,name,role FROM auth_users WHERE email=?',[email]);let user=rows[0];
 if(!user){
  // Only /setup may create the admin account; Google sign-in never does.
  if(email===(env.ADMIN_EMAIL||'').trim().toLowerCase())return fail('Энэ хаягаар бүртгүүлэх боломжгүй.');
  const name=((typeof claims.name==='string'&&claims.name.trim())||email.split('@')[0]).slice(0,100);
  user={id:crypto.randomUUID(),email,name,role:'user'};
  // '!google' never matches the scrypt format, so password login stays impossible for Google-only accounts.
  try{await pool.execute('INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',[user.id,email,name,'!google','user',Date.now()]);}
  catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;[rows]=await pool.execute('SELECT id,email,name,role FROM auth_users WHERE email=?',[email]);user=rows[0];if(!user)return fail('Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.');}
 }
 let destination='/';try{destination=safeReturn(Buffer.from(encodedReturn||'','base64url').toString('utf8'));}catch{}
 return newSession(pool,user,secure,destination,clear);
}
function facebookStart(url,env,next,secure){
 const state=randomBytes(24).toString('base64url');
 const target=new URL('https://www.facebook.com/dialog/oauth');
 target.search=new URLSearchParams({client_id:env.FACEBOOK_APP_ID,redirect_uri:url.origin+'/api/auth/facebook/callback',response_type:'code',scope:'public_profile,email',state}).toString();
 return new Response(null,{status:302,headers:{Location:target.href,'Cache-Control':'no-store','Set-Cookie':facebookCookie(`${state}.${Buffer.from(next).toString('base64url')}`,secure)}});
}
async function facebookCallback(request,url,pool,env,ip,secure,fetcher){
 const [state,encodedReturn]=(readCookie(request,(secure?'__Host-':'')+'dz_fboauth')||'').split('.');
 const clear=facebookCookie('',secure,true);
 const fail=message=>{const response=page('login','/',message,googleReady(env),facebookReady(env));response.headers.append('Set-Cookie',clear);return response;};
 if(!facebookReady(env))return fail('Facebook нэвтрэлт одоогоор тохируулагдаагүй байна.');
 if(!sameText(url.searchParams.get('state'),state))return fail('Нэвтрэх хугацаа дууссан эсвэл хүсэлт таарахгүй байна. Дахин оролдоно уу.');
 const code=url.searchParams.get('code');if(url.searchParams.get('error')||!code)return fail('Facebook-ээр нэвтрэхийг цуцаллаа.');
 if(await rateLimit(pool,'ip:'+ip,100))return new Response('Олон оролдлого хийсэн байна. 15 минутын дараа оролдоно уу.',{status:429});
 let profile;
 try{
  const tokenUrl=new URL('https://graph.facebook.com/oauth/access_token');
  tokenUrl.search=new URLSearchParams({client_id:env.FACEBOOK_APP_ID,client_secret:env.FACEBOOK_APP_SECRET,redirect_uri:url.origin+'/api/auth/facebook/callback',code}).toString();
  const tokenResponse=await fetcher(tokenUrl.href,{signal:AbortSignal.timeout(15000)});const token=await tokenResponse.json();
  if(!tokenResponse.ok||typeof token.access_token!=='string')throw Error('token');
  // appsecret_proof ties the token to this app's secret, as Facebook recommends for server calls.
  const proof=createHmac('sha256',env.FACEBOOK_APP_SECRET).update(token.access_token).digest('hex');
  const meUrl=new URL('https://graph.facebook.com/me');meUrl.search=new URLSearchParams({fields:'id,name,email',access_token:token.access_token,appsecret_proof:proof}).toString();
  const meResponse=await fetcher(meUrl.href,{signal:AbortSignal.timeout(15000)});profile=await meResponse.json();
  if(!meResponse.ok||!/^\d{1,30}$/.test(String(profile?.id||'')))throw Error('me');
 }catch{return fail('Facebook-тэй холбогдож чадсангүй. Дахин оролдоно уу.');}
 const subject=String(profile.id);
 let [rows]=await pool.execute('SELECT u.id,u.email,u.name,u.role FROM auth_identities i JOIN auth_users u ON u.id=i.user_id WHERE i.provider=? AND i.subject=?',['facebook',subject]);let user=rows[0];
 if(!user){
  const email=typeof profile.email==='string'?profile.email.trim().toLowerCase():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>191)return fail('Facebook бүртгэлээс и-мэйл хаяг ирсэнгүй. Facebook-т и-мэйл нэмэх эсвэл и-мэйл хандах зөвшөөрөл өгөөд дахин оролдоно уу.');
  if(email===(env.ADMIN_EMAIL||'').trim().toLowerCase())return fail('Энэ хаягаар бүртгүүлэх боломжгүй.');
  const [existing]=await pool.execute('SELECT id FROM auth_users WHERE email=?',[email]);
  // An email-only match is not proof of ownership on Facebook, so existing accounts are never taken over.
  if(existing.length)return fail('Энэ и-мэйлээр бүртгэл аль хэдийн байна. И-мэйл, нууц үг эсвэл Google-ээр нэвтэрнэ үү.');
  const name=((typeof profile.name==='string'&&profile.name.trim())||email.split('@')[0]).slice(0,100);
  user={id:crypto.randomUUID(),email,name,role:'user'};
  try{
   await pool.execute('INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',[user.id,email,name,'!facebook','user',Date.now()]);
   await pool.execute('INSERT INTO auth_identities (provider,subject,user_id,created_at) VALUES (?,?,?,?)',['facebook',subject,user.id,Date.now()]);
  }catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;return fail('Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.');}
 }
 let destination='/';try{destination=safeReturn(Buffer.from(encodedReturn||'','base64url').toString('utf8'));}catch{}
 return newSession(pool,user,secure,destination,clear);
}
export async function handleAuth(request,pool,env,ip='unknown',{fetcher=fetch}={}){
 const url=new URL(request.url),kind=url.pathname.slice('/api/auth/'.length),next=safeReturn(url.searchParams.get('return_to')),pg=(k,n,e)=>page(k,n,e,googleReady(env),facebookReady(env));
 if(['/login','/register','/setup','/logout'].includes(url.pathname)&&request.method==='GET')return pg(url.pathname.slice(1),next);
 if(!url.pathname.startsWith('/api/auth/'))return null;
 if(request.method==='GET'&&kind==='providers')return Response.json({google:googleReady(env),facebook:facebookReady(env)},{headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET'&&kind==='facebook')return facebookReady(env)?facebookStart(url,env,next,url.protocol==='https:'):pg('login',next,'Facebook нэвтрэлт одоогоор тохируулагдаагүй байна.');
 if(request.method==='GET'&&kind==='facebook/callback')return facebookCallback(request,url,pool,env,ip,url.protocol==='https:',fetcher);
 if(request.method==='GET'&&kind==='google')return googleReady(env)?googleStart(url,env,next,url.protocol==='https:'):pg('login',next,'Google нэвтрэлт одоогоор тохируулагдаагүй байна.');
 if(request.method==='GET'&&kind==='google/callback')return googleCallback(request,url,pool,env,ip,url.protocol==='https:',fetcher);
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
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>191||password.length<12||password.length>128)return pg(kind,destination,'И-мэйл болон 12–128 тэмдэгттэй нууц үгээ шалгана уу.');
 if(await rateLimit(pool,'account:'+email,10)||await rateLimit(pool,'ip:'+ip,100))return new Response('Олон оролдлого хийсэн байна. 15 минутын дараа оролдоно уу.',{status:429});
 let user;
 if(kind==='register'||kind==='setup'){
  if(!name||name.length>100)return pg(kind,destination,'Нэрээ оруулна уу.');
  if(kind==='setup'){
   const supplied=form.get('setup_token')||'';
   if(!env.SETUP_TOKEN||env.SETUP_TOKEN.length<32||!timingSafeEqual(Buffer.from(digest(supplied)),Buffer.from(digest(env.SETUP_TOKEN)))||email!==(env.ADMIN_EMAIL||'').trim().toLowerCase())return pg(kind,destination,'Тохиргооны мэдээлэл таарахгүй байна.');
  }else if(email===(env.ADMIN_EMAIL||'').trim().toLowerCase())return pg(kind,destination,'Энэ хаягаар бүртгүүлэх боломжгүй.');
  user={id:crypto.randomUUID(),email,name,role:kind==='setup'?'admin':'user'};
  try{await pool.execute('INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',[user.id,email,name,await hashPassword(password),user.role,Date.now()]);}
  catch(error){if(error.code!=='ER_DUP_ENTRY')throw error;return pg(kind,destination,'Бүртгэл үүсгэх боломжгүй. Бүртгэлтэй бол нэвтэрнэ үү.');}
 }else{
  const [rows]=await pool.execute('SELECT id,email,name,role,password_hash FROM auth_users WHERE email=?',[email]);user=rows[0];
  if(!await verifyPassword(password,user?.password_hash))return pg(kind,destination,'И-мэйл эсвэл нууц үг буруу байна.');
 }
 const token=randomBytes(32).toString('hex');await pool.execute('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',[digest(token),user.id,Date.now()+ttl]);
 return new Response(null,{status:303,headers:{Location:kind==='setup'?'/admin':destination,'Set-Cookie':sessionCookie(token,secure)}});
}
