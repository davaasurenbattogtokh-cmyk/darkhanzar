import {Fragment,type ReactNode} from 'react';
import {parseArticle} from '@/lib/news-markup.mjs';

type Inline={t:string;v:string;href?:string};
type Block={t:string;c?:Inline[];items?:Inline[][];ordered?:boolean;src?:string;alt?:string};

function inline(parts:Inline[]):ReactNode[]{
 return parts.map((p,i)=>p.t==='strong'?<strong key={i}>{p.v}</strong>
  :p.t==='em'?<em key={i}>{p.v}</em>
  :p.t==='link'?<a key={i} href={p.href} {...(/^https?:/.test(p.href||'')?{target:'_blank',rel:'noopener noreferrer nofollow'}:{})}>{p.v}</a>
  :<Fragment key={i}>{p.v}</Fragment>);
}

// Renders the article text format as React elements (no raw HTML is ever injected).
export default function NewsBody({body}:{body:string}){
 const blocks=parseArticle(body) as Block[];
 return <div className="news-body">{blocks.map((b,i)=>{
  if(b.t==='h2')return <h2 key={i}>{inline(b.c!)}</h2>;
  if(b.t==='h3')return <h3 key={i}>{inline(b.c!)}</h3>;
  if(b.t==='quote')return <blockquote key={i}>{inline(b.c!)}</blockquote>;
  if(b.t==='img')return <figure key={i}><img src={b.src} alt={b.alt||''} loading="lazy"/>{b.alt&&<figcaption>{b.alt}</figcaption>}</figure>;
  if(b.t==='list'){const items=b.items!.map((it,j)=><li key={j}>{inline(it)}</li>);return b.ordered?<ol key={i}>{items}</ol>:<ul key={i}>{items}</ul>;}
  return <p key={i}>{inline(b.c!)}</p>;
 })}</div>;
}
