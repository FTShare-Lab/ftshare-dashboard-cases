export const qualityLabels = {price_jump:'价格跳变待核查',share_jump:'份额变动待核查',flow_spike:'净申赎突增待核查',share_change_review:'份额折算待核查',share_consolidation:'份额合并、暂停申赎',share_missing:'份额缺失',nav_missing:'净值缺失',price_missing:'价格缺失',vix_missing:'恐慌指数缺失'};
export function freshnessText(quality) {
  if (!quality) return '';
  if(!quality.funds?.length)return `最新完整数据 ${quality.completeThrough || '—'}`;
  return [['price','ETF价格'],['vix','VIX'],['flow','净申赎']].map(([key,label])=>{
    const dates=quality.funds.map(f=>f.latest[key]).filter(Boolean).sort();
    const range=dates.length?(dates[0]===dates.at(-1)?dates[0]:dates[0]+'—'+dates.at(-1)):'缺失';
    return label+' '+range;
  }).join(' ｜ ');
}
export function fundDatesText(fund, expectedDate) {
  if (!fund) return '';
  const labels = {price:'ETF价格',vix:'恐慌指数',flow:'净申赎'};
  const parts = Object.entries(labels).map(([key, label]) => `${label} ${fund.latest[key] || '缺失'}`);
  const missing = fund.pending.filter(key => ['shares','nav'].includes(key));
  if (missing.length) parts.push(missing.map(k => k === 'shares' ? '份额' : '净值').join('、') + `未齐至 ${expectedDate}`);
  return parts.join(' · ');
}
export function updateText(status, board) {
  if (!status) return '';
  // A failed bookkeeping step after a successful board commit must not claim old data was retained.
  if (status.status === 'failed') return '本次更新未完成，保留原快照';
  if (status.status === 'maintenance_failed') return '更新记录未完成，请核查';
  if (status.status === 'running') return '数据更新中';
  if (status.runId !== board.update?.runId) return '';
  return '';
}
