export const isNum = x => typeof x === 'number' && Number.isFinite(x);
export function dedupeVix(rows) {
 const out=new Map();
 for(const row of rows){const old=out.get(row.trade_date);if(!old || row.version>old.version || (row.version===old.version && row.asof_ts>old.asof_ts))out.set(row.trade_date,row);}
 return out;
}
export function validVix(row,strict=false){return (row?.status==='ok' || (row?.status==='provided_value' && row?.vixSource==='user_query_excerpt')) && isNum(row.vix) && (!strict || !row.warning);}
export function derive(rows,strict=false){
 return rows.map((r,i)=>{
  const prev=rows[i-1];const v=validVix(r,strict)?r.vix:null;
  const baseline=n=>{const w=rows.slice(Math.max(0,i-n),i);return w.length===n&&w.every(x=>isNum(x.turnover)&&x.turnover>=0)?w.reduce((a,x)=>a+x.turnover,0)/n:null;};
  const avg20=baseline(20),avg60=baseline(60);
  const window=rows.slice(Math.max(0,i-252),i),history=window.filter(x=>validVix(x,strict)).map(x=>x.vix);
  return {...r,vixShown:v,returnPct:isNum(r.close)&&isNum(prev?.close)&&prev.close>0?(r.close/prev.close-1)*100:null,
   delta:isNum(v)&&validVix(prev,strict)?v-prev.vix:null,avg20,avg60,
   ratio20:isNum(r.turnover)&&avg20>0?r.turnover/avg20:null,ratio60:isNum(r.turnover)&&avg60>0?r.turnover/avg60:null,
   percentile:isNum(v)&&window.length===252&&history.length>=200?history.filter(x=>x<=v).length/history.length*100:null,
   percentileN:history.length};
 });
}
export function combinedAmount(a,b){return isNum(a)&&isNum(b)?a+b:null;}
export function dateAtOrBefore(dates,date){return dates.findLastIndex(d=>d<=date);}

// All price series use one calendar date; hidden series never change this base.
export function normalizePrices(dates,groups){
 const maps=groups.map(rows=>new Map(rows.map(r=>[r.date,r.close])));
 const baseDate=dates.find(d=>maps.length>0&&maps.every(m=>isNum(m.get(d))&&m.get(d)>0))??null;
 return {baseDate,values:maps.map(m=>dates.map(d=>baseDate&&d>=baseDate&&isNum(m.get(d))?m.get(d)/m.get(baseDate)*100:null))};
}

// The chart needs daily changes, not rolling turnover or percentile research fields.
export function chartRecords(rows,strict=false){
 return rows.map((r,i)=>({...r,vixShown:validVix(r,strict)?r.vix:null,returnPct:isNum(r.close)&&isNum(rows[i-1]?.close)&&rows[i-1].close>0?(r.close/rows[i-1].close-1)*100:null}));
}
