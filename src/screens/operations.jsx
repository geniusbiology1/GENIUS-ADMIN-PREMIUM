import React, { useCallback, useEffect, useState } from 'react';
import * as I from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { today, mins, money, fmtDate, uid2 } from '../utils/format.js';
import { isActive as active } from '../db.js';
import { openSession, completeSession, sessionSummary } from '../engines/session/engine.js';
import { allocatePayment } from '../engines/finance/ledger.js';
import { student360 as buildStudent360 } from '../engines/students/engine.js';
import { examStats } from '../engines/exams/engine.js';
import { inventory as bookInventory } from '../engines/books/engine.js';
import { ensureAttendance as ensureSessionAttendance, stats as attendanceStats } from '../engines/attendance/engine.js';
import { scanGENIUSID, isScannerSupported, stopScanner } from '../services/scanner/nativeScanner.js';
import { shareText, shareImageDataUrl, pickContact } from '../native.js';
import { validStudent, uniqueCodes } from '../services/validation.js';
import { renderTemplate, DEFAULT_TEMPLATES } from '../services/whatsapp/templates.js';
import { Screen, Section, Card, Row, Stat, Badge, Empty, Modal, Field } from '../components/ui.jsx';

export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function svgToPngDataUrl(svgEl, scale = 3) {
  return new Promise((resolve, reject) => {
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.onload = () => {
        const w = (svgEl.viewBox?.baseVal?.width) || svgEl.clientWidth || 300;
        const h = (svgEl.viewBox?.baseVal?.height) || svgEl.clientHeight || 120;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;base64,${svg64}`;
    } catch (e) {
      reject(e);
    }
  });
}

export function AttendanceModal(p) {
  const groupStudents = p.students.filter(s => s.groupId === p.session.groupId && s.status === 'نشط');
  const attendanceRows = p.data.attendance.filter(x => active(x) && x.sessionId === p.session.id);
  const attendanceSummary = attendanceStats(attendanceRows);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('attendance');

  const mark = async (s, status) => {
    const id = `${p.session.id}_${s.id}`;
    await p.write('attendance', {
      id,
      sessionId: p.session.id,
      studentId: s.id,
      status,
      billable: status !== 'غائب',
      time: new Date().toISOString(),
      academicYearId: p.session.academicYearId
    }, 'تسجيل حضور');
    await p.buzz();
    p.notify(`${status} — ${s.name}`);
  };

  const scan = () => p.setModal('scan');

  const lifecycle = async next => {
    if (next === 'OPEN') {
      for (const row of ensureSessionAttendance(p.data, p.session)) {
        await p.write('attendance', row, 'تهيئة حضور الحصة');
      }
    }
    const updated = next === 'OPEN' ? openSession(p.session) : completeSession(p.session);
    await p.write('sessions', updated, next === 'OPEN' ? 'فتح الحصة' : 'إنهاء الحصة');
    p.setSelected(updated);
    p.notify(next === 'OPEN' ? 'تم فتح الحصة' : 'تم إنهاء الحصة');
  };

  const summary = sessionSummary(p.data, p.session.id);

  return (
    <Modal title={`حصة — ${p.groupBy(p.session.groupId)?.name || ''}`} close={() => p.setModal(null)}>
      <div className="between">
        <span className="badge">{p.session.status || 'UPCOMING'}</span>
        <div className="actions">
          {p.session.status !== 'OPEN' && p.session.status !== 'COMPLETED' && (
            <button className="btn" onClick={() => lifecycle('OPEN')}>فتح الحصة</button>
          )}
          {p.session.status === 'OPEN' && (
            <button className="btn secondary" onClick={() => lifecycle('COMPLETED')}>إنهاء الحصة</button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>الحضور</button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>بيانات</button>
        <button className={tab === 'grades' ? 'active' : ''} onClick={() => setTab('grades')}>الدرجات</button>
      </div>

      {tab === 'attendance' && (
        <>
          <div className="actions">
            <button className="btn" onClick={scan}><I.ScanLine /> Scan ID</button>
            <input
              className="input codeInput"
              placeholder="اكتب ID ثم Enter"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const s = groupStudents.find(x => x.code === code.trim());
                  if (s) mark(s, 'حاضر');
                  else p.notify('ID غير موجود في المجموعة');
                  setCode('');
                }
              }}
            />
            <button className="btn secondary" onClick={async () => {
              for (const s of groupStudents) await mark(s, 'حاضر');
            }}>الكل حاضر</button>
          </div>
          <div className="list">
            {groupStudents.map(s => {
              const a = p.data.attendance.find(x => active(x) && x.id === `${p.session.id}_${s.id}`);
              return (
                <div className="rowItem" key={s.id}>
                  <div>
                    <b>{s.name}</b>
                    <small>{s.code} • {a?.status || 'لم يسجل'}</small>
                  </div>
                  <div className="attendanceActions">
                    <button className={a?.status === 'حاضر' ? 'pill activePill' : 'pill'} onClick={() => mark(s, 'حاضر')}>حاضر</button>
                    <button className={a?.status === 'متأخر' ? 'pill activePill' : 'pill'} onClick={() => mark(s, 'متأخر')}>متأخر</button>
                    <button className={a?.status === 'غائب' ? 'pill activePill' : 'pill'} onClick={() => mark(s, 'غائب')}>غائب</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'data' && (
        <div className="stats">
          <Stat n={groupStudents.length} l="إجمالي" />
          <Stat n={groupStudents.filter(s => p.data.attendance.find(a => active(a) && a.id === `${p.session.id}_${s.id}` && a.status !== 'غائب')).length} l="حاضر" />
          <Stat n={groupStudents.filter(s => p.data.attendance.find(a => active(a) && a.id === `${p.session.id}_${s.id}` && a.status === 'غائب')).length} l="غائب" />
          <Stat n={money(summary.collection)} l="تحصيل الحصة" />
          <Stat n={`${attendanceSummary.rate}%`} l="النسبة" />
        </div>
      )}

      {tab === 'grades' && (
        <p className="hint">لإدارة درجات الامتحانات افتح شاشة الامتحانات؛ الدرجة تحفظ تلقائيًا في سجل كل طالب.</p>
      )}
    </Modal>
  );
}

export function Scanner(p) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('جاهز للمسح بالكاميرا');

  const resolve = useCallback(value => {
    const s = p.students.find(x => x.code === String(value || '').trim());
    if (s) {
      p.setSelected(s);
      p.setModal('card');
    } else {
      p.notify('الكود غير معروف');
    }
  }, [p]);

  const nativeScan = async () => {
    setBusy(true);
    try {
      const supported = await isScannerSupported();
      if (!supported) {
        setMsg('الماسح الأصلي غير مدعوم على هذا الجهاز');
        return;
      }
      const value = await scanGENIUSID();
      if (value) resolve(value);
      else setMsg('لم يتم العثور على كود');
    } catch (e) {
      console.error(e);
      setMsg('تعذر تشغيل الكاميرا — تأكد من صلاحية الكاميرا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="GENIUS Scanner" close={() => { stopScanner(); p.setModal(null); }}>
      <div className="scanner">
        <div className="scanFrame"><I.ScanLine size={46} /></div>
        <small>{msg}</small>
      </div>
      <button className="btn wide" disabled={busy} onClick={nativeScan}>
        <I.Camera /> {busy ? 'جاري المسح...' : 'فتح الكاميرا والمسح'}
      </button>
      <input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="أو أدخل GENIUS ID يدويًا" />
      <button className="btn secondary wide" onClick={() => resolve(code)}>فتح الطالب</button>
    </Modal>
  );
}

export function Student360(p) {
  const profile = buildStudent360(p.data, p.student.id);
  const s = profile?.student || p.student;
  const grades = profile?.grades || [];
  const att = profile?.attendance || [];
  const payments = profile?.payments || [];
  const books = profile?.books || [];

  return (
    <Modal title={`Student 360 — ${s.name}`} close={() => p.setModal(null)}>
      <div className="studentHero">
        <div className="avatar">{s.name?.slice(0, 1)}</div>
        <div>
          <h2>{s.name}</h2>
          <small>GENIUS ID: {s.code}</small>
          <p>{p.groupBy(s.groupId)?.name || 'بدون مجموعة'} • {s.grade}</p>
        </div>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => { p.setSelected(s); p.setModal('card'); }}>بطاقة + QR</button>
        <button className="btn secondary" onClick={() => { p.setSelected(s); p.setModal('report'); }}><I.FileText size={16} /> تقرير مخصص لولي الأمر</button>
        <button className="btn secondary" onClick={() => window.print()}>طباعة</button>
      </div>
      <div className="stats">
        <Stat n={`${p.attendanceRate(s)}%`} l="الحضور" />
        <Stat n={`${p.avg(s)}%`} l="متوسط الدرجات" />
        <Stat n={money(p.due(s))} l="المتبقي" />
        <Stat n={payments.filter(x => x.type === 'PAYMENT').length} l="دفعات" />
      </div>
      <Section title="بيانات الطالب">
        <div className="detailGrid">
          <span>ولي الأمر</span><b>{s.parentName || '—'}</b>
          <span>هاتف الطالب</span><b>{s.studentPhone || '—'}</b>
          <span>هاتف ولي الأمر</span><b>{s.parentPhone || '—'}</b>
          <span>المستوى</span><b>{s.level || '—'}</b>
          <span>ملاحظات</span><b>{s.notes || '—'}</b>
        </div>
      </Section>
      <Section title={`الحضور (${att.length})`}>
        <div className="list">
          {att.slice(-12).reverse().map(a => (
            <Row key={a.id} title={a.status} sub={new Date(a.time || Date.now()).toLocaleString('ar-EG')} />
          ))}
        </div>
      </Section>
      <Section title={`الدرجات (${grades.length})`}>
        <div className="list">
          {grades.map(g => (
            <Row key={g.id} title={p.data.exams.find(e => e.id === g.examId)?.title || 'امتحان'} sub={`${g.score}/${g.maxScore}`} />
          ))}
        </div>
      </Section>
      <Section title={`المالية (${payments.length})`}>
        <div className="list">
          {payments.map(x => (
            <Row key={x.id} title={`${x.type === 'CHARGE' ? 'مستحق' : 'دفعة'} — ${money(x.amount)}`} sub={`${fmtDate(x.date)} • ${x.note || x.method || ''}`} />
          ))}
        </div>
      </Section>
      <Section title={`الكتب (${books.length})`}>
        <div className="list">
          {books.map(x => (
            <Row key={x.id} title={p.data.books.find(b => b.id === x.bookId)?.title || 'كتاب'} sub={x.status} />
          ))}
        </div>
      </Section>
      <Section title="السجل الزمني">
        <div className="list">
          {profile.timeline.slice(0, 20).map((x, i) => (
            <Row key={x.ref + '_' + i} title={x.label} sub={fmtDate(x.date)} />
          ))}
        </div>
      </Section>
    </Modal>
  );
}

export function ReportForm(p) {
  const s = p.selected;
  const profile = buildStudent360(p.data, s.id);
  const [sec, setSec] = useState({ level: true, attendance: true, grades: true, finance: true, books: false });
  const [text, setText] = useState('');

  const build = useCallback(() => {
    const lines = [`GENIUS BIOLOGY — تقرير الطالب`, `الاسم: ${s.name}`, `GENIUS ID: ${s.code}`, `المجموعة: ${p.groupBy(s.groupId)?.name || '—'}`];
    if (sec.level) lines.push(`المستوى: ${s.level || '—'}`);
    if (sec.attendance) {
      const att = (profile.attendance || []).slice(-5).reverse();
      lines.push(`نسبة الحضور: ${p.attendanceRate(s)}%`, `آخر الحضور: ${att.length ? att.map(a => `${a.status} (${fmtDate(a.date)})`).join('، ') : '—'}`);
    }
    if (sec.grades) {
      const gr = (profile.grades || []).slice(-5).reverse();
      lines.push(`متوسط الدرجات: ${p.avg(s)}%`, `آخر الامتحانات: ${gr.length ? gr.map(g => `${p.data.exams.find(e => e.id === g.examId)?.title || 'امتحان'}: ${g.score}/${g.maxScore}`).join('، ') : '—'}`);
    }
    if (sec.finance) {
      const pay = (profile.payments || []).filter(x => x.type === 'PAYMENT').slice(-5).reverse();
      lines.push(`المتبقي: ${money(p.due(s))}`, `آخر الدفعات: ${pay.length ? pay.map(x => `${money(x.amount)} (${fmtDate(x.date)})`).join('، ') : '—'}`);
    }
    if (sec.books) {
      const bk = profile.books || [];
      lines.push(`الكتب: ${bk.length ? bk.map(x => `${p.data.books.find(b => b.id === x.bookId)?.title || 'كتاب'} — ${x.status}`).join('، ') : '—'}`);
    }
    return lines.join('\n');
  }, [s, p, profile, sec]);

  useEffect(() => { setText(build()); }, [sec, build]);

  const opts = [['level', 'المستوى'], ['attendance', 'الحضور'], ['grades', 'الدرجات'], ['finance', 'المدفوعات'], ['books', 'الكتب']];

  return (
    <Modal title={`تقرير — ${s.name}`} close={() => p.setModal(null)}>
      <div className="space">
        <div className="reportSections">
          {opts.map(([k, l]) => (
            <label className="check" key={k}>
              <input type="checkbox" checked={sec[k]} onChange={e => setSec({ ...sec, [k]: e.target.checked })} />
              {l}
            </label>
          ))}
        </div>
        <Field label="نص الرسالة (قابل للتعديل قبل الإرسال)">
          <textarea className="input textarea reportPreview" value={text} onChange={e => setText(e.target.value)} />
        </Field>
        <div className="actions">
          <button className="btn" onClick={() => p.whatsapp(s.parentPhone, text)}><I.MessageCircle size={16} /> إرسال واتساب</button>
          <button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(text); p.notify('تم نسخ التقرير'); }}>نسخ</button>
          <button className="btn secondary" onClick={() => setText(build())}>إعادة التوليد</button>
        </div>
      </div>
    </Modal>
  );
}

export function StudentCard(p) {
  const s = p.student;
  const [qr, setQr] = useState('');
  const barRef = React.useRef(null);

  useEffect(() => {
    QRCode.toDataURL(JSON.stringify({ geniusId: s.code, name: s.name, groupId: s.groupId }), { width: 260, margin: 1, errorCorrectionLevel: 'M' }).then(setQr);
    if (barRef.current) {
      try {
        JsBarcode(barRef.current, s.code, { format: 'CODE128', displayValue: true, height: 52, width: 2, margin: 8, fontSize: 14 });
      } catch {}
    }
  }, [s]);

  const text = `GENIUS BIOLOGY\n${s.name}\nGENIUS ID: ${s.code}\nالمجموعة: ${p.groupBy(s.groupId)?.name || '—'}`;

  const shareQr = async () => {
    if (!qr) return;
    const ok = await shareImageDataUrl(qr, `GENIUS_${s.code}_QR.png`, `بطاقة ${s.name}`);
    if (ok) p.notify('تم فتح مشاركة صورة QR');
    else p.notify('تعذرت مشاركة الصورة — جرّب لقطة شاشة');
  };

  const shareBarcode = async () => {
    if (!barRef.current) return;
    try {
      const png = await svgToPngDataUrl(barRef.current);
      const ok = await shareImageDataUrl(png, `GENIUS_${s.code}_BARCODE.png`, `باركود ${s.name}`);
      if (ok) p.notify('تم فتح مشاركة صورة الباركود');
      else p.notify('تعذرت مشاركة الصورة');
    } catch {
      p.notify('تعذرت مشاركة الصورة');
    }
  };

  return (
    <Modal title="بطاقة GENIUS ID" close={() => p.setModal(null)}>
      <div className="studentCard">
        <div className="cardBrand">GENIUS BIOLOGY <span>GENIUS ADMIN • STUDENT ID</span></div>
        <h2>{s.name}</h2>
        <div className="idBig">{s.code}</div>
        <p>{p.groupBy(s.groupId)?.name || '—'} • {s.grade || '—'}</p>
        {qr && <img src={qr} alt="GENIUS QR" />}
        <svg ref={barRef} aria-label={`Barcode ${s.code}`}></svg>
        <small>QR وCode 128 مرتبطان بـ GENIUS ID فقط</small>
      </div>
      <div className="actions">
        <button className="btn" onClick={shareQr}><I.QrCode size={16} /> مشاركة صورة QR</button>
        <button className="btn secondary" onClick={shareBarcode}><I.Barcode size={16} /> مشاركة صورة الباركود</button>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={async () => {
          const ok = await shareText('GENIUS ID', text);
          if (!ok) {
            await navigator.clipboard?.writeText(text);
            p.notify('تم نسخ بيانات البطاقة');
          }
        }}>مشاركة النص</button>
        <button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(s.code); p.notify('تم نسخ ID'); }}>نسخ ID</button>
        <button className="btn secondary" onClick={() => p.whatsapp(s.parentPhone, text)}>WhatsApp</button>
        <button className="btn secondary" onClick={() => window.print()}>طباعة</button>
      </div>
    </Modal>
  );
}

export function StudentForm(p) {
  const old = p.selected;
  const [f, setF] = useState(old || {
    id: uid2('st'),
    code: '',
    name: '',
    grade: p.dict('grades')[0] || '',
    academicYearId: p.yearId,
    groupId: p.groups[0]?.id || '',
    branchId: p.branchId === 'ALL' ? p.groups[0]?.branchId || '' : p.branchId,
    status: 'نشط',
    studentPhone: '',
    parentName: '',
    parentPhone: '',
    joinDate: today(),
    price: 0,
    discountType: 'NONE',
    discountValue: 0,
    level: p.dict('levels')[0] || '',
    notes: ''
  });

  useEffect(() => {
    if (!f.code && !old) {
      const y = p.data.academicYears.find(x => x.id === p.yearId);
      const nums = p.students.map(s => Number(String(s.code).replace(/\D/g, '')) || 0);
      const max = Math.max(0, ...nums);
      setF(x => ({ ...x, code: `${y?.shortCode || '27'}${String(max + 1).slice(-4).padStart(4, '0')}` }));
    }
  }, [f.code, old, p.data.academicYears, p.yearId, p.students]);

  const contactSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  const pickStudentPhone = async () => {
    const c = await pickContact();
    if (!c) return p.notify(contactSupported ? 'لم يتم اختيار جهة اتصال' : 'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');
    setF(x => ({ ...x, studentPhone: c.tel || x.studentPhone }));
  };

  const pickParentPhone = async () => {
    const c = await pickContact();
    if (!c) return p.notify(contactSupported ? 'لم يتم اختيار جهة اتصال' : 'اختيار جهات الاتصال غير مدعوم على هذا الجهاز — أدخل الرقم يدويًا');
    setF(x => ({ ...x, parentPhone: c.tel || x.parentPhone, parentName: x.parentName || c.name || x.parentName }));
  };

  return (
    <Modal title={old ? 'تعديل الطالب' : 'إضافة طالب'} close={() => p.setModal(null)}>
      <form className="space" onSubmit={async e => {
        e.preventDefault();
        if (!f.name.trim() || !f.code) return p.notify('أكمل الاسم وGENIUS ID');
        if (p.data.students.some(s => active(s) && s.code === f.code && s.id !== f.id)) return p.notify('GENIUS ID مستخدم بالفعل');
        const g = p.groupBy(f.groupId);
        const row = { ...f, price: Number(f.price || g?.price || 0), discountValue: Number(f.discountValue || 0), branchId: f.branchId || g?.branchId, academicYearId: f.ac
