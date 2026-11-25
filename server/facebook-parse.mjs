// Turns a Facebook page post (free text) into a Darkhanzar listing draft.
// Only posts that carry a phone number become listings; photos are checked by the importer.

const categoryNames={property:'Үл хөдлөх',cars:'Автомашин',fashion:'Хувцас, хэрэглэл',jobs:'Ажлын зар',kids:'Хүүхдийн бараа',computers:'Компьютер, сэлбэг',phones:'Утас, дугаар',electronics:'Цахилгаан бараа',home:'Гэр ахуйн бараа',equipment:'Төхөөрөмж, материал',hobby:'Амралт, спорт, хобби',health:'Эрүүл мэнд, гоо сайхан',animals:'Мал, амьтан, ургамал',services:'Үйлчилгээ',free:'Үнэгүй өгнө'};
const placeLabels={darkhan:'Дархан',khongor:'Хонгор',orkhon:'Орхон',sharyngol:'Шарын гол',sukhbaatar:'Сүхбаатар хот',khutul:'Хөтөл'};

// Keyword → category. Phrases are matched on lower-cased text; the category with most hits wins.
const KEYWORDS={
 jobs:['ажилд авна','ажилтан авна','ажилтан хэрэгтэй','цалин','ажлын байр','жолооч авна','худалдагч авна','ээлжийн ажил'],
 electronics:['угаалгын машин','зурагт','телевиз','хөргөгч','тоос сорогч','богино долгион','чанагч','пүрс','playstation','чихэвч','камер','кондиционер','халаагуур'],
 cars:['toyota','prius','lexus','hyundai','kia ','nissan','honda','mercedes','benz','bmw','land cruiser','porter','mazda','subaru','mitsubishi','suzuki','ford','chevrolet','volkswagen','автомашин','суудлын','ачааны машин','тээврийн хэрэгсэл','хөдөлгүүр','машин зарна','машин зарагдана','км явсан','mile','мото'],
 property:['байр','өрөө','газар','хашаа','мкв','м2','м²','обьект','объект','талбай','түрээс','орон сууц','хаус','гараж','хаалга','давхар'],
 phones:['iphone','samsung','galaxy','утас','дугаар','xiaomi','redmi','oppo','vivo','huawei','honor','pixel'],
 computers:['компьютер','ноутбук','laptop','notebook','macbook','ipad','таблет','принтер','монитор','видео карт'],
 services:['үйлчилгээ','засвар','засна','угсралт','тээвэр','зөөнө','сургалт','хичээл','хийж өгнө','захиалга авна'],
 home:['тавилга','буйдан','шкаф','ширээ','сандал','гудас','хивс','гал тогоо','ор '],
 kids:['хүүхдийн','тэрэг','өлгий','тоглоом'],
 fashion:['хувцас','гутал','цүнх','куртка','дээл','пальто','малгай','даашинз','хүрэм'],
 animals:['нохой','муур','үхэр','хонь','ямаа','адуу','тахиа','гөлөг','цэцэг','тарьц','мал '],
 health:['гоо сайхан','крем','витамин','массаж','арьс арчилгаа'],
 equipment:['тоног','төхөөрөмж','материал','багаж','генератор','станок','тоосго','цемент','банз','төмөр'],
 hobby:['спорт','унадаг дугуй','фитнес','майхан','загас','тренажер'],
 free:['үнэгүй өгнө','үнэгүй авна уу'],
};

const PHONE=/(?:\+?976[\s-]?)?(?<!\d)([5-9]\d)[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})(?![\d])(?!\s*(?:₮|төг|tug|сая))/gu;
export function findPhone(text){
 for(const m of String(text||'').matchAll(PHONE)){
  const phone=m.slice(1,5).join('');
  if(/0000$/.test(phone))continue; // round numbers are prices, not phones
  return phone;
 }
 return '';
}

