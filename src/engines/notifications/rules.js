import {consecutiveAbsences} from '../attendance/engine';
export function evaluateRules(data,now=new Date()){
 const out=[], today=now.toISOString().slice(0,10);
 for(const s of (data.students||[]).filter(x=>!x.deletedAt&&x.status==='نشط')){
  if(consecutiveAbsences(data,s.id,3))out.push({rule:'ABSENCE_3',studentId:s.id,title:'غياب متكرر',message:`${s.name} غاب 3 حصص متتالية`});
  const due=(data.payments||[]).filter(x=>!x.deletedAt&&x.studentId===s.id&&x.type==='CHARGE').reduce((a,x)=>a+Number(x.amount||0),0)-(data.payments||[]).filter(x=>!x.deletedAt&&x.studentId===s.id&&x.type==='PAYMENT').reduce((a,x)=>a+Number(x.amount||0),0);
  if(due>0)out.push({rule:'DUE',studentId:s.id,title:'متأخرات',message:`${s.name} عليه ${due} ج`});
 }
 for(const e of (data.exams||[]).filter(x=>!x.deletedAt)){const age=(Date.now()-new Date(e.date||today))/86400000;if(age>=1){const graded=(data.grades||[]).filter(g=>!g.deletedAt&&g.examId===e.id).length;const groups=Array.isArray(e.groupIds)?e.groupIds:(e.groupId?[e.groupId]:[]);const total=(data.students||[]).filter(s=>!s.deletedAt&&s.status==='نشط'&&groups.includes(s.groupId)).length;if(graded<total)out.push({rule:'UNMARKED_EXAM',examId:e.id,title:'امتحان غير مكتمل التصحيح',message:`${e.name||'امتحان'} يحتاج تصحيحًا`});}}
 return out;
}
