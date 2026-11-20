const homeBanner={enabled:true, title:'Ойрхоноос хай. Амархан ол.', subtitle:'Дархан-Уул, Сүхбаатар хот, Хөтөлийн худалдаа, үйлчилгээ нэг дор.', desktopImage:'', mobileImage:'', buttonText:'Зар нэмэх', href:'#post'};
export const bannerSlots=[
 {id:'homeTop',label:'Нүүр хуудасны дээд баннер',description:'Нүүр хуудсанд, хайлтын хэсгийн дээр.',width:900,height:90,mobileWidth:300,mobileHeight:150},
 {id:'categoryTop',label:'Ангиллын баннер',description:'Сонгосон ангиллын зарын жагсаалтын дээр.',width:300,height:150,mobileWidth:300,mobileHeight:150},
 {id:'inlineCard',label:'15 зар тутмын баннер',description:'15, 30, 45… зарын дараа нэг карт. 3 хүртэл зураг 5 секунд тутам ээлжилнэ.',width:600,height:450,mobileWidth:600,mobileHeight:450},
];
export const defaultSettings = {
  banner: homeBanner,
  bannerPlacements:{homeTop:homeBanner,categoryTop:{enabled:true,title:'Зараа ойрхоноос хүргэе.',subtitle:'Таны хэрэглэхгүй зүйл хэн нэгэнд хэрэгтэй.',desktopImage:'',mobileImage:'',buttonText:'Зар нэмэх',href:'#post'},inlineCard:{enabled:true,title:'Таны зар энд байж болно.',subtitle:'Дархан-Уул · Сүхбаатар хот · Хөтөл',desktopImage:'',mobileImage:'',buttonText:'Зар нэмэх',href:'#post',slides:[]}},
  promotionPlans: [
    {id:'special-1',label:'Онцгой · 1 хоног',days:1,price:0,enabled:false,categoryPrices:{}},
    {id:'special-7',label:'Онцгой · 7 хоног',days:7,price:0,enabled:false,categoryPrices:{}},
    {id:'special-30',label:'Онцгой · 30 хоног',days:30,price:0,enabled:false,categoryPrices:{}},
  ],
};
export function normalizeSiteSettings(input){
 const homeTop=input?.bannerPlacements?.homeTop||input?.banner||defaultSettings.banner;
 return {...input,banner:homeTop,bannerPlacements:{homeTop,categoryTop:input?.bannerPlacements?.categoryTop||defaultSettings.bannerPlacements.categoryTop,inlineCard:input?.bannerPlacements?.inlineCard||defaultSettings.bannerPlacements.inlineCard},promotionPlans:input?.promotionPlans||defaultSettings.promotionPlans};
}
function safeMedia(v){return typeof v==='string'&&(v===''||/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(v));}
function cleanHref(href){
 if(typeof href!=='string'||href.length>1000||!(href==='#post'||/^\/(?!\/)/.test(href)||/^https:\/\//.test(href))||/[\x00-\x20\\]/.test(href))throw new Error('Баннерын холбоос буруу байна.');
 if(href.startsWith('https://')){try{const u=new URL(href);if(u.username||u.password)throw 0;}catch{throw new Error('Баннерын холбоос буруу байна.');}}
 return href;
}
function cleanBanner(b){
 const text=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():null;
 if(!b||typeof b.enabled!=='boolean'||text(b.title,100)===null||text(b.subtitle,240)===null||text(b.buttonText,40)===null)throw new Error('Баннерын мэдээллээ шалгана уу.');
 if(!safeMedia(b.desktopImage)||!safeMedia(b.mobileImage))throw new Error('Баннерын зургаа дахин байршуулна уу.');
 return {enabled:b.enabled,title:b.title.trim(),subtitle:b.subtitle.trim(),desktopImage:b.desktopImage,mobileImage:b.mobileImage,buttonText:b.buttonText.trim(),href:cleanHref(b.href)};
}
function cleanInlineBanner(b){
 const banner=cleanBanner(b);
 if(!Array.isArray(b.slides)||b.slides.length>3)throw new Error('Зарын дундах баннерт 3 хүртэл зураг байршуулна.');
 const ids=new Set();const slides=b.slides.map(s=>{
  if(!s||typeof s.id!=='string'||!/^[a-z0-9-]{1,60}$/.test(s.id)||ids.has(s.id)||!safeMedia(s.image)||typeof s.title!=='string'||s.title.length>100)throw new Error('Солигдох баннерын зураг, нэрээ шалгана уу.');
  ids.add(s.id);return {id:s.id,image:s.image,title:s.title.trim(),href:cleanHref(s.href)};
 });
 return {...banner,slides};
}
export function cleanSettings(input) {
  if(!input||typeof input!=='object')throw new Error('Тохиргоо буруу байна.');
  const text=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():null;
  if(input.banner)cleanBanner(input.banner);
  const normalized=normalizeSiteSettings(input);
  const bannerPlacements=Object.fromEntries(bannerSlots.map(slot=>[slot.id,slot.id==='inlineCard'?cleanInlineBanner(normalized.bannerPlacements[slot.id]):cleanBanner(normalized.bannerPlacements[slot.id])]));
  if(!Array.isArray(input.promotionPlans)||input.promotionPlans.length>20)throw new Error('Багцын тоо 20-оос ихгүй байна.');
  const ids=new Set();
  const plans=input.promotionPlans.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[a-z0-9-]{1,60}$/.test(p.id)||ids.has(p.id)||!text(p.label,80)||!Number.isInteger(p.days)||p.days<1||p.days>365||!Number.isInteger(p.price)||p.price<0||p.price>100000000||typeof p.enabled!=='boolean')throw new Error('Багцын нэр, хугацаа, үнээ шалгана уу.');
    ids.add(p.id);const categoryPrices={};
    for(const [k,v] of Object.entries(p.categoryPrices||{})){if(!['property','cars','fashion','jobs','kids','computers','phones','electronics','home','equipment','hobby','health','animals','services','free'].includes(k)||!Number.isInteger(v)||v<0||v>100000000)throw new Error('Ангиллын үнэ буруу байна.');categoryPrices[k]=v;}
    return {id:p.id,label:p.label.trim(),days:p.days,price:p.price,enabled:p.enabled,categoryPrices};
  });
  return {banner:bannerPlacements.homeTop,bannerPlacements,promotionPlans:plans};
}
export function promotionPrice(plan,category){return plan.categoryPrices?.[category]??plan.price;}
