import {news} from '@/lib/news-server';
import {ListingRail,VideoRail} from './NewsCard';

// Right-hand column of the news pages: featured marketplace listings, then the latest videos.
export async function loadRails(){
 const [listings,videos]=await Promise.all([news.listings(),news.videos(3).then(v=>v.items).catch(()=>[])]);
 return {listings,videos,has:listings.length>0||videos.length>0};
}
export function NewsRails({listings,videos}:Awaited<ReturnType<typeof loadRails>>){
 if(!listings.length&&!videos.length)return null;
 return <div className="news-rail-stack"><ListingRail items={listings}/><VideoRail items={videos}/></div>;
}
