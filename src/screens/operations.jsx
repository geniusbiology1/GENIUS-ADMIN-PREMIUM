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
import {renderTemplate,DEFAULT_TEMPLATES} from '../services/whatsapp/templates.js';
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

export function AttendanceModal(p){const groupStudents=p.students.filter(s=>s.groupId===p.session.groupId&&s.status==='نشط');const attendanceRows=p.data.attendance.filter(x=>active(x)&&x.sessionId===p.session.id);const attendanceSummary=attendanceStats(attendanceRows);const [code,setCode]=useState('');const [tab,setTab]=useState('attendance');const mark=async(s,status)=>{const id=`${p.session.id}_${s.id}`;await p.write('attendance',{id,sessionId:p.session.id,studentId:s.id,status,billable:status!=='غائب',time:new Date().toISOString(),academicYearId:p.session.academicYearId},'تسجيل حضور');await p.buzz();p.notify(`${status} — ${s.name}`)};const scan=()=>p.setModal('scan');const lifecycle=async next=>{if(next==='OPEN'){for(const row of ensureSessionAttendance(p.data,p.session))await p.write('attendance',row,'تهيئة حضور الحصة')}const updated=next==='OPEN'?openSession(p.session):completeSession(p.session);await p.write('sessions',updated,next==='OPEN'?'فتح الحصة':'إنهاء الحصة');p.setSelected(updated);p.notify(next==='OPEN'?'تم فتح الحصة':'تم إنهاء الحصة')};const summary=sessionSummary(p.data,p.session.id);return <Modal title={`حصة — ${p.groupBy(p.session.groupId)?.name||''}`} close={()=>p.setModal(null)}><div className="between"><span className="badge">{p.session.status||'UPCOMING'}</span><div className="actions">{p.session.status!=='OPEN'&&p.session.status!=='COMPLETED'&&<button className="btn" onClick={()=>lifecycle('OPEN')}>فتح الحصة</button>}{p.session.status==='OPEN'&&<button className="btn secondary" onClick={()=>lifecycle('COMPLETED')}>إنهاء الحصة</button>}</div></div><div className="tabs"><button className={tab==='attendance'?'active':''} onClick={()=>setTab('attendance')}>الحضور</button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')}>بيانات</button><button className={tab==='grades'?'active':''} onClick={()=>setTab('grades')}>الدرجات</button></div>{tab==='attendance'&&<><div className="actions"><button className="btn" onClick={scan}><I.ScanLine/> Scan ID</button><input className="input codeInput" placeholder="اكتب ID ثم Enter" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){const s=groupStudents.find(x=>x.code===code.trim());if(s)mark(s,'حاضر');else p.notify('ID غير موجود في المجموعة');setCode('')}}}/><button className="btn secondary" onClick={async()=>{for(const s of groupStudents)await mark(s,'حاضر');}}>الكل حاضر</button></div><div className="list">{groupStudents.map(s=>{const a=p.data.attendance.find(x=>active(x)&&x.id===`${p.session.id}_${s.id}`);return <div className="rowItem" key={s.id}><div><b>{s.name}</b><small>{s.code} • {a?.status||'لم يسجل'}</small></div><div className="attendanceActions"><button className={a?.status==='حاضر'?'pill activePill':'pill'} onClick={()=>mark(s,'حاضر')}>حاضر</button><button className={a?.status==='متأخر'?'pill activePill':'pill'} onClick={()=>mark(s,'متأخر')}>متأخر</button><button className={a?.status==='غائب'?'pill activePill':'pill'} onClick={()=>mark(s,'غائب')}>غائب</button></div></div>})}</div></>}{tab==='data'&&<div className="stats"><Stat n={groupStudents.length} l="إجمالي"/><Stat n={groupStudents.filter(s=>p.data.attendance.find(a=>active(a)&&a.id===`${p.session.id}_${s.id}`&&a.status!=='غائب')).length} l="حاضر"/><Stat n={groupStudents.filter(s=>p.data.attendance.find(a=>active(a)&&a.id===`${p.session.id}_${s.id}`&&a.status==='غائب')).length} l="غائب"/><Stat n={money(summary.collection)} l="تحصيل الحصة"/><Stat n={`${attendanceSummary.rate}%`} l="النسبة"/></div>}{tab==='grades'&&<p className="hint">لإدارة درجات الامتحانات افتح شاشة الامتحانات؛ الدرجة تحفظ تلقائيًا في سجل كل طالب.</p>}</Modal>}


export function Scanner(p){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('جاهز للمسح بالكاميرا');
 const resolve=useCallback(value=>{const s=p.students.find(x=>x.code===String(value||'').trim());if(s){p.setSelected(s);p.setModal('card')}else p.notify('الكود غير معروف')},[p]);
 const nativeScan=async()=>{setBusy(true);try{const supported=await isScannerSupported();if(!supported){setMsg('الماسح الأصلي غير مدعوم على هذا الجهاز');return}const value=await scanGENIUSID();if(value)resolve(value);else setMsg('لم يتم العثور على كود')}catch(e){console.error(e);setMsg('تعذر تشغيل الكاميرا — تأكد من صلاحية الكاميرا')}finally{setBusy(false)}};
 return <Modal title="GENIUS Scanner" close={()=>{stopScanner();p.setModal(null)}}>
  <div className="scanner"><div className="scanFrame"><I.ScanLine size={46}/></div><small>{msg}</small></div>
  <button className="btn wide" disabled={busy} onClick={nativeScan}><I.Camera/> {busy?'جاري المسح...':'فتح الكاميرا والمسح'}</button>
  <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="أو أدخل GENIUS ID يدويًا"/>
  <button className="btn secondary wide" onClick={()=>resolve(code)}>فتح الطالب</button>
 </Modal>
}

export function Student360(p){const profile=buildStudent360(p.data,p.student.id);const s=profile?.student||p.student;const grades=profile?.grades||[];const att=profile?.attendance||[];const payments=profile?.payments||[];const books=profile?.books||[];const reportText=renderTemplate(DEFAULT_TEMPLATES.result,{studentName:s.name,exam:'ملف الطالب',score:Math.round((p.avg(s)/100)*100),maxScore:100,percent:p.avg(s)})+`\nGENIUS ID: ${s.code}\nالمجموعة: ${p.groupBy(s.groupId)?.name||'—'}\nالمستحق: ${money(p.due(s))}`;return <Modal title={`Student 360 — ${s.name}`} close={()=>p.setModal(null)}><div className="studentHero"><div className="avatar">{s.name?.slice(0,1)}</div><div><h2>{s.name}</h2><small>GENIUS ID: {s.code}</small><p>{p.groupBy(s.groupId)?.name||'بدون مجموعة'} • {s.grade}</p></div></div><div className="actions"><button className="btn" onClick={()=>{p.setSelected(s);p.setModal('card')}}>بطاقة + QR</button><button className="btn secondary" onClick={()=>{p.setSelected(s);p.setModal('report')}}><I.FileText size={16}/> تقرير مخصص لولي الأمر</button><button className="btn secondary" onClick={()=>window.print()}>طباعة</button></div><div className="stats"><Stat n={`${p.attendanceRate(s)}%`} l="الحضور"/><Stat n={`${p.avg(s)}%`} l="متوسط الدرجات"/><Stat n={money(p.due(s))} l="المتبقي"/><Stat n={payments.filter(x=>x.type==='PAYMENT').length} l="دفعات"/></div><Section title="بيانات الطالب"><div className="detailGrid"><span>ولي الأمر</span><b>{s.parentName||'—'}</b><span>هاتف الطالب</span><b>{s.studentPhone||'—'}</b><span>هاتف ولي الأمر</span><b>{s.parentPhone||'—'}</b><span>المستوى</span><b>{s.level||'—'}</b><span>ملاحظات</span><b>{s.notes||'—'}</b></div></Section><Section title={`الحضور (${att.length})`}><div className="list">{att.slice(-12).reverse().map(a=><Row key={a.id} title={a.status} sub={new Date(a.time||Date.now()).toLocaleString('ar-EG')}/>)}</div></Section><Section title={`الدرجات (${grades.length})`}><div className="list">{grades.map(g=><Row key={g.id} title={p.data.exams.find(e=>e.id===g.examId)?.title||'امتحان'} sub={`${g.score}/${g.maxScore}`}/>)}</div></Section><Section title={`المالية (${payments.length})`}><div className="list">{payments.map(x=><Row key={x.id} title={`${x.type==='CHARGE'?'مستحق':'دفعة'} — ${money(x.amount)}`} sub={`${fmtDate(x.date)} • ${x.note||x.method||''}`}/>)}</div></Section><Section title={`الكتب (${books.length})`}><div className="list">{books.map(x=><Row key={x.id} title={p.data.books.find(b=>b.id===x.bookId)?.title||'كتاب'} sub={x.status}/>)}</div></Section><Section title="السجل الزمني"><div className="list">{profile.timeline.slice(0,20).map((x,i)=><Row key={x.ref+'_'+i} title={x.label} sub={fmtDate(x.date)}/>)}</div></Section></Modal>}


export function ReportForm(p){
  const s=p.selected;const profile=buildStudent360(p.data,s.id);
  const [sec,setSec]=useState({level:true,attendance:true,grades:true,finance:true,books:false});
  const [text,setText]=useState('');
  const build=useCallback(()=>{
    const lines=[`GENIUS BIOLOGY — تقرير الطالب`,`الاسم: ${s.name}`,`GENIUS ID: ${s.code}`,`المجموعة: ${p.groupBy(s.groupId)?.name||'—'}`];
    if(sec.level)lines.push(`المستوى: ${s.level||'—'}`);
    if(sec.attendance){const att=(profile.attendance||[]).slice(-5).reverse();lines.push(`نسبة الحضور: ${p.attendanceRate(s)}%`,`آخر الحضور: ${att.length?att.map(a=>`${a.status} (${fmtDate(a.date)})`).join('، '):'—'}`)}
    if(sec.grades){const gr=(profile.grades||[]).slice(-5).reverse();lines.push(`متوسط الدرجات: ${p.avg(s)}%`,`آخر الامتحانات: ${gr.length?gr.map(g=>`${p.data.exams.find(e=>e.id===g.examId)?.title||'امتحان'}: ${g.score}/${g.maxScore}`).join('، '):'—'}`)}
    if(sec.finance){const pay=(profile.payments||[]).filter(x=>x.type==='PAYMENT').slice(-5).reverse();lines.push(`المتبقي: ${money(p.due(s))}`,`آخر الدفعات: ${pay.length?pay.map(x=>`${money(x.amount)} (${fmtDate(x.date)})`).join('، '):'—'}`)}
    if(sec.books){const bk=profile.books||[];lines.push(`الكتب: ${bk.length?bk.map(x=>`${p.data.books.find(b=>b.id===x.bookId)?.title||'كتاب'} — ${x.status}`).join('، '):'—'}`)}
    return lines.join('\n');
  },[s,p,profile,sec]);
  useEffect(()=>{setText(build())},[sec]);
  const opts=[['level','المستوى'],['attendance','الحضور'],['grades','الدرجات'],['finance','المدفوعات'],['books','الكتب']];
  return <Modal title={`تقرير — ${s.name}`} close={()=>p.setModal(null)}>
    <div className="space">
      <div className="reportSections">{opts.map(([k,l])=><label className="check" key={k}><input type="checkbox" checked={sec[k]} onChange={e=>setSec({...sec,[k]:e.target.checked})}/>{l}</label>)}</div>
      <Field label="نص الرسالة (قابل للتعديل قبل الإرسال)">
        <textarea className="input textarea reportPreview" value={text} onChange={e=>setText(e.target.value)}/>
      </Field>
      <div className="actions">
        <button className="btn" onClick={()=>p.whatsapp(s.parentPhone,text)}><I.MessageCircle size={16}/> إرسال واتساب</button>
        <button className="btn secondary" onClick={()=>{navigator.clipboard?.writeText(text);p.notify('تم نسخ التقرير')}}>نسخ</button>
        <button className="btn secondary" onClick={()=>setText(build())}>إعادة التوليد</button>
      </div>
    </div>
  </Modal>;
}

export function StudentCard(p){const s=p.student;const [qr,setQr]=useState('');const barRef=React.useRef(null);useEffect(()=>{QRCode.toDataURL(JSON.stringify({geniusId:s.code,name:s.name,groupId:s.groupId}),{width:260,margin:1,errorCorrectionLevel:'M'}).then(setQr);if(barRef.current){try{JsBarcode(barRef.current,s.code,{format:'CODE128',displayValue:true,height:52,width:2,margin:8,fontSize:14})}catch{}}},[s]);const text=`GENIUS BIOLOGY\n${s.name}\nGENIUS ID: ${s.code}\nالمجموعة: ${p.groupBy(s.groupId)?.name||'—'}`;const shareQr=async()=>{if(!qr)return;const ok=await shareImageDataUrl(qr,`GENIUS_${s.code}_QR.png`,`بطاقة ${s.name}`);if(ok)p.notify('تم فتح مشاركة صورة QR');else p.notify('تعذرت مشاركة الصورة — جرّب لقطة شاشة')};const shareBarcode=async()=>{if(!barRef.current)return;try{const png=await svgToPngDataUrl(barRef.current);const ok=await shareImageDataUrl(png,`GENIUS_${s.code}_BARCODE.png`,`باركود ${s.name}`);if(ok)p.notify('تم فتح مشاركة صورة الباركود');else p.notify('تعذرت مشاركة الصورة')}catch{p.notify('تعذرت مشاركة الصورة')}};return <Modal title="بطاقة GENIUS ID" close={()=>p.setModal(null)}><div className="studentCard"><div className="cardBrand">GENIUS BIOLOGY <span>GENIUS ADMIN • STUDENT ID</span></div><h2>{s.name}</h2><div className="idBig">{s.code}</div><p>{p.groupBy(s.groupId)?.name||'—'} • {s.grade||'—'}</p>{qr&&<img src={qr} alt="GENIUS QR"/>}<svg ref={barRef} aria-label={`Barcode ${s.code}`}></svg><small>QR وCode 128 مرتبطان بـ GENIUS ID فقط</small></div><div className="actions"><button className="btn" onClick={shareQr}><I.QrCode size={16}/> مشاركة صورة QR</button><button className="btn secondary" onClick={shareBarcode}><I.Barcode size={16}/> مشاركة صورة الباركود</button></div><div className="actions"><button className="btn secondary" onClick={async()=>{const ok=await shareText('GENIUS ID',text);if(!ok){await navigator.clipboard?.writeText(text);p.notify('تم نسخ بيانات البطاقة')}}}>مشاركة النص</button><button className="btn secondary" onClick={()=>{navigator.clipboard?.writeText(s.code);p.notify('تم نسخ ID')}}>نسخ ID</button><button className="btn secondary" onClick={()=>p.whatsapp(s.parentPhone,text)}>WhatsApp</button><button className="btn secondary" onClick={()=>window.print()}>طباعة</button></div></Modal>}


export function StudentForm(p){const old=p.selected;const [f,setF]=useState(old||{id:uid2('st'),code:'',name:'',grade:p.dict('grades')[0]||'',academicYearId:p.yearId,groupId:p.groups[0]?.id||'',branchId:p.branchId==='ALL'?p.groups[0]?.branchId||'':p.branchId,status:'نشط',studentPhone:'',parentName:'',parentPhone:'',joinDate:today(),price:0,discountType:'NONE',discountValue:0,level:p.dict('levels')[0]||'',notes:''});useEffect(()=>{if(!f.code&&!old){const y=p.data.academicYears.find(x=>x.id===p.yearId);const nums=p.students.map(s=>Number(String(s.code).replace(/\D/g,''))||0);const max=Math.max(0,...nums);setF(x=>({...x,code:`${y?.shortCode||'27'}${String(max+1).slice(-4).padStart(4,'0')}`}))}},[f.code,old,p.data.academicYears,p.yearId,p.students]);
 const contactSupported=typeof navigator!=='undefined'&&'contacts'in navigator&&'ContactsManager'in window;
 const pickStudentPhone=async()=>{const c=await pickContact();if(!c)return p.notify(contactSupported?'لم يتم اختيار جهة اتصال':'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');setF(x=>({...x,studentPhone:c.tel||x.studentPhone}))};
 const pickParentPhone=async()=>{const c=await pickContact();if(!c)return p.notify(contactSupported?'لم يتم اختيار جهة اتصال':'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');setF(x=>({...x,parentPhone:c.tel||x.parentPhone,parentName:x.parentName||c.name||x.parentName}))};
 return <Modal title={old?'تعديل الطالب':'إضافة طالب'} close={()=>p.setModal(null)}><form className="space" onSubmit={async e=>{e.preventDefault();if(!f.name.trim()||!f.code)return p.notify('أكمل الاسم وGENIUS ID');if(p.data.students.some(s=>active(s)&&s.code===f.code&&s.id!==f.id))return p.notify('GENIUS ID مستخدم بالفعل');const g=p.groupBy(f.groupId);const row={...f,price:Number(f.price||g?.price||0),discountValue:Number(f.discountValue||0),branchId:f.branchId||g?.branchId,academicYearId:f.academicYearId||g?.academicYearId};if(uniqueCodes([...p.data.students.filter(s=>active(s)&&s.id!==f.id),row]).length)return p.notify('يوجد GENIUS ID مكرر — اختر ID مختلفًا');if(!validStudent(row))return p.notify('بيانات الطالب غير مكتملة: الاسم + ID + السنة + المجموعة مطلوبة');await p.write('students',row,old?'تعديل طالب':'إضافة طالب');p.setModal(null);p.notify('تم حفظ الطالب')}}>
 <div className="formGrid">
  <Field label="اسم الطالب" required><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="مثال: أحمد محمد"/></Field>
  <Field label="GENIUS ID" required><input className="input" value={f.code} onChange={e=>setF({...f,code:e.target.value.replace(/\s/g,'')})} placeholder="270001"/></Field>
  <Field label="المجموعة"><select className="input" value={f.groupId} onChange={e=>{const g=p.groupBy(e.target.value);setF({...f,groupId:e.target.value,branchId:g?.branchId||f.branchId,academicYearId:g?.academicYearId||f.academicYearId,price:g?.price||f.price})}}><option value="">بدون مجموعة</option>{p.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
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
  <Field label="السعر (اتركه فارغًا لسعر المجموعة)"><input className="input" type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} placeholder="0"/></Field>
  <Field label="نوع الخصم"><select className="input" value={f.discountType} onChange={e=>setF({...f,discountType:e.target.value})}><option value="NONE">بدون خصم</option><option value="PERCENT">خصم %</option><option value="FIXED">خصم ثابت</option></select></Field>
  <Field label="قيمة الخصم"><input className="input" type="number" value={f.discountValue} onChange={e=>setF({...f,discountValue:e.target.value})} placeholder="0"/></Field>
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


export function BookForm(p){const [f,setF]=useState({title:'',type:p.dict('bookTypes')[0]||'',price:0,cost:0,stock:0,minStock:5,groupIds:[]});return <Modal title="إضافة كتاب" close={()=>p.setModal(null)}><div className="space">
 <Field label="اسم الكتاب" required><input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="مثال: مذكرة الأحياء"/></Field>
 <Field label="نوع الكتاب"><select className="input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{p.dict('bookTypes').map(x=><option key={x}>{x}</option>)}</select></Field>
 <div className="row">
  <Field label="سعر البيع"><input className="input" type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})} placeholder="0"/></Field>
  <Field label="تكلفة الطباعة"><input className="input" type="number" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})} placeholder="0"/></Field>
 </div>
 <div className="row">
  <Field label="الكمية بالمخزون"><input className="input" type="number" value={f.stock} onChange={e=>setF({...f,stock:e.target.value})} placeholder="0"/></Field>
  <Field label="حد التنبيه عند النقص"><input className="input" type="number" value={f.minStock} onChange={e=>setF({...f,minStock:e.target.value})} placeholder="5"/></Field>
 </div>
 <Field label="المجموعات المرتبطة"><div className="checkList">{p.groups.map(g=><label className="check" key={g.id}><input type="checkbox" checked={f.groupIds.includes(g.id)} onChange={e=>setF({...f,groupIds:e.target.checked?[...f.groupIds,g.id]:f.groupIds.filter(x=>x!==g.id)})}/>{g.name}</label>)}</div></Field>
 <button className="btn wide" onClick={async()=>{if(!f.title)return p.notify('أدخل اسم الكتاب');await p.write('books',{id:uid2('book'),...f,price:Number(f.price),cost:Number(f.cost),stock:Number(f.stock),minStock:Number(f.minStock),academicYearId:p.yearId},'إضافة كتاب');p.setModal(null);p.notify('تم إضافة الكتاب')}}>حفظ الكتاب</button></div></Modal>}


                                                                                                                                                                                                                                                                                                                                                                                }
export function BookView(p){
 const [sid,setSid]=useState('');
 const statuses=p.dict('bookStatuses');
 const [status,setStatus]=useState(statuses[0]||'غير مدفوع وغير مستلم');
 const list=p.data.studentBooks.filter(x=>active(x)&&x.bookId===p.book.id);const inventory=bookInventory(p.data,p.book.id);
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
 return <Modal title={`إدارة الكتاب — ${p.book.title}`} close={()=>p.setModal(null)}><div className="space"><div className="stats"><Stat n={inventory.available} l="المتاح"/><Stat n={inventory.delivered} l="تم التسليم"/><Stat n={inventory.paid} l="مدفوع"/><Stat n={inventory.lowStock?'تنبيه':'جيد'} l="حالة المخزون"/></div><select className="input" value={sid} onChange={e=>setSid(e.target.value)}><option value="">اختر طالبًا</option>{p.students.filter(s=>p.book.groupIds.includes(s.groupId)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="input" value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select><button className="btn wide" onClick={save}>تسجيل / تحديث الكتاب</button><div className="list">{list.map(x=><Row key={x.id} title={p.studentBy(x.studentId)?.name||'—'} sub={`${x.status} • ${fmtDate(x.date)}`}/>)}</div></div></Modal>
 }
