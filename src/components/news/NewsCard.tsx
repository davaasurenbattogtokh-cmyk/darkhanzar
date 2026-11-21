import {newsCategoryLabel} from '@/lib/news-categories.mjs';
import {formatDate,type NewsItem,type ListingHighlight} from '@/lib/news-server';
import {coverOf} from './NewsVideo';

function Cover({item,className}:{item:NewsItem;className:string}){
 const src=coverOf(item);
 const image=src
  ?<img className={className} src={src} alt="" loading="lazy"/>
  :<div className={`${className} news-cover-empty`} aria-hidden="true"><span>darkhan<b>zar</b></span></div>;
 return item.video?<span className="news-has-video">{image}<i aria-label="Видео">▶</i></span>:image;
}

export function NewsHero({item}:{item:NewsItem}){
 return <a className="news-hero" href={`/news/${item.slug}`}>
  <Cover item={item} className="news-hero-image"/>
  <div className="news-hero-text"><span className="news-tag">{newsCategoryLabel(item.category)}</span><h2>{item.title}</h2><p>{item.summary}</p><small>{formatDate(item.publishedAt)} · {item.author}</small></div>
 </a>;
}

export function NewsCard({item}:{item:NewsItem}){
 return <a className="news-card" href={`/news/${item.slug}`}>
  <Cover item={item} className="news-card-image"/>
  <span className="news-tag">{newsCategoryLabel(item.category)}</span>
  <h3>{item.title}</h3>
  <small>{formatDate(item.publishedAt)}</small>
 </a>;
}

export function NewsRow({item}:{item:NewsItem}){
 return <a className="news-row" href={`/news/${item.slug}`}>
  <Cover item={item} className="news-row-image"/>
  <div><span className="news-tag">{newsCategoryLabel(item.category)}</span><h3>{item.title}</h3><p>{item.summary}</p><small>{formatDate(item.publishedAt)} · {item.author}</small></div>
 </a>;
}

const price=(i:ListingHighlight)=>i.priceLabel||(i.price>0?`${new Intl.NumberFormat('mn-MN').format(i.price)} ₮`:'Үнэ тохиролцоно');
export function ListingRail({items}:{items:ListingHighlight[]}){
 if(!items.length)return null;
 return <aside className="news-listing-rail" aria-label="Darkhanzar онцлох зар">
  <h3 className="news-section-title">Онцлох зар</h3>
  <ul>{items.map(i=><li key={i.id}><a href={i.href}>
   {i.image?<img src={i.image} alt="" loading="lazy"/>:<span className="news-listing-noimg" aria-hidden="true">zar</span>}
   <span><b>{i.title}</b><strong>{price(i)}</strong><small>{i.place}{i.featured?' · Онцлох':''}</small></span>
  </a></li>)}</ul>
  <a className="news-rail-more" href="/">Бүх зарыг үзэх →</a>
 </aside>;
}

export function MostRead({items}:{items:NewsItem[]}){
 if(!items.length)return null;
 return <aside className="news-most-read"><h3 className="news-section-title">Их уншилттай</h3><ol>{items.map(i=><li key={i.id}><a href={`/news/${i.slug}`}>{i.title}</a><small>{formatDate(i.publishedAt)}</small></li>)}</ol></aside>;
}

export function VideoRail({items}:{items:NewsItem[]}){
 if(!items.length)return null;
 return <section className="news-video-rail" aria-label="Видео мэдээ">
  <h3 className="news-section-title">Видео мэдээ</h3>
  {items.map(i=><a key={i.id} href={`/news/${i.slug}`} className="news-video-rail-item"><Cover item={i} className="news-video-rail-image"/><b>{i.title}</b></a>)}
  <a className="news-rail-more" href="/news/video">Бүх видео →</a>
 </section>;
}
