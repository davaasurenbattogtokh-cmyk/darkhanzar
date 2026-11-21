'use client';
import {useState} from 'react';
import AdvertisingBanner from '../AdvertisingBanner';
import {useSiteSettings} from '../SiteContent';

// Banner placements managed from Admin → Баннер (Мэдээ · дээд / нийтлэл доторх).
export function NewsBanner({placement}:{placement:'newsTop'|'newsArticle'}){
 const settings=useSiteSettings();
 const banner=settings.bannerPlacements[placement];
 if(!banner?.enabled)return null;
 return <div className="news-banner"><AdvertisingBanner placement={placement} banner={banner} onPost={()=>{window.location.href='/';}}/></div>;
}

export function NewsShare({url,title}:{url:string;title:string}){
 const [copied,setCopied]=useState(false);
 const fb=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{window.prompt('Холбоосыг хуулна уу:',url);}}
 async function share(){if(navigator.share){try{await navigator.share({title,url});}catch{}}else copy();}
 return <div className="news-share" aria-label="Хуваалцах">
  <a className="news-share-fb" href={fb} target="_blank" rel="noopener noreferrer">Facebook-т хуваалцах</a>
  <button type="button" onClick={copy}>{copied?'Хуулагдлаа ✓':'Холбоос хуулах'}</button>
  <button type="button" className="news-share-native" onClick={share}>Хуваалцах</button>
 </div>;
}
