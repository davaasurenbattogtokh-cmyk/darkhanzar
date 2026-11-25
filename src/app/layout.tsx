import type { Metadata } from 'next';
import './globals.css';
import './source.css';
import './photos.css';
import './admin.css';
import './filters.css';
import './advertising.css';
import './inline-banners.css';
import './login.css';
import './concept.css';
import './source-sync.css';
import './promotions.css';
import './market-news.css';
import VisitTracker from '@/components/VisitTracker';
const siteTitle='Darkhanzar — Ойрхон хай. Амархан ол.';
const siteDescription='Дархан-Уул, Сүхбаатар хот, Хөтөлийн зарын нэгдсэн платформ. Орон нутгийн худалдаа, үйлчилгээ, ажлын зар.';
// Link previews (Facebook, Messenger, Viber, X): without og:image a shared link shows as plain text.
export const metadata: Metadata = {
 metadataBase:new URL(process.env.APP_ORIGIN||'https://darkhanzar.mn'),
 title:siteTitle,description:siteDescription,robots:{index:false,follow:false},
 openGraph:{type:'website',siteName:'Darkhanzar',locale:'mn_MN',title:siteTitle,description:siteDescription,url:'/',images:[{url:'/og.png',width:1200,height:630,alt:'Darkhanzar'}]},
 twitter:{card:'summary_large_image',title:siteTitle,description:siteDescription,images:['/og.png']},
 // fb:app_id (the public Facebook app ID, same app as Facebook login). Inherited by every page, /news included.
 facebook:{appId:process.env.FACEBOOK_APP_ID||'1190178560029395'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="mn"><body>{children}<VisitTracker/></body></html>;}
