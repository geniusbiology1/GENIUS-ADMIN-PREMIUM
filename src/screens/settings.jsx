import React,{useState} from 'react';
import * as I from 'lucide-react';
import {today,uid2} from '../utils/format.js';
import {derivePin} from '../services/security.js';
import {writeTextFile} from '../native.js';
import {snapshot,restore} from '../db.js';
import {makeBackupEnvelope,verifyBackupEnvelope} from '../engines/backup/index.js';
import {ensureBackupFolder,uploadBackup,listBackups,downloadBackup} from '../services/googleDrive/drive.js';
import {isActive as active} from '../db.js';
import {Screen,Section,Card,Row,Empty,Modal,Field} from '../components/ui.jsx';

export function Settings(p){const s=p.settings;const save=async(key,value)=>{await p.write('settings',{...s,[key]:value},`تغيير إعداد ${key}`);p.notify('تم حفظ الإعداد')};const savePrint=async(key,value)=>{await p.write('settings',{...s,printCosts:{...(s.printCosts||{}),[key]:Number(value)||0}},'تغيير تكلفة طباعة');p.notify('تم حفظ سعر الطباعة')};return <Screen title="الإعدادات"><Section title="الأمان"><Card><div className="between"><div><h3>PIN الدخول</h3><small>Hash + Salt — لا يتم تخزين PIN كنص صريح</small></div><button className="btn" onClick={()=>p.setModal('pin')}>تغيير PIN</button></div><div className="rowItem"><div><b>القفل التلقائي</b><small>بعد عدد الدقائق المحدد</small></div><input className="input smallInput" type="number" value={s.autoLockMinutes} onChange={e=>save('autoLockMinutes',Number(e.target.value))}/></div></Card></Section><Section title="Backup & Restore"><Card><div className="rowItem"><div><b>النسخ التلقائي</b><small>محليًا داخل ملفات التطبيق — بدون إنترنت</small></div><select className="input smallInput" value={s.autoBackupMode||'DAILY'} onChange={e=>save('autoBackupMode',e.target.value)}><option value="DAILY">يومي</option><option value="WEEKLY">أسبوعي</option><option value="OFF">إيقاف</option></select></div><div className="actions"><button className="btn" onClick={p.backup}>Backup كامل</button><label className="fileBtn">Restore JSON<input type="file" accept="application/json,.json" onChange={p.restoreFile}/></label><button className="btn secondary" onClick={()=>p.setModal('drive')}>Google Drive</button></div><p className="hint">آخر Backup محلي: {p.data.backupMeta?.find(x=>x.id==='last')?.createdAt?new Date(p.data.backupMeta.find(x=>x.id==='last').createdAt).toLocaleString('ar-EG'):'لم يتم إنشاء نسخة بعد'}<br/>Google Drive مخصص للنسخ الاحتياطي فقط. التشغيل اليومي لا يعتمد على الإنترنت.</p></Card></Section><Section title="الهوية"><Card><div className="formGrid">
 <Field label="اسم النظام"><input className="input" value={s.name} onChange={e=>save('name',e.target.value)} placeholder="مثال: GENIUS BIOLOGY"/></Field>
 <Field label="اسم المدرس"><input className="input" value={s.teacher} onChange={e=>save('teacher',e.target.value)} placeholder="اسمك"/></Field>
 <Field label="رقم الهاتف"><input className="input" type="tel" value={s.phone} onChange={e=>save('phone',e.target.value)} placeholder="01xxxxxxxxx"/></Field>
 <Field label="بادئة GENIUS ID" hint="تظهر في بداية كود كل طالب جديد"><input className="input" value={s.idPrefix||'GB'} onChange={e=>save('idPrefix',e.target.value.toUpperCase())} placeholder="GB"/></Field>
 <Field label="قالب بطاقة الطالب" hint="يُطبّق على كل بطاقات GENIUS ID تلقائيًا"><select className="input" value={s.cardTemplate||'classic'} onChange={e=>save('cardTemplate',e.target.value)}><option value="classic">كلاسيك (متوسط)</option><option value="bold">بولد (ملوّن)</option><option value="compact">مضغوط (أفقي)</option></select></Field>
</div></Card></Section><Section title="صيغة التقرير المرسل لولي الأمر"><Card><p className="hint">تقدر تستخدم {'{name}'} و{'{code}'} و{'{group}'} داخل النص وهيتم استبدالها ببيانات الطالب تلقائيًا. المقدمة والخاتمة بتتطبق على كل تقارير الطلاب.</p>
 <Field label="مقدمة التقرير"><textarea className="input textarea" value={s.reportIntro||''} onChange={e=>save('reportIntro',e.target.value)} placeholder={'GENIUS BIOLOGY — تقرير الطالب\nالاسم: {name}\nGENIUS ID: {code}\nالمجموعة: {group}'}/></Field>
 <Field label="خاتمة التقرير (اختياري)"><textarea className="input textarea" value={s.reportOutro||''} onChange={e=>save('reportOutro',e.target.value)} placeholder="مثال: نتمنى لابنكم دوام التوفيق — إدارة GENIUS BIOLOGY"/></Field>
</Card></Section><Section title="تكاليف الطباعة" ><Card><p className="hint">أسعار مدخلات طباعة المذكرات — تُستخدم لاحتساب تكلفة أي كتاب أوتوماتيكيًا من شاشة "إضافة كتاب".</p><div className="formGrid">
 <Field label="سعر الورقة الواحدة (بالجنيه)"><input className="input" type="number" step="0.1" value={s.printCosts?.paper??0} onChange={e=>savePrint('paper',e.target.value)}/></Field>
 <Field label="سعر التجليد/التكعيب (بالجنيه)"><input className="input" type="number" step="0.1" value={s.printCosts?.binding??0} onChange={e=>savePrint('binding',e.target.value)}/></Field>
 <Field label="سعر الغلاف الواحد (بالجنيه)"><input className="input" type="number" step="0.1" value={s.printCosts?.cover??0} onChange={e=>savePrint('cover',e.target.value)}/></Field>
 <Field label="سعر النوتة/الملحق الإضافي (بالجنيه)"><input className="input" type="number" step="0.1" value={s.printCosts?.notes??0} onChange={e=>savePrint('notes',e.target.value)}/></Field>
</div></Card></Section><Section title="تجربة Android"><Card><div className="rowItem"><div><b>اهتزازات</b><small>Haptics عند العمليات المهمة</small></div><input type="checkbox" checked={s.hapticEnabled!==false} onChange={e=>save('hapticEnabled',e.target.checked)}/></div><div className="rowItem"><div><b>الأصوات/التنبيهات</b><small>تشغيل التنبيهات داخل التطبيق</small></div><input type="checkbox" checked={s.notificationsEnabled!==false} onChange={e=>save('notificationsEnabled',e.target.checked)}/></div></Card></Section><Section title="حالة البيانات"><Card><div className="stats"><div className="stat"><b>{p.data.outbox?.filter(x=>x.status==='PENDING').length||0}</b><small>عمليات Pending للمزامنة</small></div><div className="stat"><b>{p.data.activities?.length||0}</b><small>سجل عمليات</small></div></div><p className="hint">Outbox محلي لتجميع العمليات القابلة للمزامنة لاحقًا. لا تعتمد عليه وظائف التشغيل اليومية.</p></Card></Section><Section title="البيانات والقواميس"><div className="actions"><button className="btn" onClick={()=>p.setModal('year')}>إدارة السنوات</button><button className="btn secondary" onClick={()=>p.setModal('branches')}>الفروع</button><button className="btn secondary" onClick={()=>p.setModal('dict')}>القواميس</button><button className="btn secondary" onClick={()=>p.go('archive')}>الأرشيف</button></div></Section></Screen>}


