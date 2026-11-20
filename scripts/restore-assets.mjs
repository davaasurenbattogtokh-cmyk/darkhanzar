import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'asset-bundle/manifest.json'),'utf8'));
const chunks=[];
for(const part of manifest.parts){
 if(!/^assets-\d+\.part$/.test(part.name))throw Error('Invalid asset part');
 const bytes=await readFile(path.join(root,'asset-bundle',part.name));
 if(createHash('sha256').update(bytes).digest('hex')!==part.sha256)throw Error('Asset checksum mismatch');chunks.push(bytes);
}
const tar=gunzipSync(Buffer.concat(chunks),{maxOutputLength:100*1024*1024});let count=0;
const string=(b,a,z)=>b.subarray(a,z).toString('utf8').split('\0')[0];
for(let pos=0;pos+512<=tar.length;){
 const h=tar.subarray(pos,pos+512);if(h.every(b=>b===0))break;
 const name=string(h,0,100),prefix=string(h,345,500),relative=prefix?prefix+'/'+name:name;
 const size=parseInt(string(h,124,136).trim()||'0',8),type=String.fromCharCode(h[156]||48);
 if(!/^(brand|photos|imported)\//.test(relative)||relative.includes('..')||relative.includes('\\')||!Number.isSafeInteger(size)||size<0||pos+512+size>tar.length)throw Error('Invalid asset archive');
 const target=path.join(root,'public',relative);
 if(type==='5')await mkdir(target,{recursive:true});
 else if(type==='0'){await mkdir(path.dirname(target),{recursive:true});await writeFile(target,tar.subarray(pos+512,pos+512+size));count++;}
 else throw Error('Unsupported asset entry');
 pos+=512+Math.ceil(size/512)*512;
}
if(count!==manifest.files)throw Error('Incomplete asset archive');console.log(`Restored ${count} checked assets.`);
