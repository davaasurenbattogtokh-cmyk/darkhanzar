import {newsCategoryLabel} from '@/lib/news-categories.mjs';
import {formatDate,type NewsItem,type ListingHighlight} from '@/lib/news-server';

function Cover({item,className}:{item:NewsItem;className:string}){
 return item.cover
  ?<img className={className} src={item.cover} alt="" loading="lazy"/>
  :<div className={`${className} news-cover-empty`} aria-hidden="true"><span>darkhan<b>zar</b></span></div>;
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
