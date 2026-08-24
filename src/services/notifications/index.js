import {evaluateRules} from '../../engines/notifications/rules.js';
import {put} from '../../db.js';
export async function syncRuleNotifications(data,now=new Date()){
 const rules=evaluateRules(data,now), existing=new Set((data.notifications||[]).filter(x=>!x.deletedAt).map(x=>x.key));
 const created=[];
 for(const r of rules){const key=`${r.rule}:${r.studentId||r.examId||'system'}:${now.toISOString().slice(0,10)}`;if(existing.has(key))continue;const row={id:`rule_${key.replace(/[^a-zA-Z0-9:_-]/g,'_')}`,key,title:r.title,body:r.message,at:now.toISOString(),read:false,rule:r.rule,studentId:r.studentId||'',examId:r.examId||''};await put('notifications',row);created.push(row)}
 return created;
}
