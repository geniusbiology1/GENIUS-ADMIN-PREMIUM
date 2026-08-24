import {isActive,uid} from '../../db';
export const STATUSES=['حاضر','غائب','متأخر'];
export function attendanceFor(data,sessionId){return (data.attendance||[]).filter(x=>isActive(x)&&x.sessionId===sessionId);}
export function ensureAttendance(data,session){
 const students=(data.students||[]).filter(s=>isActive(s)&&s.groupId===session.groupId&&(!session.academicYearId||s.academicYearId===session.academicYearId));
 const existing=new Set(attendanceFor(data,session.id).map(x=>x.studentId));
 return students.filter(s=>!existing.has(s.id)).map(s=>({id:uid('att'),sessionId:session.id,studentId:s.id,date:session.date,status:'حاضر',billable:true,createdAt:new Date().toISOString()}));
}
export function stats(rows){
 const total=rows.length,present=rows.filter(x=>x.status==='حاضر').length,late=rows.filter(x=>x.status==='متأخر').length,absent=rows.filter(x=>x.status==='غائب').length;
 return {total,present,late,absent,rate:total?Math.round((present+late)/total*100):0};
}
export function consecutiveAbsences(data,studentId,limit=3){
 const rows=(data.attendance||[]).filter(x=>isActive(x)&&x.studentId===studentId).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 let count=0; for(const r of rows){if(r.status==='غائب')count++;else break;} return count>=limit;
}
