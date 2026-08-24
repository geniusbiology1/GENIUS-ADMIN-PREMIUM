import React,{useState} from 'react';
import * as I from 'lucide-react';
import {today,uid2} from '../utils/format.js';
import {derivePin} from '../services/security.js';
import {writeTextFile} from '../native.js';
import {snapshot,restore} from '../db.js';
import {makeBackupEnvelope,verifyBackupEnvelope} from '../engines/backup/index.js';
import {ensureBackupFolder,uploadBackup,listBackups,downloadBackup} from '../services/googleDrive/drive.js';
import {planPromotion} from '../engines/students/promotion.js';
import {isActive as active} from '../db.js';
import {Screen,Section,Card,Row,Empty,Modal} from '../components/ui.jsx';

export function Settings(p){const s=p.settings;const save=async(key,value)=>{await p.write('settings',{...s,[key]:value},`تغيير إعداد ${key}`);p.notify('تم حفظ الإعداد')};return <Screen title="الإعدادات"><Section title="الأمان"><Card><div className="between"><div><h3>PIN الدخول</h3><small>Hash + Salt — لا يتم تخزين PIN كنص صريح</small></div><button className="btn" onClick={()=>p.setModal('pin')}>تغيير PIN</button></div><div className="rowItem"><div><b>القفل التلقائي</b><small>بعد عدد الدقائق المحدد</small></div><input className="input smallInput" type="number" value={s.autoLockMinutes} onChange={e=>save('autoLockMinutes',Number(e.target.value))}/></div></Card></Section><Section title="Backup & Restore"><Card><div className="rowItem"><div><b>النسخ التلقائي</b><small>محليًا داخل ملفات التطبيق — بدون إنترنت</small></div><select className="input smallInput" value={s.autoBackupMode||'DAILY'} onChange={e=>save('autoBackupMode',e.target.value)}><option value="DAILY">يومي</option><option value="WEEKLY">أسبوعي</option><option value="OFF">إيقاف</option></select></div><div className="actions"><button className="btn" onClick={p.backup}>Backup كامل</button><label className="fileBtn">Restore JSON<input type="file" accept="application/json,.json" onChange={p.restoreFile}/></label><button className="btn secondary" onClick={()=>p.setModal('drive')}>Google Drive</button></div><p className="hint">آخر Backup محلي: {p.data.backupMeta?.find(x=>x.id==='last')?.createdAt?new Date(p.data.backupMeta.find(x=>x.id==='last').createdAt).toLocaleString('ar-EG'):'لم يتم إنشاء نسخة بعد'}<br/>Google Drive مخصص للنسخ الاحتياطي فقط. التشغيل اليومي لا يعتمد على الإنترنت.</p></Card></Section><Section title="الهوية"><Card><div className="formGrid"><input className="input" value={s.name} onChange={e=>save('name',e.target.value)} placeholder="اسم النظام"/><input className="input" value={s.teacher} onChange={e=>save('teacher',e.target.value)} placeholder="اسم المدرس"/><input className="input" value={s.phone} onChange={e=>save('phone',e.target.value)} placeholder="الهاتف"/><input className="input" value={s.idPrefix||'GB'} onChange={e=>save('idPrefix',e.target.value.toUpperCase())} placeholder="Prefix ID"/></div></Card></Section><Section title="تجربة Android"><Card><div className="rowItem"><div><b>اهتزازات</b><small>Haptics عند العمليات المهمة</small></div><input type="checkbox" checked={s.hapticEnabled!==false} onChange={e=>save('hapticEnabled',e.target.checked)}/></div><div className="rowItem"><div><b>الأصوات/التنبيهات</b><small>تشغيل التنبيهات داخل التطبيق</small></div><input type="checkbox" checked={s.notificationsEnabled!==false} onChange={e=>save('notificationsEnabled',e.target.checked)}/></div></Card></Section><Section title="حالة البيانات"><Card><div className="stats"><div className="stat"><b>{p.data.outbox?.filter(x=>x.status==='PENDING').length||0}</b><small>عمليات Pending للمزامنة</small></div><div className="stat"><b>{p.data.activities?.length||0}</b><small>سجل عمليات</small></div></div><p className="hint">Outbox محلي لتجميع العمليات القابلة للمزامنة لاحقًا. لا تعتمد عليه وظائف التشغيل اليومية.</p></Card></Section><Section title="البيانات والقواميس"><div className="actions"><button className="btn" onClick={()=>p.setModal('year')}>إدارة السنوات</button><button className="btn secondary" onClick={()=>p.setModal('dict')}>القواميس</button><button className="btn secondary" onClick={()=>p.go('archive')}>الأرشيف</button><button className="btn secondary" onClick={()=>p.setModal('promotion')}>ترقية سنة</button></div></Section></Screen>}


export function PinForm(p){const [a,setA]=useState(''),[b,setB]=useState('');return <Modal title="تغيير PIN" close={()=>p.setModal(null)}><div className="space"><input className="input bigInput" type="password" inputMode="numeric" value={a} onChange={e=>setA(e.target.value)} placeholder="PIN جديد"/><input className="input bigInput" type="password" inputMode="numeric" value={b} onChange={e=>setB(e.target.value)} placeholder="تأكيد PIN"/><button className="btn wide" onClick={async()=>{if(a.length<4||a!==b)return p.notify('PIN يجب أن يكون 4 أرقام على الأقل ومتطابقًا');const h=await derivePin(a);await p.write('settings',{...p.settings,pinHash:h.hash,pinSalt:h.salt},'تغيير PIN');p.setModal(null);p.notify('تم تغيير PIN بنجاح')}}>حفظ PIN</button></div></Modal>}


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

