// Sends one page view to the site's own visitor statistics (no cookies, no third parties).
let last='';
export function trackVisit(path:string){
 if(typeof window==='undefined'||/^\/admin(\/|$)/.test(path)||path===last)return;
 last=path;
 const referrer=document.referrer&&!document.referrer.startsWith(location.origin)?document.referrer:'';
 try{fetch('/api/visit',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({path,referrer})}).catch(()=>{});}catch{}
}
