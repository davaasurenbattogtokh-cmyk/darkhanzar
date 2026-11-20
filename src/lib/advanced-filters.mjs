const specificationLabels={"condition":["Шинэ / Хуучин"],"plateStatus":["Нөхцөл"],"bodyType":["Төрөл"],"steering":["Хүрд"],"drive":["Хөтлөгч"],"year":["Үйлдвэрлэсэн он"],"importYear":["Орж ирсэн он"],"fuel":["Хөдөлгүүр"],"engineSize":["Мотор багтаамж"],"transmission":["Хурдны хайрцаг"],"mileage":["Явсан, км"],"leasing":["Лизинг"],"color":["Өнгө"],"area":["Талбай, м²"],"buildingFloors":["Барилгын давхар"],"floor":["Хэдэн давхарт"],"commissionYear":["Ашиглалтанд орсон он"],"purchasePayment":["Төлбөрийн нөхцөл"],"rentalPayment":["Төлбөрийн нөхцөл"],"constructionStage":["Барилгын явц"],"elevator":["Цахилгаан шаттай эсэх"],"garage":["Гараж"],"landPurpose":["Зориулалт"],"commercialType":["Төрөл"],"workTime":["Ажлын цаг"],"experience":["Туршлага"],"professionalLevel":["Мэргэжлийн түвшин"],"screenSize":["Дэлгэцийн хэмжээ"],"cpu":["CPU"],"ram":["RAM"],"storage":["SSD Hard"],"phoneStorage":["Багтаамж"],"numberType":["Төрөл"],"shoeSize":["Размер"],"clothingSize":["Размер"],"productType":["Төрөл"],"brand":["Брэнд"],"season":["Улирал"],"capacity":["Хүчин чадал"],"tvFunction":["Функц"],"driver":["Жолооч"],"vehicleCondition":["Нөхцөл"],"country":["Үйлдвэрлэсэн улс"],"truckType":["Төрөл"],"truckDrive":["Хөтлөгч"],"payload":["Даац"],"machinePurpose":["Зориулалт"],"radius":["Радиус"],"tyreWidth":["Дугуйн өргөн"],"tyreHeight":["Дугуйн өндөр"],"monitorSize":["Хэмжээ"],"perfumeType":["Төрөл"],"transportPayload":["Даац"],"operatingSystem":["Үйлдлийн систем"]};
export const normalizeTaxonomy=value=>String(value||'').toLowerCase().normalize('NFKC').replace(/[,\s]+/g,' ').trim();
export function rootForCategory(category,categories,taxonomy){const root=categories.find(c=>c.id===category)?.root;return taxonomy.find(n=>!n.parent&&normalizeTaxonomy(n.label)===normalizeTaxonomy(root));}
export function fieldsFor(schema,category,path=''){
 let ids=[...(schema.roots.find(r=>r.categoryId===category)?.fields||[])];
 const matches=schema.variants.filter(v=>v.categoryId===category&&(path===v.taxonomyPath||path.startsWith(v.taxonomyPath+' > '))).sort((a,b)=>a.taxonomyPath.length-b.taxonomyPath.length);
 for(const variant of matches){if(variant.inheritRoot===false)ids=[];ids.push(...variant.fields);}
 return [...new Set(ids)].map(id=>schema.fields[id]).filter(Boolean);
}
export function explicitAttributes(item){
 const attrs={...item.attributes};
 if(item.condition==='new')attrs.condition='Шинэ';if(item.condition==='used')attrs.condition='Хуучин';
 const aliases={year:['Үйлдвэрлэсэн он'],importYear:['Орж ирсэн он'],transmission:['Хурдны хайрцаг'],fuel:['Хөдөлгүүр','Түлш'],engineSize:['Мотор багтаамж','Хөдөлгүүрийн багтаамж'],drive:['Хөтлөгч'],steering:['Хүрд'],mileage:['Явсан','Явсан, км','Гүйлт'],leasing:['Лизинг'],model:['Загвар'],area:['Талбай','Талбай (м²)'],floor:['Давхар'],workTime:['Ажлын цаг'],experience:['Туршлага'],phoneStorage:['Багтаамж'],ram:['RAM'],cpu:['Процессор'],storage:['SSD'],color:['Өнгө'],brand:['Брэнд'],clothingSize:['Размер']};
 for(const [key,names] of Object.entries(specificationLabels))aliases[key]=[...(aliases[key]||[]),...names];
 if(item.category!=='cars'&&attrs.condition===undefined)attrs.condition=attrs['Нөхцөл'];
 for(const [key,names] of Object.entries(aliases)){if(attrs[key]!==undefined)continue;const name=names.find(n=>attrs[n]!==undefined);if(name)attrs[key]=attrs[name];}
 if(item.category==='cars'){
  if(attrs.bodyType===undefined)attrs.bodyType=attrs['Төрөл'];
  if(attrs.plateStatus===undefined)attrs.plateStatus=attrs['Нөхцөл'];
  const pair=item.title.match(/(?:^|[,·\s])(19\d{2}|20\d{2})\s*\/\s*(19\d{2}|20\d{2})(?:\D|$)/);
  if(pair){attrs.year??=pair[1];attrs.importYear??=pair[2];}
  for(const feature of item.features||[]){
   if(/^\d[\d,\s]*(?:\.\d+)?\s*км$/i.test(feature))attrs.mileage??=feature.replace(/[^\d.]/g,'');
   if(/^\d+(?:[.,]\d+)?\s*л$/i.test(feature))attrs.engineSize??=feature.replace(/\s*л$/i,'').replace(',','.');
   if(/^(Автомат|Механик|Хагас автомат)$/i.test(feature))attrs.transmission??=feature;
   if(/^(Бензин|Дизель|Газ|Хайбрид|Цахилгаан)$/i.test(feature))attrs.fuel??=feature;
  }
 }
 if(item.category==='property'&&attrs.area===undefined){const area=item.title.match(/(\d+(?:[.,]\d+)?)\s*(?:мкв|м²|м2|mkv|m2|m²)/i);if(area)attrs.area=area[1].replace(',','.');}
 return attrs;
}
export function itemTaxonomyPath(item,root){
 let path=String(item.subcategory||'').replace(/\s*\/\s*/g,' > ');
 if(root&&!path.startsWith(root.label))path=root.label+(path?' > '+path:'');
 return path;
}
export function matchesAdvanced(item,{subcategory='',place='',attributes={},hasPhoto=false}={}){
 if(hasPhoto&&!item.images?.length)return false;
 if(place&&!normalizeTaxonomy(item.place).includes(normalizeTaxonomy(place)))return false;
 if(subcategory.includes(' > ')){const leaf=subcategory.split(' > ').slice(1).join(' > '),actual=String(item.subcategory||'').replace(/\s*\/\s*/g,' > ');if(!(actual===subcategory||actual.startsWith(subcategory+' > ')||actual===leaf||actual.startsWith(leaf+' > ')))return false;}
 const values=explicitAttributes(item);
 for(const [id,filter] of Object.entries(attributes)){
  if(filter===undefined||filter===''||(Array.isArray(filter)&&!filter.length))continue;
  if(typeof filter==='object'&&!Array.isArray(filter)&&filter.min===''&&filter.max==='')continue;
  const raw=values[id];if(raw===undefined||raw===null||raw==='')return false;
  if(typeof filter==='object'&&!Array.isArray(filter)){
   if(filter.min===''&&filter.max==='')continue;
   const value=Number(String(raw).replace(/,/g,'').match(/\d+(?:\.\d+)?/)?.[0]);
   if(!Number.isFinite(value))return false;
   if(filter.min!==''&&filter.min!==undefined&&value<Number(filter.min))return false;
   if(filter.max!==''&&filter.max!==undefined&&value>Number(filter.max))return false;
  }else{const expected=Array.isArray(filter)?filter:[filter];const actual=String(raw).split('|').map(normalizeTaxonomy);if(!expected.some(x=>actual.includes(normalizeTaxonomy(x))))return false;}
 }
 return true;
}
