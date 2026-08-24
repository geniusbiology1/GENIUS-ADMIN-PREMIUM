import {uid,isActive} from '../../db';
export function planPromotion(data,{fromYearId,toYearId,groupMap={},priceMap={}}){
 const students=(data.students||[]).filter(s=>isActive(s)&&s.academicYearId===fromYearId);
 return students.map(s=>({
   id:uid('st'),
   code:s.code,
   name:s.name,
   grade:s.grade,
   subject:s.subject,
   academicYearId:toYearId,
   groupId:groupMap[s.groupId]||'',
   branchId:s.branchId,
   status:'نشط',
   studentPhone:s.studentPhone||'',
   parentName:s.parentName||'',
   parentPhone:s.parentPhone||'',
   joinDate:new Date().toISOString().slice(0,10),
   price:priceMap[s.groupId]??0,
   discountType:'NONE',
   discountValue:0,
   previousStudentId:s.id,
   promotedFrom:fromYearId,
   notes:'تمت الترقية تلقائيًا — يحتفظ الطالب بسجل السنة السابقة.'
 }));
}
