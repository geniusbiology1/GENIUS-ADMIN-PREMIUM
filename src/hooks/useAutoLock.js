import {useEffect} from 'react';
export function useAutoLock({enabled=true,minutes=15,onLock,onActivity}){
 useEffect(()=>{
  if(!enabled)return;
  let timer;
  const reset=()=>{clearTimeout(timer);onActivity?.();timer=setTimeout(()=>onLock?.(),Math.max(1,Number(minutes||15))*60000)};
  const events=['touchstart','click','keydown','pointerdown'];
  events.forEach(e=>window.addEventListener(e,reset,{passive:true}));
  document.addEventListener('visibilitychange',reset);
  reset();
  return()=>{clearTimeout(timer);events.forEach(e=>window.removeEventListener(e,reset));document.removeEventListener('visibilitychange',reset)};
 },[enabled,minutes,onLock,onActivity]);
}
