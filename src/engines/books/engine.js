import {isActive} from '../../db';
export function inventory(data,bookId){
 const book=(data.books||[]).find(x=>x.id===bookId);
 const movements=(data.bookMovements||[]).filter(x=>isActive(x)&&x.bookId===bookId);
 const inQty=movements.filter(x=>x.type==='IN').reduce((a,x)=>a+Number(x.qty||0),0);
 const outQty=movements.filter(x=>x.type==='OUT').reduce((a,x)=>a+Number(x.qty||0),0);
 const studentMovements=(data.studentBooks||[]).filter(x=>isActive(x)&&x.bookId===bookId);
 const delivered=studentMovements.filter(x=>['مستلم','مدفوع ومستلم'].includes(x.status)).length;
 const paid=studentMovements.filter(x=>['مدفوع ولم يستلم','مدفوع ومستلم'].includes(x.status)).length;
 const damaged=studentMovements.filter(x=>x.status==='تالف').length;
 const stock=Number(book?.stock||0)+inQty-outQty;
 const available=Math.max(0,stock-delivered-damaged);
 const revenue=delivered*Number(book?.price||0);
 const cost=delivered*Number(book?.cost||0);
 return {book,stock,delivered,paid,damaged,available,lowStock:available<=Number(book?.minStock??5),revenue,cost,profit:revenue-cost};
}
