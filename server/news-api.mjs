import {adminIdentity,validMutationOrigin,storeImage} from './admin-api.mjs';
import {uploadVideo,serveVideo} from './news-video-files.mjs';
import {NewsError,listPublished,highlights,listVideos,listAll,createArticle,updateArticle,deleteArticle} from './news-store.mjs';

// Public news feed plus the newsroom API used by admins and editors.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export function newsroomIdentity(request,env){
 const admin=adminIdentity(request,env);
 const role=request.headers.get('oai-authenticated-user-role');
 let name=request.headers.get('oai-authenticated-user-full-name')||'Редакц';
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='Редакц';}}
 // Role headers come only from the trusted Node boundary; client-sent oai-* headers are stripped.
 return {authenticated:admin.authenticated,staff:admin.authorized||(admin.authenticated&&role==='editor'),id:admin.userId,name:name.slice(0,100)};
}

export async function handleNewsAPI(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/api/news/video/')&&['GET','HEAD'].includes(request.method))return serveVideo(request,env,path.slice('/api/news/video/'.length));
 if(path==='/api/news'&&request.method==='GET'&&url.searchParams.has('videos')){
  try{return Response.json(await listVideos(env,{limit:url.searchParams.get('videos')}),{headers:{'Cache-Control':'public, max-age=120','X-Content-Type-Options':'nosniff'}});}
  catch{return json({error:'Видео ачаалж чадсангүй.'},500);}
 }
 if(path==='/api/news'&&request.method==='GET'&&url.searchParams.has('highlights')){
  try{return Response.json({items:await highlights(env,url.searchParams.get('highlights'))},{headers:{'Cache-Control':'public, max-age=120','X-Content-Type-Options':'nosniff'}});}
  catch{return json({error:'Мэдээ ачаалж чадсангүй.'},500);}
 }
 if(path==='/api/news'&&request.method==='GET'){
  const page=Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1);
  try{return json(await listPublished(env,{category:url.searchParams.get('category')||'',limit:12,offset:(page-1)*12}));}
  catch{return json({error:'Мэдээ ачаалж чадсангүй.'},500);}
 }
 if(path!=='/api/admin/news'&&path!=='/api/admin/news/upload'&&path!=='/api/admin/news/video')return null;
 const who=newsroomIdentity(request,env);
 if(!who.authenticated)return json({error:'Нэвтэрнэ үү.'},401);
 if(!who.staff)return json({error:'Мэдээ удирдах эрх байхгүй байна.'},403);
 try{
  if(request.method==='GET'&&path==='/api/admin/news')return json({items:await listAll(env)});
  if(!validMutationOrigin(request))return json({error:'Хүсэлтийн эх сурвалж буруу байна.'},403);
  if(path==='/api/admin/news/upload'&&request.method==='POST')return storeImage(request,env);
  if(path==='/api/admin/news/video'&&request.method==='POST')return uploadVideo(request,env);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON хүсэлт шаардлагатай.'},415);
  const raw=await request.text();if(raw.length>210000)return json({error:'Мэдээ хэт урт байна.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Хүсэлт буруу байна.'},400);}
  if(request.method==='POST')return json({item:await createArticle(env,input,who)},201);
  if(request.method==='PUT')return json({item:await updateArticle(env,input?.id,input)});
  if(request.method==='DELETE'){await deleteArticle(env,input?.id);return json({ok:true});}
  return json({error:'Хүсэлтийн арга дэмжигдэхгүй байна.'},405);
 }catch(error){
  if(error instanceof NewsError)return json({error:error.message},error.status);
  console.error('News API failed',path,error?.message);return json({error:'Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.'},500);
 }
}
