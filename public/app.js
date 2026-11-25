const byId = id => document.getElementById(id);
const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
const currentPath = location.pathname;
const copyButton = byId('share');
const loading = byId('case-loading');
const viewer = byId('viewer');
const rail = byId('rail-toggle');
const compact = matchMedia('(max-width: 700px)');
const collapseKey = () => 'ftshare-library-collapsed:' + (compact.matches ? 'mobile' : 'desktop');
function setCollapsed(collapsed) {
  document.documentElement.classList.toggle('rail-collapsed', collapsed);
  rail.setAttribute('aria-expanded', String(!collapsed));
  const label = collapsed ? '展开看板库' : '收起看板库';
  rail.setAttribute('aria-label', label);
  rail.title = label;
  byId('rail-directory').hidden = collapsed;
  byId('rail-footer').hidden = collapsed;
}
function restoreRail() {
  let collapsed = false;
  try { collapsed = localStorage.getItem(collapseKey()) === 'true'; } catch {}
  setCollapsed(collapsed);
}
rail.onclick = () => {
  const collapsed = rail.getAttribute('aria-expanded') === 'true';
  setCollapsed(collapsed);
  try { localStorage.setItem(collapseKey(), String(collapsed)); } catch {}
};
compact.addEventListener('change', restoreRail);
restoreRail();
let toastTimer;
function announce(message) {
  const status = byId('status');
  status.textContent = message;
  status.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { status.hidden = true; }, 4000);
}
function parseUrl(value) {
  if (typeof value !== 'string') return null;
  try { return new URL(value); } catch { return null; }
}

async function loadLibrary() {
  const response = await fetch('/api/cases');
  if (!response.ok) throw new Error('暂时无法读取看板目录。');
  const { cases: bundled, repository, origin, feed, creationUrl, curatedCases = [], retiredCases = [] } = await response.json();
  if (creationUrl) byId('create').href = creationUrl;
  const reserved = new Set([...curatedCases, ...retiredCases]);
  let cases = bundled;
  let selected = currentPath === '/' ? cases[0] : cases.find(item => item.url === currentPath);
  const query = byId('search');
  function list() {
    query.hidden = cases.length < 6;
    const match = query.value.trim().normalize('NFKC').toLowerCase();
    const results = cases.filter(item =>
      [item.title, item.description, item.author, ...item.tags].some(term => term.normalize('NFKC').toLowerCase().includes(match)));
    byId('directory').replaceChildren(...results.map(item => {
      const link = element('a', '');
      link.href = item.url;
      if (item.id === selected?.id) link.setAttribute('aria-current', 'page');
      link.textContent = item.title;
      link.title = item.description;
      return link;
    }));
    byId('directory-empty').hidden = results.length > 0;
  }
  query.addEventListener('input', list);
  list();
  if (origin !== 'published' && feed) {
    const refresh = async () => {
      try {
        const endpoint = new URL(feed);
        const next = await fetch(endpoint, { credentials: 'omit', signal: AbortSignal.timeout(6000) });
        if (!next.ok) return;
        const release = await next.json();
        if (release.version !== 1 || !Array.isArray(release.cases) || release.cases.length === 0) return;
        const validated = release.cases.filter(item => {
          if (!item || typeof item.id !== 'string' || item.url !== '/cases/' + item.id ||
            !/^[a-z][a-z0-9-]{0,63}$/.test(item.id) || !Array.isArray(item.tags) ||
            ![item.title, item.description, item.author, item.data, ...item.tags].every(value => typeof value === 'string')) return false;
          const entry = parseUrl(item.entry);
          if (entry?.protocol !== 'https:' || entry.username || entry.password) return false;
          if (item.kind === 'local') return entry.href === new URL('case-assets/' + item.id + '/index.html', endpoint).href;
          return item.kind === 'external';
        });
        if (validated.length !== release.cases.length) return;
        cases = [...bundled.filter(item => curatedCases.includes(item.id)), ...validated.filter(item => !reserved.has(item.id))];
        if (!selected || selected.kind === 'local') {
          const matching = cases.find(item => item.url === currentPath);
          if (matching) selected = matching;
        }
        byId('directory').dataset.source = 'published';
        list();
      } catch {
        // The bundled cases remain available when the public feed is unavailable.
      }
    };
    if (selected?.kind === 'external') void refresh();
    else if (currentPath !== '/contribute') await refresh();
  }

  if (currentPath === '/contribute') {
    document.title = '贡献看板 · FtShare 看板库';
    byId('contribute').setAttribute('aria-current', 'page');
    const article = element('article', '');
    article.append(element('h1', '贡献你的看板'));
    const list = element('ol', '');
    for (const step of ['复制案例模板，在本地完成看板。', '注明数据来源、观察范围和公开分发权限。', '提交 Pull Request，审核通过后发布。']) {
      list.append(element('li', step));
    }
    const guide = element('a', 'GitHub 贡献指南');
    guide.href = repository + '/blob/main/CONTRIBUTING.md';
    const template = element('a', '案例模板');
    template.href = repository + '/tree/main/templates/case';
    const links = element('div', '');
    links.className = 'contribution-links';
    links.append(guide, template);
    article.append(list, links);
    viewer.classList.add('contribution');
    viewer.append(article);
    loading.hidden = true;
    return;
  }
  if (!selected) throw new Error('找不到这个看板。请从目录选择一个案例。');
  document.title = selected.title + ' · FtShare 看板库';
  if (selected.author !== 'FtShare') {
    const credit = byId('case-credit');
    const sourceUrl = parseUrl(selected.source);
    if (sourceUrl?.protocol === 'https:') {
      const author = element('a', selected.author);
      author.href = sourceUrl.href;
      author.target = '_blank';
      author.rel = 'noopener noreferrer';
      credit.append(author);
    } else {
      credit.textContent = selected.author;
    }
    credit.hidden = false;
  }
  const frame = document.createElement('iframe');
  frame.title = selected.title;
  frame.setAttribute('sandbox', selected.kind === 'external' && new URL(selected.entry, location.origin).origin !== location.origin
    ? 'allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox'
    : selected.origin ? 'allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox' : 'allow-scripts allow-downloads');
  frame.referrerPolicy = 'no-referrer';
  frame.src = selected.entry;
  viewer.append(frame);
  loading.hidden = true;
  const source = byId('source');
  source.href = parseUrl(selected.original)?.protocol === 'https:' ? selected.original : selected.entry;
  source.textContent = selected.kind === 'external' || selected.original ? '打开原站' : '独立打开';
  byId('case-actions').hidden = false;
  const charts = Array.isArray(selected.charts) ? selected.charts : [];
  const jumpLinks = byId('chart-links');
  for (const chart of charts) {
    if (!/^[A-Za-z][\w-]{0,48}$/.test(chart?.id ?? '') || typeof chart?.label !== 'string') continue;
    const url = new URL(selected.entry, location.origin);
    url.hash = chart.id;
    const row = element('li', '');
    const target = element('a', chart.label);
    target.href = url.href;
    target.onclick = event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      frame.src = url.href;
      jumpLinks.querySelector('[aria-current]')?.removeAttribute('aria-current');
      target.setAttribute('aria-current', 'location');
    };
    row.append(target);
    jumpLinks.append(row);
  }
  byId('chart-navigation').hidden = !jumpLinks.childElementCount;
  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(new URL(selected.url, location.origin).href);
      announce('已复制看板链接。');
    } catch {
      announce(new URL(selected.url, location.origin).href);
    }
  };
}

loadLibrary().catch(error => {
  loading.textContent = error.message;
});
