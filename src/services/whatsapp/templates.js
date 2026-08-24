export const DEFAULT_TEMPLATES={
payment:`السلام عليكم يا ولي أمر {studentName}، نذكركم بقيمة المستحقات: {amount} ج. مجموعة {group}.`,
absence:`السلام عليكم، نحيطكم علمًا بغياب الطالب {studentName} عن حصة {date}.`,
result:`نتيجة {studentName} في {exam}: {score}/{maxScore} — النسبة {percent}%.`,
session:`تذكير: حصة {group} يوم {date} الساعة {sessionTime}.`,
book:`كتاب {book} للطالب {studentName}: {status}.`
};
export function renderTemplate(template,vars={}){return String(template||'').replace(/\{([a-zA-Z0-9_]+)\}/g,(_,k)=>vars[k]??`{${k}}`);}
