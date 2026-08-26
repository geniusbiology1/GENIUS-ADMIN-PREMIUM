import React,{useEffect,useState} from 'react';
import * as I from 'lucide-react';
import {today,mins,money,uid2} from '../utils/format.js';
import {verifyPin} from '../services/security.js';
import {isActive as active} from '../db.js';
import {Screen,Section,Card,Row,Stat,Badge,Empty} from '../components/ui.jsx';

/* حصص اليوم تُحسب مباشرة من مواعيد المجموعات النشطة (بدون توليد جدول مسبق).
   لو فيه حصة حقيقية مسجلة بالفعل لنفس اليوم والمعاد، بتتاخد بياناتها (حالتها الفعلية)،
   ولو لأ، بيتعمل صف "افتراضي" لحد ما المستخدم يفتحه فعليًا فيتسجل وقتها بس. */
function daySessions(ctx,dt){
 const day=new Date(`${dt}T00:00:00`).toLocaleDateString('ar-EG',{weekday:'long'});
 const rows=[];
 for(const g of ctx.groups.filter(g=>g.status==='ACTIVE')){
  for(const slot of (g.schedule||[])){
   if(slot.day!==day)continue;
   const real=ctx.data.sessions.find(x=>active(x)&&x.groupId===g.id&&x.date===dt&&x.timeStart===slot.start);
   rows.push(real?{...real,group:g,virtual:false}:{id:null,groupId:g.id,date:dt,day,timeStart:slot.start,timeEnd:slot.end,status:'UPCOMING',academicYearId:g.academicYearId,group:g,virtual:true});
  }
 }
 const matchedIds=new Set(rows.filter(r=>!r.virtual).map(r=>r.id));
 for(const x of ctx.data.sessions.filter(x=>active(x)&&x.date===dt&&!matchedIds.has(x.id))){
  rows.push({...x,group:ctx.groupBy(x.groupId),virtual:false,extra:true});
 }
 return rows.sort((a,b)=>mins(a.timeStart)-mins(b.timeStart));
}
async function ensureSession(ctx,row){
 if(!row.virtual)return row;
 const s={id:uid2('ses'),groupId:row.groupId,academicYearId:row.academicYearId||ctx.yearId,date:row.date,day:row.day,timeStart:row.timeStart,timeEnd:row.timeEnd,status:'UPCOMING'};
 await ctx.write('sessions',s,'إنشاء حصة من الجدول');
 return s;
}

export function Login({settings,onOk}){const [pin,setPin]=useState(''),[busy,setBusy]=useState(false),[fails,setFails]=useState(Number(sessionStorage.getItem('genius_pin_fails')||0)),[wait,setWait]=useState(0);useEffect(()=>{if(!wait)return;const t=setInterval(()=>setWait(x=>Math.max(0,x-1)),1000);return()=>clearInterval(t)},[wait]);const submit=async()=>{if(wait||busy)return;setBusy(true);const ok=await verifyPin(pin,settings.pinHash,settings.pinSalt);setBusy(false);if(ok){sessionStorage.removeItem('genius_pin_fails');onOk();return}const n=fails+1;setFails(n);sessionStorage.setItem('genius_pin_fails',String(n));setPin('');if(n>=5){const seconds=Math.min(300,30*Math.pow(2,n-5));setWait(seconds);return}alert(`PIN غير صحيح — المحاولة ${n} من 5`)};return <div className="login"><div className="loginBox"><img className="loginLogo" src="/branding/genius-admin-logo.png" alt="GENIUS ADMIN PREMIUM"/><h1>GENIUS ADMIN</h1><p>إدارة GENIUS BIOLOGY — Offline First</p><input className="input pin" autoFocus type="password" inputMode="numeric" maxLength="12" value={pin} disabled={!!wait} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="PIN"/><button className="btn wide" disabled={busy||!!wait} onClick={submit}>{wait?`حاول بعد ${wait} ثانية`:busy?'جاري التحقق…':'دخول النظام'}</button><small>PIN مشفر بـ PBKDF2 داخل الجهاز • حماية من المحاولات المتكررة</small></div></div>}

