import React,{useCallback,useEffect,useState} from 'react';
import * as I from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {today,mins,money,fmtDate,uid2} from '../utils/format.js';
import {isActive as active} from '../db.js';
import {openSession,completeSession,sessionSummary} from '../engines/session/engine.js';
import {allocatePayment} from '../engines/finance/ledger.js';
import {student360 as buildStudent360} from '../engines/students/engine.js';
import {examStats} from '../engines/exams/engine.js';
import {inventory as bookInventory} from '../engines/books/engine.js';
import {ensureAttendance as ensureSessionAttendance,stats as attendanceStats} from '../engines/attendance/engine.js';
import {scanGENIUSID,isScannerSupported,stopScanner} from '../services/scanner/nativeScanner.js';
import {shareText,shareImageDataUrl,pickContact} from '../native.js';
import {validStudent,uniqueCodes} from '../services/validation.js';
import {Screen,Section,Card,Row,Stat,Badge,Empty,Modal,Field} from '../components/ui.jsx';

export const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

function svgToPngDataUrl(svgEl,scale=3){
  return new Promise((resolve,reject)=>{
    try{
      const xml=new XMLSerializer().serializeToString(svgEl);
      const svg64=btoa(unescape(encodeURIComponent(xml)));
      const img=new Image();
      img.onload=()=>{
        const w=(svgEl.viewBox?.baseVal?.width)||svgEl.clientWidth||300;
        const h=(svgEl.viewBox?.baseVal?.height)||svgEl.clientHeight||120;
        const canvas=document.createElement('canvas');
        canvas.width=w*scale;canvas.height=h*scale;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror=reject;
      img.src=`data:image/svg+xml;base64,${svg64}`;
    }catch(e){reject(e)}
  });
}

/* تنبيه الحضور الموحّد: نفس الرسالة أيًا كان منفذ التسجيل (يدوي / سكانر / بحث بالاسم) */
export function buildWelcome(p,s){
 const lines=[`أهلاً ${s.name} 👋`];
 const dueAmt=p.due(s);
 if(dueAmt>0)lines.push(`⚠️ متأخرات: ${money(dueAmt)}`);
 const bookPending=(p.data.studentBooks||[]).some(x=>active(x)&&x.studentId===s.id&&/غير مدفوع|لم يستلم/.test(x.status));
 if(bookPending)lines.push('📘 عليه مذكرة غير مسددة أو غير مستلمة');
 if(s.level&&/يحتاج متابعة/.test(s.level))lines.push(`📉 المستوى: ${s.level}`);
 const rate=p.attendanceRate(s);
 if(rate<75)lines.push(`📅 نسبة حضوره العامة: ${rate}%`);
 return lines.join('\n');
}
export async function markAttendance(p,session,s,status){
 const id=`${session.id}_${s.id}`;
 await p.write('attendance',{id,sessionId:session.id,studentId:s.id,status,billable:status!=='غائب',time:new Date().toISOString(),academicYearId:session.academicYearId},'تسجيل حضور');
 await p.buzz();
 if(status==='غائب')p.notify(`غائب — ${s.name}`);
 else p.notify(buildWelcome(p,s));
}

export function AttendanceModal(p){
 const groupStudents=p.students.filter(s=>s.groupId===p.session.groupId&&s.status==='نشط');
 const attendanceRows=p.data.attendance.filter(x=>active(x)&&x.sessionId===p.session.id);
 const attendanceSummary=attendanceStats(attendanceRows);
 const [code,setCode]=useState('');const [suggestions,setSuggestions]=useState([]);const [tab,setTab]=useState('attendance');
 const mark=(s,status)=>markAttendance(p,p.session,s,status);
 const doSearch=v=>{setCode(v);const q=v.trim();if(!q){setSuggestions([]);return}const exact=groupStudents.find(x=>x.code===q);if(exact){mark(exact,'حاضر');setCode('');setSuggestions([]);return}setSuggestions(groupStudents.filter(x=>x.name.includes(q)).slice(0,5))};
 const pickSuggestion=s=>{mark(s,'حاضر');setCode('');setSuggestions([])};
 const scan=()=>{p.setScanSession(p.session);p.setModal('scan')};
 const lifecycle=async next=>{if(next==='OPEN'){for(const row of ensureSessionAttendance(p.data,p.session))await p.write('attendance',row,'تهيئة حضور الحصة')}const updated=next==='OPEN'?openSession(p.session):completeSession(p.session);await p.write('sessions',updated,next==='OPEN'?'فتح الحصة':'إنهاء الحصة');p.setSelected(updated);p.notify(next==='OPEN'?'تم فتح الحصة':'تم إنهاء الحصة')};
 const summary=sessionSummary(p.data,p.session.id);
 const recLevels=p.dict('recitationLevels');
 const setRecitation=async(s,level)=>{await p.write('recitations',{id:`${p.session.id}_${s.id}`,sessionId:p.session.id,studentId:s.id,groupId:p.session.groupId,date:p.session.date,level,academicYearId:p.session.academicYearId},'تسجيل تسميع');p.notify(`تسميع ${s.name}: ${level}`)};
 return <Modal title={`حصة — ${p.groupBy(p.session.groupId)?.name||''}`} close={()=>p.setModal(null)}>
  <div className="between"><span className="badge">{p.session.status||'UPCOMING'}</span><div className="actions">{p.session.status!=='OPEN'&&p.session.status!=='COMPLETED'&&<button className="btn" onClick={()=>lifecycle('OPEN')}>فتح الحصة</button>}{p.session.status==='OPEN'&&<button className="btn secondary" onClick={()=>lifecycle('COMPLETED')}>إنهاء الحصة</button>}</div></div>
  <div className="tabs"><button className={tab==='attendance'?'active':''} onClick={()=>setTab('attendance')}>الحضور</button><button className={tab==='recitation'?'active':''} onClick={()=>setTab('recitation')}>التسميع</button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')}>بيانات</button><button className={tab==='grades'?'active':''} onClick={()=>setTab('grades')}>الدرجات</button></div>
  {tab==='attendance'&&<>
   <div className="actions"><button className="btn" onClick={scan}><I.ScanLine/> Scan ID (مستمر)</button><input className="input codeInput" placeholder="اكتب ID أو اسم الطالب" value={code} onChange={e=>doSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&suggestions.length===1)pickSuggestion(suggestions[0])}}/><button className="btn secondary" onClick={async()=>{for(const s of groupStudents)await mark(s,'حاضر');}}>الكل حاضر</button></div>
   {suggestions.length>0&&<div className="checkList">{suggestions.map(s=><button key={s.id} type="button" className="pill" onClick={()=>pickSuggestion(s)}>{s.name}</button>)}</div>}
   <div className="list">{groupStudents.map(s=>{const a=p.data.attendance.find(x=>active(x)&&x.id===`${p.session.id}_${s.id}`);return <div className="rowItem" key={s.id}><div><b>{s.name}</b><small>{s.code} • {a?.status||'لم يسجل'}</small></div><div className="attendanceActions"><button className={a?.status==='حاضر'?'pill activePill':'pill'} onClick={()=>mark(s,'حاضر')}>حاضر</button><button className={a?.status==='متأخر'?'pill activePill':'pill'} onClick={()=>mark(s,'متأخر')}>متأخر</button><button className={a?.status==='غائب'?'pill activePill':'pill'} onClick={()=>mark(s,'غائب')}>غائب</button></div></div>})}</div>
  </>}
  {tab==='recitation'&&<div className="list">{groupStudents.map(s=>{const r=p.data.recitations?.find(x=>active(x)&&x.id===`${p.session.id}_${s.id}`);return <div className="rowItem" key={s.id}><div><b>{s.name}</b><small>{r?.level||'لم يُسجّل تسميع'}</small></div><select className="input smallInput" value={r?.level||''} onChange={e=>setRecitation(s,e.target.value)}><option value="">—</option>{recLevels.map(l=><option key={l}>{l}</option>)}</select></div>})}</div>}
  {tab==='data'&&<div className="stats"><Stat n={groupStudents.length} l="إجمالي"/><Stat n={groupStudents.filter(s=>p.data.attendance.find(a=>active(a)&&a.id===`${p.session.id}_${s.id}`&&a.status!=='غائب')).length} l="حاضر"/><Stat n={groupStudents.filter(s=>p.data.attendance.find(a=>active(a)&&a.id===`${p.session.id}_${s.id}`&&a.status==='غائب')).length} l="غائب"/><Stat n={money(summary.collection)} l="تحصيل الحصة"/><Stat n={`${attendanceSummary.rate}%`} l="النسبة"/></div>}
  {tab==='grades'&&<p className="hint">لإدارة درجات الامتحانات افتح شاشة الامتحانات؛ الدرجة تحفظ تلقائيًا في سجل كل طالب.</p>}
 </Modal>;
}


