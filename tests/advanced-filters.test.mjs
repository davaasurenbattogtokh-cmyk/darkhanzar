import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fieldsFor,matchesAdvanced,explicitAttributes,rootForCategory} from '../src/lib/advanced-filters.mjs';
const schema=JSON.parse(readFileSync(new URL('../src/lib/filter-schema.json',import.meta.url))),taxonomy=JSON.parse(readFileSync(new URL('../src/lib/taxonomy.json',import.meta.url)));
const car={category:'cars',title:'Toyota Prius, 2015/2022',subcategory:'Автомашин зарна / Toyota',features:['150,000 км','Автомат','1.8 л','Хайбрид'],attributes:{},images:['photo'],place:'Дархан-Уул',condition:'unknown'};
test('Car year, mileage and fuel filter explicit source values; OR within, AND across fields',()=>{
 assert.equal(matchesAdvanced(car,{attributes:{year:{min:'2010',max:'2016'},fuel:['Бензин','Хайбрид'],mileage:{min:'0',max:'160000'}}}),true);
 assert.equal(matchesAdvanced(car,{attributes:{year:{min:'2016',max:''}}}),false);
 assert.equal(explicitAttributes(car).engineSize,'1.8');assert.equal(explicitAttributes(car).mileage,'150000');
});
test('Unknown metadata stays unknown; clearing a range restores matching',()=>{
 assert.equal(matchesAdvanced(car,{attributes:{elevator:'Тийм'}}),false);assert.equal(matchesAdvanced(car,{attributes:{elevator:{min:'',max:''}}}),true);assert.equal(matchesAdvanced(car,{attributes:{year:[]}}),true);assert.equal(explicitAttributes(car).leasing,undefined);
});
test('Taxonomy child filter matches exact branch and descendants, not siblings',()=>{
 assert.equal(matchesAdvanced(car,{subcategory:'Автомашин > Автомашин зарна > Toyota'}),true);assert.equal(matchesAdvanced(car,{subcategory:'Автомашин > Автомашин зарна > Lexus'}),false);assert.equal(matchesAdvanced(car,{subcategory:'Автомашин'}),true);
 const truck={...car,subcategory:'Ачааны машин, автобус, хүнд механизм / Автобус'};assert.equal(matchesAdvanced(truck,{subcategory:'Автомашин > Ачааны машин, автобус, хүнд механизм > Ачааны машин'}),false);
});
test('Dependent fields and root matching handle punctuation and category changes',()=>{
 const ids=fieldsFor(schema,'cars','Автомашин > Автомашин зарна > Toyota').map(f=>f.id);assert(ids.includes('year'));assert(ids.includes('mileage'));assert(!fieldsFor(schema,'cars','Автомашин > Авто дугуй, обуд > Обуд').some(f=>f.id==='year'));
 assert.equal(rootForCategory('phones',[{id:'phones',root:'Утас дугаар'}],taxonomy)?.label,'Утас, дугаар');assert.equal(fieldsFor(schema,'property','Үл хөдлөх > Үл хөдлөх зарна > Орон сууц зарна').some(f=>f.id==='elevator'),true);
});

test('Matching source-detail attributes override contradictory title and summary features',()=>{
 const actual={...car,attributes:{'Үйлдвэрлэсэн он':'2014','Орж ирсэн он':'2025','Мотор багтаамж':'2.5 л','Явсан':'226000 км','Хөдөлгүүр':'Дизель','Хүрд':'Буруу','Хөтлөгч':'Урдаа FWD','Хурдны хайрцаг':'Механик','Нөхцөл':'Дугаар авсан','Лизинг':'Лизинггүй'}};
 const attrs=explicitAttributes(actual);assert.equal(attrs.year,'2014');assert.equal(attrs.importYear,'2025');assert.equal(attrs.transmission,'Механик');
 assert.equal(matchesAdvanced(actual,{attributes:{year:{min:'2014',max:'2014'},importYear:{min:'2025',max:'2025'},engineSize:{min:'2',max:'3'},mileage:{min:'200000',max:'230000'},fuel:['Дизель'],steering:'Буруу',drive:['Урдаа FWD'],plateStatus:['Дугаар авсан'],leasing:['Лизинггүй']}}),true);
 assert.equal(matchesAdvanced(actual,{attributes:{fuel:['Хайбрид']}}),false);
});

test('Property and electronics specifications use the same imported values as their category filters',()=>{
 const property={category:'property',title:'Байр',attributes:{'Талбай, м²':'58.5','Барилгын давхар':'12','Хэдэн давхарт':'6','Цахилгаан шаттай эсэх':'Тийм','Ашиглалтанд орсон он':'2020'}};
 assert.equal(matchesAdvanced(property,{attributes:{area:{min:'55',max:'60'},floor:{min:'5',max:'7'},elevator:'Тийм',commissionYear:{min:'2019',max:'2021'}}}),true);
 assert.equal(matchesAdvanced({category:'computers',title:'Компьютер',attributes:{CPU:'Intel i5','SSD Hard':'512 GB','Дэлгэцийн хэмжээ':'15.6'}},{attributes:{cpu:'Intel i5',storage:'512 GB',screenSize:'15.6'}}),true);
});
