import {isActive} from '../../db';
export function inventory(data,bookId){
 const book=(data.books||[]).find(x=>x.id===bookId);
 const movements=(data.studentBooks||[]).filter(x=>isActive(x)&&x.bookId===bookId);
 const delivered=movements.filter(x=>['مستلم','مدفوع ومستلم'].includes(x.status)).length;
 const paid=movements.filter(x=>['مدفوع ولم يستلم','مدفوع ومستلم'].includes(x.status)).length;
 const damaged=movements.filter(x=>x.status==='تالف').length;
 const stock=Number(book?.stock||0);
 return {book,stock,delivered,paid,damaged,available:Math.max(0,stock-delivered-damaged),lowStock:Math.max(0,stock-delivered-damaged)<=Number(book?.minStock??5)};
}
