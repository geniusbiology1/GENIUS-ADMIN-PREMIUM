import React from 'react';
import * as I from 'lucide-react';

/* ==========================================
   1. مكونات الواجهة الأساسية (UI Components)
========================================== */
export function Screen({ title, action, children }) {
  return (
    <section className="screen">
      <div className="screenHead">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Section({ title, children }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Card({ children, onClick }) {
  return (
    <div className={`card${onClick ? ' interactive' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function Row({ title, sub, action }) {
  return (
    <div className="rowItem">
      <div>
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ n, l }) {
  return (
    <div className="stat">
      <b>{n}</b>
      <small>{l}</small>
    </div>
  );
}

export function Badge({ t }) {
  return <span className="badge">{t}</span>;
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export function Modal({ title, children, close }) {
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modalHead">
          <h3>{title}</h3>
          <button className="iconBtn" aria-label="إغلاق" onClick={close}>
            <I.X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, required, children }) {
  return (
    <label className="field">
      <span className="fieldLabel">
        {label}
        {required && <i className="req">*</i>}
      </span>
      {children}
      {hint && <small className="fieldHint">{hint}</small>}
    </label>
  );
}

/* ==========================================
   2. منطق الحصص والعمليات (Session Logic)
========================================== */
export const SESSION_STATUS = {
  UPCOMING: 'UPCOMING',
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export function openSession(session) {
  return { ...session, status: SESSION_STATUS.OPEN, openedAt: new Date().toISOString() };
}

export function completeSession(session) {
  return { ...session, status: SESSION_STATUS.COMPLETED, completedAt: new Date().toISOString() };
}

export function sessionSummary(data, sessionId) {
  const session = (data.sessions || []).find(x => x.id === sessionId);
  const attendance = (data.attendance || []).filter(x => x.sessionId === sessionId && !x.deletedAt);
  const grades = (data.grades || []).filter(x => x.sessionId === sessionId && !x.deletedAt);
  const collection = (data.payments || []).filter(x => x.sessionId === sessionId && !x.deletedAt && x.type === 'PAYMENT').reduce((a, x) => a + Number(x.amount || 0), 0);
  return { session, attendance, grades, collection };
}
