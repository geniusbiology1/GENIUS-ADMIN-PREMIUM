import {isActive} from '../../db';
const fields={students:['name','code','studentPhone','parentName','parentPhone'],groups:['name'],books:['name','title'],exams:['name','title'],payments:['id','note','source','amount'],expenses:['id','note','category','amount']};
export function globalSearch(data,query){
 const q=String(query||'').trim().toLowerCase(); if(!q)return [];
 return Object.entries(fields).flatMap(([store,keys])=>(data[store]||[]).filter(isActive).filter(x=>keys.some(k=>String(x[k]??'').toLowerCase().includes(q))).slice(0,30).map(x=>({store,id:x.id,title:x.name||x.title||x.note||x.id,subtitle:x.code||x.phone||x.category||''})));
}
