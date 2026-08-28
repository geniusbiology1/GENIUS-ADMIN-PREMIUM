const DB='genius_admin_premium';
export const DB_VERSION=6;
export const stores=['settings','dictionaries','branches','academicYears','groups','students','sessions','attendance','exams','grades','books','studentBooks','bookMovements','recitations','payments','paymentAllocations','expenses','activities','notifications','followups','backupMeta','outbox'];
let dbPromise;

function open(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result,old=req.oldVersion;
   for(const s of stores)if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});
   if(old<5){
    const meta=db.objectStoreNames.contains('backupMeta')?null:null;
   }
  };
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null};resolve(db)};
  req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
 });
 return dbPromise;
}
const txRequest=(store,mode,fn)=>open().then(db=>new Promise((resolve,reject)=>{
 const tx=db.transaction(store,mode);let req;
 try{req=fn(tx.objectStore(store));}catch(e){reject(e);return}
 if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}
 tx.onerror=()=>reject(tx.error||new Error('DB_TRANSACTION_FAILED'));tx.onabort=()=>reject(tx.error||new Error('DB_TRANSACTION_ABORTED'));if(!req)tx.oncomplete=()=>resolve(true);
}));
export const all=store=>txRequest(store,'readonly',s=>s.getAll());
export const get=(store,id)=>txRequest(store,'readonly',s=>s.get(id));
export const put=(store,row)=>txRequest(store,'readwrite',s=>s.put(row)).then(()=>row);
export const putMany=async entries=>{
 if(!entries?.length)return true;const db=await open(),used=[...new Set(entries.map(x=>x[0]))];
 return new Promise((resolve,reject)=>{const tx=db.transaction(used,'readwrite');for(const [store,row] of entries)tx.objectStore(store).put(row);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
};
export const del=(store,id)=>txRequest(store,'readwrite',s=>s.delete(id));
export const clear=store=>txRequest(store,'readwrite',s=>s.clear());
export const snapshot=async()=>{
 const out={schemaVersion:DB_VERSION,exportedAt:new Date().toISOString()};
 for(const s of stores)out[s]=await all(s);
 return out;
};
export function validateSnapshot(payload){
 if(!payload||payload.app!=='GENIUS ADMIN'||payload.backupFormat!=='GENIUS_ADMIN_BACKUP')throw new Error('INVALID_BACKUP_APP');
 if(!payload.data||typeof payload.data!=='object')throw new Error('INVALID_BACKUP_DATA');
 if(Number(payload.data.schemaVersion)>DB_VERSION)throw new Error('BACKUP_SCHEMA_TOO_NEW');
 for(const s of stores)if(payload.data[s]!==undefined&&!Array.isArray(payload.data[s]))throw new Error(`INVALID_STORE_${s}`);
 return true;
}
export const restore=async payload=>{
 validateSnapshot(payload);
 const before=await snapshot(),db=await open();
 try{
  await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const s of stores){tx.objectStore(s).clear();for(const row of(payload.data[s]||[])){if(!row||row.id===undefined)throw new Error(`INVALID_ROW_${s}`);tx.objectStore(s).put(row)}}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('RESTORE_FAILED'));tx.onabort=()=>reject(tx.error||new Error('RESTORE_ABORTED'))});
 }catch(err){
  await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const s of stores){tx.objectStore(s).clear();for(const row of(before[s]||[]))tx.objectStore(s).put(row)}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
  throw err;
 }
};
export const uid=(p='id')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const isActive=x=>!x?.deletedAt;
export {open};
