export type Listing = {
  id:string; title:string; description:string; category:string; categoryLabel:string; subcategory:string;
  price:number; region:string; place:string; images:string[]; featured:boolean; condition:string;
  status:'published'|'pending'|'rejected'|'closed'; createdAt:number; ownerId:string; seller:string; phone?:string;
  persisted?:boolean; promotedUntil?:number; updatedAt?:number;
  attributes:Record<string,string>; negotiable?:boolean; features?:string[];
  source?:{id:string;url:string;priceLabel:string;priceUnknown:boolean;publishedLabel:string;observedAt:string;promotion:string;thumbnail?:string};
};
export const regions = [
  {id:'darkhan',label:'Дархан',parent:'Дархан-Уул',detail:'Дархан сум'},
  {id:'khongor',label:'Хонгор',parent:'Дархан-Уул',detail:'Хонгор сум'},
  {id:'orkhon',label:'Орхон',parent:'Дархан-Уул',detail:'Орхон сум'},
  {id:'sharyngol',label:'Шарын гол',parent:'Дархан-Уул',detail:'Шарын гол сум'},
  {id:'sukhbaatar',label:'Сүхбаатар хот',parent:'Сэлэнгэ',detail:'Сүхбаатар хот'},
  {id:'khutul',label:'Хөтөл',parent:'Сэлэнгэ',detail:'Хөтөл хот'},
];
export const categories = [
  {id:'property',label:'Үл хөдлөх',icon:'apartment',root:'Үл хөдлөх'},
  {id:'cars',label:'Автомашин',icon:'car',root:'Автомашин'},
  {id:'fashion',label:'Хувцас, хэрэглэл',icon:'fashion',root:'Хувцас хэрэглэл'},
  {id:'jobs',label:'Ажлын зар',icon:'briefcase',root:'Ажлын зар'},
  {id:'kids',label:'Хүүхдийн бараа',icon:'baby',root:'Хүүхдийн бараа'},
  {id:'computers',label:'Компьютер, сэлбэг',icon:'laptop',root:'Компьютер сэлбэг хэрэгсэл'},
  {id:'phones',label:'Утас, дугаар',icon:'smartphone',root:'Утас дугаар'},
  {id:'electronics',label:'Цахилгаан бараа',icon:'appliance',root:'Цахилгаан бараа'},
  {id:'home',label:'Гэр ахуйн бараа',icon:'furniture',root:'Гэр ахуйн бараа'},
  {id:'equipment',label:'Төхөөрөмж, материал',icon:'tools',root:'Төхөөрөмж материал түлш'},
  {id:'hobby',label:'Амралт, спорт, хобби',icon:'sports',root:'Амралт спорт хобби'},
  {id:'health',label:'Эрүүл мэнд, гоо сайхан',icon:'beauty',root:'Эрүүл мэнд гоо сайхан хүнс'},
  {id:'animals',label:'Мал, амьтан, ургамал',icon:'plants',root:'Мал амьтан ургамал'},
  {id:'services',label:'Үйлчилгээ',icon:'service',root:'Үйлчилгээ'},
  {id:'free',label:'Үнэгүй өгнө',icon:'gifts',root:'Үнэгүй өгнө'},
];
const base = Date.UTC(2026,10,17,4);
const rows: [string,string,number,string,string,string,string,boolean,Record<string,string>?][] = [
 ['property','Гэрэл сайтай 3 өрөө орон сууц',245000000,'darkhan','Шинэ Дархан, 13-р баг','apartment','Орон сууц зарна',true,{'Өрөө':'3','Талбай':'72 м²','Давхар':'4 / 9'}],
 ['cars','Toyota Prius 30 · 2015 / 2022',23500000,'darkhan','Хуучин Дархан, 5-р баг','car','Суудлын автомашин',true,{'Үйлдвэрлэсэн он':'2015','Орж ирсэн он':'2022','Хурдны хайрцаг':'Автомат'}],
 ['home','Скандинав загварын ногоон буйдан',680000,'sukhbaatar','Сүхбаатар хот, төв','sofa','Буйдан',true,{'Өнгө':'Ногоон','Материал':'Даавуу','Урт':'210 см'}],
 ['phones','iPhone 13 · 128GB · Midnight',1150000,'darkhan','Шинэ Дархан, 12-р баг','phone','Гар утас',true,{'Багтаамж':'128 GB','Батарей':'89%','Өнгө':'Midnight'}],
 ['computers','MacBook Pro 13, M1, 8/256GB',2100000,'khutul','Хөтөл хот, 1-р хороолол','laptop','Зөөврийн компьютер',false,{'Процессор':'Apple M1','RAM':'8 GB','SSD':'256 GB'}],
 ['hobby','Хотын унадаг дугуй, 28 инч',350000,'darkhan','Дархан, 15-р баг','bike','Дугуй',false,{'Дугуйн хэмжээ':'28 инч','Араа':'7'}],
 ['electronics','Canon камер, линзний хамт',890000,'darkhan','Шинэ Дархан, 14-р баг','camera','Камер, дуран',false,{'Төрөл':'DSLR','Дагалдах':'Линз, цэнэглэгч'}],
 ['property','Хотын төвд 2 өрөө байр түрээслүүлнэ',850000,'sukhbaatar','Сүхбаатар хот, 2-р баг','interior','Орон сууц түрээслүүлнэ',false,{'Өрөө':'2','Талбай':'48 м²','Төлбөр':'Сараар'}],
 ['home','Модон хөлтэй минимал сандал',95000,'khutul','Хөтөл хот, төв','chair','Ширээ, сандал',false,{'Тоо':'4 ширхэг','Материал':'Мод, хуванцар'}],
 ['animals','Тасалгааны ногоон ургамлууд',35000,'darkhan','Дархан, 11-р баг','plant','Тасалгааны ургамал',false,{'Хэмжээ':'Дунд','Сав':'Дагалдана'}],
 ['fashion','Намрын куртик, размер M',120000,'sharyngol','Шарын гол, Дархан баг','clothes','Эмэгтэй хувцас',false,{'Размер':'M','Өнгө':'Беж'}],
 ['services','Гал тогооны тавилга захиалгаар',1500000,'darkhan','Дархан сум','kitchen','Тавилга захиалга',false,{'Хугацаа':'10–14 хоног','Хэмжилт':'Тохиролцоно'}],
 ['jobs','Борлуулалтын зөвлөх ажилд авна',1800000,'darkhan','Шинэ Дархан, төв','job','Худалдаа, борлуулалт',false,{'Ажлын цаг':'Бүтэн цаг','Туршлага':'Шаардлагагүй','Цалин':'Сарын'}],
 ['kids','Хүүхдийн тэрэг, эвхэгддэг',280000,'sukhbaatar','Сүхбаатар хот, 3-р баг','baby','Хүүхдийн тэрэг',false,{'Нас':'0–3 нас','Өнгө':'Саарал'}],
 ['free','Ургамлын үрсэлгээ үнэгүй өгнө',0,'orkhon','Орхон сум, төв','plant','Үнэгүй өгнө',false,{'Нөхцөл':'Өөрөө ирж авна'}],
 ['property','Хашаа байшин, 700 м² газартай',85000000,'khongor','Хонгор сум, 1-р баг','apartment','Хашаа байшин',false,{'Газар':'700 м²','Байшин':'64 м²','Өрөө':'2'}],
];
export const seedListings:Listing[] = rows.map((r,i)=>({id:`DZ-${1024+i}`,category:r[0],categoryLabel:categories.find(c=>c.id===r[0])!.label,title:r[1],price:r[2],region:r[3],place:r[4],images:[`/photos/${r[5]}.jpg`,...(r[0]==='property'?['/photos/interior.jpg']:[])],subcategory:r[6],featured:r[7],attributes:r[8]||{},status:'published',condition:i%4===0?'new':'used',createdAt:base-i*3600000,ownerId:'sample',seller:['Б. Энхжин','Т. Бат-Эрдэнэ','Г. Номин','Д. Мөнхтөр','С. Оюунчимэг','Н. Тэмүүлэн','Б. Саруул','А. Болормаа'][i%8],phone:'99999999',description:`${r[1]}. Цэвэрхэн хэрэглэсэн, сайн нөхцөлтэй. Дэлгэрэнгүй мэдээллийг зарын үзүүлэлтээс харна уу.\n\nЭнэ бол интерфэйс шалгах зориулалттай жишээ зар. Зураг нь тухайн зарын бодит бараа биш.`,negotiable:i%3===0}));
export const money=(price:number)=>price===0?'Үнэгүй':`${new Intl.NumberFormat('en-US').format(price).replaceAll(',',' ')} ₮`;
// An ad without a stated price (e.g. imported from the Facebook page) is negotiable, not free.
export const listingMoney=(item:{price:number;negotiable?:boolean})=>item.price===0&&item.negotiable?'Үнэ тохиролцоно':money(item.price);
export const showNegotiable=(item:{price:number;negotiable?:boolean})=>!!item.negotiable&&item.price>0;