export function PinForm(p){const [a,setA]=useState(''),[b,setB]=useState('');return <Modal title="تغيير PIN" close={()=>p.setModal(null)}><div className="space">
 <Field label="PIN جديد" hint="٤ أرقام على الأقل"><input className="input bigInput" type="password" inputMode="numeric" value={a} onChange={e=>setA(e.target.value)} placeholder="••••"/></Field>
 <Field label="تأكيد PIN"><input className="input bigInput" type="password" inputMode="numeric" value={b} onChange={e=>setB(e.target.value)} placeholder="••••"/></Field>
 <button className="btn wide" onClick={async()=>{if(a.length<4||a!==b)return p.notify('PIN يجب أن يكون 4 أرقام على الأقل ومتطابقًا');const h=await derivePin(a);await p.write('settings',{...p.settings,pinHash:h.hash,pinSalt:h.salt},'تغيير PIN');p.setModal(null);p.notify('تم تغيير PIN بنجاح')}}>حفظ PIN</button></div></Modal>}


export function DriveBackup(p){
 const [client,setClient]=useState(p.settings.driveClientId||'');
 const [busy,setBusy]=useState(false),[files,setFiles]=useState([]),[folderId,setFolderId]=useState(p.settings.driveFolderId||'');
 const tokenRef=React.useRef('');
 const loadGIS=()=>new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error('GIS_LOAD_FAILED'));document.head.appendChild(script)});
 const auth=async()=>{
  if(!client.trim())return p.notify('أدخل Google OAuth Client ID أولًا');
  await loadGIS();if(!window.google?.accounts?.oauth2)return p.notify('تعذر تحميل Google Identity — تأكد من اتصال الإنترنت');
  setBusy(true);
  try{
   const token=await new Promise((resolve,reject)=>{const c=window.google.accounts.oauth2.initTokenClient({client_id:client.trim(),scope:'https://www.googleapis.com/auth/drive.file',callback:r=>r?.access_token?resolve(r.access_token):reject(new Error('OAUTH_FAILED'))});c.requestAccessToken({prompt:'consent'});});
   tokenRef.current=token;
   const folder=folderId?{id:folderId}:await ensureBackupFolder(token);
   setFolderId(folder.id);
   await p.write('settings',{...p.settings,driveClientId:client.trim(),driveFolderId:folder.id},'حفظ إعداد Google Drive');
   setFiles(await listBackups(token,folder.id));p.notify('تم الاتصال بمجلد GENIUS ADMIN BACKUPS');
  }catch(e){console.error(e);p.notify('فشل الاتصال بـ Google Drive')}finally{setBusy(false)}
 };
 const upload=async()=>{
  setBusy(true);
  try{
   if(!tokenRef.current)await auth();
   const token=tokenRef.current;if(!token)throw new Error('NO_TOKEN');
   const folder=folderId|| (await ensureBackupFolder(token)).id;setFolderId(folder);
   const payload=await makeBackupEnvelope(await snapshot(),{version:'5.2.0',academicYearId:p.yearId});
   const name=`GENIUS_ADMIN_BACKUP_${today()}_${Date.now()}.json`;
   await uploadBackup({accessToken:token,fileName:name,json:JSON.stringify(payload),folderId:folder});
   await p.write('backupMeta',{id:'drive-last',createdAt:payload.createdAt,provider:'google-drive',fileName:name,schemaVersion:5,checksum:payload.checksum,folderId:folder},'حفظ بيانات Google Drive Backup');
   setFiles(await listBackups(token,folder));p.notify('تم رفع Backup موثق إلى Google Drive');
  }catch(e){console.error(e);p.notify('فشل رفع Backup إلى Google Drive')}finally{setBusy(false)}
 };
 const disconnect=()=>{tokenRef.current='';setFiles([]);p.notify('تم فصل جلسة Google Drive — يمكنك إعادة الاتصال');};
 const restoreDrive=async file=>{
  setBusy(true);
  try{
   if(!tokenRef.current)throw new Error('AUTH_REQUIRED');
   const raw=JSON.parse(await downloadBackup(tokenRef.current,file.id));
   await verifyBackupEnvelope(raw);
   if(!confirm('سيتم أخذ نقطة أمان ثم استبدال البيانات الحالية. هل تريد المتابعة؟'))return;
   try{const safety=await makeBackupEnvelope(await snapshot(),{version:'5.2.0',academicYearId:p.yearId});await writeTextFile(`GENIUS_ADMIN_PRE_RESTORE_${Date.now()}.json`,JSON.stringify(safety));}catch{}
   await restore(raw);location.reload();
  }catch(e){console.error(e);p.notify('تعذر استعادة النسخة — لم يتم تغيير البيانات إذا كان الملف غير صالح')}finally{setBusy(false)}
 };
 return <Modal title="Google Drive — Backup فقط" close={()=>p.setModal(null)}><div className="space"><p className="hint">Drive طبقة Backup خارجية فقط. التشغيل اليومي Offline First ولا يعتمد على Google.</p><input className="input" value={client} onChange={e=>setClient(e.target.value)} placeholder="Google OAuth Client ID"/><div className="actions"><button className="btn" disabled={busy} onClick={auth}>{busy?'جاري…':'اتصال Google Drive'}</button><button className="btn secondary" disabled={busy} onClick={upload}>Backup إلى Drive</button><button className="btn secondary" disabled={busy} onClick={disconnect}>فصل</button></div><Section title="آخر النسخ"><div className="list">{files.map(f=><Row key={f.id} title={f.name} sub={`${f.modifiedTime?new Date(f.modifiedTime).toLocaleString('ar-EG'):''} • ${f.size||'—'} bytes`} action={<button className="btn" disabled={busy} onClick={()=>restoreDrive(f)}>Restore</button>}/>)}</div>{!files.length&&<Empty text="اتصل بـ Google Drive لعرض النسخ"/>}</Section></div></Modal>}