export function Dashboard({data,students,groups,groupBy,due,attendanceRate,setModal,setSelected,go,notify,write,yearId}){const sessions=daySessions({data,groups,students,groupBy},today());const revenue=data.payments.filter(p=>active(p)&&p.type==='PAYMENT'&&p.date===today()).reduce((a,p)=>a+Number(p.amount||0),0);const expenses=data.expenses.filter(e=>active(e)&&e.date===today()).reduce((a,e)=>a+Number(e.amount||0),0);const overdue=students.filter(s=>due(s)>0).length;const weak=students.filter(s=>attendanceRate(s)<75).length;const openRow=async row=>{const s=await ensureSession({write,yearId},row);setSelected(s);setModal('attendance')};return <Screen title="الرئيسية"><div className="hero"><img className="heroLogo" src="/branding/genius-admin-logo.png" alt="GENIUS ADMIN"/><img className="heroTeacher" src="/branding/teacher.png" alt="مدير النظام"/><div><small>اليوم</small><h1>{new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})}</h1><p>مركز تحكم سريع — كل بياناتك محليًا</p></div><span>OFFLINE • READY</span></div><div className="stats"><Stat n={sessions.filter(s=>s.status!=='CANCELLED').length} l="حصص اليوم"/><Stat n={students.length} l="طلاب نشطين"/><Stat n={money(revenue)} l="تحصيل اليوم"/><Stat n={money(revenue-expenses)} l="صافي اليوم"/></div><Section title="إجراءات سريعة"><div className="quick">{[['طالب',I.UserPlus,()=>setModal('student')],['حضور',I.QrCode,()=>go('schedule')],['دفعة',I.Banknote,()=>setModal('payment')],['مصروف',I.Receipt,()=>setModal('expense')],['امتحان',I.ClipboardPlus,()=>setModal('exam')],['تقرير',I.BarChart3,()=>go('reports')],['حصة استثنائية',I.CalendarPlus,()=>setModal('session')],['Backup',I.ShieldCheck,()=>notify('افتح الإعدادات → Backup')]].map(([t,Icon,f])=><button key={t} onClick={f}><Icon/><span>{t}</span></button>)}</div></Section><Section title={`حصص اليوم — ${sessions.length}`}><div className="list">{sessions.length?sessions.map(s=><Card key={s.virtual?`v_${s.groupId}_${s.timeStart}`:s.id}><div className="between"><div><h3>{groupBy(s.groupId)?.name||'مجموعة غير موجودة'}</h3><small>{s.timeStart} → {s.timeEnd} • {students.filter(x=>x.groupId===s.groupId).length} طالب{s.status==='CANCELLED'?` • إجازة (${s.holidayReason||''})`:''}</small></div>{s.status!=='CANCELLED'&&<button className="btn" onClick={()=>openRow(s)}>فتح الحصة</button>}</div></Card>):<Empty text="لا توجد حصص اليوم حسب مواعيد المجموعات"/>}</div></Section><Section title="مهام تحتاج انتباه"><div className="list"><Row title="طلاب عليهم مستحقات" sub={`${overdue} طالب`} action={<button className="btn" onClick={()=>go('finance')}>المالية</button>}/><Row title="طلاب حضورهم أقل من 75%" sub={`${weak} طالب`} action={<button className="btn" onClick={()=>go('reports')}>تقرير</button>}/><Row title="حصة لم تبدأ بعد" sub={`${sessions.filter(s=>s.status==='UPCOMING').length} حصة`} action={<button className="btn" onClick={()=>go('schedule')}>الجدول</button>}/></div></Section></Screen>}


export function Students(p){const [status,setStatus]=useState('ALL');const [groupFilter,setGroupFilter]=useState('ALL');const [gradeFilter,setGradeFilter]=useState('ALL');const list=p.students.filter(s=>status==='ALL'||s.status===status).filter(s=>groupFilter==='ALL'||s.groupId===groupFilter).filter(s=>gradeFilter==='ALL'||s.grade===gradeFilter).filter(s=>[s.name,s.code,s.parentPhone,s.studentPhone,p.groupBy(s.groupId)?.name].some(v=>String(v||'').toLowerCase().includes(p.query.toLowerCase())));return <Screen title="الطلاب" action={<div className="actions"><button className="btn" onClick={()=>{p.setSelected(null);p.setModal('student')}}><I.Plus/> طالب</button><label className="fileBtn">استيراد Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&p.importStudents(e.target.files[0])}/></label></div>}><input className="input" value={p.query} onChange={e=>p.setQuery(e.target.value)} placeholder="بحث بالاسم / ID / الهاتف / المجموعة"/><div className="filters"><select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">كل الحالات</option><option>نشط</option><option>موقوف</option><option>مؤرشف</option></select><select className="input" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="ALL">كل المجموعات</option>{p.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select className="input" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}><option value="ALL">كل الصفوف</option>{p.dict('grades').map(x=><option key={x}>{x}</option>)}</select></div><div className="list">{list.map(s=><Card key={s.id} onClick={()=>{p.setSelected(s);p.setModal('studentView')}}><div className="between"><div><h3>{s.name}</h3><small>GENIUS ID: {s.code} • {p.groupBy(s.groupId)?.name||'بدون مجموعة'}</small></div><Badge t={s.status}/></div><div className="mini"><Stat n={`${p.attendanceRate(s)}%`} l="حضور"/><Stat n={`${p.avg(s)}%`} l="متوسط"/><Stat n={money(p.due(s))} l="متبقي"/></div></Card>)}{!list.length&&<Empty text="لا توجد نتائج"/>}</div></Screen>}


