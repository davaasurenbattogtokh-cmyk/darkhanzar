import type {MetadataRoute} from 'next';

export const dynamic='force-dynamic';
// Search engines may crawl the business news section; the marketplace pages keep their own noindex meta.
export default function robots():MetadataRoute.Robots{
 const origin=(process.env.APP_ORIGIN||'https://darkhanzar.mn').replace(/\/$/,'');
 return {rules:[{userAgent:'*',allow:'/news',disallow:['/admin','/api/','/login','/register','/setup','/logout']}],sitemap:`${origin}/news/sitemap.xml`};
}
