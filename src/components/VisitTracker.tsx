'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {trackVisit} from '@/lib/track';

// Counts a page view on every page change (the opened ad is counted by the marketplace itself).
export default function VisitTracker(){
 const pathname=usePathname();
 useEffect(()=>{
  const ad=new URLSearchParams(window.location.search).get('ad');
  trackVisit(ad?`${pathname}?ad=${ad}`:pathname);
 },[pathname]);
 return null;
}
