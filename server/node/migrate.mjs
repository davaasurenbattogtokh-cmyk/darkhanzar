import {readFile} from 'node:fs/promises';
import {MySQLBucket} from './mysql.mjs';
import {defaultSettings,cleanSettings} from '../../src/lib/site-settings.mjs';
export async function migrate(pool,env){
 const c=await pool.getConnection();let held=false;
 try{
  const [locks]=await c.execute("SELECT GET_LOCK('darkhanzar-schema-v1',30) AS held");held=locks[0].held===1;if(!held)throw Error('Schema migration is busy');
  const ddl=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  for(const sql of ddl.split(';').map(s=>s.trim()).filter(Boolean))await c.query(sql);
  let settings=structuredClone(defaultSettings);
  try{settings=cleanSettings(JSON.parse(await readFile(new URL('../../config/initial-settings.json',import.meta.url),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
  await c.execute('INSERT INTO site_settings (id,value_json,revision,updated_at,updated_by) VALUES (1,?,1,?,?) ON DUPLICATE KEY UPDATE id=id',[JSON.stringify(settings),new Date().toISOString(),'initial-setup']);
  const [published]=await c.execute('SELECT id FROM source_publication WHERE id=1');
  if(!published.length){
   try{
    const snapshot=JSON.parse(await readFile(new URL('../../public/data/unegui-current.json',import.meta.url),'utf8'));
    if(snapshot?.schemaVersion!==5||!Array.isArray(snapshot.items))throw Error('Invalid initial source snapshot');
    const key='initial-source/published.json';await new MySQLBucket(pool).put(key,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
    await c.execute('INSERT INTO source_publication (id,object_key,observed_at,count) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE id=id',[key,snapshot.observedAt,snapshot.items.length]);
   }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(env.ADMIN_EMAIL&&env.ADMIN_PASSWORD_HASH){
   if(!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH))throw Error('ADMIN_PASSWORD_HASH format is invalid');
   await c.execute("INSERT INTO auth_users (id,email,name,password_hash,role,created_at) VALUES (?,?,?,?, 'admin',?) ON DUPLICATE KEY UPDATE id=id",['admin-'+crypto.randomUUID(),env.ADMIN_EMAIL.trim().toLowerCase(),env.ADMIN_NAME||'Администратор',env.ADMIN_PASSWORD_HASH,Date.now()]);
  }
 }finally{if(held)await c.execute("SELECT RELEASE_LOCK('darkhanzar-schema-v1')");c.release();}
}
