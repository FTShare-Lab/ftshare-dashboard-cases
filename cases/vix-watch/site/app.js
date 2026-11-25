import {chartRecords,isNum,dateAtOrBefore,normalizePrices} from './math.js';
import {qualityLabels,freshnessText,fundDatesText,updateText} from './data-status.js';
const $=s=>document.querySelector(s);
const source='https://etf.jtxaionline.com/vix/data/';
// The HTML preload starts this download while ECharts and modules are loading.
async function loadBoard(){
 const options={signal:AbortSignal.timeout(20000)};
 let res=await fetch(source+'view.json',options);
 if(res.status===404)res=await fetch(source+'board.json',options);
 if(!res.ok)throw Error('行情文件不可用');
 return res.json();
}
const boardRequest=loadBoard();

const fmt=(v,n=2)=>isNum(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const signed=(v,n=2)=>isNum(v)?(v>0?'+':'')+fmt(v,n):'—';
const warningLabel=r=>r.warning?r.warning.split(';').map(w=>({coverage_metadata_not_provided:'查询摘录 · 覆盖信息未提供',status_and_coverage_not_provided:'查询摘录 · 状态及覆盖信息未提供',adjusted_contract_restored:'调整合约恢复',single_expiry_extrapolated:'单期限外推',implied_vol_proxy:'隐含波动率代理值',fallback_below_7d:'短期限回退',extrapolated_30d:'期限外推'}[w]||'覆盖警告')).join(' · '):'可用';
let board,series,etfs,dates,date,strict=false;
const referenceDefaults={'上证指数（参照）':true,'深证成指（参照）':true,'创业板指（参照）':true};
const trendSelections={};
const priceIds=['sh','sz','chinext'];
let broadIds=[];
const priceStyles=[['#008b70','#50d4ad'],['#8255bc','#bc9aef'],['#c43e83','#ef85bb']];
let trendZoom={start:0,end:100};
const charts={},trendLayouts={};
let syncingPointer=false;
const css=name=>getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
const colors=()=>({text:css('text'),muted:css('muted'),line:css('line'),surface:css('surface'),accent:css('accent'),up:css('up'),down:css('down'),vix:css('vix'),warn:css('warn'),slate:css('slate')});
function recompute(){series=board.series.map(s=>({...s,records:chartRecords(s.records,strict)}));etfs=board.etfs.map(s=>({...s,records:chartRecords(s.records)}));}
function windowed(records){return records.filter(r=>r.date>=board.minDate&&r.date<=date);}
function base(){const c=colors();return {animation:false,textStyle:{fontFamily:'Inter,-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,Segoe UI,sans-serif',color:c.text,fontSize:12},tooltip:{backgroundColor:c.surface,borderColor:c.line,padding:12,textStyle:{color:c.text,fontSize:13,lineHeight:23},confine:true},aria:{enabled:true},color:[c.accent,c.vix,c.warn],legend:{show:false,textStyle:{color:c.text,fontSize:12}}};}
function axis(data,index=0,labels=true){const c=colors();return {type:'category',gridIndex:index,data,boundaryGap:false,axisLabel:{show:labels,color:c.muted,fontSize:12,margin:14,hideOverlap:true,interval:'auto',formatter:v=>v.slice(2).replaceAll('-','/')},axisLine:{show:labels,lineStyle:{color:c.line}},axisTick:{show:false},splitLine:{show:false},axisPointer:{label:{show:true,backgroundColor:c.text}}};}
function valueAxis(name,index=0,extra={}){const c=colors();return {type:'value',gridIndex:index,name,nameTextStyle:{color:c.text,fontSize:12,align:'left'},nameGap:18,splitNumber:3,axisLabel:{color:c.muted,fontSize:12,margin:12},axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:c.line,type:'solid',opacity:.65}},...extra};}
function chart(id,option){
 const element=$('#'+id);
 if(!charts[id]){element.setAttribute('aria-busy','false');element.replaceChildren();charts[id]=echarts.init(element,null,{renderer:'svg'});}
 const instance=charts[id];
 if(instance.getWidth()!==element.clientWidth||instance.getHeight()!==element.clientHeight)instance.resize();
 instance.setOption({...base(),...option},{notMerge:true});
}
function renderDate(){
 $('#asof').textContent=`观察日 ${date}`;
 $('#freshness').textContent=freshnessText(board.quality);
 $('#freshness').classList.toggle('pending',board.quality?.status!=='complete');
 $('#prev').disabled=date===dates[0];$('#next').disabled=date===dates.at(-1);$('#latest').disabled=date===dates.at(-1);$('#date').value=date;
}
function renderTrend(ids=broadIds){
 const c=colors(),mobile=innerWidth<700,dark=document.documentElement.dataset.theme==='dark',fearColor=dark?'#ff9c57':'#d55e00',etfColor=dark?'#70b8ff':'#1267b1',fearName='恐慌指数（VIX）',amountName='净申赎估算';
 const groups=broadIds.map(id=>{const p=series.find(s=>s.id===id),fund=etfs.find(s=>s.id===id);return {...p,etfLabel:id==='chinext'?'创业板ETF':p.name+'ETF',rows:windowed(p.records),fund,etfRows:windowed(fund.records)};});
 const ds=groups[0].rows.map(r=>r.date);
 const prices=priceIds.map((id,i)=>{const p=series.find(s=>s.id===id);return {...p,label:id==='chinext'?'创业板指':p.name,key:(id==='chinext'?'创业板指':p.name)+'（参照）',rows:windowed(p.records),color:priceStyles[i][dark?1:0]};});
 const combinedTooltip=(d,focusId)=>{
  const i=ds.indexOf(d);if(i<0)return '';
  return `<strong>${d}</strong><div class="linked-tooltip">`+(mobile?groups.filter(q=>q.id===focusId):groups).map(q=>{
   const r=q.rows[i],e=q.etfRows[i],selection=trendSelections[q.id];
   const reason=e.flowStatus==='share_consolidation'?'份额合并、暂停申赎':e.flowStatus==='share_change_review'?'份额变动待核实':e.flowStatus==='nav_missing'?'单位净值缺失':'份额数据缺失';
   const fear=selection[fearName]===false?'':`<div>恐慌指数（VIX）　${fmt(r.vixShown)} 点${r.warning?' · '+warningLabel(r):''}</div>`;
   const price=selection[q.etfLabel+'（前复权）']===false?'':`<div>前复权价格　${fmt(e.close,3)} 元<span style="margin-left:10px;color:${isNum(e.returnPct)?e.returnPct>=0?c.up:c.down:c.muted}">日涨跌 ${signed(e.returnPct)}${isNum(e.returnPct)?'%':''}</span></div>`;
   const flow=isNum(e.netFlow)?`<span style="color:${e.netFlow>=0?c.up:c.down}">${e.netFlow>0?'净申购':e.netFlow<0?'净赎回':'净申赎'}估算　${fmt(Math.abs(e.netFlow),2)} 亿元</span>`:`净申赎估算　—（${reason}）`;
   const checks=(e.qualityFlags||[]).filter(key=>['price_jump','share_jump','flow_spike','vix_missing','price_missing'].includes(key)).map(key=>qualityLabels[key]);
   return `<div style="border-top:1px solid ${c.line};margin-top:7px;padding-top:7px"><strong>${q.etfLabel} · ${q.fund.symbol}</strong>${fear}${price}<div>${flow}</div>${checks.length?`<div style="color:${c.warn}">${checks.join(' · ')}</div>`:''}</div>`;
  }).join('')+'</div>';
 };
 for(const p of groups.filter(p=>ids.includes(p.id))){
  const etfName=p.etfLabel+'（前复权）',id='trend-'+p.id,selection=trendSelections[p.id],showRefs=prices.some(q=>selection[q.key]!==false),left=mobile?45:62,right=mobile?53:72;
  const normalized=normalizePrices(ds,[p.etfRows,...prices.map(q=>q.rows)]),h=$('#'+id).clientHeight,usable=h-214,upper=usable*.70,lower=usable*.30,tops=[70,70+upper+54];
  const line=(name,data,x,y,color,width=2.4)=>({name,type:'line',data,xAxisIndex:x,yAxisIndex:y,showSymbol:false,connectNulls:false,lineStyle:{color,width},itemStyle:{color},emphasis:{focus:'series'}});
  $('#etf-'+p.id).textContent=p.fund.name+' · '+p.fund.symbol+(showRefs&&normalized.baseDate?' · 价格基准 '+normalized.baseDate:'');
  const health=board.quality?.funds.find(f=>f.id===p.id);
  $('#dates-'+p.id).textContent=fundDatesText(health,board.asOf)+(p.rows.some(r=>/single_expiry_extrapolated|implied_vol_proxy/.test(r.warning||''))?' · ◆ 外推或代理值，悬浮查看':'');
  const reviewed=(board.quality?.issues||[]).filter(i=>i.symbol===p.fund.symbol&&i.date<=date&&i.severity==='review');
  $('#checks-'+p.id).textContent=reviewed.length?`截至观察日，${new Set(reviewed.map(i=>i.date)).size}日有待核查标记，原值保留；悬浮可查看。最近：`+reviewed.slice(-3).map(i=>`${i.date} ${qualityLabels[i.code]||i.code}`).join('；')+'。':'截至观察日，无突变待核查标记。';
  const selected={...selection};
  chart(id,{
   legend:{...base().legend,show:true,inactiveColor:c.muted,type:'scroll',orient:'horizontal',top:0,left:'center',...(mobile?{width:$('#'+id).clientWidth-10}:{}),itemWidth:22,itemHeight:9,itemGap:mobile?14:26,textStyle:{color:c.text,fontSize:12},selected,data:[fearName,etfName,...prices.map(q=>q.key)]},
   title:[{text:'恐慌指数 / 点',left,top:tops[0]-27},{text:showRefs?'价格涨跌幅 / %':'ETF前复权价格 / 元',right:0,top:tops[0]-27},{text:p.etfLabel+'净申赎估算 / 亿元',left,top:tops[1]-27},{text:'正：净申购 · 负：净赎回',right:0,top:tops[1]-27}].map(t=>({...t,padding:0,textStyle:{fontSize:mobile?11:12,fontWeight:500,color:c.muted}})),
   grid:[{left,right,top:tops[0],height:upper},{left,right,top:tops[1],height:lower}],axisPointer:{link:[{xAxisIndex:'all'}]},
   tooltip:{...base().tooltip,trigger:'axis',axisPointer:{axis:'x',type:'line'},formatter:ps=>{
    const point=ps.find(q=>q.axisDim==='x'&&ds.includes(q.axisValue));return point?combinedTooltip(point.axisValue,p.id):'';
   }},
   xAxis:[axis(ds,0,false),axis(ds,1)],yAxis:[valueAxis('',0,{scale:true}),valueAxis('',0,{position:'right',scale:true,splitLine:{show:false},axisPointer:{show:false,triggerTooltip:false}}),valueAxis('',1)],
   dataZoom:[{type:'inside',xAxisIndex:[0,1],filterMode:'filter',...trendZoom},{type:'slider',xAxisIndex:[0,1],left,right,bottom:3,height:22,showDataShadow:false,borderColor:c.line,textStyle:{color:c.muted,fontSize:11},fillerColor:css('soft'),handleSize:'115%',handleStyle:{color:c.accent,borderWidth:0},moveHandleSize:0,filterMode:'filter',...trendZoom}],
   series:[{...line(fearName,p.rows.map(r=>r.vixShown),0,0,fearColor,2.8),z:6,markPoint:{symbol:'diamond',symbolSize:10,label:{show:false},itemStyle:{color:c.warn,borderColor:c.surface,borderWidth:1},data:p.rows.filter(r=>isNum(r.vixShown)&&/single_expiry_extrapolated|implied_vol_proxy/.test(r.warning||'')).map(r=>({coord:[r.date,r.vixShown]}))}},line(etfName,showRefs?normalized.values[0].map(v=>isNum(v)?v-100:null):p.etfRows.map(r=>r.close),0,1,etfColor,2.3),...prices.map((q,i)=>({...line(q.key,normalized.values[i+1].map(v=>isNum(v)?v-100:null),0,1,q.color,1.6),lineStyle:{color:q.color,width:1.6,type:'dashed',opacity:.85}})),{name:amountName,type:'bar',xAxisIndex:1,yAxisIndex:2,barMaxWidth:10,itemStyle:{opacity:.85},data:p.etfRows.map(r=>({value:r.netFlow,itemStyle:{color:r.netFlow>=0?c.up:c.down}})),markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:c.muted,width:1,type:'solid'},data:[{yAxis:0}]}}]
  });
  const instance=charts[id];
  trendLayouts[id]={tops,heights:[upper,lower]};
  instance.off('legendselectchanged');instance.on('legendselectchanged',e=>{Object.assign(selection,e.selected);renderTrend([p.id]);});
  instance.off('datazoom');instance.on('datazoom',e=>{const z=e.batch?.[0]||e;if(!isNum(z.start)||!isNum(z.end))return;trendZoom={start:z.start,end:z.end};for(const other of broadIds){if(other!==p.id)charts['trend-'+other]?.dispatchAction({type:'dataZoom',...trendZoom},{silent:true});}});
  instance.off('updateAxisPointer');instance.on('updateAxisPointer',e=>{
   if(syncingPointer)return;
   const info=e.axesInfo?.find(a=>a.axisDim==='x');if(!info)return;
   const day=typeof info.value==='string'?info.value:ds[info.value];if(!ds.includes(day))return;
   syncingPointer=true;
   try{for(const other of broadIds){const key='trend-'+other,target=charts[key],layout=trendLayouts[key];if(other===p.id||!target||!layout)continue;
    const axisIndex=info.axisIndex===1?1:0;
    target.dispatchAction({type:'updateAxisPointer',x:target.convertToPixel({xAxisIndex:axisIndex},day),y:layout.tops[axisIndex]+layout.heights[axisIndex]/2},{silent:true});
   }}finally{syncingPointer=false;}
  });
  instance.getZr().off('globalout');instance.getZr().on('globalout',()=>{
   syncingPointer=true;
   try{for(const target of Object.values(charts)){target.dispatchAction({type:'updateAxisPointer',currTrigger:'leave'},{silent:true});target.dispatchAction({type:'hideTip'},{silent:true});}}finally{syncingPointer=false;}
  });
  const audit=board.audit.flows.find(f=>f.symbol===p.fund.symbol);
  $('#source-'+p.id).textContent=`${ds[0]||'—'}至${ds.at(-1)||'—'}。ETF价格为前复权收盘价；净申赎估算＝${p.fund.symbol.endsWith('.SZ')?'下一交易日与当日份额记录之差':'当日与前一交易日份额差'}×当日原始单位净值，正值为净申购、负值为净赎回，并非二级市场主动买卖金额。净申赎覆盖${audit.first}至${p.etfRows.findLast(r=>isNum(r.netFlow))?.date||'—'}，缺失${p.etfRows.filter(r=>r.date>=audit.first&&!isNum(r.netFlow)).length}日；2022年以前份额不足，保留空白。数据服务：FtShare。${p.id==='csi1000'?'2022-09-02份额合并、暂停申赎，当日留空，不将合并及取整差额视为资金流。':''}大盘价格相对${normalized.baseDate||'无共同有效日期'}归一，全部参照关闭后恢复ETF前复权价格（元）。`;

 }
}
function setupNavigation(){
 const nav=$('#vixNav'),cards=broadIds.map(id=>$('#vix-'+id));
 nav.innerHTML=broadIds.map(id=>`<a href="#vix-${id}">${board.series.find(s=>s.id===id).name}</a>`).join('');
 const links=[...nav.querySelectorAll('a')];let frame,active=-1;
 const sync=()=>{
  const edge=nav.getBoundingClientRect().bottom+48;
  let index=0;cards.forEach((card,i)=>{if(card.getBoundingClientRect().top<=edge)index=i;});
  if(index===active)return;active=index;
  links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  const link=links[index];nav.scrollTo({left:link.offsetLeft-nav.offsetLeft-(nav.clientWidth-link.offsetWidth)/2,behavior:'auto'});
 };
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);};
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 const initial=cards.find(card=>'#'+card.id===location.hash);if(initial)initial.scrollIntoView({behavior:'instant',block:'start'});
 sync();
}
function chartError(box,label='行情加载失败'){
 box.setAttribute('aria-busy','false');box.replaceChildren();
 const status=document.createElement('div');status.className='chart-loading';
 const text=document.createElement('span');text.textContent=label;
 const retry=document.createElement('button');retry.className='chart-retry';retry.textContent='重新加载';retry.onclick=()=>location.reload();
 status.append(text,retry);box.append(status);
}
const visibleCharts=new Set(),chartVersions=new Map();
let renderRevision=0,renderFrame=0;
function scheduleCharts(){
 if(renderFrame||!board)return;
 renderFrame=requestAnimationFrame(()=>{
  renderFrame=0;
  const id=[...visibleCharts].find(id=>chartVersions.get(id)!==renderRevision);
  if(!id)return;
  try{renderTrend([id]);}catch(error){chartError($('#trend-'+id),'图表加载失败');console.error(error);}
  chartVersions.set(id,renderRevision);
  if([...visibleCharts].some(id=>chartVersions.get(id)!==renderRevision))scheduleCharts();
 });
}
function observeCharts(){
 const initial=broadIds.find(id=>location.hash==='#vix-'+id)||broadIds[0];
 visibleCharts.add(initial);
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const id=entry.target.id.slice(4);if(entry.isIntersecting)visibleCharts.add(id);else visibleCharts.delete(id);}
   scheduleCharts();
  },{rootMargin:'250px 0px'});
  for(const id of broadIds)observer.observe($('#vix-'+id));
 }else broadIds.forEach(id=>visibleCharts.add(id));
 scheduleCharts();
}
function render(){renderDate();renderRevision++;scheduleCharts();}
function selectDate(d){trendZoom={start:0,end:100};let i=dateAtOrBefore(dates,d);if(i<0)i=0;date=dates[i];$('#dateMessage').textContent=d!==date?`该日期无交易记录，已定位至 ${date}。`:'';render();}
$('#theme').onclick=()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('ftshare-vix-theme',dark?'dark':'light')}catch{}$('#theme').textContent=dark?'浅色':'深色';if(board)render();};
$('#theme').textContent=document.documentElement.dataset.theme==='dark'?'浅色':'深色';
$('#date').onchange=e=>{if(e.target.value)selectDate(e.target.value)};$('#prev').onclick=()=>selectDate(dates[Math.max(0,dates.indexOf(date)-1)]);$('#next').onclick=()=>selectDate(dates[Math.min(dates.length-1,dates.indexOf(date)+1)]);$('#latest').onclick=()=>selectDate(dates.at(-1));
let resizeTimer;window.addEventListener('resize',()=>{
 clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(board){renderRevision++;scheduleCharts();}},100);
});
try{
 board=await boardRequest;
 broadIds=board.etfs.map(f=>f.id);
 for(const id of broadIds)trendSelections[id]={...referenceDefaults};
 dates=board.calendar.filter(d=>d>=board.minDate&&d<=board.asOf);date=board.asOf;
 recompute();
 $('#date').min=board.minDate;$('#date').max=board.asOf;$('#date').disabled=false;
 $('#content').setAttribute('aria-busy','false');$('#loading').hidden=true;
 render();setupNavigation();observeCharts();
}catch(e){
 $('#asof').textContent='行情暂不可用';
 for(const box of document.querySelectorAll('.fear-chart'))chartError(box);
 console.error(e);
}

if(board){try{const response=await fetch(source+'update-status.json');if(response.ok)$('#updateStatus').textContent=updateText(await response.json(),board);}catch{}}
