import {youtubeEmbed,youtubeThumb,UPLOADED_VIDEO} from '@/lib/news-video.mjs';

// Player for an article video: privacy-enhanced YouTube embed, or the uploaded file.
export default function NewsVideo({video,title,poster=''}:{video:string;title:string;poster?:string}){
 const embed=youtubeEmbed(video);
 if(embed)return <div className="news-video"><iframe src={embed} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/></div>;
 if(UPLOADED_VIDEO.test(video))return <div className="news-video"><video src={video} controls preload="metadata" playsInline {...(poster?{poster}:{})}>Таны хөтөч видео тоглуулахгүй байна.</video></div>;
 return null;
}

// Card image for any article: its own cover, otherwise the YouTube thumbnail.
export const coverOf=(item:{cover:string;video?:string})=>item.cover||youtubeThumb(item.video||'');
