import {today,isActive} from './db';
import {repository} from './db/repositories/index.js';
const paymentRepo=repository('payments');
export {calculateDiscount,financeSummary,ledgerRows as buildStudentLedger,allocatePayment,expenseSummary,revenueSummary} from './engines/finance/ledger';
export {ensureAttendance as ensureSessionAttendance,stats as attendanceStats} from './engines/attendance/engine';
export {student360} from './engines/students/engine';
export {examStats} from './engines/exams/engine';
export {inventory as bookInventory} from './engines/books/engine';
export {globalSearch} from './engines/search/engine';
export {evaluateRules} from './engines/notifications/rules';

export const normalizeEgyptPhone=value=>{let n=String(value||'').replace(/\D/g,'');if(n.startsWith('20'))return n;if(n.startsWith('0'))return `20${n.slice(1)}`;return n};
export const whatsappUrl=(phone,text='')=>{const n=normalizeEgyptPhone(phone);return n?`https://wa.me/${n}?text=${encodeURIComponent(text)}`:''};

export async function createMonthlyCharges(data,yearId,month){
 const created=[],groups=(data.groups||[]).filter(isActive),students=(data.students||[]).filter(x=>isActive(x)&&(!yearId||x.academicYearId===yearId));
 for(const s of students){
  const g=groups.find(x=>x.id===s.groupId); if(!g||g.pricingModel!=='MONTHLY')continue;
  const exists=(data.payments||[]).some(x=>isActive(x)&&x.type==='CHARGE'&&x.source==='MONTHLY_FEE'&&x.studentId===s.id&&x.period===month);
  if(exists)continue;
  let amount=Number(s.price||g.price||0);if(s.discountType==='PERCENT')amount-=amount*Number(s.discountValue||0)/100;if(s.discountType==='FIXED')amount-=Number(s.discountValue||0);amount=Math.max(0,amount);
  const row={id:`charge_${s.id}_${month}`,studentId:s.id,amount,date:`${month}-01`,period:month,type:'CHARGE',source:'MONTHLY_FEE',note:`اشتراك ${month}`,academicYearId:s.academicYearId||yearId,branchId:s.branchId||g.branchId,createdAt:new Date().toISOString()};
  await paymentRepo.save(row);created.push(row);
 }
 return created;
}