export function Scanner(p){
 const session=p.scanSession;
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(session?'جاهز لمسح الطالب التالي':'جاهز للمسح بالكاميرا');
 const handleFound=useCallback(async value=>{
  const v=String(value||'').trim();
  if(!v)return;
  const s=p.students.find(x=>x.code===v);
  if(!s){setMsg('الكود غير معروف');return}
  if(session){await markAttendance(p,session,s,'حاضر');setMsg(`${s.name} — تم تسجيل الحضور، جاهز للطالب التالي`);return}
  p.setSelected(s);p.setModal('card');
 },[p,session]);
 const nativeScan=async()=>{
  setBusy(true);
  try{
   const supported=await isScannerSupported();
   if(!supported){setMsg('الماسح الأصلي غير مدعوم على هذا الجهاز');return}
   const value=await scanGENIUSID();
   if(value){await handleFound(value);if(session)setTimeout(nativeScan,600)}
   else setMsg('لم يتم العثور على كود')
  }catch(e){console.error(e);setMsg('تعذر تشغيل الكاميرا — تأكد من صلاحية الكاميرا')}
  finally{setBusy(false)}
 };
 const back=()=>{stopScanner();if(session){p.setSelected(session);p.setModal('attendance');p.setScanSession(null)}else p.setModal(null)};
 return <Modal title={session?'مسح الحضور المستمر':'GENIUS Scanner'} close={back}>
  <div className="scanner"><div className="scanFrame"><I.ScanLine size={46}/></div><small>{msg}</small></div>
  <button className="btn wide" disabled={busy} onClick={nativeScan}><I.Camera/> {busy?'جاري المسح...':'فتح الكاميرا والمسح'}</button>
  <input className="input" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){handleFound(code);setCode('')}}} placeholder="أو أدخل GENIUS ID يدويًا"/>
  <button className="btn secondary wide" onClick={()=>{handleFound(code);setCode('')}}>{session?'تسجيل الحضور':'فتح الطالب'}</button>
  {session&&<button className="btn secondary wide" onClick={back}>إنهاء المسح والعودة للحصة</button>}
 </Modal>
}

