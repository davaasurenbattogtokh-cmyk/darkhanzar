'use client';

// Opens Facebook's share dialog for an ad. The link (/?ad=…) carries the ad's own photo,
// title and price as its preview card.
export default function FacebookShare({id}:{id:string}){
 function share(event:React.MouseEvent<HTMLAnchorElement>){
  const url=event.currentTarget.href;
  const w=620,h=560,left=Math.max(0,(window.screen.width-w)/2),top=Math.max(0,(window.screen.height-h)/2);
  // A centred popup on desktop; if it is blocked (or on phones) the link opens normally.
  const popup=window.open(url,'fbshare',`width=${w},height=${h},left=${left},top=${top}`);
  if(popup){event.preventDefault();popup.opener=null;}
 }
 const link=typeof window==='undefined'?'':`${window.location.origin}/?ad=${encodeURIComponent(id)}`;
 return <a className="button fb-share full-width" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" onClick={share}>
  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>
  Facebook-т хуваалцах
 </a>;
}
