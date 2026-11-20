import test from 'node:test';
import assert from 'node:assert/strict';
import {writeHeaders} from '../server/node/headers.mjs';

test('All Set-Cookie headers reach the browser (Google login sets a session and clears the OAuth cookie)',()=>{
 const written={};const res={setHeader:(k,v)=>{written[k.toLowerCase()]=v;}};
 const headers=new Headers({Location:'/','Cache-Control':'no-store'});
 headers.append('Set-Cookie','__Host-dz_session=abc; Path=/; HttpOnly; Secure');
 headers.append('Set-Cookie','__Host-dz_oauth=; Path=/; Max-Age=0; Secure');
 writeHeaders(res,headers);
 assert.deepEqual(written['set-cookie'],['__Host-dz_session=abc; Path=/; HttpOnly; Secure','__Host-dz_oauth=; Path=/; Max-Age=0; Secure']);
 assert.equal(written.location,'/');assert.equal(written['cache-control'],'no-store');
});

test('Responses without cookies do not set an empty Set-Cookie header',()=>{
 const written={};writeHeaders({setHeader:(k,v)=>{written[k]=v;}},new Headers({'Content-Type':'text/html'}));
 assert.equal('set-cookie' in written,false);assert.equal(written['content-type'],'text/html');
});
