import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as I from 'lucide-react';
import * as XLSX from 'xlsx';
import { all, put, snapshot, restore, uid, today, stores, isActive as active } from '../db.js';
import { globalSearch, createMonthlyCharges } from '../services.js';
import { uid2, egPhone } from '../utils/format.js';
import { validBackup, uniqueCodes } from '../services/validation.js';
import { writeTextFile, shareFile, haptic, configureNative } from '../native.js';
import { makeBackupEnvelope, verifyBackupEnvelope, backupFilename } from '../engines/backup/index.js';
import { derivePin } from '../services/security.js';
import { useAutoLock } from '../hooks/useAutoLock.js';
import { syncRuleNotifications } from '../services/notifications/index.js';
import { defaultData } from '../seed.js';
import { Login, Dashboard, Students, Groups, Schedule, AttendanceModal, Scanner, Student360, ReportForm, StudentCard, StudentForm, GroupForm, GroupView, SessionForm, PaymentForm, ExpenseForm, ExamForm, ExamView, BookForm, BookView, Finance, Reports, Notifications, Activity, Settings, PinForm, DriveBackup, YearForm, DictForm, BranchForm, Archive, Calculator, QuickGrades, QuickBooks, QuickSubscriptions } from '../screens/index.js';
import '../style.css';

export class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={hasError:false,error:null}}
  static getDerivedStateFromError(e){return {hasError:true,error:e}}
  componentDidCatch(e,i){console.error('UI Error',e,i)}
  retry=()=>this.setState({hasError:false,error:null});
  render(){
    if(!this.state.hasError)return this.props.children;
    return (
      <div className="fatal" dir="rtl">
        <div className="fatalCard">
          <div className="fatalIcon"><I.ShieldAlert size={32}/></div>
          <h1>GENIUS ADMIN استعاد نفسه</h1>
          <p>حدث خطأ غير متوقع في الواجهة.</p>
          <div className="actions">
            <button className="btn btnPrimary" onClick={this.retry}><I.RefreshCw size={16}/> إعادة المحاولة</button>
            <button className="btn btnSecondary" onClick={()=>window.location.reload()}><I.RotateCcw size={16}/> إعادة التشغيل</button>
          </div>
        </div>
      </div>
    );
  }
}

