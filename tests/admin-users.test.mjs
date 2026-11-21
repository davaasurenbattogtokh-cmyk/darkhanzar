import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAdminAPI,adminIdentity} from '../server/admin-api.mjs';
import {trustedHeaders,verifyPassword} from '../server/node/auth.mjs';

const origin='https://darkhan.example';
function fixture(){
 const users=[{id:'owner-id',email:'owner@example.test',name:'Эзэн',role:'admin',password_hash:'x',created_at:1}];
 const sessions=[{user_id:'owner-id'}],identities=[],audit=[];
 const exec=(sql,a)=>{
  if(sql.startsWith("SELECT id,email,name,role,created_at FROM auth_users WHERE role IN"))return users.filter(u=>['admin','editor'].includes(u.role));
  if(sql.startsWith('SELECT id FROM auth_users WHERE email=?'))return users.filter(u=>u.email===a[0]);
  if(sql.startsWith("SELECT id,email,name,role FROM auth_users WHERE id=? AND role IN"))return users.filter(u=>u.id===a[0]&&['admin','editor'].includes(u.role));
  if(sql.startsWith('INSERT INTO auth_users')){users.push({id:a[0],email:a[1],name:a[2],password_hash:a[3],role:a[4],created_at:a[5]});return [];}
  if(sql.startsWith('UPDATE auth_users SET password_hash')){users.find(u=>u.id===a[1]).password_hash=a[0];return [];}
  if(sql.startsWith('DELETE FROM auth_sessions')){for(let i=sessions.length-1;i>=0;i--)if(sessions[i].user_id===a[0])sessions.splice(i,1);return [];}
  if(sql.startsWith('DELETE FROM auth_identities'))return [];
  if(sql.startsWith('DELETE FROM auth_users')){const i=users.findIndex(u=>u.id===a[0]&&['admin','editor'].includes(u.role));if(i>=0)users.splice(i,1);return [];}
  if(sql.startsWith('INSERT INTO admin_audit')){audit.push(a[1]);return [];}
  throw Error('unexpected SQL '+sql);
 };
 const stmt=(sql,args=[])=>({sql,args,bind:(...a)=>stmt(sql,a),async all(){return {results:exec(sql,args)};},async first(){return exec(sql,args)[0]||null;},async run(){exec(sql,args);return {};}});
 const env={ADMIN_EMAIL:'owner@example.test',DB:{prepare:sql=>stmt(sql),async batch(list){return list.map(s=>({results:exec(s.sql,s.args)}));}}};
 return {env,users,sessions,audit};
}
const as=(who)=>({'oai-authenticated-user-id':who.id,'oai-authenticated-user-email':who.email,...(who.role?{'oai-authenticated-user-role':who.role}:{})});
const owner={id:'owner-id',email:'owner@example.test',role:'admin'};
const req=(method,body,headers=as(owner))=>new Request(origin+'/api/admin/admins',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});

test('Only accounts marked admin by the trusted boundary are authorized; the primary is the ADMIN_EMAIL account',()=>{
 const env={ADMIN_EMAIL:'owner@example.test'};
 const id=h=>adminIdentity(new Request(origin+'/',{headers:h}),env);
 assert.deepEqual([id(as(owner)).authorized,id(as(owner)).primary],[true,true]);
 assert.deepEqual([id(as({id:'b',email:'b@x.mn',role:'admin'})).authorized,id(as({id:'b',email:'b@x.mn',role:'admin'})).primary],[true,false]);
 assert.equal(id(as({id:'c',email:'c@x.mn'})).authorized,false);
 // Client-supplied role headers never survive the Node boundary.
 const forged=trustedHeaders(new Request(origin+'/',{headers:{'oai-authenticated-user-role':'admin'}}),{id:'u',name:'U',email:'u@x.mn',role:'user'});
 assert.equal(forged.has('oai-authenticated-user-role'),false);assert.equal(forged.has('oai-authenticated-user-email'),false);
 assert.equal(trustedHeaders(new Request(origin+'/'),{id:'a',name:'A',email:'a@x.mn',role:'admin'}).get('oai-authenticated-user-role'),'admin');
});

