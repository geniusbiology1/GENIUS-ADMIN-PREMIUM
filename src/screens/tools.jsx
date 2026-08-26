import React,{useState} from 'react';
import * as I from 'lucide-react';
import {money,fmtDate} from '../utils/format.js';
import {isActive as active} from '../db.js';
import {Row,Empty,Modal} from '../components/ui.jsx';

export function Calculator(p){
 const [expr,setExpr]=useState('');
 const [result,setResult]=useState('');
 const press=k=>{
  if(k==='C'){setExpr('');setResult('');return}
  if(k==='DEL'){setExpr(x=>x.slice(0,-1));return}
  if(k==='='){
   try{
    if(!expr.trim()||!/^[0-9+\-*/.%()\s]+$/.test(expr))throw new Error('bad');
    // eslint-disable-next-line no-new-func
    const v=Function(`"use strict";return (${expr})`)();
    if(!isFinite(v))throw new Error('bad');
    setResult(String(Math.round(v*10000)/10000));
   }catch{setResult('خطأ في العملية')}
   return;
  }
  setResult('');setExpr(x=>x+k);
 };
 const keys=['7','8','9','/','4','5','6','*','1','2','3','-','0','.','%','+'];
 return <Modal title="آلة حاسبة" close={()=>p.setModal(null)}><div className="space">
  <div className="calcScreen"><div className="calcExpr">{expr||'0'}</div><div className="calcResult">{result}</div></div>
  <div className="calcGrid">{keys.map(k=><button type="button" key={k} className="btn secondary" onClick={()=>press(k)}>{k}</button>)}</div>
  <div className="actions"><button type="button" className="btn secondary" onClick={()=>press('DEL')}>⌫ حذف</button><button type="button" className="btn secondary" onClick={()=>press('C')}>مسح الكل</button><button type="button" className="btn" onClick={()=>press('=')}>=</button></div>
 </div></Modal>;
}

export function QuickGrades(p){
 const exams=[...p.data.exams].filter(active).sort((a,b)=>new Date(b.date)-new Date(a.date));
 return <Modal title="رصد درجات سريع" close={()=>p.setModal(null)}><div className="space">
  <p className="hint">اختر امتحانًا لفتح قائمة طلابه ورصد درجاتهم مباشرة.</p>
  <div className="list">{exams.map(e=><Row key={e.id} title={e.title} sub={`${fmtDate(e.date)} • من ${e.maxScore}`} action={<button className="btn" onClick={()=>{p.setSelected(e);p.setModal('examView')}}>فتح</button>}/>)}</div>
  {!exams.length&&<Empty text="لا توجد امتحانات — أضف امتحانًا أولًا"/>}
  <button type="button" className="btn secondary wide" onClick={()=>{p.setSelected(null);p.setModal('exam')}}>+ امتحان جديد</button>
 </div></Modal>;
}

export function QuickBooks(p){
 const books=p.data.books.filter(active);
 return <Modal title="تسليم كتاب سريع" close={()=>p.setModal(null)}><div className="space">
  <p className="hint">اختر كتابًا لفتح شاشة تسليمه وربطه بالطالب والسعر مباشرة.</p>
  <div className="list">{books.map(b=><Row key={b.id} title={b.title} sub={`${money(b.price)} • مخزون متاح: ${b.stock||0}`} action={<button className="btn" onClick={()=>{p.setSelected(b);p.setModal('bookView')}}>فتح</button>}/>)}</div>
  {!books.length&&<Empty text="لا توجد كتب — أضف كتابًا أولًا"/>}
  <button type="button" className="btn secondary wide" onClick={()=>{p.setSelected(null);p.setModal('book')}}>+ كتاب جديد</button>
 </div></Modal>;
}

export function QuickSubscriptions(p){
 const due=p.students.filter(s=>p.due(s)>0).sort((a,b)=>p.due(b)-p.due(a));
 return <Modal title="الاشتراكات الشهرية — تسديد سريع" close={()=>p.setModal(null)}><div className="space">
  <p className="hint">قائمة الطلاب اللي عليهم مستحقات — اضغط تسديد لفتح شاشة الدفع لهذا الطالب مباشرة.</p>
  <div className="list">{due.map(s=><Row key={s.id} title={s.name} sub={`${p.groupBy(s.groupId)?.name||'بدون مجموعة'} • متبقي ${money(p.due(s))}`} action={<button className="btn" onClick={()=>{p.setSelected(s);p.setModal('payment')}}>تسديد</button>}/>)}</div>
  {!due.length&&<Empty text="لا توجد متأخرات — كل الطلاب مسددين"/>}
 </div></Modal>;
}
