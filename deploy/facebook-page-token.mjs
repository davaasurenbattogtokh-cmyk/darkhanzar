// Exchanges a short-lived user token (from Graph API Explorer, Darkhanzar app) for the Darkhanzar
// page's non-expiring page token. Reads the user token from stdin; prints three lines for the
// caller to store: page id, page token, page name. Run on the VPS with the app's .env loaded.
import {createHmac} from 'node:crypto';
const v=process.env.FACEBOOK_GRAPH_VERSION||'v23.0';
const {FACEBOOK_APP_ID:appId,FACEBOOK_APP_SECRET:secret}=process.env;
const wanted=(process.argv[2]||'darkhanzar').toLowerCase();
const fail=m=>{console.error('ERROR: '+m);process.exit(1);};
if(!appId||!secret)fail('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing in .env');
let input='';for await(const c of process.stdin)input+=c;
const userToken=input.trim();
if(userToken.length<30)fail('no user token received');
const proof=t=>createHmac('sha256',secret).update(t).digest('hex');
async function get(path,params){
 const u=new URL(`https://graph.facebook.com/${v}/${path}`);for(const [k,x] of Object.entries(params))u.searchParams.set(k,x);
 const r=await fetch(u);const b=await r.json().catch(()=>({}));
 if(!r.ok)fail(`${path}: ${b?.error?.message||r.status}`);return b;
}
const long=await get('oauth/access_token',{grant_type:'fb_exchange_token',client_id:appId,client_secret:secret,fb_exchange_token:userToken});
const accounts=await get('me/accounts',{fields:'id,name,username,access_token,tasks',limit:'100',access_token:long.access_token,appsecret_proof:proof(long.access_token)});
const pages=accounts.data||[];
const page=pages.find(p=>String(p.username||'').toLowerCase()===wanted)||pages.find(p=>String(p.name||'').toLowerCase().includes(wanted));
if(!page)fail(`page "${wanted}" not found. Pages this token can manage: ${pages.map(p=>p.name).join(', ')||'none (tick the page and pages_* permissions)'}`);
// Prove the token can read the page feed before saving it.
await get(`${page.id}/feed`,{limit:'1',fields:'id',access_token:page.access_token,appsecret_proof:proof(page.access_token)});
process.stdout.write(`${page.id}\n${page.access_token}\n${page.name}\n`);
