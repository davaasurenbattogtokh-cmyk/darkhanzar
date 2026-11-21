import type {Metadata} from 'next';
import {Logo} from '@/components/Brand';
import {newsCategories} from '@/lib/news-categories.mjs';
import './news.css';

export const metadata:Metadata={
 metadataBase:new URL(process.env.APP_ORIGIN||'https://darkhanzar.mn'),
 title:{default:'Бизнес мэдээ · Darkhanzar',template:'%s · Darkhanzar Бизнес'},
 description:'Дархан-Уул, Сүхбаатар, Хөтөл болон Монголын бизнес, эдийн засаг, санхүүгийн мэдээ.',
 robots:{index:true,follow:true},
 openGraph:{siteName:'Darkhanzar Бизнес',locale:'mn_MN',type:'website',images:[{url:'/news-og.png',width:1200,height:630}]},
};

export default function NewsLayout({children}:{children:React.ReactNode}){
 return <div className="news-site">
  <header className="news-header">
   <div className="news-header-top">
    <a className="news-brand" href="/news" aria-label="Darkhanzar бизнес мэдээ"><Logo/><span>Бизнес</span></a>
    <a className="news-to-market" href="/">Зарын сайт →</a>
   </div>
   <nav className="news-nav" aria-label="Мэдээний ангилал"><a href="/news">Нүүр</a>{newsCategories.map(c=><a key={c.id} href={`/news/c/${c.id}`}>{c.label}</a>)}</nav>
  </header>
  <main className="news-main">{children}</main>
  <footer className="news-footer">
   <div><a className="news-brand" href="/news"><Logo/><span>Бизнес</span></a><p>Дархан-Уул, Сүхбаатар, Хөтөлийн бизнес, эдийн засгийн мэдээ.</p></div>
   <nav aria-label="Холбоос"><a href="/">Зарын сайт</a><a href="/privacy">Нууцлалын бодлого</a><a href="/terms">Үйлчилгээний нөхцөл</a><a href="mailto:techopenworld@gmail.com">Холбоо барих</a></nav>
   <small>© {new Date().getFullYear()} Darkhanzar</small>
  </footer>
 </div>;
}