export function BranchForm(p){
 const [name,setName]=useState('');
 const branches=p.data.branches.filter(active);
 const add=async()=>{if(!name.trim())return p.notify('أدخل اسم الفرع');await p.write('branches',{id:uid2('br'),name:name.trim()},'إضافة فرع');setName('')};
 const rename=async(b)=>{const v=prompt('اسم الفرع الجديد',b.name);if(!v||!v.trim())return;await p.write('branches',{...b,name:v.trim()},'تعديل اسم فرع')};
 const archiveBranch=async(b)=>{if(p.data.students.some(s=>active(s)&&s.branchId===b.id))return p.notify('لا يمكن أرشفة فرع مرتبط بطلاب حاليين');await p.softDelete('branches',b.id,'أرشفة فرع')};
 return <Modal title="إدارة الفروع" close={()=>p.setModal(null)}><div className="space">
  <div className="row"><Field label="اسم الفرع الجديد"><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: طنطا"/></Field><button className="btn" onClick={add}>إضافة</button></div>
  <div className="list">{branches.map(b=><Row key={b.id} title={b.name} sub={`${p.data.students.filter(s=>active(s)&&s.branchId===b.id).length} طالب`} action={<div className="actions"><button className="btn secondary" onClick={()=>rename(b)}>تعديل</button><button className="danger" onClick={()=>archiveBranch(b)}>أرشفة</button></div>}/>)}</div>
  {!branches.length&&<Empty text="لا يوجد فروع بعد"/>}
 </div></Modal>}


