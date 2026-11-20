import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleAuth,googleReady} from '../server/node/auth.mjs';

const origin='https://darkhanzar.test';
const env={GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture-secret',ADMIN_EMAIL:'owner@example.test'};

function fakePool(users=[]){
 const sessions=[];
 return {users,sessions,async execute(sql,params){
  if(sql.startsWith('INSERT INTO auth_limits'))return [[]];
  if(sql.startsWith('SELECT attempts'))return [[{attempts:1}]];
  if(sql.startsWith('SELECT id,email,name,role FROM auth_users'))return [users.filter(u=>u.email===params[0])];
  if(sql.startsWith('INSERT INTO auth_users')){const [id,email,name,password_hash,role]=params;users.push({id,email,name,password_hash,role});return [[]];}
  if(sql.startsWith('INSERT INTO auth_sessions')){sessions.push(params);return [[]];}
  throw Error('unexpected SQL: '+sql);
 }};
}
const idToken=claims=>['e30',Buffer.from(JSON.stringify(claims)).toString('base64url'),'sig'].join('.');
const goodClaims=(extra={})=>({iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,exp:Math.floor(Date.now()/1000)+300,email:'Seller@Gmail.com',email_verified:true,name:'Зарын эзэн',...extra});

async function start(returnTo='/?view=mine'){
 const res=await handleAuth(new Request(`${origin}/api/auth/google?return_to=${encodeURIComponent(returnTo)}`),fakePool(),env);
 const location=new URL(res.headers.get('location'));
 const cookie=res.headers.get('set-cookie').split(';')[0];
 return {res,location,cookie,state:location.searchParams.get('state')};
}
function callback(pool,{cookie,state,code='fixture-code'},claims,seen={}){
 const fetcher=async(url,init)=>{seen.url=url;seen.body=Object.fromEntries(init.body);return Response.json({id_token:idToken(claims)});};
 return handleAuth(new Request(`${origin}/api/auth/google/callback?state=${state}&code=${code}`,{headers:{cookie}}),pool,env,'fixture',{fetcher});
}

test('Google sign-in is off until a real client id and secret are configured',async()=>{
 assert.equal(googleReady({}),false);assert.equal(googleReady({GOOGLE_CLIENT_ID:'x',GOOGLE_CLIENT_SECRET:'y'}),false);assert.equal(googleReady(env),true);
 const off=await handleAuth(new Request(origin+'/api/auth/providers'),null,{});assert.deepEqual(await off.json(),{google:false,facebook:false});
 const on=await handleAuth(new Request(origin+'/api/auth/providers'),null,env);assert.deepEqual(await on.json(),{google:true,facebook:false});
 const disabled=await handleAuth(new Request(origin+'/api/auth/google'),null,{});assert.equal(disabled.status,200);assert.equal(disabled.headers.get('location'),null);
 assert.doesNotMatch(await (await handleAuth(new Request(origin+'/login'),null,{})).text(),/api\/auth\/google/);
 assert.match(await (await handleAuth(new Request(origin+'/login'),null,env)).text(),/api\/auth\/google/);
});

test('Start redirects to Google with PKCE S256, state and a short-lived host-only cookie',async()=>{
 const {res,location,cookie,state}=await start();
 assert.equal(res.status,302);assert.equal(location.origin+location.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
 assert.equal(location.searchParams.get('client_id'),env.GOOGLE_CLIENT_ID);assert.equal(location.searchParams.get('redirect_uri'),origin+'/api/auth/google/callback');
 assert.equal(location.searchParams.get('code_challenge_method'),'S256');assert.equal(location.searchParams.get('scope'),'openid email profile');
 const raw=res.headers.get('set-cookie');for(const part of ['__Host-dz_oauth=','HttpOnly','Secure','SameSite=Lax','Max-Age=600','Path=/'])assert(raw.includes(part),part);
 const [cookieState,verifier]=cookie.split('=')[1].split('.');assert.equal(cookieState,state);
 assert.equal(location.searchParams.get('code_challenge'),createHash('sha256').update(verifier).digest('base64url'));
});

test('Callback creates a user from a verified Google email, sends the PKCE verifier and returns to the saved page',async()=>{
 const flow=await start('/?view=mine'),pool=fakePool(),seen={};
 const res=await callback(pool,flow,goodClaims(),seen);
 assert.equal(res.status,303);assert.equal(res.headers.get('location'),'/?view=mine');
 assert.equal(seen.url,'https://oauth2.googleapis.com/token');assert.equal(seen.body.code_verifier,flow.cookie.split('=')[1].split('.')[1]);assert.equal(seen.body.redirect_uri,origin+'/api/auth/google/callback');
 assert.equal(pool.users.length,1);assert.equal(pool.users[0].email,'seller@gmail.com');assert.equal(pool.users[0].role,'user');assert.equal(pool.users[0].name,'Зарын эзэн');
 assert.equal(pool.users[0].password_hash,'!google');assert.equal(pool.sessions.length,1);
 const cookies=res.headers.getSetCookie();assert(cookies.some(c=>c.startsWith('__Host-dz_session=')));assert(cookies.some(c=>c.startsWith('__Host-dz_oauth=;')&&c.includes('Max-Age=0')));
});

test('Callback signs an existing account in by email, including the admin, without creating a duplicate',async()=>{
 const pool=fakePool([{id:'admin-1',email:'owner@example.test',name:'Админ',role:'admin'}]);
 const res=await callback(pool,await start(),goodClaims({email:'owner@example.test'}));
 assert.equal(res.status,303);assert.equal(pool.users.length,1);assert.equal(pool.sessions[0][1],'admin-1');
});

test('Callback rejects forged state, missing cookie, unverified email, wrong audience and new admin-email accounts',async()=>{
 const flow=await start();
 const cases=[
  [{...flow,state:'forged-state-value-000000000000'},goodClaims()],
  [{...flow,cookie:''},goodClaims()],
  [flow,goodClaims({email_verified:false})],
  [flow,goodClaims({aud:'other.apps.googleusercontent.com'})],
  [flow,goodClaims({iss:'https://evil.test'})],
  [flow,goodClaims({exp:Math.floor(Date.now()/1000)-10})],
  [flow,goodClaims({email:'owner@example.test'})],
 ];
 for(const [f,claims] of cases){
  const pool=fakePool();const res=await callback(pool,f,claims);
  assert.equal(res.status,200);assert.equal(res.headers.get('location'),null);assert.equal(pool.sessions.length,0);assert.equal(pool.users.length,0);
 }
 const cancelled=await handleAuth(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&error=access_denied`,{headers:{cookie:flow.cookie}}),fakePool(),env);
 assert.equal(cancelled.status,200);assert.match(await cancelled.text(),/цуцаллаа/);
});

test('Google-only accounts cannot sign in with a password',async()=>{
 const pool=fakePool([{id:'g1',email:'seller@gmail.com',name:'S',role:'user',password_hash:'!google'}]);
 pool.execute=(orig=>async(sql,params)=>sql.startsWith('SELECT id,email,name,role,password_hash')?[pool.users.filter(u=>u.email===params[0])]:orig(sql,params))(pool.execute);
 const res=await handleAuth(new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'seller@gmail.com',password:'!google-anything-123'})}),pool,env);
 assert.equal(res.status,200);assert.equal(pool.sessions.length,0);
});
