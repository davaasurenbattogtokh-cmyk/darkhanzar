import {adminIdentity,validMutationOrigin} from './admin-api.mjs';
import {json,PublicError,bodyJSON,marketIdentity,first,run,all,getMarketListing,publicListing} from './market-api.mjs';
import {defaultSettings,normalizeSiteSettings,promotionPrice} from '../src/lib/site-settings.mjs';
import {qpayConfigured,qpayRequest,QPayError,invoiceDisplay,testQPayConnection} from './qpay.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function promotionSettings(env){const r=await first(env,'SELECT value_json FROM site_settings WHERE id=1');return r?normalizeSiteSettings(JSON.parse(r.value_json)):defaultSettings;}
function orderView(row){return {id:row.id,listingId:row.listing_id,planLabel:row.plan_label,days:row.days,amount:row.amount,status:row.status,createdAt:row.created_at,paidAt:row.paid_at||null,error:row.error_code||null,...(row.status==='pending'&&row.qr_json?{invoice:JSON.parse(row.qr_json)}:{})};}
export async function createPromotion(env,who,input,requestOrigin,{fetcher=fetch}={}){
 if(!uuid(input.requestId)||typeof input.planId!=='string'||typeof input.listingId!=='string')throw new PublicError('Багц, зарын сонголтоо шалгана уу.');
 const listing=await getMarketListing(env,input.listingId);if(!listing||listing.owner_id!==who.id)throw new PublicError('Та зөвхөн өөрийн Darkhanzar зарыг онцгой болгоно.',403);
 if(listing.status!=='published')throw new PublicError('Админ зөвшөөрч нийтэлсэн зарыг онцгой болгоно.',409);
 if(listing.promoted_until>Date.now())throw new PublicError('Зарын онцгой хугацаа дуусаагүй байна.',409);
 const prior=await first(env,'SELECT * FROM promotion_orders WHERE owner_id=? AND client_key=?',who.id,input.requestId);if(prior)return orderView(prior);
 const existing=await first(env,'SELECT * FROM promotion_orders WHERE active_slot=?',listing.id);if(existing)return orderView(existing);
 const plan=(await promotionSettings(env)).promotionPlans.find(p=>p.id===input.planId&&p.enabled),amount=plan?promotionPrice(plan,JSON.parse(listing.data_json).category):0;
 if(!plan||!Number.isSafeInteger(amount)||amount<=0)throw new PublicError('Идэвхтэй, үнэтэй багцыг админ тохируулаагүй байна.',409);
 if(!qpayConfigured(env))throw new PublicError('QPay төлбөр түр боломжгүй байна.',503);
 let origin;try{origin=new URL(env.QPAY_SITE_ORIGIN).origin;}catch{throw new PublicError('Төлбөрийн буцах хаяг тохируулагдаагүй.',503);}
 if(origin!==requestOrigin||!origin.startsWith('https://'))throw new PublicError('Төлбөрийг сайтын үндсэн хаягаас эхлүүлнэ үү.',403);
 const now=Date.now(),quota=await first(env,'SELECT COUNT(*) AS count FROM promotion_orders WHERE owner_id=? AND created_at>?',who.id,now-86400000);if(quota.count>=20)throw new PublicError('Өдрийн нэхэмжлэхийн хязгаарт хүрлээ.',429);
 const id=crypto.randomUUID(),callbackKey=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const inserted=await first(env,"INSERT INTO promotion_orders (id,listing_id,owner_id,client_key,active_slot,plan_id,plan_label,days,amount,status,callback_hash,created_at,check_lease_until,last_checked_at) SELECT ?,?,?,?,?,?,?,?,?, 'creating',?,?,0,0 WHERE EXISTS (SELECT 1 FROM market_listings WHERE id=? AND owner_id=? AND status='published' AND updated_at=? AND data_json=? AND promoted_until<=?) ON CONFLICT DO NOTHING RETURNING id",id,listing.id,who.id,input.requestId,listing.id,plan.id,plan.label,plan.days,amount,await hash(callbackKey),now,listing.id,who.id,listing.updated_at,listing.data_json,now);
 if(!inserted){const concurrent=await first(env,'SELECT * FROM promotion_orders WHERE active_slot=? OR (owner_id=? AND client_key=?)',listing.id,who.id,input.requestId);if(concurrent)return orderView(concurrent);throw new PublicError('Нэхэмжлэх үүсгэж байна. Дахин шалгана уу.',409);}
 try{
  const invoice=invoiceDisplay(await qpayRequest(env,'/v2/invoice',{invoice_code:env.QPAY_INVOICE_CODE,sender_invoice_no:'DZ'+id.replaceAll('-',''),invoice_receiver_code:listing.id,invoice_description:`Darkhanzar: ${plan.label} / ${listing.id}`.slice(0,255),amount,callback_url:`${origin}/api/promotions/callback?order=${id}&key=${callbackKey}`},{fetcher}));
  await run(env,"UPDATE promotion_orders SET status='pending',invoice_id=?,qr_json=? WHERE id=? AND status='creating'",invoice.invoiceId,JSON.stringify(invoice),id);
 }catch(error){
  const uncertain=!(error instanceof QPayError)||error.ambiguous;
  await run(env,'UPDATE promotion_orders SET status=?,active_slot=?,error_code=? WHERE id=?',uncertain?'unknown':'failed',uncertain?listing.id:null,error instanceof QPayError?error.message:'QPAY_REQUEST_UNCERTAIN',id);
 }
 return orderView(await first(env,'SELECT * FROM promotion_orders WHERE id=?',id));
}
export async function verifyPromotion(env,id,{fetcher=fetch,callback=false}={}){
 const row=await first(env,'SELECT * FROM promotion_orders WHERE id=?',id);if(!row)throw new PublicError('Нэхэмжлэх олдсонгүй.',404);
 if(['paid','paid_review','failed'].includes(row.status))return orderView(row);
 if(row.status!=='pending'||!row.invoice_id)throw new PublicError('Нэхэмжлэхийн төлөв баталгаажаагүй байна. Админд хандана уу.',409);
 const now=Date.now();if(row.last_checked_at>now-15000)return {...orderView(row),throttled:true};
 const lease=now+90000;const held=await first(env,"UPDATE promotion_orders SET check_lease_until=? WHERE id=? AND status='pending' AND check_lease_until<? AND last_checked_at<? RETURNING id",lease,id,now,now-15000);if(!held)return {...orderView(row),busy:true};
 try{
  const check=await qpayRequest(env,'/v2/payment/check',{object_type:'INVOICE',object_id:row.invoice_id,offset:{page_number:1,page_limit:100}},{fetcher});
  if(!Array.isArray(check.rows)||check.rows.length>100||Number(check.count)>100)throw new QPayError('QPAY_CHECK_INVALID');
  const ids=[...new Set(check.rows.map(p=>p.payment_id).filter(p=>typeof p==='string'&&p))];if(ids.length>5)throw new QPayError('QPAY_PAYMENT_REVIEW_REQUIRED');
  let total=0;const paid=[];
  const payments=await Promise.all(ids.map(paymentId=>qpayRequest(env,'/v2/payment/'+encodeURIComponent(paymentId),undefined,{fetcher,method:'GET'})));
  for(const [index,paymentId] of ids.entries()){
   const payment=payments[index];

   const amount=Number(payment.payment_amount);
   if(payment.payment_id===paymentId&&payment.object_type==='INVOICE'&&payment.object_id===row.invoice_id&&payment.payment_status==='PAID'&&payment.payment_currency==='MNT'&&Number.isFinite(amount)&&amount>0){total+=amount;paid.push(paymentId);}
  }
  if(total>=row.amount){
   const paidAt=Date.now(),until=paidAt+row.days*86400000;
   await env.DB.batch([
    env.DB.prepare("UPDATE promotion_orders SET status=CASE WHEN EXISTS (SELECT 1 FROM market_listings WHERE id=? AND owner_id=? AND status='published') THEN 'paid' ELSE 'paid_review' END,active_slot=NULL,paid_at=?,last_checked_at=?,check_lease_until=0,payment_ids_json=?,error_code=NULL WHERE id=? AND status='pending' AND check_lease_until=?").bind(row.listing_id,row.owner_id,paidAt,paidAt,JSON.stringify(paid),id,lease),
    env.DB.prepare("UPDATE market_listings SET promoted_until=MAX(promoted_until,?),updated_at=? WHERE id=? AND status='published' AND owner_id=? AND EXISTS (SELECT 1 FROM promotion_orders WHERE id=? AND status='paid' AND paid_at=?)").bind(until,paidAt,row.listing_id,row.owner_id,id,paidAt),
   ]);
  }else await run(env,"UPDATE promotion_orders SET last_checked_at=?,check_lease_until=0,error_code=NULL WHERE id=? AND check_lease_until=?",now,id,lease);
 }catch(error){
  await run(env,'UPDATE promotion_orders SET check_lease_until=0,last_checked_at=?,error_code=? WHERE id=? AND check_lease_until=?',now,error instanceof QPayError?error.message:'QPAY_CHECK_UNAVAILABLE',id,lease);
  if(callback)throw new PublicError('Төлбөр шалгах үйлчилгээ түр боломжгүй.',503);
  throw new PublicError('Төлбөр баталгаажуулж чадсангүй. Хэсэг хүлээгээд дахин шалгана уу.',502);
 }
 return orderView(await first(env,'SELECT * FROM promotion_orders WHERE id=?',id));
}
export async function handlePromotionsAPI(request,env,{fetcher=fetch}={}){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/promotions/')&&!path.startsWith('/api/admin/payments'))return null;
 try{
  if(path==='/api/promotions/callback'){
   if(!['GET','POST'].includes(request.method))return json({error:'Арга дэмжигдэхгүй.'},405);
   const id=url.searchParams.get('order'),key=url.searchParams.get('key');if(!uuid(id)||!key||key.length!==64)throw new PublicError('Callback зөвшөөрөлгүй.',401);
   const row=await first(env,'SELECT callback_hash,status FROM promotion_orders WHERE id=?',id);if(!row||row.callback_hash!==await hash(key))throw new PublicError('Callback зөвшөөрөлгүй.',401);
   const order=await verifyPromotion(env,id,{fetcher,callback:true});if(order.busy||order.throttled&&order.status==='pending')return new Response('Retry later',{status:503,headers:{'Retry-After':'20'}});
   return json({ok:true});
  }
  const who=marketIdentity(request),admin=adminIdentity(request,env);
  if(path==='/api/promotions/config'&&request.method==='GET')return json({qpayReady:qpayConfigured(env)&&!!env.QPAY_SITE_ORIGIN,plans:(await promotionSettings(env)).promotionPlans.filter(p=>p.enabled)});
  if(!who)throw new PublicError('Баталгаажсан бүртгэлээр нэвтэрнэ үү.',401);
  if(path.startsWith('/api/admin/payments')&&!admin.authorized)throw new PublicError('Админы эрх шаардлагатай.',403);
  if(path==='/api/admin/payments'&&request.method==='GET')return json({qpayReady:qpayConfigured(env)&&!!env.QPAY_SITE_ORIGIN,orders:(await all(env,'SELECT * FROM promotion_orders ORDER BY created_at DESC LIMIT 100')).map(orderView)});
  const id=url.searchParams.get('id');
  if(path==='/api/promotions/order'&&request.method==='GET'){
   if(!uuid(id))throw new PublicError('Нэхэмжлэх буруу.');const row=await first(env,'SELECT * FROM promotion_orders WHERE id=? AND owner_id=?',id,who.id);if(!row)throw new PublicError('Нэхэмжлэх олдсонгүй.',404);return json({order:orderView(row)});
  }
  if(path==='/api/promotions/active'&&request.method==='GET')return json({orders:(await all(env,"SELECT * FROM promotion_orders WHERE owner_id=? AND status IN ('creating','pending','unknown','paid_review') ORDER BY created_at DESC LIMIT 50",who.id)).map(orderView)});
  if(!validMutationOrigin(request))throw new PublicError('Хүсэлтийн эх сурвалж буруу.',403);
  if(request.method!=='POST')return json({error:'Арга дэмжигдэхгүй.'},405);
  if(path==='/api/admin/payments/test')return json(await testQPayConnection(env,fetcher));
  const input=await bodyJSON(request);
  if(path==='/api/promotions/create')return json({order:await createPromotion(env,who,input,url.origin,{fetcher})});
  if(path==='/api/promotions/check'||path==='/api/admin/payments/check'){
   if(!uuid(input.id))throw new PublicError('Нэхэмжлэх буруу.');const row=await first(env,'SELECT * FROM promotion_orders WHERE id=?',input.id);if(!row||row.owner_id!==who.id&&!admin.authorized)throw new PublicError('Нэхэмжлэх олдсонгүй.',404);
   return json({order:await verifyPromotion(env,input.id,{fetcher})});
  }
  return json({error:'Олдсонгүй.'},404);
 }catch(error){return json({error:error instanceof PublicError?error.message:error instanceof QPayError?'QPay холболт амжилтгүй. Нэвтрэх мэдээлэл, тохиргоог шалгана уу.':'Төлбөрийн үйлчилгээтэй холбогдсонгүй.',...(path==='/api/admin/payments/test'&&error instanceof QPayError?{code:error.message}:{})},error instanceof PublicError?error.status:502);}
}
