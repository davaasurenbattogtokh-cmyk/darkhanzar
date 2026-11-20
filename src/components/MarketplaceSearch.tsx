'use client';
import {type FormEvent,type ReactNode} from 'react';
import {categories} from '@/lib/data';
import {Icon} from './Brand';
type Props={compact:boolean;text:string;onText:(v:string)=>void;category:string;onCategory:(v:string)=>void;region:string;onRegion:(v:string)=>void;regionOptions:ReactNode;onSearch:(e?:FormEvent)=>void};
export default function MarketplaceSearch(p:Props){return <section className={`discovery-search ${p.compact?'discovery-search-compact':''}`} aria-label="Зар хайх хэсэг">
 {!p.compact&&<div className="discovery-heading"><h1>Ойрхон хай. Амархан ол.</h1><p>Дархан-Уул · Сүхбаатар · Хөтөл</p></div>}
 <form className="discovery-form" onSubmit={p.onSearch}>
  <label className="discovery-query"><Icon name="search"/><input id="marketplace-search" aria-label="Зар хайх" placeholder="Юу хайж байна?" value={p.text} onChange={e=>p.onText(e.target.value)}/>{p.text&&<button type="button" aria-label="Хайлтын үг арилгах" onClick={()=>p.onText('')}><Icon name="x-circle"/></button>}</label>
  <label className="discovery-select"><Icon name="categories"/><select aria-label="Хайлтын ангилал" value={p.category} onChange={e=>p.onCategory(e.target.value)}><option value="">Бүх ангилал</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><Icon name="chevron-down"/></label>
  <label className="discovery-select"><Icon name="map-pin"/><select aria-label="Хайлтын байршил" value={p.region} onChange={e=>p.onRegion(e.target.value)}>{p.regionOptions}</select><Icon name="chevron-down"/></label>
  <button className="button button-primary discovery-submit" type="submit"><Icon name="search"/>Хайх</button>
 </form>
 {!p.compact&&<div className="discovery-regions" role="group" aria-label="Түгээмэл байршил">{[{id:'darkhanuul',label:'Дархан-Уул'},{id:'sukhbaatar',label:'Сүхбаатар'},{id:'khutul',label:'Хөтөл'}].map(r=><button key={r.id} className={p.region===r.id?'selected':''} aria-pressed={p.region===r.id} onClick={()=>p.onRegion(p.region===r.id?'all':r.id)}>{p.region===r.id&&<Icon name="check-circle"/>}{r.label}</button>)}</div>}
 </section>;}

const categoryOrder=['property','cars','jobs','services','phones','computers','electronics','home','fashion','kids','hobby','equipment','health','animals','free'];
const shortNames:Record<string,string>={jobs:'Ажлын байр',phones:'Гар утас',computers:'Компьютер',fashion:'Хувцас',hobby:'Спорт, аялал',equipment:'Төхөөрөмж',health:'Эрүүл мэнд',animals:'Мал, ургамал'};
export function CategoryTiles({expanded,onExpand,onChoose}:{expanded:boolean;onExpand:()=>void;onChoose:(id:string)=>void}){return <section className="category-discovery" aria-label="Зарын ангиллууд"><div className={`category-tiles ${expanded?'all-tiles':''}`}>{categoryOrder.slice(0,expanded?15:12).map(id=>{const c=categories.find(c=>c.id===id)!;return <button key={id} onClick={()=>onChoose(id)} aria-label={`${c.label} ангилал`}><Icon name={c.icon}/><span>{shortNames[id]||c.label}</span></button>;})}</div><button className="all-categories-link" onClick={onExpand} aria-expanded={expanded}>{expanded?'Хураах':'Бүх ангилал'}<Icon name={expanded?'arrow-left':'arrow-right'}/></button></section>;}
