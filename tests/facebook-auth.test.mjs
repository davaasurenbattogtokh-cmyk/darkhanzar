import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleAuth,facebookReady} from '../server/node/auth.mjs';

const origin='https://darkhanzar.test';
const env={FACEBOOK_APP_ID:'123456789012345',FACEBOOK_APP_SECRET:'0123456789abcdef0123456789abcdef',ADMIN_EMAIL:'owner@example.test'};

function fakePool({users=[],identities=[]}={}){
 const sessions=[];
 return {users,identities,sessions,async execute(sql,params){
  if(sql.startsWith('INSERT INTO auth_limits'))return [[]];
  if(sql.startsWith('SELECT attempts'))return [[{attempts:1}]];
  if(sql.startsWith('SELECT u.id,u.email,u.name,u.role FROM auth_identities')){const i=identities.find(x=>x.provider===params[0]&&x.subject===params[1]);return [i?users.filter(u=>u.id===i.user_id):[]];}
  if(sql.startsWith('SELECT id FROM auth_users WHERE email'))return [users.filter(u=>u.email===params[0])];
  if(sql.startsWith('INSERT INTO auth_users')){const [id,email,name,password_hash,role]=params;users.push({id,email,name,password_hash,role});return [[]];}
  if(sql.startsWith('INSERT INTO auth_identities')){const [provider,subject,user_id]=params;identities.push({provider,subject,user_id});return [[]];}
  if(sql.startsWith('INSERT INTO auth_sessions')){sessions.push(params);return [[]];}
  throw Error('unexpected SQL: '+sql);
 }};
}
async function start(returnTo='/?view=mine'){
 const res=await handleAuth(new Request(`${origin}/api/auth/facebook?return_to=${encodeURIComponent(returnTo)}`),fakePool(),env);
 const location=new URL(res.headers.get('location'));
 return {res,location,cookie:res.headers.get('set-cookie').split(';')[0],state:location.searchParams.get('state')};
}
function callback(pool,{cookie,state},profile,seen={calls:[]}){
 const fetcher=async url=>{const u=new URL(url);seen.calls.push(u);
  if(u.pathname==='/oauth/access_token')return Response.json({access_token:'fixture-token',token_type:'bearer'});
  if(u.pathname==='/me')return Response.json(profile);
  throw Error(u.href);};
 return handleAuth(new Request(`${origin}/api/auth/facebook/callback?state=${state}&code=fixture-code`,{headers:{cookie}}),pool,env,'fixture',{fetcher});
}
const profile=(extra={})=>({id:'10001',name:'Бат Болд',email:'Bat@Example.com',...extra});

test('Facebook sign-in is off until a numeric app id and 32-hex secret are configured',async()=>{
 assert.equal(facebookReady({}),false);assert.equal(facebookReady({FACEBOOK_APP_ID:'abc',FACEBOOK_APP_SECRET:'x'}),false);assert.equal(facebookReady(env),true);
 assert.deepEqual(await (await handleAuth(new Request(origin+'/api/auth/providers'),null,env)).json(),{google:false,facebook:true});
 const off=await handleAuth(new Request(origin+'/api/auth/facebook'),null,{});assert.equal(off.status,200);assert.equal(off.headers.get('location'),null);
 assert.match(await (await handleAuth(new Request(origin+'/login'),null,env)).text(),/api\/auth\/facebook/);
 assert.doesNotMatch(await (await handleAuth(new Request(origin+'/login'),null,{})).text(),/api\/auth\/facebook/);
});

test('Start redirects to the Facebook dialog with state and a short-lived host-only cookie',async()=>{
 const {res,location,cookie,state}=await start();
 assert.equal(res.status,302);assert.equal(location.origin+location.pathname,'https://www.facebook.com/dialog/oauth');
 assert.equal(location.searchParams.get('client_id'),env.FACEBOOK_APP_ID);assert.equal(location.searchParams.get('redirect_uri'),origin+'/api/auth/facebook/callback');
 assert.equal(location.searchParams.get('scope'),'public_profile,email');
 for(const part of ['__Host-dz_fboauth=','HttpOnly','Secure','SameSite=Lax','Max-Age=600'])assert(res.headers.get('set-cookie').includes(part),part);
 assert.equal(cookie.split('=')[1].split('.')[0],state);
});

test('Callback creates a user linked by Facebook id, sends appsecret_proof and returns to the saved page',async()=>{
 const pool=fakePool(),seen={calls:[]};const res=await callback(pool,await start('/?view=mine'),profile(),seen);
 assert.equal(res.status,303);assert.equal(res.headers.get('location'),'/?view=mine');
 const me=seen.calls.find(u=>u.pathname==='/me');assert.equal(me.searchParams.get('appsecret_proof'),createHmac('sha256',env.FACEBOOK_APP_SECRET).update('fixture-token').digest('hex'));
 assert.equal(seen.calls[0].searchParams.get('client_secret'),env.FACEBOOK_APP_SECRET);
 assert.equal(pool.users.length,1);assert.equal(pool.users[0].email,'bat@example.com');assert.equal(pool.users[0].password_hash,'!facebook');assert.equal(pool.users[0].role,'user');
 assert.deepEqual(pool.identities,[{provider:'facebook',subject:'10001',user_id:pool.users[0].id}]);
 const cookies=res.headers.getSetCookie();assert(cookies.some(c=>c.startsWith('__Host-dz_session=')));assert(cookies.some(c=>c.startsWith('__Host-dz_fboauth=;')));
});

test('Returning Facebook users sign in by id even if their Facebook email changed',async()=>{
 const pool=fakePool({users:[{id:'u1',email:'bat@example.com',name:'Бат',role:'user'}],identities:[{provider:'facebook',subject:'10001',user_id:'u1'}]});
 const res=await callback(pool,await start(),profile({email:'new@example.com'}));
 assert.equal(res.status,303);assert.equal(pool.users.length,1);assert.equal(pool.sessions[0][1],'u1');
});

test('Facebook never takes over an existing email account, the admin email, or proceeds without email or valid state',async()=>{
 const flow=await start();
 const cases=[
  [fakePool({users:[{id:'u1',email:'bat@example.com',name:'Бат',role:'user'}]}),flow,profile()],
  [fakePool(),flow,profile({email:'owner@example.test'})],
  [fakePool(),flow,profile({email:undefined})],
  [fakePool(),{...flow,state:'forged-state-value-00000000000000'},profile()],
  [fakePool(),{...flow,cookie:''},profile()],
 ];
 for(const [pool,f,p] of cases){
  const before=pool.users.length;const res=await callback(pool,f,p);
  assert.equal(res.status,200);assert.equal(pool.sessions.length,0);assert.equal(pool.users.length,before);assert.equal(pool.identities.length,0);
 }
});
