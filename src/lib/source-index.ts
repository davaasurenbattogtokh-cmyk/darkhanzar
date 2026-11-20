import snapshot from '../../public/data/unegui-darkhan.json';
import {categories,type Listing} from './data';
export const sourceSnapshot = snapshot;
export type SourceEntry={id:string;title:string;category:string;subcategory:string;price:number|null;priceLabel:string;region:string;location:string;publishedLabel:string;url:string;sourcePromotion:string;observedAt:string;images?:string[];localImages?:string[];features?:string[];thumbnail?:string|null;attributes?:Record<string,string>};
export type SourceData={observedAt:string;collectedCount:number;scope?:string;counts?:Record<string,number>;excludedUnclear?:number;items:SourceEntry[]};
export const toSourceListings=(data:SourceData):Listing[]=>data.items.map((entry,i)=>({
  id:`UN-${entry.id}`,title:entry.title,description:'Бүтэн тайлбар болон холбоо барих мэдээллийг Unegui.mn дээрх эх зарын хуудаснаас үзнэ үү.',
  category:entry.category,categoryLabel:categories.find(c=>c.id===entry.category)?.label||'Бусад',subcategory:entry.subcategory||categories.find(c=>c.id===entry.category)?.label||'',
  price:entry.price??0,region:entry.region,place:entry.location,images:entry.localImages||(entry.images?.length?entry.images:entry.thumbnail?[entry.thumbnail]:[]).map(url=>`/api/source-image?url=${encodeURIComponent(url)}`),
  featured:!!entry.sourcePromotion,condition:'unknown',status:'published',
  createdAt:Date.parse(data.observedAt)-i*1000,ownerId:'external-source',seller:'Unegui.mn',attributes:entry.attributes||{},features:entry.features,
  source:{id:entry.id,url:entry.url,priceLabel:entry.priceLabel,priceUnknown:entry.price===null,publishedLabel:entry.publishedLabel,observedAt:entry.observedAt,promotion:entry.sourcePromotion,thumbnail:entry.thumbnail??undefined},
}));
export const sourceListings:Listing[]=toSourceListings(snapshot);
