const byId = id => document.getElementById(id);
const element = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
const currentPath = location.pathname;
const copyButton = byId('share');

async function loadLibrary() {
  const response = await fetch('/api/cases');
  if (!response.ok) throw new Error('暂时无法读取看板目录。');
  const { cases, repository } = await response.json();
  const selected = currentPath === '/' ? cases[0] : cases.find(item => item.url === currentPath);
  const query = byId('search');
  function list() {
    const match = query.value.trim().normalize('NFKC').toLowerCase();
    const results = cases.filter(item =>
      [item.title, item.description, item.author, ...item.tags].some(term => term.normalize('NFKC').toLowerCase().includes(match)));
    byId('directory').replaceChildren(...results.map(item => {
      const link = element('a', '');
      link.href = item.url;
      if (item === selected) link.setAttribute('aria-current', 'page');
      link.append(element('strong', item.title), element('span', item.description));
      return link;
    }));
    byId('directory-empty').hidden = results.length > 0;
  }
  query.addEventListener('input', list);
  list();

  if (currentPath === '/contribute') {
    byId('case-title').textContent = '贡献你的看板';
    byId('case-description').textContent = '把你已经打磨好的金融研究变成一个别人可以直接打开的案例。';
    const article = element('article', '');
    const list = element('ol', '');
    for (const step of ['复制案例模板，在本地完成看板。', '给出数据来源、更新范围和可公开预览的数据。', '提交 Pull Request。通过检查和维护者预览后，就会出现在案例目录。']) {
      list.append(element('li', step));
    }
    const guide = element('a', '打开 GitHub 贡献指南');
    guide.href = repository + '/blob/main/CONTRIBUTING.md';
    const template = element('a', '查看案例模板');
    template.href = repository + '/tree/main/templates/case';
    article.append(list, guide, element('p', ''), template);
    byId('viewer').append(article);
    return;
  }
  if (!selected) throw new Error('找不到这个看板。请从目录选择一个案例。');
  document.title = selected.title + ' · FtShare 看板库';
  byId('case-title').textContent = selected.title;
  byId('case-description').textContent = selected.description;
  byId('case-meta').textContent = [selected.author, ...selected.tags, selected.data].join(' · ');
  const frame = document.createElement('iframe');
  frame.title = selected.title;
  frame.setAttribute('sandbox', selected.kind === 'external'
    ? 'allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox'
    : 'allow-scripts allow-downloads');
  frame.referrerPolicy = 'no-referrer';
  frame.src = selected.entry;
  byId('viewer').append(frame);
  const source = byId('source');
  source.href = selected.entry;
  source.textContent = selected.kind === 'external' ? '打开原看板' : '在独立页打开';
  source.hidden = false;
  copyButton.hidden = false;
  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(new URL(selected.url, location.origin).href);
      byId('status').textContent = '已复制看板链接。';
    } catch {
      byId('status').textContent = '看板链接：' + new URL(selected.url, location.origin).href;
    }
    byId('status').hidden = false;
  };
}

loadLibrary().catch(error => {
  byId('case-title').textContent = error.message;
});
