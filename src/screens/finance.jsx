import React, { useState } from 'react';
import * as I from 'lucide-react';
import { today, fmtDate, money } from '../utils/format.js';
import { isActive as active, all } from '../db.js';
import { renderTemplate, DEFAULT_TEMPLATES } from '../services/whatsapp/templates.js';
import { evaluateRules } from '../engines/notifications/rules.js';
import { Screen, Section, Card, Row, Stat, Badge, Empty } from '../components/ui.jsx';

// دالة حساب حصص اليوم
export function daySessions({ data, groups, students, groupBy }, dateStr) {
  if (!data?.sessions) return [];
  const dt = new Date(dateStr || today());
  const dayName = dt.toLocaleDateString('ar-EG', { weekday: 'long' });
  const list = [];

  for (const s of data.sessions) {
    if (!active(s) || s.date !== dateStr) continue;
    const g = groupBy ? groupBy(s.groupId) : groups?.find(x => x.id === s.groupId);
    list.push({ ...s, group: g });
  }

  if (groups) {
    for (const g of groups) {
      if (!active(g)) continue;
      for (const slot of g.schedule || []) {
        if (slot.day === dayName) {
          const exists = list.some(x => x.groupId === g.id && x.timeStart === slot.start);
          if (!exists) {
            list.push({
              id: `gen_${g.id}_${slot.start}`,
              groupId: g.id,
              group: g,
              date: dateStr,
              timeStart: slot.start,
              timeEnd: slot.end,
              status: 'UPCOMING'
            });
          }
        }
      }
    }
  }
  return list;
}

function MiniBarChart({ labels, seriesA, seriesB, colorA = 'var(--accent)', colorB = 'var(--muted-2)', legendA, legendB }) {
  const max = Math.max(1, ...seriesA, ...seriesB);
  const w = 320, h = 140, barW = Math.min(26, (w / labels.length) / 2 - 4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="140" aria-label="مخطط الإيرادات مقابل المصروفات">
      {labels.map((l, i) => {
        const gx = i * (w / labels.length) + 8;
        const ah = Math.round((seriesA[i] / max) * 100), bh = Math.round((seriesB[i] / max) * 100);
        return (
          <g key={l}>
            <rect x={gx} y={110 - ah} width={barW} height={ah} fill={colorA} rx="2" />
            <rect x={gx + barW + 3} y={110 - bh} width={barW} height={bh} fill={colorB} rx="2" />
            <text x={gx + barW} y="128" fontSize="9" fill="var(--muted)" textAnchor="middle">{l}</text>
          </g>
        );
      })}
      <rect x="0" y="0" width="8" height="8" fill={colorA} /><text x="12" y="8" fontSize="9" fill="var(--muted)">{legendA}</text>
      <rect x="80" y="0" width="8" height="8" fill={colorB} /><text x="92" y="8" fontSize="9" fill="var(--muted)">{legendB}</text>
    </svg>
  );
}

