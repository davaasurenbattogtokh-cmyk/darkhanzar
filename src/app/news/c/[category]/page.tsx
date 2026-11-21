import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {news} from '@/lib/news-server';
import {newsCategories} from '@/lib/news-categories.mjs';
import {NewsRow,ListingRail} from '@/components/news/NewsCard';
import {NewsBanner} from '@/components/news/NewsClient';

export const dynamic='force-dynamic';
const PER_PAGE=12;
type Props={params:Promise<{category:string}>;searchParams:Promise<{page?:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {category}=await params;const c=newsCategories.find(x=>x.id===category);
 return c?{title:c.label,description:`${c.label} ангиллын бизнес мэдээ · Darkhanzar`,alternates:{canonical:`/news/c/${c.id}`}}:{};
}

export default async function CategoryPage({params,searchParams}:Props){
 const {category}=await params;const c=newsCategories.find(x=>x.id===category);if(!c)notFound();
 const page=Math.max(1,Number.parseInt((await searchParams).page||'1',10)||1);
 const [{items,total},listings]=await Promise.all([news.list({category:c.id,limit:PER_PAGE,offset:(page-1)*PER_PAGE}),news.listings()]);
 const pages=Math.max(1,Math.ceil(total/PER_PAGE));
 return <>
  <NewsBanner placement="newsTop"/>
  <h1 className="news-section-title news-page-title">{c.label}</h1>
  <div className={`news-columns${listings.length?' has-rail':''}`}>
   <div className="news-columns-main">
    {items.length?<div className="news-list">{items.map(i=><NewsRow key={i.id} item={i}/>)}</div>:<section className="news-empty"><p>Энэ ангилалд мэдээ хараахан алга.</p></section>}
    {pages>1&&<nav className="news-pager" aria-label="Хуудас">{page>1&&<a href={`/news/c/${c.id}?page=${page-1}`}>← Өмнөх</a>}<span>{page} / {pages}</span>{page<pages&&<a href={`/news/c/${c.id}?page=${page+1}`}>Дараах →</a>}</nav>}
   </div>
   <ListingRail items={listings}/>
  </div>
 </>;
}
