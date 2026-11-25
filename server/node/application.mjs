import {handleAdminAPI} from '../admin-api.mjs';
import {handleMarketAPI} from '../market-api.mjs';
import {handlePromotionsAPI} from '../promotions-api.mjs';
import {handleSourceAPI} from '../source-api.mjs';
import {handleNewsAPI} from '../news-api.mjs';
import {handleFacebookImportAPI} from '../facebook-import.mjs';
import {handleVisitAPI} from '../visits.mjs';
import {handleAuth,authenticatedUser,trustedHeaders} from './auth.mjs';
export async function handleApplication(request,env,pool,ip){
 const auth=await handleAuth(request,pool,env,ip);if(auth)return auth;
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return null;
 const user=await authenticatedUser(request,pool);
 const internal=new Request(request,{headers:trustedHeaders(request,user)});
 const visit=await handleVisitAPI(internal,env,ip);if(visit)return visit;
 for(const handler of [handleMarketAPI,handlePromotionsAPI,handleSourceAPI,handleNewsAPI,handleFacebookImportAPI,handleAdminAPI]){const response=await handler(internal,env);if(response)return response;}
 return Response.json({error:'Олдсонгүй.'},{status:404});
}