export function Student360(p){
 const profile=buildStudent360(p.data,p.student.id);
 const s=profile?.student||p.student;
 const grades=profile?.grades||[];
 const att=profile?.attendance||[];
 const payments=profile?.payments||[];
 const books=profile?.books||[];
 const [addExamId,setAddExamId]=useState('');
 const [editingPaymentId,setEditingPaymentId]=useState(null);
 const [editDraft,setEditDraft]=useState({});
 const availableExams=p.data.exams.filter(e=>active(e)&&(e.groupIds||[]).includes(s.groupId)&&!grades.some(g=>g.examId===e.id));
 const addGrade=async()=>{
  if(!addExamId)return;
  const exam=p.data.exams.find(e=>e.id===addExamId);
  await p.write('grades',{id:uid2('gr'),examId:addExamId,studentId:s.id,score:'',maxScore:exam?.maxScore||0,academicYearId:p.yearId},'إضافة درجة من الملف');
  setAddExamId('');
 };
 const startEditPayment=x=>{setEditingPaymentId(x.id);setEditDraft({amount:x.amount,date:x.date||today(),method:x.method||'',note:x.note||''})};
 const savePayment=async x=>{
  const n=Number(editDraft.amount);
  if(!n||n<=0)return p.notify('مبلغ غير صحيح');
  await p.write('payments',{...x,amount:n,date:editDraft.date,method:editDraft.method,note:editDraft.note},'تعديل قيد مالي من الملف');
  setEditingPaymentId(null);
 };
 const openBook=book=>{if(!book)return;p.setPresetStudentId(s.id);p.setSelected(book);p.setModal('bookView')};
 return <Modal title={`Student 360 — ${s.name}`} close={()=>p.setModal(null)}>
  <div className="studentHero"><div className="avatar">{s.name?.slice(0,1)}</div><div><h2>{s.name}</h2><small>GENIUS ID: {s.code}</small><p>{p.groupBy(s.groupId)?.name||'بدون مجموعة'} • {s.grade}</p></div></div>
  <div className="actions"><button className="btn" onClick={()=>{p.setSelected(s);p.setModal('student')}}><I.Pencil size={16}/> تعديل بيانات الطالب</button><button className="btn secondary" onClick={()=>{p.setSelected(s);p.setModal('card')}}>بطاقة + QR</button></div>
  <div className="actions"><button className="btn secondary" onClick={()=>{p.setSelected(s);p.setModal('report')}}><I.FileText size={16}/> تقرير مخصص لولي الأمر</button><button className="btn secondary" onClick={()=>window.print()}>طباعة</button></div>
  <div className="stats"><Stat n={`${p.attendanceRate(s)}%`} l="الحضور"/><Stat n={`${p.avg(s)}%`} l="متوسط الدرجات"/><Stat n={money(p.due(s))} l="المتبقي"/><Stat n={payments.filter(x=>x.type==='PAYMENT').length} l="دفعات"/></div>
  <Section title="بيانات الطالب"><div className="detailGrid"><span>ولي الأمر</span><b>{s.parentName||'—'}</b><span>هاتف الطالب</span><b>{s.studentPhone||'—'}</b><span>هاتف ولي الأمر</span><b>{s.parentPhone||'—'}</b><span>المستوى</span><b>{s.level||'—'}</b><span>ملاحظات</span><b>{s.notes||'—'}</b></div></Section>

  <Section title={`الحضور (${att.length}) — قابل للتعديل والحذف`}>
   <div className="list">{att.slice(-12).reverse().map(a=>{const sess=p.data.sessions.find(x=>x.id===a.sessionId);return <div className="rowItem" key={a.id}><div><b>{sess?fmtDate(sess.date):new Date(a.time||Date.now()).toLocaleDateString('ar-EG')}</b><small>{p.groupBy(sess?.groupId)?.name||''} {sess?.timeStart||''}</small></div><div className="attendanceActions"><select className="input smallInput" value={a.status} onChange={e=>p.write('attendance',{...a,status:e.target.value,billable:e.target.value!=='غائب'},'تعديل حضور من الملف')}><option>حاضر</option><option>متأخر</option><option>غائب</option></select><button className="danger" onClick={()=>p.softDelete('attendance',a.id,'حذف سجل حضور من الملف')}>حذف</button></div></div>})}</div>
   {!att.length&&<Empty text="لا يوجد سجل حضور بعد"/>}
  </Section>

  <Section title={`الدرجات (${grades.length}) — قابلة للتعديل والحذف`}>
   <div className="list">{grades.map(g=><div className="gradeRow" key={g.id}><div><b>{p.data.exams.find(e=>e.id===g.examId)?.title||'امتحان'}</b><small>من {g.maxScore}</small></div><div className="attendanceActions"><input className="input gradeInput" inputMode="decimal" type="number" min="0" max={g.maxScore} value={g.score??''} onChange={e=>p.write('grades',{...g,score:e.target.value===''?'':Number(e.target.value)},'تعديل درجة من الملف')}/><button className="danger" onClick={()=>p.softDelete('grades',g.id,'حذف درجة من الملف')}>حذف</button></div></div>)}</div>
   {!grades.length&&<Empty text="لا توجد درجات بعد"/>}
   {availableExams.length>0&&<div className="row"><select className="input" value={addExamId} onChange={e=>setAddExamId(e.target.value)}><option value="">+ اختر امتحانًا لإضافة درجة</option>{availableExams.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select><button className="btn secondary" onClick={addGrade}>إضافة</button></div>}
  </Section>

  <Section title={`المالية (${payments.length}) — تحكم كامل`}>
   <div className="actions"><button className="btn" onClick={()=>p.setModal('payment')}><I.Banknote size={16}/> تسجيل دفعة جديدة</button></div>
   <div className="list">{payments.map(x=>editingPaymentId===x.id?(
    <div className="card" key={x.id}>
     <div className="row">
      <Field label="المبلغ"><input className="input" type="number" value={editDraft.amount} onChange={e=>setEditDraft({...editDraft,amount:e.target.value})}/></Field>
      <Field label="التاريخ"><input className="input" type="date" value={editDraft.date} onChange={e=>setEditDraft({...editDraft,date:e.target.value})}/></Field>
     </div>
     <Field label="طريقة الدفع"><select className="input" value={editDraft.method} onChange={e=>setEditDraft({...editDraft,method:e.target.value})}><option value="">—</option>{p.dict('paymentMethods').map(m=><option key={m}>{m}</option>)}</select></Field>
     <Field label="ملاحظة"><input className="input" value={editDraft.note} onChange={e=>setEditDraft({...editDraft,note:e.target.value})}/></Field>
     <div className="actions"><button className="btn" onClick={()=>savePayment(x)}>حفظ</button><button className="btn secondary" onClick={()=>setEditingPaymentId(null)}>إلغاء</button></div>
    </div>
   ):(
    <div className="rowItem" key={x.id}><div><b>{x.type==='CHARGE'?'مستحق':'دفعة'} — {money(x.amount)}</b><small>{fmtDate(x.date)} • {x.note||x.method||''}</small></div><div className="actions"><button className="btn secondary" onClick={()=>startEditPayment(x)}>تعديل</button><button className="danger" onClick={()=>p.softDelete('payments',x.id,'حذف قيد مالي من الملف')}>حذف</button></div></div>
   ))}</div>
   {!payments.length&&<Empty text="لا يوجد سجل مالي بعد"/>}
  </Section>

  <Section title={`الكتب (${books.length})`}>
   <div className="actions"><button className="btn secondary" onClick={()=>{p.setPresetStudentId(s.id);p.setModal('quickBooks')}}><I.BookOpen size={16}/> إضافة / تسليم كتاب</button></div>
   <div className="list">{books.map(x=>{const book=p.data.books.find(b=>b.id===x.bookId);return <div className="rowItem" key={x.id}><div><b>{book?.title||'كتاب'}</b><small>{x.status}</small></div><button className="btn secondary" onClick={()=>openBook(book)}>تعديل</button></div>})}</div>
   {!books.length&&<Empty text="لا توجد كتب مسجلة بعد"/>}
  </Section>

  <Section title={`التسميع اليومي (${(p.data.recitations||[]).filter(r=>active(r)&&r.studentId===s.id).length})`}>
   <div className="list">{(p.data.recitations||[]).filter(r=>active(r)&&r.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(r=><div className="rowItem" key={r.id}><div><b>{fmtDate(r.date)}</b><small>{p.groupBy(r.groupId)?.name||''}</small></div><select className="input smallInput" value={r.level} onChange={e=>p.write('recitations',{...r,level:e.target.value},'تعديل تسميع من الملف')}><option value="">—</option>{p.dict('recitationLevels').map(l=><option key={l}>{l}</option>)}</select></div>)}</div>
   {!(p.data.recitations||[]).some(r=>active(r)&&r.studentId===s.id)&&<Empty text="لا يوجد سجل تسميع بعد — يُسجَّل من داخل الحصة"/>}
  </Section>

  <Section title="السجل الزمني"><div className="list">{profile.timeline.slice(0,20).map((x,i)=><Row key={x.ref+'_'+i} title={x.label} sub={fmtDate(x.date)}/>)}</div></Section>
 </Modal>;
}


export function ReportForm(p){
  const s=p.selected;const profile=buildStudent360(p.data,s.id);
  const [sec,setSec]=useState({level:true,attendance:true,grades:true,finance:true,books:false,recitation:false});
  const [text,setText]=useState('');
  const fillTpl=t=>t.replace(/\{name\}/g,s.name).replace(/\{code\}/g,s.code).replace(/\{group\}/g,p.groupBy(s.groupId)?.name||'—');
  const build=useCallback(()=>{
    const introTpl=p.settings.reportIntro||'GENIUS BIOLOGY — تقرير الطالب\nالاسم: {name}\nGENIUS ID: {code}\nالمجموعة: {group}';
    const outroTpl=p.settings.reportOutro||'';
    const lines=[fillTpl(introTpl)];
    if(sec.level)lines.push(`المستوى: ${s.level||'—'}`);
    if(sec.attendance){const att=(profile.attendance||[]).slice(-5).reverse();lines.push(`نسبة الحضور: ${p.attendanceRate(s)}%`,`آخر الحضور: ${att.length?att.map(a=>`${a.status} (${fmtDate(a.date)})`).join('، '):'—'}`)}
    if(sec.grades){const gr=(profile.grades||[]).slice(-5).reverse();lines.push(`متوسط الدرجات: ${p.avg(s)}%`,`آخر الامتحانات: ${gr.length?gr.map(g=>`${p.data.exams.find(e=>e.id===g.examId)?.title||'امتحان'}: ${g.score}/${g.maxScore}`).join('، '):'—'}`)}
    if(sec.finance){const pay=(profile.payments||[]).filter(x=>x.type==='PAYMENT').slice(-5).reverse();lines.push(`المتبقي: ${money(p.due(s))}`,`آخر الدفعات: ${pay.length?pay.map(x=>`${money(x.amount)} (${fmtDate(x.date)})`).join('، '):'—'}`)}
    if(sec.books){const bk=profile.books||[];lines.push(`الكتب: ${bk.length?bk.map(x=>`${p.data.books.find(b=>b.id===x.bookId)?.title||'كتاب'} — ${x.status}`).join('، '):'—'}`)}
    if(sec.recitation){const rec=(p.data.recitations||[]).filter(x=>active(x)&&x.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);lines.push(`آخر التسميع: ${rec.length?rec.map(r=>`${r.level||'—'} (${fmtDate(r.date)})`).join('، '):'—'}`)}
    if(outroTpl)lines.push(fillTpl(outroTpl));
    return lines.join('\n');
  },[s,p,profile,sec]);
  useEffect(()=>{setText(build())},[sec]);
  const opts=[['level','المستوى'],['attendance','الحضور'],['grades','الدرجات'],['finance','المدفوعات'],['books','الكتب'],['recitation','التسميع']];
  return <Modal title={`تقرير — ${s.name}`} close={()=>p.setModal(null)}>
    <div className="space">
      <div className="reportSections">{opts.map(([k,l])=><label className="check" key={k}><input type="checkbox" checked={sec[k]} onChange={e=>setSec({...sec,[k]:e.target.checked})}/>{l}</label>)}</div>
      <Field label="نص الرسالة (قابل للتعديل قبل الإرسال)">
        <textarea className="input textarea reportPreview" value={text} onChange={e=>setText(e.target.value)}/>
      </Field>
      <p className="hint">المقدمة والخاتمة تُضبط مرة واحدة من الإعدادات → "صيغة التقرير" وتتطبق تلقائيًا على كل الطلاب.</p>
      <div className="actions">
        <button className="btn" onClick={()=>p.whatsapp(s.parentPhone,text)}><I.MessageCircle size={16}/> إرسال واتساب</button>
        <button className="btn secondary" onClick={()=>{navigator.clipboard?.writeText(text);p.notify('تم نسخ التقرير')}}>نسخ</button>
        <button className="btn secondary" onClick={()=>setText(build())}>إعادة التوليد</button>
      </div>
    </div>
  </Modal>;
}

export function StudentCard(p){const s=p.student;const tpl=p.settings?.cardTemplate||'classic';const [qr,setQr]=useState('');const barRef=React.useRef(null);useEffect(()=>{QRCode.toDataURL(JSON.stringify({geniusId:s.code,name:s.name,groupId:s.groupId}),{width:260,margin:1,errorCorrectionLevel:'M'}).then(setQr);if(barRef.current){try{JsBarcode(barRef.current,s.code,{format:'CODE128',displayValue:true,height:52,width:2,margin:8,fontSize:14})}catch{}}},[s]);const text=`GENIUS BIOLOGY\n${s.name}\nGENIUS ID: ${s.code}\nالمجموعة: ${p.groupBy(s.groupId)?.name||'—'}`;const shareQr=async()=>{if(!qr)return;const ok=await shareImageDataUrl(qr,`GENIUS_${s.code}_QR.png`,`بطاقة ${s.name}`);if(ok)p.notify('تم فتح مشاركة صورة QR');else p.notify('تعذرت مشاركة الصورة — جرّب لقطة شاشة')};const shareBarcode=async()=>{if(!barRef.current)return;try{const png=await svgToPngDataUrl(barRef.current);const ok=await shareImageDataUrl(png,`GENIUS_${s.code}_BARCODE.png`,`باركود ${s.name}`);if(ok)p.notify('تم فتح مشاركة صورة الباركود');else p.notify('تعذرت مشاركة الصورة')}catch{p.notify('تعذرت مشاركة الصورة')}};return <Modal title="بطاقة GENIUS ID" close={()=>p.setModal(null)}><div className={`studentCard tpl-${tpl}`}><div className="cardBrand">GENIUS BIOLOGY <span>GENIUS ADMIN • STUDENT ID</span></div><h2>{s.name}</h2><div className="idBig">{s.code}</div><p>{p.groupBy(s.groupId)?.name||'—'} • {s.grade||'—'}</p>{qr&&<img src={qr} alt="GENIUS QR"/>}<svg ref={barRef} aria-label={`Barcode ${s.code}`}></svg><small>QR وCode 128 مرتبطان بـ GENIUS ID فقط</small></div><div className="actions"><button className="btn" onClick={shareQr}><I.QrCode size={16}/> مشاركة صورة QR</button><button className="btn secondary" onClick={shareBarcode}><I.Barcode size={16}/> مشاركة صورة الباركود</button></div><div className="actions"><button className="btn secondary" onClick={async()=>{const ok=await shareText('GENIUS ID',text);if(!ok){await navigator.clipboard?.writeText(text);p.notify('تم نسخ بيانات البطاقة')}}}>مشاركة النص</button><button className="btn secondary" onClick={()=>{navigator.clipboard?.writeText(s.code);p.notify('تم نسخ ID')}}>نسخ ID</button><button className="btn secondary" onClick={()=>p.whatsapp(s.parentPhone,text)}>WhatsApp</button><button className="btn secondary" onClick={()=>window.print()}>طباعة</button></div></Modal>}


export function StudentForm(p){const old=p.selected;const [f,setF]=useState(old||{id:uid2('st'),code:'',name:'',grade:p.dict('grades')[0]||'',academicYearId:p.yearId,groupId:p.presetGroupId||p.groups[0]?.id||'',branchId:p.branchId==='ALL'?p.groups[0]?.branchId||'':p.branchId,status:'نشط',studentPhone:'',parentName:'',parentPhone:'',joinDate:today(),price:0,discountType:'NONE',discountValue:0,level:p.dict('levels')[0]||'',notes:''});useEffect(()=>{if(!f.code&&!old){const y=p.data.academicYears.find(x=>x.id===p.yearId);const nums=p.students.map(s=>Number(String(s.code).replace(/\D/g,''))||0);const max=Math.max(0,...nums);const g=p.groupBy(f.groupId);setF(x=>({...x,code:`${y?.shortCode||'27'}${String(max+1).slice(-4).padStart(4,'0')}`,price:x.price||g?.price||0}))}},[f.code,old,p.data.academicYears,p.yearId,p.students]);
 const contactSupported=typeof navigator!=='undefined'&&'contacts'in navigator&&'ContactsManager'in window;
 const presets=p.dict('discountPresets');
 const [customPercent,setCustomPercent]=useState(!presets.includes(String(f.discountValue))&&f.discountType==='PERCENT');
 const pickStudentPhone=async()=>{const c=await pickContact();if(!c)return p.notify(contactSupported?'لم يتم اختيار جهة اتصال':'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');setF(x=>({...x,studentPhone:c.tel||x.studentPhone}))};
 const pickParentPhone=async()=>{const c=await pickContact();if(!c)return p.notify(contactSupported?'لم يتم اختيار جهة اتصال':'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');setF(x=>({...x,parentPhone:c.tel||x.parentPhone,parentName:x.parentName||c.name||x.parentName}))};
 return <Modal title={old?'تعديل الطالب':'إضافة طالب'} close={()=>p.setModal(null)}><form className="space" onSubmit={async e=>{e.preventDefault();if(!f.name.trim()||!f.code)return p.notify('أكمل الاسم وGENIUS ID');if(p.data.students.some(s=>active(s)&&s.code===f.code&&s.id!==f.id))return p.notify('GENIUS ID مستخدم بالفعل');const g=p.groupBy(f.groupId);const row={...f,price:Number(f.price||g?.price||0),discountValue:Number(f.discountValue||0),branchId:f.branchId||g?.branchId,academicYearId:f.academicYearId||g?.academicYearId};if(uniqueCodes([...p.data.students.filter(s=>active(s)&&s.id!==f.id),row]).length)return p.notify('يوجد GENIUS ID مكرر — اختر ID مختلفًا');if(!validStudent(row))return p.notify('بيانات الطالب غير مكتملة: الاسم + ID + السنة + المجموعة مطلوبة');await p.write('students',row,old?'تعديل طالب':'إضافة طالب');p.setModal(null);p.notify('تم حفظ الطالب')}}>
 <div className="formGrid">
  <Field label="اسم الطالب" required><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="مثال: أحمد محمد"/></Field>
  <Field label="GENIUS ID" required hint="يُنشأ تلقائيًا ولا يمكن تعديله يدويًا"><input className="input" value={f.code} readOnly disabled placeholder="270001"/></Field>
  <Field label="المجموعة"><select className="input" value={f.groupId} onChange={e=>{const g=p.groupBy(e.target.value);setF({...f,groupId:e.target.value,branchId:g?.branchId||f.branchId,academicYearId:g?.academicYearId||f.academicYearId,price:g?.price??f.price})}}><option value="">بدون مجموعة</option>{p.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
  <Field label="الصف الدراسي"><select className="input" value={f.grade} onChange={e=>setF({...f,grade:e.target.value})}>{p.dict('grades').map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="هاتف الطالب" hint="اضغط على الأيقونة لاختيار الرقم من جهات الاتصال إن توفرت">
   <div className="phoneRow"><input className="input" type="tel" value={f.studentPhone} onChange={e=>setF({...f,studentPhone:e.target.value})} placeholder="01xxxxxxxxx"/><button type="button" className="pickBtn" onClick={pickStudentPhone} aria-label="اختيار من جهات الاتصال"><I.Contact size={18}/></button></div>
  </Field>
  <Field label="اسم ولي الأمر"><input className="input" value={f.parentName} onChange={e=>setF({...f,parentName:e.target.value})} placeholder="مثال: محمد علي"/></Field>
  <Field label="هاتف ولي الأمر" hint="اضغط على الأيقونة لاختيار الرقم من جهات الاتصال إن توفرت">
   <div className="phoneRow"><input className="input" type="tel" value={f.parentPhone} onChange={e=>setF({...f,parentPhone:e.target.value})} placeholder="01xxxxxxxxx"/><button type="button" className="pickBtn" onClick={pickParentPhone} aria-label="اختيار من جهات الاتصال"><I.Contact size={18}/></button></div>
  </Field>
  <Field label="تاريخ الالتحاق"><input className="input" type="date" value={f.joinDate} onChange={e=>setF({...f,joinDate:e.target.value})}/></Field>
  <Field label="المستوى"><select className="input" value={f.level} onChange={e=>setF({...f,level:e.target.value})}>{p.dict('levels').map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="السعر (بالجنيه)" hint="يُجلب تلقائيًا من المجموعة، وقابل للتعديل لهذا الطالب فقط"><input className="input" type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} placeholder="0"/></Field>
  <Field label="نوع الخصم"><select className="input" value={f.discountType} onChange={e=>{const v=e.target.value;setCustomPercent(false);setF({...f,discountType:v,discountValue:v==='NONE'?0:f.discountValue})}}><option value="NONE">بدون خصم</option><option value="PERCENT">خصم نسبة %</option><option value="FIXED">خصم مبلغ ثابت</option></select></Field>
  {f.discountType==='PERCENT'&&!customPercent&&<Field label="نسبة الخصم"><select className="input" value={presets.includes(String(f.discountValue))?String(f.discountValue):''} onChange={e=>{if(e.target.value==='CUSTOM'){setCustomPercent(true);return}setF({...f,discountValue:Number(e.target.value)})}}><option value="">اختر نسبة</option>{presets.map(x=><option key={x} value={x}>{x==='100'?'إعفاء كامل (100%)':`${x}%`}</option>)}<option value="CUSTOM">نسبة أخرى...</option></select></Field>}
  {f.discountType==='PERCENT'&&customPercent&&<Field label="نسبة خصم مخصصة %"><input className="input" type="number" min="0" max="100" value={f.discountValue} onChange={e=>setF({...f,discountValue:e.target.value})} placeholder="0"/></Field>}
  {f.discountType==='FIXED'&&<Field label="قيمة الخصم (بالجنيه)"><input className="input" type="number" value={f.discountValue} onChange={e=>setF({...f,discountValue:e.target.value})} placeholder="0"/></Field>}
 </div>
 <Field label="ملاحظات الطالب"><textarea className="input textarea" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} placeholder="أي ملاحظات إضافية عن الطالب"/></Field>
 <button className="btn wide" type="submit">حفظ البيانات</button>{old&&<button type="button" className="btn dangerBtn wide" onClick={()=>p.softDelete('students',old.id,'أرشفة طالب').then(()=>p.setModal(null))}>أرشفة الطالب</button>}</form></Modal>}


export function GroupForm(p){const old=p.selected;const [f,setF]=useState(old||{id:uid2('g'),code:'',name:'',branchId:p.data.branches[0]?.id||'',academicYearId:p.yearId,grade:p.dict('grades')[0]||'',subject:p.data.settings[0]?.subject||'الأحياء',type:p.dict('groupTypes')[0]||'',status:'ACTIVE',maxStudents:50,pricingModel:'MONTHLY',price:350,whatsapp1:'',whatsapp2:'',schedule:[]});const add=()=>setF(x=>({...x,schedule:[...(x.schedule||[]),{day:'الأحد',start:'17:00',end:'18:30'}]}));return <Modal title={old?'تعديل المجموعة':'إضافة مجموعة'} close={()=>p.setModal(null)}><form className="space" onSubmit={async e=>{e.preventDefault();if(!f.name)return p.notify('أدخل اسم المجموعة');await p.write('groups',{...f,maxStudents:Number(f.maxStudents),price:Number(f.price)},old?'تعديل مجموعة':'إضافة مجموعة');p.setModal(null);p.notify('تم حفظ المجموعة')}}>
 <div className="formGrid">
  <Field label="اسم المجموعة" required><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="مثال: 3 ث سمنود 1"/></Field>
  <Field label="كود المجموعة"><input className="input" value={f.code} onChange={e=>setF({...f,code:e.target.value})} placeholder="اختياري"/></Field>
  <Field label="الفرع"><select className="input" value={f.branchId} onChange={e=>setF({...f,branchId:e.target.value})}>{p.data.branches.filter(active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
  <Field label="الصف الدراسي"><select className="input" value={f.grade} onChange={e=>setF({...f,grade:e.target.value})}>{p.dict('grades').map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="نوع المجموعة"><select className="input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{p.dict('groupTypes').map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="نظام التسعير"><select className="input" value={f.pricingModel} onChange={e=>setF({...f,pricingModel:e.target.value})}><option value="MONTHLY">شهري</option><option value="PER_SESSION">بالحصة</option></select></Field>
  <Field label="السعر (بالجنيه)"><input className="input" type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} placeholder="350"/></Field>
  <Field label="الحد الأقصى لعدد الطلاب"><input className="input" type="number" value={f.maxStudents} onChange={e=>setF({...f,maxStudents:e.target.value})} placeholder="50"/></Field>
  <Field label="واتساب المجموعة 1"><input className="input" type="tel" value={f.whatsapp1} onChange={e=>setF({...f,whatsapp1:e.target.value})} placeholder="01xxxxxxxxx"/></Field>
  <Field label="واتساب المجموعة 2"><input className="input" type="tel" value={f.whatsapp2} onChange={e=>setF({...f,whatsapp2:e.target.value})} placeholder="اختياري"/></Field>
 </div>
 <Section title="مواعيد المجموعة">
  <div className="space">{(f.schedule||[]).map((s,i)=><div className="scheduleEdit" key={i}><select className="input" value={s.day} onChange={e=>{const a=[...f.schedule];a[i]={...a[i],day:e.target.value};setF({...f,schedule:a})}}>{DAYS.map(x=><option key={x}>{x}</option>)}</select><input className="input" type="time" value={s.start} onChange={e=>{const a=[...f.schedule];a[i]={...a[i],start:e.target.value};setF({...f,schedule:a})}}/><input className="input" type="time" value={s.end} onChange={e=>{const a=[...f.schedule];a[i]={...a[i],end:e.target.value};setF({...f,schedule:a})}}/><button type="button" className="danger" onClick={()=>setF({...f,schedule:f.schedule.filter((_,j)=>j!==i)})}>حذف</button></div>)}</div>
  <button type="button" className="btn secondary" onClick={add}>+ إضافة موعد</button>
 </Section>
 <button className="btn wide" type="submit">حفظ المجموعة</button>{old&&<button type="button" className="btn dangerBtn wide" onClick={()=>p.softDelete('groups',old.id,'أرشفة مجموعة').then(()=>p.setModal(null))}>أرشفة المجموعة</button>}</form></Modal>}


export function GroupView(p){
 const g=p.selected;
 const members=p.students.filter(s=>s.groupId===g.id&&s.status==='نشط');
 const attendanceAvg=members.length?Math.round(members.reduce((a,s)=>a+p.attendanceRate(s),0)/members.length):0;
 const unpaidCount=members.filter(s=>p.due(s)>0).length;
 const month=today().slice(0,7);
 const collectedThisMonth=p.data.payments.filter(x=>active(x)&&x.type==='PAYMENT'&&String(x.date||'').startsWith(month)&&members.some(s=>s.id===x.studentId)).reduce((a,x)=>a+Number(x.amount||0),0);
 const punctuality=s=>{
  if(p.due(s)>0)return {label:'متأخر',cls:'dangerBtn'};
  const paidThisMonth=p.data.payments.filter(x=>active(x)&&x.type==='PAYMENT'&&x.studentId===s.id&&String(x.date||'').startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(paidThisMonth&&Number(paidThisMonth.date.slice(-2))<=10)return {label:'مقدم',cls:''};
  return {label:'منتظم',cls:''};
 };
 const groupExams=p.data.exams.filter(x=>active(x)&&(x.groupIds||[]).includes(g.id));
 const openAttendance=async()=>{
  let s=p.data.sessions.find(x=>active(x)&&x.groupId===g.id&&x.date===today());
  if(!s){
   s={id:uid2('ses'),groupId:g.id,academicYearId:g.academicYearId||p.yearId,date:today(),day:new Date().toLocaleDateString('ar-EG',{weekday:'long'}),timeStart:g.schedule?.[0]?.start||'17:00',timeEnd:g.schedule?.[0]?.end||'18:30',status:'UPCOMING'};
   await p.write('sessions',s,'إنشاء حصة سريعة للحضور');
  }
  p.setSelected(s);p.setModal('attendance');
 };
 const bulkReport=()=>{
  const target=g.whatsapp1||g.whatsapp2;
  if(!target)return p.notify('لا يوجد رقم واتساب مسجل لهذه المجموعة — أضفه من تعديل المجموعة');
  const text=`GENIUS BIOLOGY — تقرير مجموعة ${g.name}\nعدد الطلاب: ${members.length}\nمتوسط الحضور: ${attendanceAvg}%\nالمحصّل هذا الشهر: ${money(collectedThisMonth)}\nعدد المتأخرين في السداد: ${unpaidCount}`;
  p.whatsapp(target,text);
 };
 return <Modal title={`إدارة المجموعة — ${g.name}`} close={()=>p.setModal(null)}>
  <div className="between"><Badge t={g.status==='ACTIVE'?'نشطة':'موقوفة'}/><button className="btn secondary" onClick={()=>p.write('groups',{...g,status:g.status==='ACTIVE'?'INACTIVE':'ACTIVE'},'تغيير حالة المجموعة')}>{g.status==='ACTIVE'?'إيقاف المجموعة':'تفعيل المجموعة'}</button></div>
  <p className="hint">{(g.schedule||[]).map(x=>`${x.day} ${x.start}–${x.end}`).join(' • ')||'لا توجد مواعيد مسجلة'}</p>
  <div className="stats"><Stat n={members.length} l="إجمالي الطلاب"/><Stat n={`${attendanceAvg}%`} l="متوسط الحضور"/><Stat n={money(collectedThisMonth)} l="محصّل هذا الشهر"/><Stat n={unpaidCount} l="متأخرين بالسداد"/></div>
  <Section title="إجراءات سريعة">
   <div className="quick">
    <button onClick={()=>{p.setPresetGroupId(g.id);p.setSelected(null);p.setModal('student')}}><I.UserPlus/><span>طالب جديد</span></button>
    <button onClick={openAttendance}><I.QrCode/><span>حضور المجموعة</span></button>
    <button onClick={()=>{if(groupExams[0]){p.setSelected(groupExams[0]);p.setModal('examView')}else{p.setSelected(null);p.setModal('exam')}}}><I.GraduationCap/><span>درجات المجموعة</span></button>
    <button onClick={bulkReport}><I.MessageCircle/><span>تقرير جماعي</span></button>
   </div>
  </Section>
  <Section title="تعديل بيانات المجموعة">
   <div className="actions"><button className="btn secondary wide" onClick={()=>p.setModal('group')}><I.Pencil size={16}/> تعديل الاسم / السعر / المواعيد</button></div>
  </Section>
  {groupExams.length>0&&<Section title="امتحانات المجموعة"><div className="list">{groupExams.map(e=><Row key={e.id} title={e.title} sub={`${fmtDate(e.date)} • من ${e.maxScore}`} action={<button className="btn secondary" onClick={()=>{p.setSelected(e);p.setModal('examView')}}>فتح</button>}/>)}</div></Section>}
  <Section title={`طلاب المجموعة (${members.length})`}>
   <div className="list">{members.map(s=>{const pt=punctuality(s);return <div className="rowItem" key={s.id}><div><b>{s.name}</b><small>{s.code} • حضور {p.attendanceRate(s)}% • متبقي {money(p.due(s))}</small></div><div className="attendanceActions"><span className={`pill ${pt.cls?'activePill':''}`}>{pt.label}</span><button className="btn secondary" onClick={()=>{p.setSelected(s);p.setModal('report')}}>تقرير</button></div></div>})}</div>
   {!members.length&&<Empty text="لا يوجد طلاب نشطين في هذه المجموعة"/>}
  </Section>
 </Modal>;
}


export function SessionForm(p){const old=p.selected;const [f,setF]=useState(old||{id:uid2('ses'),groupId:p.groups[0]?.id||'',date:today(),timeStart:'17:00',timeEnd:'18:30',status:'UPCOMING'});return <Modal title={old?'تعديل الحصة':'إضافة حصة'} close={()=>p.setModal(null)}><form className="space" onSubmit={async e=>{e.preventDefault();if(mins(f.timeEnd)<=mins(f.timeStart))return p.notify('وقت النهاية غير صحيح');const group=p.groupBy(f.groupId);await p.write('sessions',{...f,day:new Date(`${f.date}T00:00:00`).toLocaleDateString('ar-EG',{weekday:'long'}),academicYearId:group?.academicYearId||p.yearId},old?'تعديل حصة':'إضافة حصة');p.setModal(null);p.notify('تم حفظ الحصة')}}>
 <Field label="المجموعة" required><select className="input" value={f.groupId} onChange={e=>setF({...f,groupId:e.target.value})}>{p.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
 <Field label="تاريخ الحصة" required><input className="input" type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
 <div className="row">
  <Field label="وقت البداية"><input className="input" type="time" value={f.timeStart} onChange={e=>setF({...f,timeStart:e.target.value})}/></Field>
  <Field label="وقت النهاية"><input className="input" type="time" value={f.timeEnd} onChange={e=>setF({...f,timeEnd:e.target.value})}/></Field>
 </div>
 <button className="btn wide">حفظ الحصة</button></form></Modal>}


export function PaymentForm(p){const [f,setF]=useState({studentId:p.selected?.id||p.students[0]?.id||'',amount:'',method:p.dict('paymentMethods')[0]||'نقدي',date:today(),note:''});const s=p.studentBy(f.studentId);return <Modal title="تسجيل دفعة" close={()=>p.setModal(null)}><div className="space">
 <Field label="الطالب" required><select className="input" value={f.studentId} onChange={e=>setF({...f,studentId:e.target.value})}>{p.students.map(s=><option key={s.id} value={s.id}>{s.name} — متبقي {money(p.due(s))}</option>)}</select></Field>
 <div className="stats"><Stat n={money(p.due(s||{}))} l="المتبقي"/><Stat n={money(Math.max(0,p.due(s||{})-Number(f.amount||0)))} l="المتبقي بعد الدفعة"/></div>
 <Field label="مبلغ الدفعة (بالجنيه)" required><input className="input bigInput" type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})} placeholder="0"/></Field>
 <Field label="طريقة الدفع"><select className="input" value={f.method} onChange={e=>setF({...f,method:e.target.value})}>{p.dict('paymentMethods').map(x=><option key={x}>{x}</option>)}</select></Field>
 <Field label="تاريخ الدفعة"><input className="input" type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
 <Field label="ملاحظة"><input className="input" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="اختياري"/></Field>
 <button className="btn wide" onClick={async()=>{if(Number(f.amount)<=0)return p.notify('أدخل مبلغًا صحيحًا');const payment={id:uid2('pay'),...f,amount:Number(f.amount),type:'PAYMENT',academicYearId:p.yearId,branchId:s?.branchId||''};await p.write('payments',payment,'تسجيل دفعة');const charges=p.data.payments.filter(x=>active(x)&&x.studentId===payment.studentId&&x.type==='CHARGE');const allocatedByCharge=(p.data.paymentAllocations||[]).filter(x=>active(x)&&x.studentId===payment.studentId).reduce((m,x)=>{m[x.chargeId]=(m[x.chargeId]||0)+Number(x.amount||0);return m},{});const allocation=allocatePayment({payment,charges,amounts:{total:payment.amount,allocatedByCharge}});for(const row of allocation.allocations)await p.write('paymentAllocations',row,'تخصيص دفعة');p.setModal(null);p.notify(`تم تسجيل الدفعة وتخصيص ${payment.amount-allocation.unallocated} ج على المستحقات`);await p.buzz()}}>حفظ الدفعة</button></div></Modal>}


export function ExpenseForm(p){const [f,setF]=useState({title:'',category:p.dict('expenseCategories')[0]||'أخرى',amount:'',date:today(),note:''});return <Modal title="تسجيل مصروف" close={()=>p.setModal(null)}><div className="space">
 <Field label="اسم المصروف" required><input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="مثال: إيجار القاعة"/></Field>
 <Field label="التصنيف"><select className="input" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{p.dict('expenseCategories').map(x=><option key={x}>{x}</option>)}</select></Field>
 <Field label="المبلغ (بالجنيه)" required><input className="input" type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})} placeholder="0"/></Field>
 <Field label="التاريخ"><input className="input" type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
 <Field label="ملاحظة"><input className="input" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="اختياري"/></Field>
 <button className="btn wide" onClick={async()=>{if(!f.title||Number(f.amount)<=0)return p.notify('أكمل البيانات');await p.write('expenses',{id:uid2('exp'),...f,amount:Number(f.amount),academicYearId:p.yearId,branchId:p.branchId==='ALL'?'':p.branchId},'تسجيل مصروف');p.setModal(null);p.notify('تم حفظ المصروف')}}>حفظ المصروف</button></div></Modal>}


export function ExamForm(p){const [f,setF]=useState({title:'',date:today(),type:p.dict('examTypes')[0]||'',maxScore:50,groupIds:[]});return <Modal title="إضافة امتحان" close={()=>p.setModal(null)}><div className="space">
 <Field label="اسم الامتحان" required><input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="مثال: امتحان الشهر"/></Field>
 <div className="row">
  <Field label="الدرجة النهائية"><input className="input" type="number" value={f.maxScore} onChange={e=>setF({...f,maxScore:e.target.value})}/></Field>
  <Field label="نوع الامتحان"><select className="input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{p.dict('examTypes').map(x=><option key={x}>{x}</option>)}</select></Field>
 </div>
 <Field label="تاريخ الامتحان"><input className="input" type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
 <Field label="المجموعات المشمولة" required><div className="checkList">{p.groups.map(g=><label className="check" key={g.id}><input type="checkbox" checked={f.groupIds.includes(g.id)} onChange={e=>setF({...f,groupIds:e.target.checked?[...f.groupIds,g.id]:f.groupIds.filter(x=>x!==g.id)})}/>{g.name}</label>)}</div></Field>
 <button className="btn wide" onClick={async()=>{if(!f.title||!f.groupIds.length)return p.notify('أدخل الاسم واختر المجموعات');const exam={id:uid2('exam'),...f,maxScore:Number(f.maxScore),academicYearId:p.yearId};await p.write('exams',exam,'إضافة امتحان');const target=p.students.filter(s=>f.groupIds.includes(s.groupId));for(const s of target){if(!p.data.grades.some(g=>active(g)&&g.examId===exam.id&&g.studentId===s.id))await p.write('grades',{id:uid2('gr'),examId:exam.id,studentId:s.id,score:'',maxScore:exam.maxScore,academicYearId:p.yearId},'إنشاء سجل درجة تلقائيًا')}p.setModal(null);p.notify(`تم إنشاء الامتحان وإضافة ${target.length} طالب لسجله`)}}>حفظ الامتحان</button></div></Modal>}


export function ExamView(p){const target=p.students.filter(s=>p.exam.groupIds.includes(s.groupId));const stats=examStats(p.data,p.exam.id);const [query,setQuery]=useState('');const list=target.filter(s=>s.name.includes(query)||s.code.includes(query));return <Modal title={`درجات — ${p.exam.title}`} close={()=>p.setModal(null)}><div className="stats"><Stat n={stats.count} l="سجلات"/><Stat n={money(stats.average)} l="متوسط النقاط"/><Stat n={`${Math.round(stats.passRate)}%`} l="نسبة النجاح"/><Stat n={stats.highest} l="أعلى درجة"/></div><Field label="بحث عن طالب"><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث بالاسم أو ID"/></Field><div className="list">{list.map(s=>{const g=p.data.grades.find(x=>active(x)&&x.examId===p.exam.id&&x.studentId===s.id);return <div className="gradeRow" key={s.id}><div><b>{s.name}</b><small>{s.code}</small></div><Field label={`الدرجة من ${p.exam.maxScore}`}><input className="input gradeInput" inputMode="decimal" type="number" min="0" max={p.exam.maxScore} value={g?.score??''} onChange={e=>p.write('grades',{...(g||{}),id:g?.id||uid2('gr'),examId:p.exam.id,studentId:s.id,score:e.target.value===''?'':Number(e.target.value),maxScore:p.exam.maxScore,academicYearId:p.yearId},'تسجيل درجة')}/></Field></div>})}</div></Modal>}


export function BookForm(p){const [f,setF]=useState({title:'',type:p.dict('bookTypes')[0]||'',price:0,cost:0,pages:0,needsBinding:false,covers:1,stock:0,minStock:5,groupIds:[]});const pc=p.settings.printCosts||{paper:0,binding:0,cover:0,notes:0};const calcCost=()=>{const c=Number(f.pages||0)*Number(pc.paper||0)+(f.needsBinding?Number(pc.binding||0):0)+Number(f.covers||0)*Number(pc.cover||0);setF({...f,cost:Math.round(c*100)/100})};return <Modal title="إضافة كتاب" close={()=>p.setModal(null)}><div className="space">
 <Field label="اسم الكتاب" required><input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="مثال: مذكرة الأحياء"/></Field>
 <Field label="نوع الكتاب"><select className="input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{p.dict('bookTypes').map(x=><option key={x}>{x}</option>)}</select></Field>
 <Section title="احتساب تكلفة الطباعة (اختياري)">
  <div className="row">
   <Field label="عدد الورق بالمذكرة"><input className="input" type="number" value={f.pages} onChange={e=>setF({...f,pages:e.target.value})} placeholder="0"/></Field>
   <Field label="عدد الأغلفة"><input className="input" type="number" value={f.covers} onChange={e=>setF({...f,covers:e.target.value})} placeholder="1"/></Field>
  </div>
  <label className="check"><input type="checkbox" checked={f.needsBinding} onChange={e=>setF({...f,needsBinding:e.target.checked})}/> يحتاج تجليد/تكعيب</label>
  <button type="button" className="btn secondary wide" onClick={calcCost}>احتساب التكلفة تلقائيًا من أسعار الإعدادات</button>
 </Section>
 <div className="row">
  <Field label="سعر البيع"><input className="input" type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} placeholder="0"/></Field>
  <Field label="تكلفة الطباعة (تُحسب تلقائيًا أو تُكتب يدويًا)"><input className="input" type="number" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})} placeholder="0"/></Field>
 </div>
 <div className="row">
  <Field label="الكمية بالمخزون (الرصيد الافتتاحي)"><input className="input" type="number" value={f.stock} onChange={e=>setF({...f,stock:e.target.value})} placeholder="0"/></Field>
  <Field label="حد التنبيه عند النقص"><input className="input" type="number" value={f.minStock} onChange={e=>setF({...f,minStock:e.target.value})} placeholder="5"/></Field>
 </div>
 <Field label="المجموعات المرتبطة"><div className="checkList">{p.groups.map(g=><label className="check" key={g.id}><input type="checkbox" checked={f.groupIds.includes(g.id)} onChange={e=>setF({...f,groupIds:e.target.checked?[...f.groupIds,g.id]:f.groupIds.filter(x=>x!==g.id)})}/>{g.name}</label>)}</div></Field>
 <button className="btn wide" onClick={async()=>{if(!f.title)return p.notify('أدخل اسم الكتاب');await p.write('books',{id:uid2('book'),...f,price:Number(f.price),cost:Number(f.cost),stock:Number(f.stock),minStock:Number(f.minStock),academicYearId:p.yearId},'إضافة كتاب');p.setModal(null);p.notify('تم إضافة الكتاب')}}>حفظ الكتاب</button></div></Modal>}


