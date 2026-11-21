'use client';
import {useEffect,useState} from 'react';
import {youtubeThumb} from '@/lib/news-video.mjs';

type Highlight={id:string;slug:string;title:string;cover:string;video?:string;category:string;publishedAt:number};
type Rail={news:Highlight[];videos:Highlight[]};
const items=(url:string)=>fetch(url).then(r=>r.ok?r.json():{items:[]}).then((d:{items?:Highlight[]})=>d.items||[]).catch(()=>[] as Highlight[]);
let request:Promise<Rail>|null=null;
// One shared request pair for both placements (side column and the inline block on smaller screens).
const loadRail=()=>request??=Promise.all([items('/api/news?highlights=5'),items('/api/news?videos=3')]).then(([news,videos])=>({news,videos}));

export default function MarketNewsRail({variant}:{variant:'side'|'inline'}){
 const [rail,setRail]=useState<Rail>({news:[],videos:[]});
 useEffect(()=>{let alive=true;loadRail().then(r=>{if(alive)setRail(r);});return()=>{alive=false;};},[]);
 if(!rail.news.length&&!rail.videos.length)return null;
 return <aside className={`market-news-rail market-news-${variant}`} aria-label="Онцлох бизнес мэдээ">
  {rail.news.length>0&&<>
   <div className="market-news-head"><span>Бизнес мэдээ</span><a href="/news">Дэлгэрэнгүй →</a></div>
   <ol>{rail.news.map(i=><li key={i.id}><a href={`/news/${i.slug}`}>
    {i.cover?<img src={i.cover} alt="" loading="lazy"/>:<span className="market-news-noimg" aria-hidden="true">darkhan<b>zar</b></span>}
    <span>{i.title}</span>
   </a></li>)}</ol>
   <a className="market-news-more" href="/news">Бүх мэдээг үзэх</a>
  </>}
  {rail.videos.length>0&&<section className="market-news-videos" aria-label="Видео мэдээ">
   <div className="market-news-head"><span>Видео мэдээ</span><a href="/news/video">Бүгд →</a></div>
   <div className="market-news-video-list">{rail.videos.map(i=>{const src=i.cover||youtubeThumb(i.video||'');return <a key={i.id} href={`/news/${i.slug}`}>
    <span className="market-news-video-thumb">{src?<img src={src} alt="" loading="lazy"/>:<span className="market-news-noimg" aria-hidden="true">darkhan<b>zar</b></span>}<i aria-hidden="true">▶</i></span>
    <b>{i.title}</b>
   </a>;})}</div>
  </section>}
 </aside>;
}
