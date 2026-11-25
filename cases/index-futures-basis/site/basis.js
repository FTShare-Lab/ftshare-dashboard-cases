const $ = id => document.getElementById(id);
const parameters = { IF: [3900, 3, 16], IC: [5700, -28, 26], IM: [6200, -42, 30] };
const dates = Array.from({ length: 110 }, (_, n) => new Date(Date.UTC(2026, 6, 1 + n)))
  .filter(d => ![0, 6].includes(d.getUTCDay())).map(d => d.toISOString().slice(0, 10));
const one = n => n.toFixed(1);
const signed = value => (value > 0 ? '+' : '') + one(value);
const positive = '#b24450';
const negative = '#167760';
const chart = $('chart');
let shown = [];

function rows() {
  const [base, offset, variance] = parameters[$('index').value];
  return dates.map((date, i) => {
    const spot = Math.round((base + i * 1.4 + Math.sin(i / 6) * 70) * 10) / 10;
    const future = Math.round((spot + offset + Math.sin(i / 4.4) * variance + Math.cos(i / 2) * 5) * 10) / 10;
    return { date, spot, future, basis: Math.round((future - spot) * 10) / 10 };
  }).slice(-Number($('window').value));
}

function draw() {
  if (!shown.length) return;
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  if (width < 100 || height < 100) return;
  const ratio = devicePixelRatio || 1;
  chart.width = Math.round(width * ratio);
  chart.height = Math.round(height * ratio);
  const ctx = chart.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = '12px system-ui';
  const left = 39;
  const right = width - 10;
  const top = 23;
  const bottom = height - 34;
  const step = Math.max(10, Math.ceil(Math.max(...shown.map(row => Math.abs(row.basis))) / 20) * 10);
  const position = basis => top + (2 * step - basis) / (4 * step) * (bottom - top);
  const slot = (right - left) / shown.length;
  for (const tick of [2 * step, step, 0, -step, -2 * step]) {
    const y = position(tick);
    ctx.strokeStyle = tick === 0 ? '#8ba5b5' : '#e0e9ef';
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = '#516776';
    ctx.fillText(String(tick), 4, y + 4);
  }
  shown.forEach(({ basis }, i) => {
    const y = position(basis);
    const zero = position(0);
    ctx.fillStyle = basis >= 0 ? positive : negative;
    ctx.fillRect(left + (i + 0.2) * slot, Math.min(y, zero), slot * 0.6, Math.abs(zero - y));
  });
  ctx.fillStyle = '#516776';
  ctx.fillText(shown[0].date.slice(5), left, height - 12);
  const lastDate = shown.at(-1).date.slice(5);
  ctx.fillText(lastDate, right - ctx.measureText(lastDate).width, height - 12);
}

function render() {
  shown = rows();
  const last = shown.at(-1);
  const average = shown.reduce((sum, row) => sum + row.basis, 0) / shown.length;
  $('last').textContent = signed(last.basis) + ' 点';
  $('average').textContent = signed(average) + ' 点';
  $('latest-date').textContent = last.date;
  $('under').textContent = shown.filter(row => row.basis < 0).length + ' / ' + shown.length;
  $('chart-summary').textContent = shown[0].date + ' 至 ' + last.date + ' · ' + shown.length + ' 条观测';
  $('data').replaceChildren(...shown.map(row => {
    const tr = document.createElement('tr');
    tr.append(...[row.date, one(row.future), one(row.spot), signed(row.basis)].map(value =>
      Object.assign(document.createElement('td'), { textContent: value })));
    return tr;
  }));
  $('readout').textContent = '';
  draw();
}
for (const id of ['index', 'window']) $(id).addEventListener('change', render);
chart.addEventListener('pointermove', event => {
  const x = (event.offsetX - 39) / (chart.clientWidth - 49);
  const selected = shown[Math.floor(x * shown.length)];
  $('readout').textContent = selected ? selected.date + ' · ' + signed(selected.basis) + ' 点' : '';
});
chart.addEventListener('pointerleave', () => { $('readout').textContent = ''; });
new ResizeObserver(draw).observe(chart);
render();
