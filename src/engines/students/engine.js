import {isActive} from '../../db';
export function student360(data,studentId){
 const student=(data.students||[]).find(x=>x.id===studentId);
 if(!student)return null;
 const related=(store)=> (data[store]||[]).filter(x=>isActive(x)&&x.studentId===studentId);
 const timeline=[
  ...related('attendance').map(x=>({date:x.date,type:'ATTENDANCE',label:`الحضور: ${x.status}`,ref:x.id})),
  ...related('grades').map(x=>({date:x.date,type:'GRADE',label:`${x.examName||'امتحان'}: ${x.score}/${x.maxScore}`,ref:x.id})),
  ...related('payments').map(x=>({date:x.date||x.createdAt,type:'FINANCE',label:x.note||x.source||x.type,amount:Number(x.amount||0),ref:x.id})),
  ...(data.paymentAllocations||[]).filter(x=>isActive(x)&&x.studentId===studentId).map(x=>({date:x.date||x.createdAt,type:'ALLOCATION',label:`تخصيص دفعة: ${x.chargeId}`,amount:-Number(x.amount||0),ref:x.id})),
  ...related('studentBooks').map(x=>({date:x.date,type:'BOOK',label:`كتاب: ${x.status||'—'}`,ref:x.id}))
 ].sort((a,b)=>new Date(b.date)-new Date(a.date));
 return {student,group:(data.groups||[]).find(x=>x.id===student.groupId),attendance:related('attendance'),grades:related('grades'),payments:related('payments'),books:related('studentBooks'),timeline};
}
