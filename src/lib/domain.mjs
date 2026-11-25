import {matchesAdvanced} from './advanced-filters.mjs';
export const DARHAN_UUL = ['darkhan', 'khongor', 'orkhon', 'sharyngol'];
// No stated price: an imported ad without a price, or an own ad marked negotiable at 0.
const priceUnknown = item => !!item.source?.priceUnknown || (item.price === 0 && !!item.negotiable);
export function normalize(value = '') { return String(value).toLocaleLowerCase('mn').normalize('NFKC').trim(); }
export function filterListings(items, filters = {}) {
  const { query = '', category = '', region = 'all', min = '', max = '', featured = false, condition = 'all', sort = 'newest', advanced = {} } = filters;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const result = items.filter(item => item.status === 'published'
    && (!category || item.category === category)
    && (region === 'all' || (region === 'darkhanuul' ? (DARHAN_UUL.includes(item.region) || item.region === 'darkhanuul') : item.region === region))
    && (!featured || item.featured)
    && (condition === 'all' || item.condition === condition)
    && (min === '' || (!priceUnknown(item) && item.price >= Number(min)))
    && (max === '' || (!priceUnknown(item) && item.price <= Number(max)))
    && matchesAdvanced(item,advanced)
    && terms.every(term => normalize(`${item.title} ${item.description} ${item.place} ${item.categoryLabel} ${item.subcategory}`).includes(term)));
  // Ads posted on Darkhanzar come before imported (Unegui) ads: promoted Darkhanzar ads,
  // then other Darkhanzar ads, then imported ones. The chosen sort applies within each group.
  const rank = item => item.source ? 2 : item.featured ? 0 : 1;
  return result.sort((a,b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if(sort.startsWith('price-')){
      if(priceUnknown(a) !== priceUnknown(b))return priceUnknown(a)?1:-1;
      return sort==='price-asc'?a.price-b.price:b.price-a.price;
    }
    return b.createdAt-a.createdAt;
  });
}
export function validateDraft(draft) {
  if (!draft.category) return 'Ангиллаа сонгоно уу.';
  if (String(draft.title || '').trim().length < 8) return 'Гарчиг хамгийн багадаа 8 тэмдэгттэй байна.';
  if (String(draft.title || '').trim().length > 100) return 'Гарчиг 100 тэмдэгтээс хэтрэхгүй байна.';
  if (String(draft.description || '').trim().length < 20) return 'Тайлбар хамгийн багадаа 20 тэмдэгттэй байна.';
  if (!['darkhan','khongor','orkhon','sharyngol','sukhbaatar','khutul'].includes(draft.region)) return 'Хамрагдах байршлаас сонгоно уу.';
  if (String(draft.price).trim() === '' || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0 || Number(draft.price) > 1000000000000) return 'Үнээ зөв оруулна уу.';
  if (!draft.images?.length) return 'Хамгийн багадаа нэг зураг нэмнэ үү.';
  return '';
}
export function transitionListing(listing, action, role, ownerId) {
  if (action === 'approve' && role === 'admin' && listing.status === 'pending') return {...listing,status:'published'};
  if (action === 'reject' && role === 'admin' && listing.status === 'pending') return {...listing,status:'rejected'};
  if (action === 'close' && listing.ownerId === ownerId && ['published','pending'].includes(listing.status)) return {...listing,status:'closed'};
  if (action === 'resubmit' && listing.ownerId === ownerId && ['closed','rejected'].includes(listing.status)) return {...listing,status:'pending'};
  return listing;
}
