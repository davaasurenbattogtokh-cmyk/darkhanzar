import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,open,rename,rm,stat} from 'node:fs/promises';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import path from 'node:path';

// Uploaded news videos live on disk (outside the app checkout, so deploys never touch them)
// and are streamed back with HTTP Range support so browsers can seek.
export const MAX_VIDEO_BYTES=300*1024*1024;
const NAME=/^[a-f0-9-]{36}\.(mp4|webm)$/;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const videoDir=env=>env.VIDEO_DIR||path.resolve(process.cwd(),'..','media','videos');

function sniff(head){
 // MP4 / MOV: "ftyp" box at offset 4. WebM / Matroska: EBML magic 1A 45 DF A3.
 if(head.length>=12&&head.toString('latin1',4,8)==='ftyp')return 'mp4';
 if(head.length>=4&&head[0]===0x1a&&head[1]===0x45&&head[2]===0xdf&&head[3]===0xa3)return 'webm';
 return null;
}

export async function uploadVideo(request,env){
 const type=(request.headers.get('Content-Type')||'').split(';')[0].trim();
 if(!['video/mp4','video/webm','video/quicktime'].includes(type))return json({error:'MP4, MOV эсвэл WEBM видео байршуулна уу.'},415);
 const declared=Number(request.headers.get('Content-Length')||0);
 if(declared>MAX_VIDEO_BYTES)return json({error:'Видео 300MB-аас бага байна.'},413);
 if(!request.body)return json({error:'Видео файл ирсэнгүй.'},400);
 const dir=videoDir(env);await mkdir(dir,{recursive:true});
 const id=crypto.randomUUID(),temp=path.join(dir,`${id}.part`);
 const out=createWriteStream(temp);let size=0;
 try{
  for await(const chunk of request.body){
   size+=chunk.byteLength;
   if(size>MAX_VIDEO_BYTES)throw Object.assign(new Error('too large'),{tooLarge:true});
   if(!out.write(chunk))await once(out,'drain');
  }
  out.end();await once(out,'finish');
  const handle=await open(temp,'r');const head=Buffer.alloc(16);await handle.read(head,0,16,0);await handle.close();
  const ext=sniff(head);
  if(!ext||size<1024){await rm(temp,{force:true});return json({error:'Видео файл танигдсангүй. MP4, MOV эсвэл WEBM ашиглана уу.'},400);}
  await rename(temp,path.join(dir,`${id}.${ext}`));
  return json({url:`/api/news/video/${id}.${ext}`,size},201);
 }catch(error){
  out.destroy();await rm(temp,{force:true});
  if(error.tooLarge)return json({error:'Видео 300MB-аас бага байна.'},413);
  throw error;
 }
}

export async function serveVideo(request,env,name){
 if(!NAME.test(name))return json({error:'Видео олдсонгүй.'},404);
 const file=path.join(videoDir(env),name);
 let info;try{info=await stat(file);}catch{return json({error:'Видео олдсонгүй.'},404);}
 const headers={'Content-Type':name.endsWith('.webm')?'video/webm':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
 const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range')||'');
 if(range&&(range[1]||range[2])){
  let start=range[1]?Number(range[1]):Math.max(0,info.size-Number(range[2]));
  let end=range[1]&&range[2]?Math.min(Number(range[2]),info.size-1):info.size-1;
  if(start>=info.size||start>end)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${info.size}`}});
  const body=request.method==='HEAD'?null:Readable.toWeb(createReadStream(file,{start,end}));
  return new Response(body,{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':String(end-start+1)}});
 }
 const body=request.method==='HEAD'?null:Readable.toWeb(createReadStream(file));
 return new Response(body,{status:200,headers:{...headers,'Content-Length':String(info.size)}});
}
