import {describe,it,expect} from 'vitest';
import {calculateDiscount,financeSummary} from '../services';
describe('finance engine',()=>{it('calculates percent discount',()=>expect(calculateDiscount(350,'PERCENT',10)).toBe(315));it('calculates ledger balance',()=>{const data={payments:[{studentId:'s',type:'CHARGE',amount:350},{studentId:'s',type:'PAYMENT',amount:200},{studentId:'s',type:'DISCOUNT',amount:25}]};expect(financeSummary(data,'s').balance).toBe(125)})});
import {DB_VERSION,stores} from '../db';
describe('database contract',()=>{
 it('keeps schema version 5 and required stores',()=>{
  expect(DB_VERSION).toBe(5);
  expect(stores).toEqual(expect.arrayContaining(['paymentAllocations','outbox','backupMeta']));
 });
});


describe('validation guards',()=>{
  it('validates backup envelope shape',()=>{expect(validBackup({app:'GENIUS ADMIN',data:{}})).toBe(true);expect(validBackup({app:'OTHER',data:{}})).toBe(false)});
  it('detects duplicate GENIUS IDs',()=>{expect(uniqueCodes([{code:'270001'},{code:'270001'},{code:'270002'}])).toEqual(['270001'])});
});
