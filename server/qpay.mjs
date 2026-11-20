import {PublicError} from './market-api.mjs';
let cache=null;
export function qpayConfigured(env){return env.QPAY_ENABLED==='true'&&!!env.QPAY_USERNAME&&!!env.QPAY_PASSWORD&&!!env.QPAY_INVOICE_CODE&&['https://merchant.qpay.mn','https://merchant-sandbox.qpay.mn'].includes(env.QPAY_BASE_URL);}
export class QPayError extends Error{constructor(code,ambiguous=false){super(code);this.ambiguous=ambiguous;}}
async function providerJSON(response){const raw=await response.text();if(raw.length>2*1024*1024)throw new QPayError('QPAY_RESPONSE_TOO_LARGE',true);try{return JSON.parse(raw);}catch{throw new QPayError('QPAY_INVALID_RESPONSE',true);}}
async function token(env,fetcher,force=false){
 if(!qpayConfigured(env))throw new PublicError('QPay холболт тохируулагдаагүй байна.',503);
 if(!cache||cache.username!==env.QPAY_USERNAME||cache.password!==env.QPAY_PASSWORD||cache.base!==env.QPAY_BASE_URL)cache={username:env.QPAY_USERNAME,password:env.QPAY_PASSWORD,base:env.QPAY_BASE_URL};
 const current=cache;if(!force&&current.access&&current.expires>Date.now()+60000)return current.access;
 if(current.pending)return current.pending;
 current.pending=(async()=>{
  let response;try{response=await fetcher(env.QPAY_BASE_URL+'/v2/auth/token',{method:'POST',redirect:'manual',headers:{Authorization:'Basic '+btoa(env.QPAY_USERNAME+':'+env.QPAY_PASSWORD)},signal:AbortSignal.timeout(15000)});}catch{throw new QPayError('QPAY_AUTH_UNAVAILABLE');}
  if(!response.ok){let detail='';try{const data=await providerJSON(response);const code=data.error||data.code;if(typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(code))detail='_'+code;}catch{}throw new QPayError('QPAY_AUTH_HTTP_'+response.status+detail);}
  const data=await providerJSON(response);if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)*1000<=Date.now())throw new QPayError('QPAY_AUTH_INVALID');
  current.access=data.access_token;current.expires=Number(data.expires_in)*1000;return current.access;
 })();try{return await current.pending;}finally{current.pending=null;}
}
export const testQPayConnection=async(env,fetcher=fetch)=>{await token(env,fetcher);return {connected:true,environment:env.QPAY_BASE_URL==='https://merchant.qpay.mn'?'production':'sandbox'};};
export async function qpayRequest(env,path,body,{fetcher=fetch,method='POST'}={}){
 for(let attempt=0;attempt<2;attempt++){
  const access=await token(env,fetcher,attempt===1);let response;
  try{response=await fetcher(env.QPAY_BASE_URL+path,{method,redirect:'manual',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});}catch{throw new QPayError('QPAY_REQUEST_UNCERTAIN',method==='POST'&&path==='/v2/invoice');}
  if([401,403].includes(response.status)&&attempt===0){await response.body?.cancel();continue;}
  if(!response.ok){const ambiguous=response.status>=500||(response.status>=300&&response.status<400);await response.body?.cancel();throw new QPayError('QPAY_HTTP_'+response.status,ambiguous);}
  return providerJSON(response);
 }
 throw new QPayError('QPAY_AUTH_REJECTED');
}
export function safeBankLink(value){
 if(typeof value!=='string'||/[\x00-\x20]/.test(value))return false;
 try{const u=new URL(value);return !u.username&&!u.password&&(u.protocol==='https:'||/^[a-z][a-z0-9+.-]*:$/.test(u.protocol)&&!['http:','javascript:','data:','file:','blob:','about:','vbscript:'].includes(u.protocol));}catch{return false;}
}
export function invoiceDisplay(data){
 if(typeof data.invoice_id!=='string'||!data.invoice_id||typeof data.qr_text!=='string'||typeof data.qr_image!=='string'||!/^[A-Za-z0-9+/=]+$/.test(data.qr_image))throw new QPayError('QPAY_INVOICE_INVALID',true);
 return {invoiceId:data.invoice_id,qrText:data.qr_text,qrImage:data.qr_image,urls:(Array.isArray(data.urls)?data.urls:[]).filter(u=>typeof u.name==='string'&&safeBankLink(u.link)).map(u=>({name:u.name,description:typeof u.description==='string'?u.description:u.name,link:u.link})),shortUrl:typeof data.qPay_shortUrl==='string'&&/^https:\/\//.test(data.qPay_shortUrl)&&safeBankLink(data.qPay_shortUrl)?data.qPay_shortUrl:null};
}