const num=s=>Number(String(s).replace(/[\s,'’]/g,'').replace(/(\d)\.(\d{3})(?!\d)/g,'$1$2'));
export function findPrice(text){
 const t=String(text||'').toLocaleLowerCase('mn');
 const candidates=[];
 for(const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(тэрбум)/gu))candidates.push([m.index,Number(m[1].replace(',','.'))*1e9]);
 for(const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(сая|say[a]?\b|сая₮)/gu))candidates.push([m.index,Number(m[1].replace(',','.'))*1e6]);
 for(const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(мянга|мянган|myanga|k\b|к\b)/gu))candidates.push([m.index,Number(m[1].replace(',','.'))*1e3]);
 for(const m of t.matchAll(/(\d{1,3}(?:[ ,.’']\d{3})+|\d{3,})\s*(₮|төг|tug|tögrög|төгрөг)/gu))candidates.push([m.index,num(m[1])]);
 if(!candidates.length)return 0;
 // Prefer the amount written right after "үнэ"; otherwise the first one in the post.
 const label=t.search(/үнэ|une\b|price/u);
 const after=label>=0?candidates.filter(([i])=>i>=label).sort((a,b)=>a[0]-b[0])[0]:null;
 const value=(after||candidates.sort((a,b)=>a[0]-b[0])[0])[1];
 return Number.isFinite(value)&&value>0&&value<=1e12?Math.round(value):0;
}

export function findCategory(text){
 const t=` ${String(text||'').toLocaleLowerCase('mn')} `;
 let best='',score=0;
 for(const [category,words] of Object.entries(KEYWORDS)){
  const hits=words.reduce((n,w)=>n+(t.includes(w)?1:0),0);
  if(hits>score){best=category;score=hits;}
 }
 return best||'home';
}

export function findRegion(text){
 const t=String(text||'').toLocaleLowerCase('mn');
 if(/хөтөл/u.test(t))return 'khutul';
 if(/сүхбаатар\s*(хот|сум)|сүхбаатар\b(?!\s*(дүүрэг|гудамж|талбай))/u.test(t)&&!/дархан/u.test(t))return 'sukhbaatar';
 if(/шарын\s*гол/u.test(t))return 'sharyngol';
 if(/хонгор/u.test(t))return 'khongor';
 if(/орхон\s*сум/u.test(t))return 'orkhon';
 return 'darkhan';
}

const clean=s=>String(s||'').replace(/#[\p{L}\p{N}_]+/gu,'').replace(/[\p{Extended_Pictographic}️‍]/gu,'').replace(/[ \t]+/g,' ').trim();

export function parsePost(message){
 const text=String(message||'').replace(/\r/g,'').trim();
 const phone=findPhone(text);
 if(!phone)return null;
 const lines=text.split('\n').map(clean).filter(l=>l.length>1);
 let title=lines.find(l=>l.replace(/[\d\s+().-]/g,'').length>=4)||'';
 if(title.length<8)title=clean(text.replace(/\s+/g,' ')).slice(0,90);
 const category=findCategory(text),region=findRegion(text),price=findPrice(text);
 if(title.length<8)title=`${categoryNames[category]} зарна`;
 if(title.length>100)title=title.slice(0,97).trimEnd()+'…';
 let description=text.slice(0,4800);
 if(description.length<20)description=`${description}\nУтас: ${phone}`.trim();
 const lower=text.toLocaleLowerCase('mn').replace(/шинэ\s*дархан/gu,'');
 return {title,description,category,categoryLabel:categoryNames[category],subcategory:'',price,negotiable:price===0,region,place:placeLabels[region],condition:/(^|[^\p{L}])шинэ([^\p{L}]|$)|шинээрээ|\bnew\b/u.test(lower)?'new':'used',attributes:{},phone};
}

// Photo URLs of a Graph API post: single photo, album, or the post picture.
export function postImages(post){
 const urls=[];
 for(const a of post?.attachments?.data||[]){
  const subs=a.subattachments?.data||[];
  for(const s of subs.length?subs:[a]){if((s.type||'').includes('photo')||s.media?.image?.src&&!/video/.test(s.type||''))if(s.media?.image?.src)urls.push(s.media.image.src);}
 }
 if(!urls.length&&post?.full_picture&&!(post?.attachments?.data||[]).some(a=>/video/.test(a.type||'')))urls.push(post.full_picture);
 return [...new Set(urls)].slice(0,8);
}
