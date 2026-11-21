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
export const metadata: Metadata = {title:'Darkhanzar — Ойрхон хай. Амархан ол.',description:'Дархан-Уул, Сүхбаатар хот, Хөтөлийн зарын нэгдсэн платформ. Орон нутгийн худалдаа, үйлчилгээ, ажлын зар.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="mn"><body>{children}</body></html>;}