export function BookView(p){
 const [sid,setSid]=useState(p.presetStudentId||'');
 useEffect(()=>{if(p.presetStudentId)p.setPresetStudentId('')},[]);
 const statuses=p.dict('bookStatuses');
 const [status,setStatus]=useState(statuses[0]||'غير مدفوع وغير مستلم');
 const [movQty,setMovQty]=useState('');
 const [movType,setMovType]=useState('IN');
 const [movReason,setMovReason]=useState('');
 const list=p.data.studentBooks.filter(x=>active(x)&&x.bookId===p.book.id);
 const movements=(p.data.bookMovements||[]).filter(x=>active(x)&&x.bookId===p.book.id).sort((a,b)=>b.date.localeCompare(a.date));
 const inv=bookInventory(p.data,p.book.id);
 const save=async()=>{
  if(!sid)return p.notify('اختر الطالب');
  const student=p.studentBy(sid), existing=list.find(x=>x.studentId===sid), amount=Number(p.book.price||0);
  const received=/مستلم/.test(status), paid=/مدفوع/.test(status);
  const row={...(existing||{}),id:existing?.id||uid2('sb'),bookId:p.book.id,studentId:sid,status,date:today(),price:amount,amount,academicYearId:p.yearId,branchId:student?.branchId||''};
  await p.write('studentBooks',row,'تحديث حالة كتاب');
  const chargeId=`book_${p.book.id}_${sid}_charge`,paymentId=`book_${p.book.id}_${sid}_payment`;
  const oldCharge=p.data.payments.find(x=>active(x)&&x.id===chargeId), oldPayment=p.data.payments.find(x=>active(x)&&x.id===paymentId);
  if(paid&&!oldPayment)await p.write('payments',{id:paymentId,studentId:sid,amount,date:today(),type:'PAYMENT',source:'BOOK',note:`دفع كتاب ${p.book.title}`,academicYearId:p.yearId,branchId:student?.branchId||''},'تسجيل دفع كتاب');
  if(!paid&&!oldCharge)await p.write('payments',{id:chargeId,studentId:sid,amount,date:today(),type:'CHARGE',source:'BOOK',note:`مستحق كتاب ${p.book.title}`,academicYearId:p.yearId,branchId:student?.branchId||''},'تسجيل مستحق كتاب');
  if(paid&&oldCharge)await p.write('payments',{...oldCharge,deletedAt:new Date().toISOString()},'إغلاق مستحق الكتاب بعد الدفع');
  if(received&&!existing?.status?.includes('مستلم'))await p.write('books',{...p.book,lastMovementAt:new Date().toISOString()},'تحديث حركة مخزون الكتاب');
  p.notify('تم تحديث الكتاب وربطه بالمالية');setSid('');
 };
 const addMovement=async()=>{
  const q=Number(movQty);
  if(!q||q<=0)return p.notify('أدخل كمية صحيحة');
  await p.write('bookMovements',{id:uid2('bm'),bookId:p.book.id,type:movType,qty:q,reason:movReason||(movType==='IN'?'طباعة جديدة':'تالف/فقد'),date:today(),academicYearId:p.yearId},movType==='IN'?'إضافة وارد مخزون':'تسجيل منصرف مخزون');
  setMovQty('');setMovReason('');p.notify('تم تحديث حركة المخزون');
 };
 return <Modal title={`إدارة الكتاب — ${p.book.title}`} close={()=>p.setModal(null)}><div className="space">
 <div className="stats"><Stat n={inv.available} l="المتاح"/><Stat n={inv.delivered} l="تم التسليم"/><Stat n={inv.paid} l="مدفوع"/><Stat n={inv.lowStock?'تنبيه':'جيد'} l="حالة المخزون"/></div>
 <div className="stats"><Stat n={money(inv.revenue)} l="إيراد الكتاب"/><Stat n={money(inv.cost)} l="تكلفة الكتاب"/><Stat n={money(inv.profit)} l="صافي الربح"/><Stat n={inv.stock} l="إجمالي الرصيد"/></div>
 <Section title="تسليم / تحصيل كتاب لطالب">
  <select className="input" value={sid} onChange={e=>setSid(e.target.value)}><option value="">اختر طالبًا</option>{p.students.filter(s=>p.book.groupIds.includes(s.groupId)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
  <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select>
  <button className="btn wide" onClick={save}>تسجيل / تحديث الكتاب</button>
 </Section>
 <Section title="حركة المخزون (وارد / منصرف)">
  <div className="row">
   <Field label="نوع الحركة"><select className="input" value={movType} onChange={e=>setMovType(e.target.value)}><option value="IN">وارد (طباعة جديدة)</option><option value="OUT">منصرف (تالف/فقد)</option></select></Field>
   <Field label="الكمية"><input className="input" type="number" value={movQty} onChange={e=>setMovQty(e.target.value)} placeholder="0"/></Field>
  </div>
  <Field label="السبب/ملاحظة"><input className="input" value={movReason} onChange={e=>setMovReason(e.target.value)} placeholder="مثال: تشغيلة طباعة جديدة"/></Field>
  <button className="btn secondary wide" onClick={addMovement}>تسجيل الحركة</button>
  <div className="list">{movements.map(m=><Row key={m.id} title={`${m.type==='IN'?'وارد':'منصرف'} — ${m.qty}`} sub={`${fmtDate(m.date)} • ${m.reason||''}`}/>)}</div>
 </Section>
 <Section title="سجل تسليم الطلاب"><div className="list">{list.map(x=><Row key={x.id} title={p.studentBy(x.studentId)?.name||'—'} sub={`${x.status} • ${fmtDate(x.date)}`}/>)}</div></Section>
 </div></Modal>
}
