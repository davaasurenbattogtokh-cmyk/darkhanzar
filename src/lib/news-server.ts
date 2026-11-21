// Server-only access to published news for the /news pages.
// The custom server (server.js) shares its database handle via globalThis.__darkhanzarEnv.
import {listPublished,featuredArticle,mostRead,publishedBySlug,countView,sitemapEntries} from '../../server/news-store.mjs';
import {listingHighlights} from '../../server/listing-highlights.mjs';
import {normalizeSiteSettings} from './site-settings.mjs';

export type ListingHighlight={id:string;title:string;price:number;priceLabel:string;place:string;image:string;featured:boolean;href:string;source:string};

export type NewsItem={id:string;slug:string;title:string;summary:string;category:string;cover:string;status:string;featured:boolean;author:string;views:number;createdAt:number;updatedAt:number;publishedAt:number;body?:string};

function env(){
 const shared=(globalThis as {__darkhanzarEnv?:unknown}).__darkhanzarEnv;
 if(!shared)throw new Error('News storage is unavailable');
 return shared;
}
export const news={
 list:(o:{category?:string;limit?:number;offset?:number;excludeIds?:string[]}={})=>listPublished(env(),o) as Promise<{items:NewsItem[];total:number}>,
 featured:()=>featuredArticle(env()) as Promise<NewsItem|null>,
 mostRead:(limit=5)=>mostRead(env(),{limit}) as Promise<NewsItem[]>,
 bySlug:(slug:string)=>publishedBySlug(env(),slug) as Promise<NewsItem|null>,
 countView:(id:string)=>countView(env(),id) as Promise<void>,
 sitemap:()=>sitemapEntries(env()) as Promise<{slug:string;updatedAt:number}[]>,
 // Number of listings is set by admins (Admin → Мэдээ → «Хажуугийн онцлох зар»).
 listings:async():Promise<ListingHighlight[]>=>{
  try{
   const e=env() as {DB:{prepare:(s:string)=>{first:()=>Promise<{value_json:string}|null>}}};
   const row=await e.DB.prepare('SELECT value_json FROM site_settings WHERE id=1').first();
   const count=normalizeSiteSettings(row?JSON.parse(row.value_json):{}).newsSidebarListings;
   return await listingHighlights(e,count) as ListingHighlight[];
  }catch{return [];}
 },
};
export const siteOrigin=()=>(process.env.APP_ORIGIN||'https://darkhanzar.mn').replace(/\/$/,'');
export const formatDate=(ms:number)=>new Date(ms).toLocaleDateString('mn-MN',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Ulaanbaatar'});
