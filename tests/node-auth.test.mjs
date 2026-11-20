import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,trustedHeaders,sessionCookie,handleAuth} from '../server/node/auth.mjs';
test('Node boundary discards all supplied Sites identity headers; only server session determines owner/admin',()=>{
 const request=new Request('https://darkhanzar.test/api/admin/session',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'owner@example.test','oai-other':'untrusted'}});
 assert.equal(trustedHeaders(request,null).has('oai-authenticated-user-id'),false);
 const user=trustedHeaders(request,{id:'real',name:'Монгол нэр',email:'owner@example.test',role:'user'});assert.equal(user.get('oai-authenticated-user-id'),'real');assert.equal(user.has('oai-authenticated-user-email'),false);
 const admin=trustedHeaders(request,{id:'admin',name:'Admin',email:'owner@example.test',role:'admin'});assert.equal(admin.get('oai-authenticated-user-email'),'owner@example.test');
});
test('Passwords use independent salts; invalid and unknown account checks cannot authenticate',async()=>{
 const a=await hashPassword('fixture-password-123'),b=await hashPassword('fixture-password-123');assert.notEqual(a,b);assert(await verifyPassword('fixture-password-123',a));assert(!await verifyPassword('wrong-password',a));assert(!await verifyPassword('fixture-password-123',null));assert(!a.includes('fixture-password-123'));
});
test('HTTPS sessions have host-only secure HttpOnly cookies and cross-site form submissions are rejected before DB access',async()=>{
 const cookie=sessionCookie('fixture',true);for(const value of ['__Host-dz_session=','HttpOnly','SameSite=Lax','Secure','Path=/'])assert(cookie.includes(value));assert(!cookie.includes('Domain='));
 const res=await handleAuth(new Request('https://darkhanzar.test/api/auth/login',{method:'POST',headers:{Origin:'https://other.test'}}),null,{});assert.equal(res.status,403);
});
test('Auth form pages keep the Origin header on same-site POST (no-referrer makes browsers send Origin: null)',async()=>{
 for(const path of ['/login','/register','/setup']){
  const res=await handleAuth(new Request('https://darkhanzar.test'+path),null,{});
  assert.notEqual(res.headers.get('Referrer-Policy'),'no-referrer',path);
 }
});
