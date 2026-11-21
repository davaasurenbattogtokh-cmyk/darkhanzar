import type {Metadata} from 'next';
import {news} from '@/lib/news-server';
import {NewsCard,ListingRail} from '@/components/news/NewsCard';
import {NewsBanner} from '@/components/news/NewsClient';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Видео мэдээ',description:'Дархан-Уул, Сүхбаатар, Хөтөлийн бизнес, эдийн засгийн видео мэдээ · Darkhanzar',alternates:{canonical:'/news/video'}};
const PER_PAGE=12;
type Props={searchParams:Promise<{page?:string}>};

export default async function VideoNews({searchParams}:Props){
 const page=Math.max(1,Number.parseInt((await searchParams).page||'1',10)||1);
 const [{items,total},listings]=await Promise.all([news.videos(PER_PAGE,(page-1)*PER_PAGE),news.listings()]);
 const pages=Math.max(1,Math.ceil(total/PER_PAGE));
 return <>
  <NewsBanner placement="newsTop"/>
  <h1 className="news-section-title news-page-title">Видео мэдээ</h1>
  <div className={`news-columns${listings.length?' has-rail':''}`}>
   <div className="news-columns-main">
    {items.length?<div className="news-grid">{items.map(i=><NewsCard key={i.id} item={i}/>)}</div>:<section className="news-empty"><p>Видео мэдээ удахгүй нэмэгдэнэ.</p></section>}
    {pages>1&&<nav className="news-pager" aria-label="Хуудас">{page>1&&<a href={`/news/video?page=${page-1}`}>← Өмнөх</a>}<span>{page} / {pages}</span>{page<pages&&<a href={`/news/video?page=${page+1}`}>Дараах →</a>}</nav>}
   </div>
   {listings.length>0&&<div className="news-rail-stack"><ListingRail items={listings}/></div>}
  </div>
 </>;
}
