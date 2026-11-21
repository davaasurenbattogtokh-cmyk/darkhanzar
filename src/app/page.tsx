import type {Metadata} from 'next';
import Marketplace from '@/components/Marketplace';
import {listingShare} from '../../server/listing-share.mjs';

type Props={searchParams:Promise<{ad?:string|string[]}>};
type Share={title:string;price:string;place:string;description:string;image:string}|null;

// A shared ad link (/?ad=<id>) previews that ad; the plain home page uses the layout's card.
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const ad=(await searchParams).ad;
 if(typeof ad!=='string')return {};
 const env=(globalThis as {__darkhanzarEnv?:unknown}).__darkhanzarEnv;
 let item:Share=null;
 try{item=env?await listingShare(env,ad) as Share:null;}catch{item=null;}
 if(!item)return {};
 const title=`${item.title}${item.price?` · ${item.price}`:''}`;
 const description=item.description||[item.place,'Darkhanzar зар'].filter(Boolean).join(' · ');
 const url=`/?ad=${encodeURIComponent(ad)}`;
 const images=item.image?[{url:item.image}]:[{url:'/og.png',width:1200,height:630}];
 return {title:`${title} — Darkhanzar`,description,openGraph:{type:'website',siteName:'Darkhanzar',locale:'mn_MN',title,description,url,images},twitter:{card:'summary_large_image',title,description,images:images.map(i=>i.url)}};
}

export default function Page(){ return <Marketplace/>; }
