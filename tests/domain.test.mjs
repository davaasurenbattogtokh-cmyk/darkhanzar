import test from 'node:test';
import assert from 'node:assert/strict';
import {filterListings,validateDraft,transitionListing} from '../src/lib/domain.mjs';
const listing={id:'a',title:'Цэвэрхэн ОРОН СУУЦ',description:'Гэрэл сайтай байр зарна',category:'property',place:'Шинэ Дархан',price:100,region:'darkhan',status:'published',condition:'used',createdAt:2,ownerId:'owner',images:['x']};
const items=[listing,{...listing,id:'b',region:'sukhbaatar',price:0},{...listing,id:'c',region:'khutul',price:200},{...listing,id:'d',region:'khongor'},{...listing,id:'e',status:'pending'},{...listing,id:'f',status:'rejected'}];
test('Darkhanzar-ийн онцлох зар Unegui-ийн онцлох болон шинэ зарын өмнө гарна',()=>{
  const records=[
    {...listing,id:'import-featured',source:{promotion:'Онцгой'},featured:true,createdAt:999,price:1},
    {...listing,id:'local-regular',createdAt:998,price:2},
    {...listing,id:'local-featured',featured:true,createdAt:1,price:1000},
    {...listing,id:'import-new',source:{},createdAt:1000,price:3},
  ];
  for(const sort of ['newest','price-asc','price-desc'])assert.equal(filterListings(records,{sort})[0].id,'local-featured');
  // Every Darkhanzar ad precedes every Unegui ad, whatever the sort; the sort applies inside each group.
  assert.deepEqual(filterListings(records).map(i=>i.id),['local-featured','local-regular','import-new','import-featured']);
  assert.deepEqual(filterListings(records,{sort:'price-asc'}).map(i=>i.id),['local-featured','local-regular','import-featured','import-new']);
  assert.deepEqual(filterListings(records,{sort:'price-desc'}).map(i=>i.id),['local-featured','local-regular','import-new','import-featured']);
  assert.deepEqual(filterListings(records,{featured:true}).map(i=>i.id),['local-featured','import-featured']);
  assert.equal(records[0].id,'import-featured');
  assert.equal(filterListings(records,{max:'10'}).some(i=>i.id==='local-featured'),false);
  assert.equal(filterListings([{...records[2],status:'pending'},records[0]])[0].id,'import-featured');
});
test('Дархан-Уулын шүүлтүүр Сэлэнгийн хотуудыг хамруулахгүй',()=>assert.deepEqual(filterListings(items,{region:'darkhanuul'}).map(x=>x.id),['a','d']));
test('Сүхбаатар, Хөтөл тусдаа байршилтай',()=>{assert.deepEqual(filterListings(items,{region:'sukhbaatar'}).map(x=>x.id),['b']);assert.deepEqual(filterListings(items,{region:'khutul'}).map(x=>x.id),['c']);});
test('Хайлтад зөвхөн нийтэлсэн зар орно',()=>assert.equal(filterListings(items).length,4));
test('Монгол хайлт үсгийн хэмжээнээс хамаарахгүй, бүх үг таарна',()=>{assert.equal(filterListings(items,{query:'Орон   сууц'}).length,4);assert.equal(filterListings(items,{query:'сууц байхгүй'}).length,0);});
test('Үнийн хязгаар 0-ийг зөв дэмжинэ, эрэмбэлэлт эх өгөгдөл өөрчлөхгүй',()=>{assert.deepEqual(filterListings(items,{min:'0',max:'0'}).map(x=>x.id),['b']);assert.deepEqual(filterListings(items,{sort:'price-asc'}).map(x=>x.price),[0,100,100,200]);assert.equal(items[0].id,'a');});
test('Зар зөвхөн зөв байршил, үнэ, зурагтай үед илгээгдэнэ',()=>{const d={...listing,price:'100'};assert.equal(validateDraft(d),'');for(const bad of [{price:''},{price:-1},{price:'NaN'},{region:'ulaanbaatar'},{images:[]},{title:'a'},{description:'a'}])assert.notEqual(validateDraft({...d,...bad}),'');assert.equal(validateDraft({...d,price:'0'}),'');});
test('Зөвшөөрөх нь админы хяналтад буй зарын үйлдэл',()=>{const p={...listing,status:'pending'};assert.equal(transitionListing(p,'approve','user','owner').status,'pending');assert.equal(transitionListing(p,'approve','admin','any').status,'published');assert.equal(transitionListing({...p,status:'closed'},'approve','admin','any').status,'closed');});
test('Өөр хэрэглэгч зар хаахгүй, эзэмшигч дахин хяналтад илгээнэ',()=>{assert.equal(transitionListing(listing,'close','user','other').status,'published');const closed=transitionListing(listing,'close','user','owner');assert.equal(closed.status,'closed');assert.equal(transitionListing(closed,'resubmit','user','owner').status,'pending');});
test('Аймгийн түвшний эх сурвалжийг Дархан сум гэж таамаглахгүй',()=>{const external={...listing,region:'darkhanuul'};assert.equal(filterListings([external],{region:'darkhanuul'}).length,1);assert.equal(filterListings([external],{region:'darkhan'}).length,0);assert.equal(filterListings([external],{region:'sukhbaatar'}).length,0);});
test('Үнэ тодорхойгүй зар үнэгүйд тооцогдохгүй, хоёр эрэмбэд төгсгөлд гарна',()=>{const external={...listing,id:'unknown',price:0,source:{priceUnknown:true}};const records=[external,listing];assert.equal(filterListings(records,{max:'0'}).length,0);assert.deepEqual(filterListings(records,{sort:'price-asc'}).map(i=>i.id),['a','unknown']);assert.deepEqual(filterListings(records,{sort:'price-desc'}).map(i=>i.id),['a','unknown']);});
