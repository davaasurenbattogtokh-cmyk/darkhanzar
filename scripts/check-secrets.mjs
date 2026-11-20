import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),bad=[];
for(const file of files){
 if(/(^|\/)(\.env(?!\.example$)|\.dev\.vars|\.wrangler|node_modules|\.next|\.git\/)|\.(pem|key|sqlite|db)$/.test(file)){bad.push(file);continue;}
 if(/\.(part|png|jpg|jpeg|webp|woff2|ttf|pdf|zip)$/.test(file))continue;
 const text=readFileSync(file,'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{25,}|\bgithub_pat_[A-Za-z0-9_]{30,}/.test(text))bad.push(file);
 if(!file.startsWith('tests/')&&file!=='.env.example'&&/QPAY_PASSWORD\s*[:=]\s*['"][^'"\s]+['"]/.test(text))bad.push(file);
}
if(bad.length){console.error('Blocked sensitive files:',[...new Set(bad)].join(', '));process.exit(1);}console.log(`Secret checks passed for ${files.length} tracked files.`);