export function Groups(p){const list=p.groups.filter(g=>[g.name,g.code,p.data.branches.find(b=>b.id===g.branchId)?.name].some(v=>String(v||'').toLowerCase().includes(p.query.toLowerCase())));return <Screen title="المجموعات" action={<button className="btn" onClick={()=>{p.setSelected(null);p.setModal('group')}}><I.Plus/> مجموعة</button>}><input className="input" value={p.query} onChange={e=>p.setQuery(e.target.value)} placeholder="ابحث عن مجموعة أو فرع"/><div className="list">{list.map(g=><Card key={g.id} onClick={()=>{p.setSelected(g);p.setModal('groupView')}}><div className="between"><div><h3>{g.name}</h3><small>{g.code} • {g.grade} • {p.data.branches.find(b=>b.id===g.branchId)?.name||''}</small></div><Badge t={g.status==='ACTIVE'?'نشطة':'موقوفة'}/></div><p>{(g.schedule||[]).map(x=>`${x.day} ${x.start}–${x.end}`).join(' • ')}</p><div className="between"><small>{p.students.filter(s=>s.groupId===g.id&&s.status==='نشط').length}/{g.maxStudents} طالب</small><b>{money(g.price)} {g.pricingModel==='MONTHLY'?'شهري':'للحصة'}</b></div><div className="actions"><button className="btn" onClick={e=>{e.stopPropagation();p.setSelected(g);p.setModal('group')}}>تعديل</button><button className="btn secondary" onClick={e=>{e.stopPropagation();p.write('groups',{...g,status:g.status==='ACTIVE'?'INACTIVE':'ACTIVE'},'تغيير حالة المجموعة')}}>{g.status==='ACTIVE'?'إيقاف':'تفعيل'}</button><button className="btn secondary" onClick={e=>{e.stopPropagation();p.setSelected(g);p.setModal('session')}}>حصة</button></div></Card>)}</div></Screen>}


export function Schedule(p){
 const [dt,setDt]=useState(today());
 const shift=n=>{const d=new Date(`${dt}T00:00:00`);d.setDate(d.getDate()+n);setDt(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)};
 const rows=daySessions({data:p.data,groups:p.groups,students:p.students,groupBy:p.groupBy},dt);
 const openRow=async row=>{const s=await ensureSession(p,row);p.setSelected(s);p.setModal('attendance')};
 const markHoliday=async row=>{
  const reasons=p.dict('holidayReasons');
  const reason=prompt(`سبب الإجازة (اختر أو اكتب):\n${reasons.join(' / ')}`,reasons[0]||'');
  if(reason===null)return;
  const s=await ensureSession(p,row);
  await p.write('sessions',{...s,status:'CANCELLED',holidayReason:reason},'تحديد إجازة للحصة');
 };
 const unmarkHoliday=async row=>{await p.write('sessions',{...row,status:'UPCOMING',holidayReason:''},'إلغاء إجازة الحصة')};
 return <Screen title="الجدول والحصص" action={<button className="btn secondary" onClick={()=>{p.setSelected(null);p.setModal('session')}}><I.Plus/> حصة استثنائية</button>}>
  <div className="filters">
   <button className="btn secondary" onClick={()=>shift(-1)}>الأمس</button>
   <button className="btn secondary" onClick={()=>setDt(today())}>اليوم</button>
   <button className="btn secondary" onClick={()=>shift(1)}>غدًا</button>
   <input className="input" type="date" value={dt} onChange={e=>setDt(e.target.value)}/>
  </div>
  <div className="list">
   {rows.map(row=>{
    const holiday=row.status==='CANCELLED';
    return <Card key={row.virtual?`v_${row.groupId}_${row.timeStart}`:row.id}>
     <div className="timeline">
      <b>{row.timeStart}</b>
      <div><h3>{row.group?.name||p.groupBy(row.groupId)?.name||'مجموعة'}</h3><small>{row.timeEnd} • {p.students.filter(x=>x.groupId===row.groupId).length} طالب{holiday?` • ${row.holidayReason||'إجازة'}`:row.status==='COMPLETED'?' • منتهية':row.status==='OPEN'?' • جارية':''}</small></div>
      {holiday
       ? <button className="btn secondary" onClick={()=>unmarkHoliday(row)}>إلغاء الإجازة</button>
       : <button className="btn" onClick={()=>openRow(row)}>فتح الحصة</button>}
     </div>
     {!holiday&&<div className="actions"><button className="danger" onClick={()=>markHoliday(row)}>تحديد إجازة</button></div>}
    </Card>;
   })}
   {!rows.length&&<Empty text="لا توجد حصص في هذا اليوم حسب مواعيد المجموعات — استخدم (حصة استثنائية) لو محتاج تضيف حصة خارج الجدول"/>}
  </div>
 </Screen>;
}
