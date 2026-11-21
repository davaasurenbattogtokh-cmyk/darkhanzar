'use client';
import {useEffect,useState} from 'react';
import {Logo,Icon} from './Brand';
import {type BannerConfig,type BannerPlacement} from './SiteContent';
export default function AdvertisingBanner({placement,banner,onPost,preview=false}:{placement:Exclude<BannerPlacement,'inlineCard'>;banner:BannerConfig;onPost:()=>void;preview?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[banner.desktopImage,banner.mobileImage]);
 if(!banner.enabled)return null;
 const image=!!(banner.desktopImage||banner.mobileImage)&&!failed;
 const content=image?<picture><source media="(max-width:600px)" srcSet={banner.mobileImage||banner.desktopImage}/><img src={banner.desktopImage||banner.mobileImage} alt={banner.title||'Сурталчилгааны баннер'} onError={()=>setFailed(true)} decoding="async"/></picture>:<div className="house-ad"><Logo/><div className="house-ad-copy"><strong>{banner.title}</strong><span>{banner.subtitle}</span></div>{banner.buttonText&&<span className="house-ad-cta">{banner.buttonText}<Icon name="arrow-right"/></span>}</div>;
 return <div className={`advertising-placement advertising-${placement}${image?' has-artwork':''}`} data-banner-placement={placement} aria-label={placement==='homeTop'?'Нүүр хуудасны баннер':placement==='categoryTop'?'Ангиллын баннер':'Сурталчилгаа'}><span className="advertising-label">{image?'Сурталчилгаа':'Darkhanzar'}</span>{preview?<div className="advertising-surface">{content}</div>:banner.href==='#post'?<button className="advertising-surface" onClick={onPost} aria-label={banner.buttonText||banner.title||'Зар нэмэх'}>{content}</button>:<a className="advertising-surface" href={banner.href} {...(banner.href.startsWith('https://')?{target:'_blank',rel:'sponsored noopener noreferrer'}:{})}>{content}</a>}</div>;
}