export function PromotionForm(p){
 const years=p.data.academicYears.filter(x=>!x.deletedAt);const from=years.find(x=>x.id===p.yearId)||years.find(x=>x.current)||years[0];const [to,setTo]=useState(years.find(x=>x.id!==from?.id)?.id||'');const [busy,setBusy]=useState(false);
 const run=async()=>{if(!from||!to||from.id===to)return p.notify('اختر سنة مصدر وسنة هدف مختلفة');setBusy(true);try{const targetGroups=p.data.groups.filter(g=>!g.deletedAt&&g.academicYearId===to);const groupMap={};for(const s of p.students.filter(x=>x.academicYearId===from.id&&active(x))){const old=p.groupBy(s.groupId);const match=targetGroups.find(g=>g.name===old?.name);if(match)groupMap[s.groupId]=match.id}const rows=planPromotion(p.data,{fromYearId:from.id,toYearId:to,groupMap,priceMap:Object.fromEntries(targetGroups.map(g=>[g.id,g.price]))});for(const row of rows)await p.write('students',row,'ترقية طالب للسنة الجديدة');p.setModal(null);p.notify(`تمت ترقية ${rows.length} طالب مع الاحتفاظ بسجل السنة السابقة`)}finally{setBusy(false)}};
 return <Modal title="ترقية الطلاب للسنة الجديدة" close={()=>p.setModal(null)}><div className="space"><p className="hint">يتم إنشاء سجل طالب جديد للسنة الهدف بدون نسخ الحضور أو الدرجات القديمة. السجل السابق يظل كما هو.</p><select className="input" value={from?.id||''} disabled><option value={from?.id}>{from?.name||'—'}</option></select><select className="input" value={to} onChange={e=>setTo(e.target.value)}><option value="">اختر السنة الهدف</option>{years.filter(y=>y.id!==from?.id).map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select><button className="btn wide" disabled={busy} onClick={run}>{busy?'جاري الترقية…':'ترقية الطلاب'}</button></div></Modal>}


export function YearForm(p){const [f,setF]=useState({id:uid2('yr'),name:'',shortCode:'',start:'',end:'',current:false});return <Modal title="سنة دراسية جديدة" close={()=>p.setModal(null)}><div className="space"><input className="input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="2027 - 2028"/><input className="input" value={f.shortCode} maxLength="2" onChange={e=>setF({...f,shortCode:e.target.value.replace(/\D/g,'').slice(-2)})} placeholder="كود السنة 28"/><input className="input" type="date" value={f.start} onChange={e=>setF({...f,start:e.target.value})}/><input className="input" type="date" value={f.end} onChange={e=>setF({...f,end:e.target.value})}/><label className="check"><input type="checkbox" checked={f.current} onChange={e=>setF({...f,current:e.target.checked})}/> السنة الحالية</label><button className="btn wide" onClick={async()=>{if(!f.name||f.shortCode.length!==2)return p.notify('أكمل البيانات');if(f.current)for(const y of p.data.academicYears)if(y.current)await p.write('academicYears',{...y,current:false},'تغيير السنة الحالية');await p.write('academicYears',f,'إضافة سنة دراسية');p.setModal(null);p.notify('تمت إضافة السنة')}}>حفظ</button></div></Modal>}


export function DictForm(p){const [type,setType]=useState(p.data.dictionaries[0]?.id||''),[val,setVal]=useState('');const item=p.data.dictionaries.find(x=>x.id===type);return <Modal title="القواميس" close={()=>p.setModal(null)}><div className="space"><select className="input" value={type} onChange={e=>setType(e.target.value)}>{p.data.dictionaries.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><div className="list">{(item?.values||[]).map(v=><Row key={v} title={v} action={<button className="danger" onClick={()=>p.write('dictionaries',{...item,values:item.values.filter(x=>x!==v)},'حذف قيمة من قاموس')}>حذف</button>}/>)}</div><div className="row"><input className="input" value={val} onChange={e=>setVal(e.target.value)} placeholder="قيمة جديدة"/><button className="btn" onClick={async()=>{if(!val.trim())return;await p.write('dictionaries',{...item,values:[...item.values,val.trim()]},'إضافة قيمة للقاموس');setVal('')}}>إضافة</button></div></div></Modal>}


export function Archive(p){const stores=['students','groups','sessions','attendance','exams','grades','books','studentBooks','payments','expenses'];const items=stores.flatMap(store=>p.data[store].filter(x=>x.deletedAt).map(x=>({store,x})));return <Screen title="الأرشيف"><div className="list">{items.map(({store,x})=><Card key={`${store}_${x.id}`}><div className="between"><div><h3>{x.name||x.title||x.id}</h3><small>{store} • {new Date(x.deletedAt).toLocaleString('ar-EG')}</small></div><button className="btn" onClick={()=>p.write(store,{...x,deletedAt:null,status:store==='students'?'نشط':x.status},'استرجاع من الأرشيف')}>استرجاع</button></div></Card>)}{!items.length&&<Empty text="الأرشيف فارغ"/>}</div></Screen>}