export function Finance(p) {
  const [period, setPeriod] = useState('month');
  const prefix = period === 'month' ? today().slice(0, 7) : period === 'year' ? today().slice(0, 4) : '';
  const studentIds = new Set(p.students.map(s => s.id));
  const payments = p.data.payments.filter(x => active(x) && studentIds.has(x.studentId) && (!prefix || String(x.date || '').startsWith(prefix)));
  const expenses = p.data.expenses.filter(x => active(x) && (!p.yearId || x.academicYearId === p.yearId) && (!prefix || String(x.date || '').startsWith(prefix)) && (!p.branchId || p.branchId === 'ALL' || x.branchId === p.branchId));
  const revenue = payments.filter(x => x.type === 'PAYMENT').reduce((a, x) => a + Number(x.amount || 0), 0);
  const cost = expenses.reduce((a, x) => a + Number(x.amount || 0), 0);
  const overdue = p.students.reduce((a, s) => a + p.due(s), 0);

  return (
    <Screen title="المالية" action={<div className="actions"><button className="btn" onClick={() => p.setModal('payment')}><I.Plus /> دفعة</button><button className="btn secondary" onClick={() => p.setModal('expense')}>مصروف</button></div>}>
      <div className="filters">
        <select className="input" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="month">هذا الشهر</option>
          <option value="year">هذه السنة</option>
          <option value="all">كل الوقت</option>
        </select>
        <button className="btn secondary" onClick={() => p.exportXlsx(`GENIUS_FINANCE_${today()}.xlsx`, { الدفعات: [['التاريخ', 'الطالب', 'النوع', 'المبلغ', 'الطريقة'], ...payments.map(x => [x.date, p.studentBy(x.studentId)?.name || '', x.type, x.amount, x.method || ''])], المصروفات: [['التاريخ', 'البند', 'المبلغ'], ...expenses.map(x => [x.date, x.title, x.amount])] })}>Excel</button>
      </div>
      <div className="stats">
        <Stat n={money(revenue)} l="المدفوع" />
        <Stat n={money(overdue)} l="المتأخرات" />
        <Stat n={money(cost)} l="المصروفات" />
        <Stat n={money(revenue - cost)} l="صافي الدخل" />
      </div>
      <Section title="كشف حساب الطلاب">
        <div className="list">
          {p.students.filter(s => p.due(s) > 0 || payments.some(x => x.studentId === s.id)).map(s => (
            <Card key={s.id}>
              <div className="between">
                <div>
                  <h3>{s.name}</h3>
                  <small>{p.groupBy(s.groupId)?.name || ''}</small>
                </div>
                <b>{money(p.due(s))}</b>
              </div>
              <div className="actions">
                <button className="btn secondary" onClick={() => { p.setSelected(s); p.setModal('studentView'); }}>كشف الحساب</button>
                <button className="btn" onClick={() => p.whatsapp(s.parentPhone, renderTemplate(p.settings.templates?.payment || DEFAULT_TEMPLATES.payment, { studentName: s.name, amount: money(p.due(s)), group: p.groupBy(s.groupId)?.name || '' }))}>تذكير WhatsApp</button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="حركة اليوم">
        <div className="list">
          {payments.slice(-15).reverse().map(x => (
            <Row key={x.id} title={`${p.studentBy(x.studentId)?.name || '—'} • ${x.type}`} sub={`${fmtDate(x.date)} • ${money(x.amount)}`} />
          ))}
        </div>
      </Section>
    </Screen>
  );
}

export function Reports(p) {
  const [type, setType] = useState('students');
  const [branch, setBranch] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const inRange = x => (!from || String(x.date || '') >= from) && (!to || String(x.date || '') <= to);
  const branchStudents = p.students.filter(s => branch === 'ALL' || s.branchId === branch);

  /* أداء اليوم */
  const todaySessions = daySessions({ data: p.data, groups: p.groups, students: p.students, groupBy: p.groupBy }, today()).filter(r => r.status !== 'CANCELLED');
  const overallAttendance = branchStudents.length ? Math.round(branchStudents.reduce((a, s) => a + p.attendanceRate(s), 0) / branchStudents.length) : 0;
  const groupRanking = p.groups.map(g => { const mem = branchStudents.filter(s => s.groupId === g.id); const rate = mem.length ? Math.round(mem.reduce((a, s) => a + p.attendanceRate(s), 0) / mem.length) : 0; return { g, rate, count: mem.length }; }).filter(x => x.count > 0).sort((a, b) => b.rate - a.rate);
  const studentRanking = [...branchStudents].sort((a, b) => p.attendanceRate(b) - p.attendanceRate(a));

  /* التحصيل والمتأخرون */
  const overdueStudents = branchStudents.filter(s => p.due(s) > 0).map(s => { const g = p.groupBy(s.groupId); const monthsBehind = Math.max(1, Math.round(p.due(s) / Number(g?.price || p.due(s) || 1))); return { s, g, monthsBehind }; });
  const bucket = n => overdueStudents.filter(x => n === 3 ? x.monthsBehind >= 3 : x.monthsBehind === n);
  const remind = x => p.whatsapp(x.s.parentPhone, renderTemplate(p.settings.templates?.payment || DEFAULT_TEMPLATES.payment, { studentName: x.s.name, amount: money(p.due(x.s)), group: x.g?.name || '' }));
  const remindBucket = list => { if (!list.length) return p.notify('لا يوجد طلاب في هذه الفئة'); list.forEach((x, i) => setTimeout(() => remind(x), i * 350)); p.notify(`جاري فتح ${list.length} محادثة واتساب — قد يطلب المتصفح إذن السماح بالنوافذ المنبثقة`); };

  /* التقرير المالي الشامل */
  const ids = new Set(branchStudents.map(s => s.id));
  const periodPayments = p.data.payments.filter(x => active(x) && ids.has(x.studentId) && inRange(x));
  const expected = periodPayments.filter(x => x.type === 'CHARGE').reduce((a, x) => a + Number(x.amount || 0), 0);
  const collected = periodPayments.filter(x => x.type === 'PAYMENT').reduce((a, x) => a + Number(x.amount || 0), 0);
  const periodExpenses = p.data.expenses.filter(x => active(x) && (!p.yearId || x.academicYearId === p.yearId) && (!p.branchId || p.branchId === 'ALL' || x.branchId === p.branchId) && inRange(x)).reduce((a, x) => a + Number(x.amount || 0), 0);
  const netProfit = collected - periodExpenses;
  const bookRevenue = periodPayments.filter(x => x.type === 'PAYMENT' && x.source === 'BOOK').reduce((a, x) => a + Number(x.amount || 0), 0);
  const subsRevenue = collected - bookRevenue;
  const daysElapsed = from ? Math.max(1, Math.round((new Date(to || today()) - new Date(from)) / 86400000) + 1) : Math.max(1, Number(today().slice(-2)));
  const dailyProfitRate = Math.round(netProfit / daysElapsed);
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const rev = p.data.payments.filter(x => active(x) && x.type === 'PAYMENT' && ids.has(x.studentId) && x.date === iso).reduce((a, x) => a + Number(x.amount || 0), 0); const exp = p.data.expenses.filter(x => active(x) && x.date === iso).reduce((a, x) => a + Number(x.amount || 0), 0); return { label: d.toLocaleDateString('ar-EG', { weekday: 'short' }), rev, exp }; });

  const build = () => { if (type === 'students') return [['الطالب', 'ID', 'المجموعة', 'الحضور', 'المتوسط', 'المتبقي'], ...branchStudents.map(s => [s.name, s.code, p.groupBy(s.groupId)?.name || '', p.attendanceRate(s) + '%', p.avg(s) + '%', p.due(s)])]; if (type === 'finance') { return [['التاريخ', 'النوع', 'الطالب/البند', 'المبلغ'], ...periodPayments.map(x => [x.date, x.type, p.studentBy(x.studentId)?.name || x.note || '', x.amount]), ...p.data.expenses.filter(x => active(x) && (!p.yearId || x.academicYearId === p.yearId) && (!p.branchId || p.branchId === 'ALL' || x.branchId === p.branchId) && inRange(x)).map(x => [x.date, 'EXPENSE', x.title, x.amount])]; } if (type === 'groups') return [['المجموعة', 'الفرع', 'الطلاب', 'السعر'], ...p.groups.map(g => [g.name, p.data.branches.find(b => b.id === g.branchId)?.name || '', p.students.filter(s => s.groupId === g.id).length, g.price])]; return [['الطالب', 'الحضور', 'المتوسط', 'المتبقي'], ...branchStudents.map(s => [s.name, p.attendanceRate(s) + '%', p.avg(s) + '%', p.due(s)])]; };
  const whatsappSummary = `GENIUS ADMIN — تقرير ${type === 'students' ? 'الطلاب' : type === 'finance' ? 'المالية' : 'المجموعات'}\nالفترة: ${from || 'البداية'} → ${to || 'اليوم'}\nعدد الطلاب: ${branchStudents.length}\nإجمالي المتأخرات: ${money(branchStudents.reduce((a, s) => a + p.due(s), 0))}`;

  return (
    <Screen title="التقارير والتحليلات" action={<div className="actions"><button className="btn" onClick={() => p.exportXlsx(`GENIUS_REPORT_${today()}.xlsx`, { تقرير: build() })}>Excel</button><button className="btn secondary" onClick={() => window.print()}>PDF / طباعة</button></div>}>
      <Section title="أداء اليوم">
        <div className="stats"><Stat n={todaySessions.length} l="حصص اليوم" /><Stat n={`${overallAttendance}%`} l="نسبة الحضور العامة" /><Stat n={overdueStudents.length} l="طلاب متأخرون بالسداد" /><Stat n={money(branchStudents.reduce((a, s) => a + p.due(s), 0))} l="إجمالي المتأخرات" /></div>
      </Section>
      <Section title="ترتيب المجموعات حسب الالتزام بالحضور">
        <div className="list">{groupRanking.map((x, i) => <Row key={x.g.id} title={`${i + 1}. ${x.g.name}`} sub={`${x.count} طالب`} action={<Badge t={`${x.rate}%`} />} />)}</div>
        {!groupRanking.length && <Empty text="لا توجد بيانات كافية بعد" />}
      </Section>
      <Section title="أعلى وأقل الطلاب التزامًا بالحضور">
        <div className="list">{studentRanking.slice(0, 5).map(s => <Row key={s.id} title={s.name} sub={p.groupBy(s.groupId)?.name || ''} action={<Badge t={`${p.attendanceRate(s)}%`} />} />)}</div>
        {studentRanking.length > 5 && <><p className="hint">الأقل التزامًا:</p><div className="list">{studentRanking.slice(-5).reverse().map(s => <Row key={s.id} title={s.name} sub={p.groupBy(s.groupId)?.name || ''} action={<Badge t={`${p.attendanceRate(s)}%`} />} />)}</div></>}
      </Section>
      <Section title="متأخرو السداد — تنبيهات سريعة">
        <div className="actions"><button className="btn secondary" onClick={() => remindBucket(bucket(1))}>تنبيه المتأخرين شهر ({bucket(1).length})</button><button className="btn secondary" onClick={() => remindBucket(bucket(2))}>تنبيه المتأخرين شهرين ({bucket(2).length})</button><button className="btn secondary" onClick={() => remindBucket(bucket(3))}>تنبيه 3 أشهر فأكثر ({bucket(3).length})</button></div>
        <div className="list">{overdueStudents.slice(0, 20).map(x => <Row key={x.s.id} title={x.s.name} sub={`متأخر ${x.monthsBehind} شهر تقريبًا • ${money(p.due(x.s))}`} action={<button className="btn secondary" onClick={() => remind(x)}>تنبيه</button>} />)}</div>
        {!overdueStudents.length && <Empty text="لا يوجد متأخرون في السداد" />}
      </Section>
      <Section title="التقرير المالي الشامل">
        <div className="filters"><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="stats"><Stat n={money(expected)} l="المتوقع" /><Stat n={money(collected)} l="المحصّل" /><Stat n={money(periodExpenses)} l="المصروفات" /><Stat n={money(netProfit)} l="صافي الربح" /></div>
        <div className="mini"><div className="stat"><b>{money(subsRevenue)}</b><small>إيراد الاشتراكات</small></div><div className="stat"><b>{money(bookRevenue)}</b><small>إيراد الكتب</small></div><div className="stat"><b>{money(dailyProfitRate)}</b><small>معدل الربح اليومي</small></div></div>
        <p className="hint">الإيرادات مقابل المصروفات — آخر 7 أيام</p>
        <MiniBarChart labels={last7.map(x => x.label)} seriesA={last7.map(x => x.rev)} seriesB={last7.map(x => x.exp)} legendA="إيرادات" legendB="مصروفات" />
      </Section>
      <Section title="تصدير تفصيلي">
        <div className="filters"><select className="input" value={type} onChange={e => setType(e.target.value)}><option value="students">طلاب</option><option value="groups">مجموعات</option><option value="finance">مالية</option><option value="attendance">حضور</option></select><select className="input" value={branch} onChange={e => setBranch(e.target.value)}><option value="ALL">كل الفروع</option>{p.data.branches.filter(active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="actions"><button className="btn secondary" onClick={() => p.whatsapp(p.settings.phone, whatsappSummary)}>إرسال ملخص واتساب</button><button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(whatsappSummary); p.notify('تم نسخ التقرير'); }}>نسخ</button></div>
        <div className="tableWrap"><table><tbody>{build().map((r, i) => <tr key={i}>{r.map((c, j) => i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      </Section>
    </Screen>
  );
}

export function Notifications(p) { const ruleCount = evaluateRules(p.data).length; const list = p.data.notifications.filter(active).sort((a, b) => new Date(b.at) - new Date(a.at)); return <Screen title="الإشعارات"><div className="stats"><Stat n={ruleCount} l="قواعد تحتاج متابعة" /><Stat n={list.filter(n => !n.read).length} l="غير مقروء" /></div><div className="list">{list.map(n => <Card key={n.id} onClick={() => p.write('notifications', { ...n, read: true }, 'قراءة إشعار')}><div className="between"><div><h3>{n.title}</h3><p>{n.body}</p><small>{new Date(n.at).toLocaleString('ar-EG')}</small></div>{!n.read && <Badge t="جديد" />}</div></Card>)}{!list.length && <Empty text="لا توجد إشعارات" />}</div></Screen>; }

export function Activity(p) { const list = [...p.data.activities].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 100); return <Screen title="سجل العمليات"><div className="list">{list.map(a => <Row key={a.id} title={a.action} sub={`${new Date(a.at).toLocaleString('ar-EG')} • ${a.refId || ''}`} />)}</div></Screen>; }
