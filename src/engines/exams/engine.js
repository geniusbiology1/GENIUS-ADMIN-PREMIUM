import {isActive} from '../../db';
export function examStats(data,examId){
 const rows=(data.grades||[]).filter(x=>isActive(x)&&x.examId===examId);
 const scores=rows.map(x=>Number(x.score||0)), max=rows.map(x=>Number(x.maxScore||0));
 const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
 const ordered=[...rows].sort((a,b)=>(Number(b.score||0)/Number(b.maxScore||1))-(Number(a.score||0)/Number(a.maxScore||1)));
 const median=ordered.length?(()=>{const v=ordered.map(x=>Number(x.score||0)).sort((a,b)=>a-b);const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2})():0;
 return {count:rows.length,average:avg,median,highest:scores.length?Math.max(...scores):0,lowest:scores.length?Math.min(...scores):0,passRate:rows.length?Math.round(rows.filter(x=>Number(x.score||0)>=Number(x.passScore||x.maxScore||0)*.5).length/rows.length*100):0,ranking:ordered.map((x,i)=>({...x,rank:i+1}))};
}
