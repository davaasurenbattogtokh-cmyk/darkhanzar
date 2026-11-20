import test from 'node:test';import assert from 'node:assert/strict';
import {insertInlineBanners} from '../src/lib/inline-ads.mjs';
import {defaultSettings,cleanSettings,normalizeSiteSettings} from '../src/lib/site-settings.mjs';
test('Inline advertisements count real listings and keep their original order across load-more boundaries',()=>{
 const listings=Array.from({length:48},(_,i)=>({id:i+1}));
 assert.equal(insertInlineBanners(listings.slice(0,14)).filter(x=>x.kind==='banner').length,0);
 const first=insertInlineBanners(listings.slice(0,24));assert.equal(first.length,25);assert.deepEqual(first[15],{kind:'banner',after:15});
 const expanded=insertInlineBanners(listings);assert.deepEqual(expanded.filter(x=>x.kind==='banner').map(x=>x.after),[15,30,45]);assert.deepEqual(expanded.slice(0,25),first);
 assert.deepEqual(expanded.filter(x=>x.kind==='listing').map(x=>x.item),listings);assert.equal(insertInlineBanners(listings,false).length,48);assert.equal(listings.length,48);
});
test('Three independent banner images and destinations survive validation; excess or unsafe slides fail',()=>{
 const settings=structuredClone(defaultSettings);settings.bannerPlacements.inlineCard.slides=[1,2,3].map(n=>({id:`slide-${n}`,image:`/api/media/00000000-0000-0000-0000-00000000000${n}.jpg`,title:`Баннер ${n}`,href:`https://example.test/banner-${n}`}));
 assert.deepEqual(cleanSettings(settings).bannerPlacements.inlineCard.slides,settings.bannerPlacements.inlineCard.slides);
 for(const mutate of [s=>s.bannerPlacements.inlineCard.slides.push({...s.bannerPlacements.inlineCard.slides[0],id:'fourth'}),s=>s.bannerPlacements.inlineCard.slides[1].image='https://external.test/unsafe.svg',s=>s.bannerPlacements.inlineCard.slides[2].href='javascript:alert(1)']){const invalid=structuredClone(settings);mutate(invalid);assert.throws(()=>cleanSettings(invalid));}
});
test('Existing two banner placements and prices are retained when the inline slot is introduced',()=>{
 const legacy=structuredClone(defaultSettings);delete legacy.bannerPlacements.inlineCard;legacy.bannerPlacements.categoryTop.enabled=false;legacy.promotionPlans[0].price=39000;
 const current=normalizeSiteSettings(legacy);assert.deepEqual(current.bannerPlacements.homeTop,legacy.bannerPlacements.homeTop);assert.equal(current.bannerPlacements.categoryTop.enabled,false);assert.equal(current.promotionPlans[0].price,39000);assert.deepEqual(current.bannerPlacements.inlineCard.slides,[]);
});
