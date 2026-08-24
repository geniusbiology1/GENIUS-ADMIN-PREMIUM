export const required=(v)=>String(v??'').trim().length>0;
export const validStudent=s=>required(s?.name)&&required(s?.academicYearId)&&required(s?.groupId)&&required(s?.code);
export const validBackup=p=>p?.app==='GENIUS ADMIN'&&p?.data&&typeof p.data==='object';
export const uniqueCodes=(students)=>{const seen=new Set(),dupes=[];for(const s of students){if(!s.code)continue;if(seen.has(s.code))dupes.push(s.code);seen.add(s.code)}return dupes};
