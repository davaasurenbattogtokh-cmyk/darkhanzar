import {news,siteOrigin} from '@/lib/news-server';
import {newsCategories} from '@/lib/news-categories.mjs';

export const dynamic='force-dynamic';

const esc=(s:string)=>s.replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]!));
export async function GET(){
 const origin=siteOrigin();const entries=await news.sitemap();
 const urls=[
  `<url><loc>${origin}/news</loc><changefreq>hourly</changefreq></url>`,
  ...newsCategories.map(c=>`<url><loc>${origin}/news/c/${c.id}</loc><changefreq>daily</changefreq></url>`),
  ...entries.map(e=>`<url><loc>${esc(`${origin}/news/${e.slug}`)}</loc><lastmod>${new Date(e.updatedAt).toISOString()}</lastmod></url>`),
 ];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=600'}});
}
