/** @template T @param {T[]} items @param {boolean} enabled @param {number} every @returns {Array<{kind:'listing',item:T}|{kind:'banner',after:number}>} */
export function insertInlineBanners(items,enabled=true,every=15){
 const result=[];
 for(let i=0;i<items.length;i++){result.push({kind:'listing',item:items[i]});if(enabled&&(i+1)%every===0)result.push({kind:'banner',after:i+1});}
 return result;
}
