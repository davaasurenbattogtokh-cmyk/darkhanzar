// Article video: either a YouTube video ("yt:<id>") or a file uploaded to the server
// ("/api/news/video/<uuid>.mp4|webm"). Shared by the server (validation) and the site (players).
const YT_ID=/^[A-Za-z0-9_-]{11}$/;
export const UPLOADED_VIDEO=/^\/api\/news\/video\/[a-f0-9-]{36}\.(mp4|webm)$/;

export function youtubeIdFromUrl(text){
 const value=String(text||'').trim();
 if(YT_ID.test(value))return value;
 let url;try{url=new URL(value);}catch{return null;}
 const host=url.hostname.replace(/^(www\.|m\.|music\.)/,'');
 let id=null;
 if(host==='youtu.be')id=url.pathname.slice(1).split('/')[0];
 else if(host==='youtube.com'||host==='youtube-nocookie.com'){
  if(url.pathname==='/watch')id=url.searchParams.get('v');
  else{const m=/^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname);if(m)id=m[2];}
 }
 return id&&YT_ID.test(id)?id:null;
}

// Returns the stored form, '' for "no video", or null when the input is not acceptable.
export function normalizeVideo(input){
 const value=String(input??'').trim();
 if(!value)return '';
 if(/^yt:[A-Za-z0-9_-]{11}$/.test(value))return value;
 if(UPLOADED_VIDEO.test(value))return value;
 const id=youtubeIdFromUrl(value);
 return id?`yt:${id}`:null;
}
export const youtubeId=video=>typeof video==='string'&&video.startsWith('yt:')?video.slice(3):null;
export const youtubeThumb=video=>{const id=youtubeId(video);return id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:'';};
export const youtubeEmbed=video=>{const id=youtubeId(video);return id?`https://www.youtube-nocookie.com/embed/${id}?rel=0`:'';};
export const youtubeWatch=video=>{const id=youtubeId(video);return id?`https://www.youtube.com/watch?v=${id}`:'';};
