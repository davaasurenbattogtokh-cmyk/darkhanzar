import mysql from 'mysql2/promise';
import {createHash} from 'node:crypto';

// Preserve the domain handlers' prepared-statement contract while implementing
// SQLite's atomic RETURNING/CAS operations with InnoDB transactions and row locks.
const primaryKeys={site_settings:'id',source_sync_runs:'day',source_detail_runs:'run_id',market_listings:'id',promotion_orders:'id'};
export function mysqlSQL(sql){
 return sql.replace(/\bMAX\((\w+(?:\+1)?),\?\)/gi,'GREATEST($1,?)')
  .replace(/json_extract\((\w+),'([^']+)'\)/gi,"JSON_UNQUOTE(JSON_EXTRACT($1,'$2'))")
  .replace(/ON CONFLICT\([^)]*\) DO UPDATE SET (.+)$/i,(_,set)=>'ON DUPLICATE KEY UPDATE '+set.replace(/excluded\.(\w+)/g,'VALUES($1)'));
}
export class MySQLDatabase{
 constructor(pool){this.pool=pool;}
 prepare(sql){return new Statement(this,sql);}
 async execute(statements){
  const c=await this.pool.getConnection();const state={changes:0};
  try{await c.beginTransaction();const results=[];for(const s of statements)results.push(await this._execute(c,s,state));await c.commit();return results;}
  catch(error){await c.rollback();throw error;}finally{c.release();}
 }
 batch(statements){return this.execute(statements);}
 async _execute(c,s,state){
  let sql=mysqlSQL(s.sql),args=[...s.args];const returning=sql.match(/\s+RETURNING (\w+)$/i)?.[1];
  if(returning)sql=sql.replace(/\s+RETURNING \w+$/i,'');
  const duplicateOK=/ ON CONFLICT(?:\([^)]*\))? DO NOTHING$/i.test(sql);
  sql=sql.replace(/ ON CONFLICT(?:\([^)]*\))? DO NOTHING$/i,'');
  if(/changes\(\)/i.test(sql)){sql=sql.replace(/changes\(\)/gi,'?');args.push(state.changes);}
  let locked=[],table,key;
  if(returning&&/^UPDATE /i.test(sql)){
   table=sql.match(/^UPDATE (\w+)/i)[1];key=primaryKeys[table];if(!key)throw Error('Unsupported returning table');
   const where=sql.search(/\bWHERE\b/i);const offset=(sql.slice(0,where).match(/\?/g)||[]).length;
   [locked]=await c.execute(`SELECT ${key} FROM ${table} ${sql.slice(where)} FOR UPDATE`,args.slice(offset));
   if(!locked.length){state.changes=0;return {results:[],meta:{changes:0},success:true};}
  }
  let rows;
  try{[rows]=await c.execute(sql,args);}catch(error){if(!duplicateOK||error.code!=='ER_DUP_ENTRY')throw error;rows={affectedRows:0};}
  state.changes=Number(rows.affectedRows||0);let results=Array.isArray(rows)?rows:[];
  if(returning&&state.changes){
   if(table){
    const ids=locked.map(r=>r[key]);[results]=await c.execute(`SELECT ${returning} FROM ${table} WHERE ${key} IN (${ids.map(()=>'?').join(',')})`,ids);
   }else if(/^INSERT INTO site_settings /i.test(sql)){[results]=await c.execute('SELECT revision FROM site_settings WHERE id=1');}
   else if(/^INSERT INTO promotion_orders /i.test(sql)){results=[{id:args[0]}];}
   else throw Error('Unsupported returning statement');
  }
  return {results,meta:{changes:state.changes},success:true};
 }
}
class Statement{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.db,this.sql,args);}
 async all(){return (await this.db.execute([this]))[0];}
 async first(column){const r=(await this.all()).results[0];return column?r?.[column]??null:r??null;}
 run(){return this.all();}
}
export function createPool(env){
 const config=env.DATABASE_URL?{uri:env.DATABASE_URL}:{host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME};
 return mysql.createPool({...config,waitForConnections:true,connectionLimit:5,queueLimit:100,charset:'utf8mb4',supportBigNumbers:true,bigNumberStrings:false,flags:['-FOUND_ROWS'],...(env.DB_SSL==='true'?{ssl:{rejectUnauthorized:true}}:{})});
}
export class MySQLBucket{
 constructor(pool){this.pool=pool;}
 async put(key,value,options={}){
  if(typeof key!=='string'||key.length>1000)throw Error('Invalid object key');
  const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value);if(bytes.length>10*1024*1024)throw Error('Object too large');
  const hash=createHash('sha256').update(key).digest('hex');
  const expiry=key.startsWith('unegui-images/')?Date.now()+7*86400000:0;
  await this.pool.execute('INSERT INTO stored_objects (key_hash,object_key,body,metadata_json,expires_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE body=VALUES(body),metadata_json=VALUES(metadata_json),expires_at=VALUES(expires_at)',[hash,key,bytes,JSON.stringify(options.httpMetadata||{}),expiry]);
 }
 async get(key){
  const hash=createHash('sha256').update(key).digest('hex');
  const [rows]=await this.pool.execute('SELECT object_key,body,metadata_json FROM stored_objects WHERE key_hash=? AND (expires_at=0 OR expires_at>?)',[hash,Date.now()]);
  if(!rows.length||rows[0].object_key!==key)return null;const bytes=rows[0].body;
  return {body:bytes,httpMetadata:JSON.parse(rows[0].metadata_json),text:async()=>bytes.toString('utf8'),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }
}
