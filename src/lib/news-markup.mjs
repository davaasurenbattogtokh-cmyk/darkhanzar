// A deliberately small, safe text format for articles (a Markdown subset).
// It is parsed into a plain tree and rendered as React elements, never as raw HTML.
//   ## Heading / ### Subheading      - list item / 1. numbered item
//   > quote                          ![caption](/api/media/…) image on its own line
//   **bold**  *italic*  [text](https://…)
const safeImage=u=>/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(u)||/^https:\/\/[^\s"'<>]+$/.test(u);
const safeLink=u=>/^https?:\/\/[^\s"'<>]+$/.test(u)||/^\/(?!\/)[^\s"'<>]*$/.test(u)||/^mailto:[^\s"'<>]+$/.test(u);

export function parseInline(text){
 const out=[];let rest=String(text);
 const re=/(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/;
 while(rest){
  const m=re.exec(rest);
  if(!m){out.push({t:'text',v:rest});break;}
  if(m.index>0)out.push({t:'text',v:rest.slice(0,m.index)});
  if(m[1])out.push({t:'strong',v:m[2]});
  else if(m[3])out.push({t:'em',v:m[4]});
  else if(safeLink(m[7]))out.push({t:'link',v:m[6],href:m[7]});
  else out.push({t:'text',v:m[6]});
  rest=rest.slice(m.index+m[0].length);
 }
 return out;
}

export function parseArticle(body){
 const blocks=[];const lines=String(body||'').replace(/\r\n?/g,'\n').split('\n');
 let para=[],list=null;
 const flushPara=()=>{if(para.length){blocks.push({t:'p',c:parseInline(para.join(' '))});para=[];}};
 const flushList=()=>{if(list){blocks.push(list);list=null;}};
 for(const raw of lines){
  const line=raw.trim();
  if(!line){flushPara();flushList();continue;}
  let m;
  if((m=/^(#{2,3})\s+(.+)$/.exec(line))){flushPara();flushList();blocks.push({t:m[1].length===2?'h2':'h3',c:parseInline(m[2])});continue;}
  if((m=/^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line))){flushPara();flushList();if(safeImage(m[2]))blocks.push({t:'img',src:m[2],alt:m[1]});continue;}
  if((m=/^>\s?(.*)$/.exec(line))){flushPara();flushList();const last=blocks.at(-1);if(last?.t==='quote')last.c.push({t:'text',v:' '},...parseInline(m[1]));else blocks.push({t:'quote',c:parseInline(m[1])});continue;}
  if((m=/^[-*]\s+(.+)$/.exec(line))||(m=/^\d+[.)]\s+(.+)$/.exec(line))){
   flushPara();const ordered=/^\d/.test(line);
   if(!list||list.ordered!==ordered){flushList();list={t:'list',ordered,items:[]};}
   list.items.push(parseInline(m[1]));continue;
  }
  flushList();para.push(line);
 }
 flushPara();flushList();
 return blocks;
}

export function plainText(body,max=300){
 const text=parseArticle(body).filter(b=>b.t==='p'||b.t==='quote').map(b=>b.c.map(i=>i.v).join('')).join(' ').replace(/\s+/g,' ').trim();
 return text.length>max?text.slice(0,max-1).replace(/\s+\S*$/,'')+'…':text;
}