test('Primary admin creates an admin with chosen credentials; duplicates and weak input are rejected',async()=>{
 const f=fixture();
 let r=await handleAdminAPI(req('POST',{name:'Болд',email:'Bold@Example.mn',password:'strong-password-1'}),f.env);
 assert.equal(r.status,201);const created=f.users.find(u=>u.email==='bold@example.mn');
 assert.equal(created.role,'admin');assert(await verifyPassword('strong-password-1',created.password_hash));assert.deepEqual(f.audit,['admin.create:bold@example.mn']);
 assert.equal((await handleAdminAPI(req('POST',{name:'Давхар',email:'bold@example.mn',password:'strong-password-1'}),f.env)).status,409);
 assert.equal((await handleAdminAPI(req('POST',{name:'Богино',email:'x@example.mn',password:'short'}),f.env)).status,400);
 assert.equal((await handleAdminAPI(req('POST',{name:'',email:'y@example.mn',password:'strong-password-1'}),f.env)).status,400);
 const list=await (await handleAdminAPI(req('GET'),f.env)).json();
 assert.equal(list.canManage,true);assert.deepEqual(list.admins.map(a=>[a.email,a.primary]),[['owner@example.test',true],['bold@example.mn',false]]);
});

test('Secondary admins can see the list but cannot add, re-password or remove admins; cross-site writes are refused',async()=>{
 const f=fixture();f.users.push({id:'b',email:'b@x.mn',name:'B',role:'admin',password_hash:'x',created_at:2});
 const b={id:'b',email:'b@x.mn',role:'admin'};
 const list=await (await handleAdminAPI(req('GET',null,as(b)),f.env)).json();assert.equal(list.canManage,false);assert.equal(list.admins.length,2);
 assert.equal((await handleAdminAPI(req('POST',{name:'X',email:'x@x.mn',password:'strong-password-1'},as(b)),f.env)).status,403);
 assert.equal((await handleAdminAPI(req('DELETE',{id:'owner-id'},as(b)),f.env)).status,403);
 assert.equal((await handleAdminAPI(new Request(origin+'/api/admin/admins',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json',...as(owner)},body:JSON.stringify({name:'X',email:'x@x.mn',password:'strong-password-1'})}),f.env)).status,403);
 assert.equal((await handleAdminAPI(req('GET',null,as({id:'u',email:'u@x.mn'})),f.env)).status,403);
});

test('Primary admin resets a password (ending that admin\'s sessions) and removes admins, but never the primary',async()=>{
 const f=fixture();f.users.push({id:'b',email:'b@x.mn',name:'B',role:'admin',password_hash:'x',created_at:2});f.sessions.push({user_id:'b'});
 assert.equal((await handleAdminAPI(req('PUT',{id:'b',password:'new-strong-password'}),f.env)).status,200);
 assert(await verifyPassword('new-strong-password',f.users.find(u=>u.id==='b').password_hash));assert.equal(f.sessions.some(s=>s.user_id==='b'),false);
 assert.equal((await handleAdminAPI(req('PUT',{id:'owner-id',password:'new-strong-password'}),f.env)).status,403);
 assert.equal((await handleAdminAPI(req('DELETE',{id:'owner-id'}),f.env)).status,403);
 assert.equal((await handleAdminAPI(req('DELETE',{id:'b'}),f.env)).status,200);assert.equal(f.users.some(u=>u.id==='b'),false);
 assert.equal((await handleAdminAPI(req('DELETE',{id:'b'}),f.env)).status,404);
});

test('Primary admin can create an editor; editors are listed with their role and are not admins',async()=>{
 const f=fixture();
 const r=await handleAdminAPI(req('POST',{name:'Редактор',email:'editor@example.mn',password:'strong-password-1',role:'editor'}),f.env);
 assert.equal(r.status,201);assert.equal(f.users.find(u=>u.email==='editor@example.mn').role,'editor');assert.deepEqual(f.audit,['editor.create:editor@example.mn']);
 assert.equal((await handleAdminAPI(req('POST',{name:'Буруу',email:'bad@example.mn',password:'strong-password-1',role:'owner'}),f.env)).status,400);
 const list=await (await handleAdminAPI(req('GET'),f.env)).json();assert.deepEqual(list.admins.map(a=>a.role),['admin','editor']);
 const editor={id:f.users.at(-1).id,email:'editor@example.mn',role:'editor'};
 assert.equal(adminIdentity(new Request(origin+'/',{headers:{'oai-authenticated-user-id':editor.id,'oai-authenticated-user-role':'editor'}}),f.env).authorized,false);
 assert.equal(trustedHeaders(new Request(origin+'/'),{id:'e',name:'E',email:'e@x.mn',role:'editor'}).get('oai-authenticated-user-role'),'editor');
 assert.equal(trustedHeaders(new Request(origin+'/'),{id:'e',name:'E',email:'e@x.mn',role:'editor'}).has('oai-authenticated-user-email'),false);
});
