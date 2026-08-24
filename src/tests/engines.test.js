import {describe,it,expect} from 'vitest';
import {calculateDiscount,financeSummary,allocatePayment,expenseSummary} from '../engines/finance/ledger';
import {stats} from '../engines/attendance/engine';
import {examStats} from '../engines/exams/engine';
import {makeBackupEnvelope,verifyBackupEnvelope} from '../services/backup/checksum';

describe('finance ledger',()=>{
 it('allocates a payment across charges',()=>{
  const r=allocatePayment({payment:{id:'p1',studentId:'s',type:'PAYMENT',amount:300},charges:[{id:'c1',amount:250},{id:'c2',amount:100}],amounts:{total:300,allocatedByCharge:{}}});
  expect(r.allocations.map(x=>x.amount)).toEqual([250,50]); expect(r.unallocated).toBe(0);
 });
 it('discounts correctly',()=>expect(calculateDiscount(500,'PERCENT',10)).toBe(450));
 it('summarizes expenses',()=>expect(expenseSummary({expenses:[{id:'e',amount:100,category:'طباعة'}]}).total).toBe(100));
});
describe('attendance',()=>it('calculates rate',()=>expect(stats([{status:'حاضر'},{status:'متأخر'},{status:'غائب'}]).rate).toBe(67)));
describe('exams',()=>it('calculates ranking and median',()=>{
 const r=examStats({grades:[{examId:'e',score:18,maxScore:20},{examId:'e',score:10,maxScore:20},{examId:'e',score:16,maxScore:20}]},'e');
 expect(r.ranking[0].rank).toBe(1);expect(r.median).toBe(16);
}));
describe('backup',()=>it('detects tampering',async()=>{
 const p=await makeBackupEnvelope({schemaVersion:5,settings:[]});
 await expect(verifyBackupEnvelope(p)).resolves.toBe(true);
 p.data.settings.push({id:'x'});await expect(verifyBackupEnvelope(p)).rejects.toThrow('BACKUP_CHECKSUM_MISMATCH');
}));
import {planPromotion} from '../engines/students/promotion';
import {evaluateRules} from '../engines/notifications/rules';
import {backupFilename} from '../engines/backup';

describe('academic promotion',()=>it('creates a new yearly student record without copying attendance/grades',()=>{
 const r=planPromotion({students:[{id:'old',name:'أحمد',code:'270001',academicYearId:'2026',groupId:'g1',branchId:'b1'}]},{fromYearId:'2026',toYearId:'2027',groupMap:{g1:'g2'},priceMap:{g2:400}});
 expect(r).toHaveLength(1);expect(r[0].academicYearId).toBe('2027');expect(r[0].groupId).toBe('g2');expect(r[0].previousStudentId).toBe('old');
}));
describe('notification rules',()=>it('flags three consecutive absences',()=>{
 const r=evaluateRules({students:[{id:'s1',name:'أحمد',status:'نشط'}],attendance:[{id:'1',studentId:'s1',date:'2026-08-23',status:'غائب'},{id:'2',studentId:'s1',date:'2026-08-22',status:'غائب'},{id:'3',studentId:'s1',date:'2026-08-21',status:'غائب'}],payments:[],exams:[]},new Date('2026-08-24T10:00:00'));
 expect(r.some(x=>x.rule==='ABSENCE_3')).toBe(true);
}));
describe('backup naming',()=>it('uses the GENIUS backup prefix',()=>expect(backupFilename(new Date('2026-08-24T14:30:00')).startsWith('GENIUS_ADMIN_BACKUP_2026-08-24_')).toBe(true)));
