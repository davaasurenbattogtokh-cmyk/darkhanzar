'use client';
import {useEffect,useRef,useState} from 'react';
import {money,type Listing} from '@/lib/data';
const sourcePrice=(item:Listing)=>item.source?.priceUnknown?item.source.priceLabel:money(item.price);
const leafName=(path:string)=>path.split(/\s*(?:>|\/)\s*/).pop();
import {Icon} from './Brand';
import FacebookShare from './FacebookShare';

function SourcePhoto({src,alt,eager=false}:{src?:string;alt:string;eager?:boolean}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  if(!src||failed)return <span className="source-photo-fallback"><Icon name="images"/><span>{src?'Зураг ачаалсангүй':'Зураггүй'}</span></span>;
  return <img src={src} alt={alt} loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}

export function SourceCard({item,saved,onSave,onOpen,layout}:{item:Listing;saved:boolean;onSave:()=>void;onOpen:()=>void;layout:string}){
  if(!item.source)return null;
  return <article className={`source-card source-photo-card ${layout==='grid'?'source-card-grid':''}`}>
    <button className="source-photo-trigger" onClick={onOpen} aria-label={`${item.title}, дэлгэрэнгүй`}>
      <SourcePhoto src={item.images[0]||item.source.thumbnail} alt={item.title}/>
      {item.images.length>0&&<span className="source-photo-count"><Icon name="images"/>{item.images.length}</span>}
    </button>
    <div className="source-card-body"><div className="source-card-price"><strong>{sourcePrice(item)}</strong></div><button className="source-card-title" onClick={onOpen}>{item.title}</button>{!!item.features?.length&&<div className="source-features">{item.features.map((f,i)=><span key={i}>{f}</span>)}</div>}<div className="source-card-meta"><span><Icon name="map-pin"/>{item.place||'Дархан-Уул'}</span><span className="source-age">{item.source.publishedLabel}</span></div><div className="source-card-eyebrow"><span>{item.categoryLabel}</span><a className="source-mini-label" href={item.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title}, эх сурвалж unegui.mn`}>unegui.mn <Icon name="arrow-right"/></a></div></div>
    <button className={`source-save ${saved?'selected':''}`} aria-label={`${item.title}, ${saved?'хадгалснаас хасах':'хадгалах'}`} aria-pressed={saved} onClick={onSave}><Icon name="heart"/></button>
  </article>;
}

function SourceGallery({images,title}:{images:string[];title:string}){
  const [active,setActive]=useState(0);
  const track=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=track.current;const selected=el?.children[active] as HTMLElement|undefined;if(el&&selected)el.scrollTo({left:Math.max(0,selected.offsetLeft-(el.clientWidth-selected.offsetWidth)/2),behavior:'smooth'});},[active]);
  return <section className="source-gallery" aria-label="Зарын зургийн цомог" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'&&images.length){e.preventDefault();setActive(i=>Math.min(images.length-1,i+1));}if(e.key==='ArrowLeft'){e.preventDefault();setActive(i=>Math.max(0,i-1));}}}>
    <div className="source-gallery-main"><SourcePhoto src={images[active]} alt={`${title}, зураг ${active+1}`} eager/>
      {images.length>1&&<><button className="gallery-arrow gallery-previous" aria-label="Өмнөх зураг" disabled={active===0} onClick={()=>setActive(active-1)}><Icon name="arrow-left"/></button><button className="gallery-arrow gallery-next" aria-label="Дараагийн зураг" disabled={active===images.length-1} onClick={()=>setActive(active+1)}><Icon name="arrow-right"/></button></>}
      {images.length>0&&<><span className="gallery-position" aria-live="polite">{active+1} / {images.length}</span><a className="gallery-expand" href={images[active]} target="_blank" rel="noopener noreferrer" aria-label="Зургийг бүтнээр нээх"><Icon name="eye"/></a></>}
    </div>
    {images.length>1&&<div className="source-gallery-track" ref={track} aria-label="Зургийн жижиг хувилбарууд">{images.map((src,i)=><button className={active===i?'selected':''} key={`${src}-${i}`} aria-label={`Зураг ${i+1} харах`} aria-pressed={active===i} onClick={()=>setActive(i)}><SourcePhoto src={src} alt={`${title}, жижиг зураг ${i+1}`}/></button>)}</div>}
  </section>;
}

export function SourceDetail({item,saved,onSave,related=[],onOpen,onShare}:{item:Listing;saved:boolean;onSave:()=>void;related?:Listing[];onOpen?:(item:Listing)=>void;onShare?:()=>void}){
  if(!item.source)return null;
  return <div className="concept-detail">
    <div className="concept-detail-breadcrumb">Нүүр <Icon name="chevron-down"/>{item.categoryLabel}<Icon name="chevron-down"/><span>{leafName(item.subcategory)}</span></div>
    <div className="source-detail photo-source-detail">
      <div className="source-detail-main">
        <div className="detail-gallery-wrap"><SourceGallery key={item.id} images={item.images} title={item.title}/><div className="detail-gallery-actions"><button onClick={onSave} aria-label={saved?'Зарыг хадгалснаас хасах':'Зар хадгалах'} aria-pressed={saved}><Icon name="heart"/></button>{onShare&&<button onClick={onShare} aria-label="Зарын холбоос хуулах"><Icon name="share"/></button>}</div></div>
        <div className="detail-mobile-price">{sourcePrice(item)}</div>
        <div className="source-detail-intro"><h1>{item.title}</h1><div className="source-detail-location"><Icon name="map-pin"/>{item.place}<span>· {item.source.publishedLabel}</span></div></div>
        {!!item.features?.length&&<div className="source-detail-features">{item.features.map((f,i)=><span key={i}>{f}</span>)}</div>}
        <section className="detail-description-section"><h2>Зарын мэдээлэл</h2><dl className="detail-facts"><div><dt>Ангилал</dt><dd>{item.categoryLabel}</dd></div><div><dt>Дэд ангилал</dt><dd>{leafName(item.subcategory)}</dd></div><div><dt>Байршил</dt><dd>{item.place}</dd></div><div><dt>Зарын дугаар</dt><dd>{item.source.id}</dd></div></dl>{Object.keys(item.attributes).length>0&&<><h2>Үзүүлэлт</h2><dl className="detail-facts">{Object.entries(item.attributes).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></>}<div className="source-original-note"><Icon name="info"/><p>Зураг, мэдээллийн эх сурвалж: Unegui.mn. Бүтэн тайлбар, утас болон одоогийн төлөвийг эх зараас үзнэ үү.</p></div></section>
        <section className="detail-location-section"><h2>Байршил</h2><a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(item.place)}`} target="_blank" rel="noopener noreferrer" className="detail-area-link"><span className="detail-area-pin"><Icon name="map-pin"/></span><span><strong>{item.place}</strong><small>Ерөнхий байршил · нарийвчилсан хаяг өгөөгүй</small></span><Icon name="arrow-right"/></a></section>
      </div>
      <aside className="concept-detail-side"><div className="source-detail-aside"><span className="source-price-caption">Зарын үнэ</span><div className="source-detail-price">{sourcePrice(item)}</div><div className="detail-source-owner"><span className="detail-owner-avatar">U</span><div><strong>Unegui.mn</strong><small>Эх сурвалжийн зар</small></div></div><a className="button button-primary full-width source-open-button" href={item.source.url} target="_blank" rel="noopener noreferrer">Эх зарыг нээх <Icon name="arrow-right"/></a><button className={`button button-outline full-width ${saved?'saved-outline':''}`} onClick={onSave}><Icon name="heart"/>{saved?'Хадгалсан':'Хадгалах'}</button><FacebookShare id={item.id}/>{onShare&&<button className="button button-outline full-width" onClick={onShare}><Icon name="share"/>Холбоос хуулах</button>}<div className="detail-source-notice"><Icon name="info"/><p>Холбоо барих мэдээлэл эх зар дээр байна. Үнэ, төлөвийг эх сурвалжаас нягтлаарай.</p></div><span className="detail-observed">Мэдээлэл шалгасан: {new Date(item.source.observedAt).toLocaleDateString('en-GB',{timeZone:'Asia/Ulaanbaatar'})}</span></div>
      {related.length>0&&onOpen&&<section className="detail-related"><h2>Ижил төстэй зарууд</h2>{related.map(r=><button key={r.id} onClick={()=>onOpen(r)}><SourcePhoto src={r.images[0]} alt={r.title}/><span><strong>{r.title}</strong><small><Icon name="map-pin"/>{r.place}</small><b>{sourcePrice(r)}</b></span></button>)}</section>}
      </aside>
    </div>
    <div className="detail-mobile-actions"><a className="button button-primary" href={item.source.url} target="_blank" rel="noopener noreferrer">Эх зарыг нээх <Icon name="arrow-right"/></a><button className="button button-outline" onClick={onSave}><Icon name="heart"/>{saved?'Хадгалсан':'Хадгалах'}</button></div>
  </div>;
}
