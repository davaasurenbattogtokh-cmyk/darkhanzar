import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import express from 'express';
import next from 'next';
import {createPool,MySQLDatabase,MySQLBucket} from './server/node/mysql.mjs';
import {migrate} from './server/node/migrate.mjs';
import {handleApplication} from './server/node/application.mjs';
import {startScheduler} from './server/node/scheduler.mjs';
import {writeHeaders} from './server/node/headers.mjs';

// Explicit canonical origin: never trust visitor-supplied forwarding headers.
const origin=new URL(process.env.APP_ORIGIN||'http://localhost:3000').origin;
const dev=process.env.NODE_ENV!=='production';
if(!dev&&(!process.env.APP_ORIGIN||!origin.startsWith('https://')))throw Error('APP_ORIGIN must be the public HTTPS site origin');
const port=Number(process.env.PORT||3000),pool=createPool(process.env);
const env={...process.env,DB:new MySQLDatabase(pool),BUCKET:new MySQLBucket(pool)};
await migrate(pool,env);
// Server-rendered pages (e.g. /news) run in this same process and read data through this handle.
globalThis.__darkhanzarEnv=env;
const app=next({dev,hostname:'0.0.0.0',port}),handler=app.getRequestHandler();await app.prepare();
const router=express();router.disable('x-powered-by');
router.use(async(req,res)=>{
 try{
  // Build a bounded standard Request without reading the entire upload to memory.
  const url=new URL(req.url,origin);if(url.origin!==origin){res.status(400).end();return;}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value)headers.set(key,Array.isArray(value)?value.join(','):value);}
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await handleApplication(request,env,pool,req.socket.remoteAddress);
  if(!response){await handler(req,res);return;}
  res.statusCode=response.status;writeHeaders(res,response.headers);
  if(response.body&&req.method!=='HEAD'){await new Promise((resolve,reject)=>{const stream=Readable.fromWeb(response.body);stream.on('error',reject);res.on('finish',resolve);res.on('close',resolve);stream.pipe(res);});}else res.end();
 }catch{console.error('Application request failed.');if(!res.headersSent)res.status(503).json({error:'Үйлчилгээ түр боломжгүй байна.'});else res.end();}
});
const server=createServer(router);server.requestTimeout=60000;server.headersTimeout=15000;
server.listen(port,'0.0.0.0',()=>console.log(`Darkhanzar listening on port ${port}`));
const stopSchedule=startScheduler(env,pool);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopSchedule();server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
