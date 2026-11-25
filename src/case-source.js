import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const slugPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const filePattern = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.csv': 'text/csv', '.txt': 'text/plain', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
};
const binary = new Set(['.png', '.jpeg', '.jpg', '.webp', '.woff2']);
const byId = new Intl.Collator('en');
const text = (value, max) => typeof value === 'string' && value.trim() !== '' && value.length <= max;
const secret = /ftshare_sk_[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}/;
const expected = ['id', 'title', 'description', 'tags', 'author', 'kind', 'entry', 'data', 'source'];
const priority = ['etf-flow', 'vix-watch'];

function validateManifest(item, id) {
  if (!item || Object.keys(item).some(key => !expected.includes(key)) || item.id !== id || !slugPattern.test(id) || id.length > 64 ||
      !text(item.title, 56) || !text(item.description, 140) || !text(item.author, 48) || !text(item.data, 140) ||
      !Array.isArray(item.tags) || item.tags.length > 4 || item.tags.some(tag => !text(tag, 22)) ||
      !['local', 'external'].includes(item.kind) || typeof item.entry !== 'string') {
    throw new Error(`cases/${id}/case.json 缺少有效的案例字段`);
  }
  if (item.kind === 'local' && item.entry !== 'index.html') {
    throw new Error(`cases/${id} 的本地入口须为 index.html`);
  }
  for (const candidate of [item.kind === 'external' ? item.entry : undefined, item.source]) {
    if (candidate === undefined) continue;
    const url = URL.parse(candidate);
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || candidate.length > 300) {
      throw new Error(`cases/${id} 只接受标准 HTTPS 链接`);
    }
  }
  return item;
}

export async function loadLibrarySource(root, repository) {
  const assets = {};
  let bytes = 0;
  async function addAsset(path, route) {
    const extension = extname(path);
    if (!Object.hasOwn(types, extension)) throw new Error(`不支持发布 ${route}`);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 1_500_000) throw new Error(`文件过大或不是普通文件 ${route}`);
    const data = await readFile(path);
    bytes += data.length;
    if (bytes > 2_000_000) throw new Error('案例库发布资源合计超过 2 MB');
    if (!binary.has(extension) && secret.test(data.toString('utf8'))) throw new Error(`检测到凭据 ${route}`);
    assets[route] = binary.has(extension)
      ? { type: types[extension], bytes: data.toString('base64') }
      : { type: types[extension] + '; charset=utf-8', text: data.toString('utf8') };
  }
  for (const file of ['index.html', 'style.css', 'app.js']) await addAsset(join(root, 'public', file), '/library/' + file);

  async function include(directory, prefix) {
    if (!(await lstat(directory)).isDirectory()) throw new Error(`不是案例目录 ${directory}`);
    for (const file of await readdir(directory, { withFileTypes: true })) {
      if (!filePattern.test(file.name)) throw new Error(`不支持发布文件名 ${file.name}`);
      const path = join(directory, file.name);
      const route = prefix + '/' + file.name;
      if (file.isDirectory()) await include(path, route);
      else await addAsset(path, route);
    }
  }
  const directories = await readdir(join(root, 'cases'), { withFileTypes: true });
  const cases = [];
  for (const directory of directories) {
    const id = directory.name;
    if (!directory.isDirectory()) throw new Error('cases/ 下只允许案例目录');
    const directoryPath = join(root, 'cases', id);
    const manifestPath = join(directoryPath, 'case.json');
    if (!(await lstat(manifestPath)).isFile()) throw new Error(`无效的案例清单 ${id}`);
    const raw = await readFile(manifestPath, 'utf8');
    if (raw.length > 3000 || secret.test(raw)) throw new Error(`无效的案例清单 ${id}`);
    const item = validateManifest(JSON.parse(raw), id);
    if (item.kind === 'external') {
      cases.push({ ...item, url: '/cases/' + id });
    } else {
      const prefix = '/case-assets/' + id;
      await include(join(directoryPath, 'site'), prefix);
      const entry = prefix + '/' + item.entry;
      if (!assets[entry]) throw new Error(`案例 ${id} 缺少入口文件`);
      cases.push({ ...item, entry, url: '/cases/' + id });
    }
  }
  if (!cases.length) throw new Error('没有案例');
  const order = id => priority.indexOf(id) < 0 ? priority.length : priority.indexOf(id);
  cases.sort((a, b) => order(a.id) - order(b.id) || byId.compare(a.id, b.id));
  return { assets, cases, repository };
}
