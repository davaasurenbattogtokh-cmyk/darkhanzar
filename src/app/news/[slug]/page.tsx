import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {news,siteOrigin,formatDate} from '@/lib/news-server';
import {newsCategoryLabel} from '@/lib/news-categories.mjs';
import NewsBody from '@/components/news/NewsBody';
import {NewsCard} from '@/components/news/NewsCard';
import {NewsBanner,NewsShare} from '@/components/news/NewsClient';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const item=await news.bySlug((await params).slug);
 if(!item)return {title:'Мэдээ олдсонгүй',robots:{index:false}};
 const image=item.cover?`${siteOrigin()}${item.cover}`:`${siteOrigin()}/news-og.png`;
 return {
  title:item.title,description:item.summary,alternates:{canonical:`/news/${item.slug}`},
  openGraph:{type:'article',title:item.title,description:item.summary,url:`/news/${item.slug}`,images:[{url:image}],publishedTime:new Date(item.publishedAt).toISOString(),modifiedTime:new Date(item.updatedAt).toISOString(),section:newsCategoryLabel(item.category),authors:[item.author]},
  twitter:{card:'summary_large_image',title:item.title,description:item.summary,images:[image]},
 };
}

export default async function ArticlePage({params}:Props){
 const item=await news.bySlug((await params).slug);if(!item)notFound();
 await news.countView(item.id);
 const related=(await news.list({category:item.category,limit:4,excludeIds:[item.id]})).items;
 const url=`${siteOrigin()}/news/${item.slug}`;
 const jsonLd={'@context':'https://schema.org','@type':'NewsArticle',headline:item.title,description:item.summary,datePublished:new Date(item.publishedAt).toISOString(),dateModified:new Date(item.updatedAt).toISOString(),author:{'@type':'Person',name:item.author},publisher:{'@type':'Organization',name:'Darkhanzar'},mainEntityOfPage:url,...(item.cover?{image:[`${siteOrigin()}${item.cover}`]}:{})};
 return <article className="news-article">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}}/>
  <nav className="news-breadcrumb"><a href="/news">Мэдээ</a> / <a href={`/news/c/${item.category}`}>{newsCategoryLabel(item.category)}</a></nav>
  <h1>{item.title}</h1>
  {item.summary&&<p className="news-lead-text">{item.summary}</p>}
  <div className="news-meta"><span>{item.author}</span><span>{formatDate(item.publishedAt)}</span><span>{item.views+1} уншсан</span></div>
  <NewsShare url={url} title={item.title}/>
  {item.cover&&<img className="news-article-cover" src={item.cover} alt=""/>}
  <NewsBody body={item.body||''}/>
  <NewsShare url={url} title={item.title}/>
  <NewsBanner placement="newsArticle"/>
  {related.length>0&&<section><h2 className="news-section-title">Холбоотой мэдээ</h2><div className="news-grid">{related.map(i=><NewsCard key={i.id} item={i}/>)}</div></section>}
 </article>;
}
