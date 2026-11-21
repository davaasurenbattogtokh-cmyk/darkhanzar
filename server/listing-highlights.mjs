import {publicSnapshot} from './source-sync.mjs';
import {publicListing} from './market-api.mjs';

// Listings shown in the business-news sidebar: promoted Darkhanzar ads first, then the newest
// Darkhanzar ads, then Unegui index ads (promoted ones first) so the box is never empty.
export async function listingHighlights(env,limit=5){
 const n=Math.min(20,Math.max(0,Number.parseInt(limit,10)||0));
 if(!n)return [];
 const rows=(await env.DB.prepare(`SELECT * FROM market_listings WHERE status='published' ORDER BY (promoted_until>?) DESC, promoted_until DESC, created_at DESC LIMIT ${n}`).bind(Date.now()).all()).results||[];
 const items=rows.map(r=>{const l=publicListing(r,false);return {id:l.id,title:l.title,price:Number(l.price)||0,priceLabel:'',place:l.place||'',image:l.images?.[0]||'',featured:!!l.featured,href:`/?ad=${encodeURIComponent(l.id)}`,source:'Darkhanzar'};});
 if(items.length<n){
  const snapshot=await publicSnapshot(env).catch(()=>null);
  const entries=[...(snapshot?.items||[])].sort((a,b)=>Number(!!b.sourcePromotion)-Number(!!a.sourcePromotion));
  for(const e of entries){
   if(items.length>=n)break;
   const remote=e.images?.[0]||e.thumbnail;
   items.push({id:`UN-${e.id}`,title:e.title,price:e.price??0,priceLabel:e.priceLabel||'',place:e.location||'',image:e.localImages?.[0]||(remote?`/api/source-image?url=${encodeURIComponent(remote)}`:''),featured:!!e.sourcePromotion,href:`/?ad=${encodeURIComponent(`UN-${e.id}`)}`,source:'Unegui'});
  }
 }
 return items;
}
