import {startSync,stepSync,localDay} from '../source-sync.mjs';
import {dailyFacebookImport} from '../facebook-import.mjs';
export function startScheduler(env,pool){
 const uneguiEnabled=env.UNEGUI_SYNC_ENABLED==='true';
 let running=false;
 const tick=async()=>{
  if(running)return;const now=new Date();const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ulaanbaatar',hour:'2-digit',hourCycle:'h23'}).format(now));
  if(hour<8)return;running=true;
  try{
   // Facebook page ads: once a day from 08:00 (Ulaanbaatar). Runs in the background.
   void dailyFacebookImport(env).catch(()=>console.error('Facebook page import unavailable.'));
   if(uneguiEnabled){
    let status=await startSync(env);
    for(let i=0;i<200&&status.status==='running'&&status.day===localDay();i++){
     status=await stepSync(env,status.runId);if(status.busy)break;
    }
   }
   await pool.execute('DELETE FROM auth_sessions WHERE expires_at<?',[Date.now()]);
   await pool.execute('DELETE FROM auth_limits WHERE reset_at<?',[Date.now()]);
   await pool.execute('DELETE FROM stored_objects WHERE expires_at>0 AND expires_at<?',[Date.now()]);
  }catch{console.error('Daily source update unavailable; retained prior publication.');}finally{running=false;}
 };
 const timer=setInterval(tick,60000);timer.unref();void tick();return ()=>clearInterval(timer);
}
