import {publicSnapshot} from './source-sync.mjs';
import {publicListing} from './market-api.mjs';

// Title, description and image for a shared ad link (/?ad=<id>), so Facebook shows a preview card.
const ID=/^(UN-)?[A-Za-z0-9_-]{1,80}$/;
const clip=(text,n)=>{const s=String(text||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'…':s;};
const money=n=>Number(n)>0?`${new Intl.NumberFormat('mn-MN').format(Number(n))} ₮`:'';

export async function listingShare(env,id){
 if(typeof id!=='string'||!ID.test(id))return null;
 if(id.startsWith('UN-')){
  const snapshot=await publicSnapshot(env).catch(()=>null);
  const e=snapshot?.items?.find(i=>`UN-${i.id}`===id);
  if(!e)return null;
  const remote=e.images?.[0]||e.thumbnail;
  return {title:clip(e.title,120),price:e.priceLabel||money(e.price),place:e.location||'',description:clip(e.description||e.summary||'',200),image:e.localImages?.[0]||(remote?`/api/source-image?url=${encodeURIComponent(remote)}`:'')};
 }
 const row=await env.DB.prepare("SELECT * FROM market_listings WHERE id=? AND status='published'").bind(id).first();
 if(!row)return null;
 const l=publicListing(row,false);
 return {title:clip(l.title,120),price:money(l.price),place:l.place||'',description:clip(l.description,200),image:l.images?.[0]||''};
}