function Modal({ title, close, children }) {
  return (
    <div className="modalBackdrop" onClick={close}>
      <div className="modalContent" onClick={e=>e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="iconBtn" onClick={close}><I.X size={20}/></button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="menuSection" style={{ marginBottom: '1rem' }}>
      {title && <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>{title}</h4>}
      {children}
    </div>
  );
}

const NAV=[['dashboard','الرئيسية',I.LayoutDashboard],['students','الطلاب',I.Users],['groups','المجموعات',I.Layers3],['schedule','الجدول',I.CalendarDays],['finance','المالية',I.Wallet],['reports','التقارير',I.BarChart3],['settings','الإعدادات',I.Settings]];

function MainApp(){
 const [data,setData]=useState(null),[page,setPage]=useState('dashboard'),[yearId,setYearId]=useState(''),[branchId,setBranchId]=useState('ALL'),[modal,setModal]=useState(null),[selected,setSelected]=useState(null),[presetGroupId,setPresetGroupId]=useState(''),[scanSession,setScanSession]=useState(null),[toast,setToast]=useState(''),[theme,setTheme]=useState('dark'),[globalQuery,setGlobalQuery]=useState(''),[locked,setLocked]=useState(()=>sessionStorage.getItem('genius_auth')!=='1'),[query,setQuery]=useState('');
 const notify=useCallback(m=>{setToast(m);window.clearTimeout(window.__gaToast);const dur=String(m).includes('\n')?4200:2600;window.__gaToast=window.setTimeout(()=>setToast(''),dur)},[]);
 const load=useCallback(async()=>{
   const x={};
   for(const k of stores){
     x[k]=await all(k);
     if(!x[k].length&&defaultData[k]?.length){
       for(const r of defaultData[k])await put(k,r);
       x[k]=defaultData[k];
     }
   }
   const s={...(x.settings[0]||defaultData.settings[0])};
   if (!s.pinHash) {
     try{
       const h=await derivePin(s.pin||'1234');
       s.pinHash=h.hash;s.pinSalt=h.salt;delete s.pin;await put('settings',s);
     }catch{
       s.pinHash=btoa('1234_fixed_salt');s.pinSalt='fixed_salt';await put('settings',s);
     }
   }
   s.accent='#FF0000';s.autoBackupMode=s.autoBackupMode||'DAILY';s.autoLockMinutes=Number(s.autoLockMinutes||15);s.soundEnabled=s.soundEnabled!==false;s.hapticEnabled=s.hapticEnabled!==false;s.notificationsEnabled=s.notificationsEnabled!==false;
   x.settings=[s];const current=x.academicYears.find(y=>y.current)||x.academicYears[0];const month=today().slice(0,7);
   for(const dict of defaultData.dictionaries){if(!x.dictionaries.some(d=>d.id===dict.id)){await put('dictionaries',dict);x.dictionaries.push(dict)}}
   x.students=x.students.map(st=>({...st,discountType:st.discountType||'NONE',discountValue:Number(st.discountValue||0)}));
   const createdCharges=await createMonthlyCharges(x,current?.id,month);if(createdCharges.length)x.payments.push(...createdCharges);
   x.groups=x.groups.map(g=>({...g,academicYearId:g.academicYearId||current?.id}));for(const g of x.groups)await put('groups',g);
   setData(x);setYearId(current?.id||'');setTheme(s.theme||'dark');
 },[]);

 useEffect(()=>{load().catch(e=>{console.error(e);notify('تعذر تحميل قاعدة البيانات')})},[load,notify]);
 const settings=data?.settings?.[0]||{};
 const buzz=useCallback(async()=>{if(!settings.hapticEnabled)return;try{await haptic('LIGHT')}catch{}},[settings.hapticEnabled]);
 const write=useCallback(async(store,row,label)=>{
   const next={...row,updatedAt:new Date().toISOString()};
   await put(store,next);
   const outbox={id:uid('outbox'),createdAt:new Date().toISOString(),store,operation:'UPSERT',recordId:next.id,payload:next,status:'PENDING',attempts:0};
   await put('outbox',outbox);
   setData(x=>({...x,[store]:[...x[store].filter(r=>r.id!==next.id),next],outbox:[...(x.outbox||[]),outbox].slice(-1000)}));
   const act={id:uid('act'),at:new Date().toISOString(),action:label||`تعديل ${store}`,refId:next.id,store};
   await put('activities',act);
   setData(x=>({...x,activities:[...x.activities,act].slice(-500)}));
   return next;
 },[]);

 const softDelete=useCallback(async(store,id,label)=>{
   if(!window.confirm('تأكيد الأرشفة؟ لن يتم حذف البيانات نهائيًا ويمكن استرجاعها.'))return;
   const row=data[store].find(x=>x.id===id);if(!row)return;
   await write(store,{...row,deletedAt:new Date().toISOString(),status:row.status==='نشط'?'مؤرشف':row.status},label||`أرشفة ${store}`);
   notify('تمت الأرشفة ويمكن الاسترجاع');await buzz();
 },[data,write,notify,buzz]);

 const filtered=useMemo(()=>{
   const visible=s=>active(s)&&(!yearId||s.academicYearId===yearId||(!s.academicYearId&&s.storeIndependent))&&(!branchId||branchId==='ALL'||s.branchId===branchId||(!s.branchId&&s.storeIndependent));
   return {groups:(data?.groups||[]).filter(visible),students:(data?.students||[]).filter(visible),sessions:(data?.sessions||[]).filter(visible),books:(data?.books||[]).filter(visible)};
 },[data,yearId,branchId]);

 const groups=filtered.groups,students=filtered.students;
 const globalResults=useMemo(()=>globalSearch(data||{},globalQuery).slice(0,8),[data,globalQuery]);
 const groupBy=useCallback(id=>groups.find(g=>g.id===id),[groups]);
 const studentBy=useCallback(id=>students.find(s=>s.id===id),[students]);
 const dict=useCallback(id=>data?.dictionaries?.find(x=>x.id===id)?.values||[],[data]);
 const chargeTotal=useCallback(s=>data.payments.filter(p=>active(p)&&p.studentId===s.id&&p.type==='CHARGE').reduce((a,p)=>a+Number(p.amount||0),0),[data]);
 const paidTotal=useCallback(s=>data.payments.filter(p=>active(p)&&p.studentId===s.id&&p.type==='PAYMENT').reduce((a,p)=>a+Number(p.amount||0),0),[data]);
 const sessionDue=useCallback(s=>{const g=groupBy(s.groupId);if(g?.pricingModel!=='PER_SESSION')return 0;let unit=Number(s.price||g.price||0);if(s.discountType==='PERCENT')unit-=unit*Number(s.discountValue||0)/100;if(s.discountType==='FIXED')unit-=Number(s.discountValue||0);unit=Math.max(0,unit);return data.attendance.filter(a=>active(a)&&a.studentId===s.id&&a.billable).length*unit},[data,groupBy]);
 const due=useCallback(s=>Math.max(0,chargeTotal(s)+sessionDue(s)-paidTotal(s)),[chargeTotal,sessionDue,paidTotal]);
 const attendanceRate=useCallback(s=>{const a=data.attendance.filter(x=>active(x)&&x.studentId===s.id);return a.length?Math.round(a.filter(x=>x.status==='حاضر'||x.status==='متأخر').length/a.length*100):0},[data]);
 const avg=useCallback(s=>{const a=data.grades.filter(x=>active(x)&&x.studentId===s.id);return a.length?Math.round(a.reduce((z,x)=>z+(Number(x.score||0)/Number(x.maxScore||1))*100,0)/a.length):0},[data]);
 const exportXlsx=useCallback((name,sheets)=>{const wb=XLSX.utils.book_new();for(const [n,rows] of Object.entries(sheets)){const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,n.slice(0,31))}XLSX.writeFile(wb,name)},[]);

 const importStudents=useCallback(async file=>{
   try{
     const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
     const ws=wb.Sheets[wb.SheetNames[0]];
     const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
     let ok=0,bad=0;
     for(const r of rows){
       const name=String(r['الاسم']||r['اسم الطالب']||r.name||'').trim();
       if(!name){bad++;continue}
       const groupName=String(r['المجموعة']||r.group||'').trim();
       const g=groups.find(x=>x.name===groupName)||groups[0];
       const rawCode=String(r['GENIUS ID']||r['ID']||r.code||'').trim();
       const code=rawCode||`${data.academicYears.find(y=>y.id===yearId)?.shortCode||'27'}${String(Date.now()+ok).slice(-4)}`;
       if(data.students.some(x=>active(x)&&x.code===code)||uniqueCodes([...data.students.filter(x=>active(x)),{id:`import_${ok}`,code}]).length){bad++;continue}
       await write('students',{id:uid2('st'),code,name,grade:String(r['الصف']||r.grade||dict('grades')[0]||''),academicYearId:yearId,groupId:g?.id||'',branchId:g?.branchId||'',status:'نشط',studentPhone:String(r['هاتف الطالب']||r.studentPhone||''),parentName:String(r['ولي الأمر']||r.parentName||''),parentPhone:String(r['هاتف ولي الأمر']||r.parentPhone||''),joinDate:today(),price:Number(r['السعر']||r.price||g?.price||0),discountType:'NONE',discountValue:0,level:'',notes:String(r['ملاحظات']||r.notes||'')},'استيراد طالب من Excel');
       ok++;
     }
     notify(`تم استيراد ${ok} طالب — أخطاء/تكرار: ${bad}`);
   }catch(e){console.error(e);notify('تعذر قراءة ملف Excel');}
 },[data,groups,yearId,write,notify,dict]);

 const createBackupFile=useCallback(async({share=false,silent=false}={})=>{
   const payload=await makeBackupEnvelope(await snapshot(),{version:'5.2.0',academicYearId:yearId});
   const json=JSON.stringify(payload,null,2);
   const name=backupFilename();
   const uri=await writeTextFile(name,json);
   if(share){try{await shareFile(uri,'GENIUS ADMIN Backup')}catch{}}
   const meta={id:'last',createdAt:payload.createdAt,fileName:name,schemaVersion:5,checksum:payload.checksum};
   await put('backupMeta',meta);
   setData(x=>({...x,backupMeta:[meta]}));
   if(!silent)notify('تم إنشاء Backup كامل وآمن');
   return {payload,name,uri};
 },[notify,yearId]);

 const backup=useCallback(async()=>{
   try{
     const result=await createBackupFile({share:true});
     if(result?.uri)return;
   }catch(e){
     console.error(e);
     try{
       const payload=await makeBackupEnvelope(await snapshot(),{version:'5.2.0',academicYearId:yearId});
       const json=JSON.stringify(payload,null,2);
       const name=backupFilename();
       const blob=new Blob([json],{type:'application/json'});
       const a=document.createElement('a');
       a.href=URL.createObjectURL(blob);
       a.download=name;
       a.click();
       setTimeout(()=>URL.revokeObjectURL(a.href),1000);
       await put('backupMeta',{id:'last',createdAt:payload.createdAt,fileName:name,schemaVersion:5,checksum:payload.checksum});
       notify('تم إنشاء Backup آمن');
     }catch(err){console.error(err);notify('فشل إنشاء النسخة الاحتياطية');}
   }
 },[createBackupFile,notify,yearId]);

 const restoreFile=useCallback(async e=>{
   const file=e.target.files?.[0];
   e.target.value='';
   if(!file)return;
   if(!confirm('سيتم إنشاء نقطة أمان ثم استبدال البيانات الحالية بالنسخة المختارة. هل تريد المتابعة؟'))return;
   try{
     const raw=JSON.parse(await file.text());
     if(!validBackup(raw))throw new Error('INVALID_BACKUP_SHAPE');
     await verifyBackupEnvelope(raw);
     await createBackupFile({share:false,silent:true});
     await restore(raw);
     location.reload();
   }catch(err){console.error(err);notify('ملف Backup غير صالح أو تالف — لم يتم تغيير بياناتك');}
 },[notify,createBackupFile]);

 useEffect(()=>{
   if(!data||locked||settings.autoBackupMode==='OFF')return;
   const last=data.backupMeta?.find(x=>x.id==='last');
   const age=last?.createdAt?Date.now()-new Date(last.createdAt).getTime():Infinity;
   const threshold=settings.autoBackupMode==='WEEKLY'?7*86400000:86400000;
   if(age<threshold)return;
   createBackupFile({share:false,silent:true}).catch(()=>{});
 },[data,locked,settings.autoBackupMode,createBackupFile]);

 const whatsapp=useCallback((phone,text)=>{
   const n=egPhone(phone);
   if(!n)return notify('لا يوجد رقم واتساب محفوظ');
   window.open(`https://wa.me/${n}?text=${encodeURIComponent(text||'')}`,'_blank','noopener');
 },[notify]);

 const scheduleSessions=useCallback(async(days=90)=>{
   let made=0;const start=new Date();start.setHours(0,0,0,0);
   for(const g of groups){
     for(let i=0;i<=days;i++){
       const dt=new Date(start);dt.setDate(dt.getDate()+i);
       const iso=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
       const day=dt.toLocaleDateString('ar-EG',{weekday:'long'});
       for(const slot of g.schedule||[]){
         if(slot.day!==day)continue;
         const exists=data.sessions.some(s=>active(s)&&s.groupId===g.id&&s.date===iso&&s.timeStart===slot.start);
         if(!exists){
           await write('sessions',{id:uid2('ses'),groupId:g.id,academicYearId:g.academicYearId,date:iso,day,timeStart:slot.start,timeEnd:slot.end,status:'UPCOMING'},'توليد حصة تلقائيًا');
           made++;
         }
       }
     }
   }
   notify(`تم توليد ${made} حصة`);await buzz();
 },[data,groups,write,notify,buzz]);

 const lockApp=useCallback(()=>{sessionStorage.removeItem('genius_auth');setLocked(true);notify('تم قفل التطبيق تلقائيًا')},[notify]);
 useAutoLock({enabled:Boolean(data&&!locked),minutes:settings.autoLockMinutes,onLock:lockApp});

 useEffect(()=>{
   if(!data||locked)return;
   let remove;
   import('@capacitor/app').then(({App})=>{
     App.addListener('backButton',({canGoBack})=>{
       if(modal){setModal(null);return}
       if(page!=='dashboard'){setPage('dashboard');return}
       if(canGoBack)history.back();else App.exitApp();
     }).then(x=>{remove=()=>x.remove()});
   }).catch(()=>{});
   return()=>remove?.();
 },[data,locked,modal,page]);

 useEffect(()=>{configureNative().catch(()=>{})},[]);
 useEffect(()=>{
   if(!data||locked||!settings.notificationsEnabled)return;
   syncRuleNotifications(data).then(rows=>{
     if(rows.length)setData(x=>({...x,notifications:[...(x.notifications||[]),...rows]}));
   }).catch(()=>{});
 },[data,locked,settings.notificationsEnabled]);

 if(!data)return (
   <div className="splash" dir="rtl">
     <div className="splashIcon"><I.Cpu size={48}/></div>
     <b>GENIUS ADMIN PREMIUM</b>
     <small>Offline First • جاري تجهيز النظام...</small>
   </div>
 );

 if(locked)return <Login settings={settings} onOk={()=>{sessionStorage.setItem('genius_auth','1');setLocked(false)}}/>;
 const go=id=>setPage(id);
 const pageProps={data,settings,groups,students,groupBy,studentBy,dict,due,attendanceRate,avg,yearId,branchId,setBranchId,setYearId,setModal,setSelected,selected,presetGroupId,setPresetGroupId,scanSession,setScanSession,query,setQuery,write,softDelete,notify,buzz,whatsapp,exportXlsx,importStudents,backup,restoreFile,scheduleSessions,go};

 return (
   <div className={`app ${theme}`} dir="rtl">
    <header className="topbar">
      <button className="iconBtn" onClick={()=>setModal('menu')}><I.Menu size={20}/></button>
      <div className="brand">
        <div className="brandIcon"><I.Zap size={22}/></div>
        <div className="brandTitle">
          <strong>GENIUS ADMIN</strong>
          <small>ENTERPRISE SYSTEM</small>
        </div>
      </div>
      <div className="globalSearch">
        <I.Search size={18} className="searchIcon"/>
        <input value={globalQuery} onChange={e=>setGlobalQuery(e.target.value)} placeholder="بحث شامل في النظام..."/>
        {globalQuery && (
          <div className="globalResults">
            {globalResults.map(r=>(
              <button key={`${r.store}_${r.id}`} onClick={()=>{setGlobalQuery("");if(r.store==="students"){setPage("students");setQuery(r.title)}else if(r.store==="groups"){setPage("groups");setQuery(r.title)}else setPage(r.store==="expenses"||r.store==="payments"?"finance":"reports")}}>
                <b>{r.title}</b>
                <small>{r.store} • {r.subtitle}</small>
              </button>
            ))}
            {!globalResults.length && <small className="globalEmpty">لا توجد نتائج مطابقة</small>}
          </div>
        )}
      </div>
      <div className="topSelects">
        <select className="yearSelect branchSelect" value={branchId} onChange={e=>setBranchId(e.target.value)}>
          <option value="ALL">كل الفروع</option>
          {data.branches.filter(active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="yearSelect" value={yearId} onChange={e=>setYearId(e.target.value)}>
          {data.academicYears.filter(active).map(y=><option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </div>
      <div className="topActions">
        <button className="iconBtn notifyBtn" onClick={()=>go('notifications')}>
          <I.Bell size={20}/>
          {data.notifications.filter(n=>active(n)&&!n.read).length>0 && (
            <i className="badge">{data.notifications.filter(n=>active(n)&&!n.read).length}</i>
          )}
        </button>
        <button className="iconBtn" onClick={()=>setTheme(x=>x==='dark'?'light':'dark')}>
          <I.SunMoon size={20}/>
        </button>
      </div>
    </header>

    <main className="mainContainer">
      {page==='dashboard'&&<Dashboard {...pageProps}/>} 
      {page==='students'&&<Students {...pageProps}/>} 
      {page==='groups'&&<Groups {...pageProps}/>} 
      {page==='schedule'&&<Schedule {...pageProps}/>} 
      {page==='finance'&&<Finance {...pageProps}/>} 
      {page==='reports'&&<Reports {...pageProps}/>} 
      {page==='notifications'&&<Notifications {...pageProps}/>} 
      {page==='settings'&&<Settings {...pageProps}/>} 
      {page==='archive'&&<Archive {...pageProps}/>} 
      {page==='activity'&&<Activity {...pageProps}/>}
    </main>

    <nav className="bottomNav">
      {NAV.slice(0,5).map(([id,label,Icon])=>(
        <button key={id} className={`navItem ${page===id?'active':''}`} onClick={()=>go(id)}>
          <Icon size={20}/>
          <span>{label}</span>
        </button>
      ))}
    </nav>

    {toast && <div className="toast">{toast}</div>}

    {modal==='menu' && (
      <Modal title="قائمة النظام الشاملة" close={()=>setModal(null)}>
        <Section title="أدوات وإجراءات سريعة">
          <div className="menuGrid">
            {[['calculator','آلة حاسبة',I.Calculator,()=>setModal('calculator')],['quickGrades','درجات سريعة',I.GraduationCap,()=>setModal('quickGrades')],['payment','دفعة سريعة',I.Banknote,()=>{setSelected(null);setModal('payment')}],['quickBooks','تسليم كتاب',I.BookOpen,()=>setModal('quickBooks')],['quickSubscriptions','تسديد الاشتراكات',I.RefreshCcw,()=>setModal('quickSubscriptions')]].map(([id,l,Icon,fn])=>(
              <button key={id} className="menuItem" onClick={()=>{setModal(null);fn()}}>
                <Icon size={22}/>
                <span>{l}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="التنقل">
          <div className="menuGrid">
            {[['reports','التقارير',I.BarChart3],['notifications','الإشعارات',I.Bell],['activity','سجل العمليات',I.History],['archive','الأرشيف',I.Archive],['settings','الإعدادات',I.Settings]].map(([id,l,Icon])=>(
              <button key={id} className="menuItem" onClick={()=>{setModal(null);go(id)}}>
                <Icon size={22}/>
                <span>{l}</span>
              </button>
            ))}
          </div>
        </Section>
      </Modal>
    )}

    {modal==='student'&&<StudentForm {...pageProps}/>} 
    {modal==='studentView'&&selected&&<Student360 {...pageProps} student={selected}/>} 
    {modal==='card'&&selected&&<StudentCard {...pageProps} student={selected}/>} 
    {modal==='report'&&selected&&<ReportForm {...pageProps}/>} 
    {modal==='group'&&<GroupForm {...pageProps}/>} 
    {modal==='groupView'&&selected&&<GroupView {...pageProps}/>}
    {modal==='session'&&<SessionForm {...pageProps}/>} 
    {modal==='attendance'&&selected&&<AttendanceModal {...pageProps} session={selected}/>} 
    {modal==='payment'&&<PaymentForm {...pageProps}/>} 
    {modal==='expense'&&<ExpenseForm {...pageProps}/>} 
    {modal==='exam'&&<ExamForm {...pageProps}/>} 
    {modal==='examView'&&selected&&<ExamView {...pageProps} exam={selected}/>} 
    {modal==='book'&&<BookForm {...pageProps}/>} 
    {modal==='bookView'&&selected&&<BookView {...pageProps} book={selected}/>} 
    {modal==='dict'&&<DictForm {...pageProps}/>} 
    {modal==='year'&&<YearForm {...pageProps}/>} 
    {modal==='pin'&&<PinForm {...pageProps}/>} 
    {modal==='drive'&&<DriveBackup {...pageProps}/>} 
    {modal==='branches'&&<BranchForm {...pageProps}/>} 
    {modal==='calculator'&&<Calculator {...pageProps}/>} 
    {modal==='quickGrades'&&<QuickGrades {...pageProps}/>} 
    {modal==='quickBooks'&&<QuickBooks {...pageProps}/>} 
    {modal==='quickSubscriptions'&&<QuickSubscriptions {...pageProps}/>}
    {modal==='scan'&&<Scanner {...pageProps}/>} 
   </div>
 );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