export function YearForm(p){const [f,setF]=useState({id:uid2('yr'),name:'',shortCode:'',start:'',end:'',current:false});return <Modal title="سنة دراسية جديدة" close={()=>p.setModal(null)}><div className="space">
 <Field label="اسم السنة الدراسية" required><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="2027 - 2028"/></Field>
 <Field label="كود السنة (رقمان)" required hint="يُستخدم في بداية أكواد الطلاب"><input className="input" value={f.shortCode} maxLength="2" onChange={e=>setF({...f,shortCode:e.target.value.replace(/\D/g,'').slice(-2)})} placeholder="28"/></Field>
 <div className="row">
  <Field label="تاريخ البداية"><input className="input" type="date" value={f.start} onChange={e=>setF({...f,start:e.target.value})}/></Field>
  <Field label="تاريخ النهاية"><input className="input" type="date" value={f.end} onChange={e=>setF({...f,end:e.target.value})}/></Field>
 </div>
 <label className="check"><input type="checkbox" checked={f.current} onChange={e=>setF({...f,current:e.target.checked})}/> السنة الحالية</label>
 <button className="btn wide" onClick={async()=>{if(!f.name||f.shortCode.length!==2)return p.notify('أكمل البيانات');if(f.current)for(const y of p.data.academicYears)if(y.current)await p.write('academicYears',{...y,current:false},'تغيير السنة الحالية');await p.write('academicYears',f,'إضافة سنة دراسية');p.setModal(null);p.notify('تمت إضافة السنة')}}>حفظ</button></div></Modal>}


export function DictForm(p){const [type,setType]=useState(p.data.dictionaries[0]?.id||''),[val,setVal]=useState('');const item=p.data.dictionaries.find(x=>x.id===type);return <Modal title="القواميس" close={()=>p.setModal(null)}><div className="space">
 <Field label="القاموس"><select className="input" value={type} onChange={e=>setType(e.target.value)}>{p.data.dictionaries.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
 <div className="list">{(item?.values||[]).map(v=><Row key={v} title={v} action={<button className="danger" onClick={()=>p.write('dictionaries',{...item,values:item.values.filter(x=>x!==v)},'حذف قيمة من قاموس')}>حذف</button>}/>)}</div>
 <div className="row"><Field label="قيمة جديدة"><input className="input" value={val} onChange={e=>setVal(e.target.value)} placeholder="أضف قيمة للقاموس"/></Field><button className="btn" onClick={async()=>{if(!val.trim())return;await p.write('dictionaries',{...item,values:[...item.values,val.trim()]},'إضافة قيمة للقاموس');setVal('')}}>إضافة</button></div></div></Modal>}


export function Archive(p){const stores=['students','groups','sessions','attendance','exams','grades','books','studentBooks','payments','expenses'];const items=stores.flatMap(store=>p.data[store].filter(x=>x.deletedAt).map(x=>({store,x})));return <Screen title="الأرشيف"><div className="list">{items.map(({store,x})=><Card key={`${store}_${x.id}`}><div className="between"><div><h3>{x.name||x.title||x.id}</h3><small>{store} • {new Date(x.deletedAt).toLocaleString('ar-EG')}</small></div><button className="btn" onClick={()=>p.write(store,{...x,deletedAt:null,status:store==='students'?'نشط':x.status},'استرجاع من الأرشيف')}>استرجاع</button></div></Card>)}{!items.length&&<Empty text="الأرشيف فارغ"/>}</div></Screen>}
