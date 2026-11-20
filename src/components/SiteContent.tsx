'use client';
import {useEffect,useState} from 'react';
import {defaultSettings,promotionPrice,normalizeSiteSettings} from '@/lib/site-settings.mjs';
import {categories,money} from '@/lib/data';
import {Icon} from './Brand';
export type PromotionPlan={id:string;label:string;days:number;price:number;enabled:boolean;categoryPrices:Record<string,number>};
export type BannerConfig={enabled:boolean;title:string;subtitle:string;desktopImage:string;mobileImage:string;buttonText:string;href:string};
export type BannerSlide={id:string;image:string;title:string;href:string};
export type InlineBannerConfig=BannerConfig&{slides:BannerSlide[]};
export type BannerPlacement='homeTop'|'categoryTop'|'inlineCard';
export type SiteSettings={banner:BannerConfig;bannerPlacements:Record<'homeTop'|'categoryTop',BannerConfig>&{inlineCard:InlineBannerConfig};promotionPlans:PromotionPlan[]};
export function useSiteSettings(){
 const [settings,setSettings]=useState<SiteSettings>(defaultSettings);
 useEffect(()=>{const controller=new AbortController();const load=()=>fetch('/api/settings',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{settings:SiteSettings}>;}).then(d=>setSettings(normalizeSiteSettings(d.settings))).catch(()=>{});load();window.addEventListener('focus',load);return()=>{controller.abort();window.removeEventListener('focus',load);};},[]);
 return settings;
}
export function PromotionPrices({settings,category=''}:{settings:SiteSettings;category?:string}){
 const [selected,setSelected]=useState(category);const plans=settings.promotionPlans.filter(p=>p.enabled);
 return <div className="promotion-prices"><p>Зараа илүү олон хүнд хүргэх онцгой зарын багцууд.</p><label className="field-label">Ангилал<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Үндсэн үнэ</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>{plans.length?<div className="promotion-plan-grid">{plans.map(p=><article key={p.id}><Icon name="featured"/><h3>{p.label}</h3><span>{p.days} хоног</span><strong>{promotionPrice(p,selected)===0?'Үнэ төлбөргүй':money(promotionPrice(p,selected))}</strong></article>)}</div>:<div className="promotion-empty">Онцгой зарын үнэ хараахан нийтлэгдээгүй байна.</div>}<small>Нийтлэгдсэн өөрийн зарыг “Миний зарууд → Онцгой болгох” хэсгээс QPay-аар төлж онцгой болгоно.</small></div>;
}
