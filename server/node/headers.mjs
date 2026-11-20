// Copy fetch Response headers onto a Node ServerResponse.
// Iterating Headers yields each Set-Cookie separately; setHeader() per entry would keep only
// the last one, so cookies are collected and written together.
export function writeHeaders(res,headers){
 for(const [key,value] of headers)if(key!=='set-cookie')res.setHeader(key,value);
 const cookies=headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
}
