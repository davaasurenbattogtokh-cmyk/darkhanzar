import type {Metadata} from 'next';
import {news} from '@/lib/news-server';
import {newsCategories} from '@/lib/news-categories.mjs';
import {NewsHero,NewsCard,NewsRow,MostRead,ListingRail} from '@/components/news/NewsCard';
import {NewsBanner} from '@/components/news/NewsClient';

export const dynamic='force-dynamic';
export const metadata:Metadata={alternates:{canonical:'/news'}};

export default async function NewsHome(){
 const hero=await news.featured();
 if(!hero)return <><NewsBanner placement="newsTop"/><section className="news-empty"><h1>Бизнес мэдээ</h1><p>Удахгүй анхны мэдээ нийтлэгдэнэ.</p></section></>;
 const [latest,popular,sections,listings]=await Promise.all([
  news.list({limit:9,excludeIds:[hero.id]}),
  news.mostRead(5),
  Promise.all(newsCategories.map(async c=>({category:c,items:(await news.list({category:c.id,limit:3})).items}))),
  news.listings(),
 ]);
 return <>
  <NewsBanner placement="newsTop"/>
  <h2 className="news-section-title">Онцлох нийтлэл</h2>
  <section className="news-lead"><NewsHero item={hero}/><MostRead items={popular}/></section>
  <div className={`news-columns${listings.length?' has-rail':''}`}>
   <div className="news-columns-main">
    {latest.items.length>0&&<section><h2 className="news-section-title">Шинэ мэдээ</h2><div className="news-list">{latest.items.slice(0,3).map(i=><NewsRow key={i.id} item={i}/>)}</div>{latest.items.length>3&&<div className="news-grid">{latest.items.slice(3).map(i=><NewsCard key={i.id} item={i}/>)}</div>}</section>}
    {sections.filter(s=>s.items.length).map(s=><section key={s.category.id}><div className="news-section-head"><h2 className="news-section-title">{s.category.label}</h2><a href={`/news/c/${s.category.id}`}>Бүгдийг үзэх →</a></div><div className="news-grid">{s.items.map(i=><NewsCard key={i.id} item={i}/>)}</div></section>)}
   </div>
   <ListingRail items={listings}/>
  </div>
 </>;
}
