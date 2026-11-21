'use client';
import {useEffect,useState} from 'react';

type Highlight={id:string;slug:string;title:string;cover:string;category:string;publishedAt:number};
let request:Promise<Highlight[]>|null=null;
// One shared request for both placements (side column and the inline block on smaller screens).
const loadHighlights=()=>request??=fetch('/api/news?highlights=5').then(r=>r.ok?r.json():{items:[]}).then((d:{items?:Highlight[]})=>d.items||[]).catch(()=>[]);

export default function MarketNewsRail({variant}:{variant:'side'|'inline'}){
 const [items,setItems]=useState<Highlight[]>([]);
 useEffect(()=>{let alive=true;loadHighlights().then(i=>{if(alive)setItems(i);});return()=>{alive=false;};},[]);
 if(!items.length)return null;
 return <aside className={`market-news-rail market-news-${variant}`} aria-label="Онцлох бизнес мэдээ">
  <div className="market-news-head"><span>Бизнес мэдээ</span><a href="/news">Дэлгэрэнгүй →</a></div>
  <ol>{items.map(i=><li key={i.id}><a href={`/news/${i.slug}`}>
   {i.cover?<img src={i.cover} alt="" loading="lazy"/>:<span className="market-news-noimg" aria-hidden="true">darkhan<b>zar</b></span>}
   <span>{i.title}</span>
  </a></li>)}</ol>
  <a className="market-news-more" href="/news">Бүх мэдээг үзэх</a>
 </aside>;
}
