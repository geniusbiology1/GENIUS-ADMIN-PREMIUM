export const SESSION_STATUS = {
  UPCOMING: 'UPCOMING',
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export function openSession(session) {
  return {
    ...session,
    status: SESSION_STATUS.OPEN,
    openedAt: new Date().toISOString()
  };
}

export function completeSession(session) {
  return {
    ...session,
    status: SESSION_STATUS.COMPLETED,
    completedAt: new Date().toISOString()
  };
}

export function sessionSummary(data, sessionId) {
  const session = (data.sessions || []).find(x => x.id === sessionId);
  const attendance = (data.attendance || []).filter(x => x.sessionId === sessionId && !x.deletedAt);
  const grades = (data.grades || []).filter(x => x.sessionId === sessionId && !x.deletedAt);
  
  const collection = (data.payments || [])
    .filter(x => x.sessionId === sessionId && !x.deletedAt && x.type === 'PAYMENT')
    .reduce((a, x) => a + Number(x.amount || 0), 0);

  return { session, attendance, grades, collection };
}
