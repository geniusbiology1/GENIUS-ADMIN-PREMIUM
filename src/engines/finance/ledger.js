import {isActive,uid,today} from '../../db';

const n=v=>Math.max(0,Number(v)||0);
export const calculateDiscount=(amount,type='NONE',value=0)=>{
 const a=n(amount);
 if(type==='PERCENT') return Math.max(0,a-a*n(value)/100);
 if(type==='FIXED') return Math.max(0,a-n(value));
 return a;
};
export function chargesFor(data,studentId){
 return (data.payments||[]).filter(x=>isActive(x)&&x.studentId===studentId&&x.type==='CHARGE');
}
export function paymentsFor(data,studentId){
 return (data.payments||[]).filter(x=>isActive(x)&&x.studentId===studentId&&x.type==='PAYMENT');
}
export function allocationsFor(data,studentId){
 return (data.paymentAllocations||[]).filter(x=>isActive(x)&&x.studentId===studentId);
}
export function financeSummary(data,studentId){
 const student=(data.students||[]).find(x=>x.id===studentId);
 const group=student?(data.groups||[]).find(g=>g.id===student.groupId):null;
 const charges=chargesFor(data,studentId).reduce((a,x)=>a+n(x.amount),0);
 const payments=paymentsFor(data,studentId).reduce((a,x)=>a+n(x.amount),0);
 const discounts=(data.payments||[]).filter(x=>isActive(x)&&x.studentId===studentId&&x.type==='DISCOUNT').reduce((a,x)=>a+n(x.amount),0);
 const refunds=(data.payments||[]).filter(x=>isActive(x)&&x.studentId===studentId&&x.type==='REFUND').reduce((a,x)=>a+n(x.amount),0);
 const allocated=allocationsFor(data,studentId).reduce((a,x)=>a+n(x.amount),0);
 let sessionCharges=0;
 if(group?.pricingModel==='PER_SESSION'&&student){
  const unit=calculateDiscount(n(student.price||group.price||0),student.discountType,student.discountValue);
  const billable=(data.attendance||[]).filter(x=>isActive(x)&&x.studentId===studentId&&x.billable).length;
  sessionCharges=billable*unit;
 }
 return {charges:charges+sessionCharges,payments,discounts,refunds,allocated,unallocated:Math.max(0,payments-allocated),balance:Math.max(0,charges+sessionCharges-payments-discounts+refunds)};
}
export function allocatePayment({payment,charges,amounts}){
 if(!payment?.id||payment.type!=='PAYMENT') throw new Error('INVALID_PAYMENT');
 let remaining=n(amounts?.total??payment.amount);
 const out=[];
 for(const charge of charges.filter(x=>isActive(x))){
   if(remaining<=0) break;
   const already=n(amounts?.allocatedByCharge?.[charge.id]);
   const due=Math.max(0,n(charge.amount)-already);
   const part=Math.min(due,remaining);
   if(part){out.push({id:uid('alloc'),paymentId:payment.id,chargeId:charge.id,studentId:payment.studentId,amount:part,date:payment.date||today(),createdAt:new Date().toISOString()});remaining-=part;}
 }
 return {allocations:out,unallocated:remaining};
}
export function ledgerRows(data,studentId){
 const rows=[];
 for(const x of (data.payments||[]).filter(x=>isActive(x)&&x.studentId===studentId)) rows.push({date:x.date||x.createdAt,type:x.type,amount:n(x.amount),label:x.note||x.source||'عملية مالية',ref:x.id});
 for(const x of (data.paymentAllocations||[]).filter(x=>isActive(x)&&x.studentId===studentId)) rows.push({date:x.date||x.createdAt,type:'ALLOCATION',amount:-n(x.amount),label:`تخصيص دفعة على ${x.chargeId}`,ref:x.id});
 return rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
}
export function expenseSummary(data,{from,to,branchId}={}){
 const rows=(data.expenses||[]).filter(x=>isActive(x)&&(!from||x.date>=from)&&(!to||x.date<=to)&&(!branchId||branchId==='ALL'||x.branchId===branchId));
 return {count:rows.length,total:rows.reduce((a,x)=>a+n(x.amount),0),byCategory:rows.reduce((m,x)=>(m[x.category||'أخرى']=(m[x.category||'أخرى']||0)+n(x.amount),m),{})};
}
export function revenueSummary(data,{from,to,branchId}={}){
 const rows=(data.payments||[]).filter(x=>isActive(x)&&x.type==='PAYMENT'&&(!from||x.date>=from)&&(!to||x.date<=to)&&(!branchId||branchId==='ALL'||x.branchId===branchId));
 return {count:rows.length,total:rows.reduce((a,x)=>a+n(x.amount),0)};
}
