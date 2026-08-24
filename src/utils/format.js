export const money=n=>`${Number(n||0).toLocaleString('ar-EG')} ج`;
export const fmtDate=x=>x?new Date(`${x}T00:00:00`).toLocaleDateString('ar-EG'):'—';
export const mins=t=>{const [h,m]=String(t||'0:0').split(':').map(Number);return h*60+m};
export const uid2=(p='id')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
export const safePhone=p=>String(p||'').replace(/\D/g,'');
export const egPhone=p=>{const n=safePhone(p);return n.startsWith('20')?n:n.startsWith('0')?`20${n.slice(1)}`:n};
export const today=()=>new Date().toISOString().slice(0,10);
