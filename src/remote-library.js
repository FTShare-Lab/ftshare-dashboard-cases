import { createLibrary } from './library.js';

const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function readPublishedCatalog(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.cases) || !payload.cases.length ||
      !payload.assets || typeof payload.assets !== 'object' || Array.isArray(payload.assets)) throw new Error('无效发布目录');
  const ids = new Set();
  for (const item of payload.cases) {
    if (!item || typeof item.id !== 'string' || !idPattern.test(item.id) || ids.has(item.id) ||
        item.url !== '/cases/' + item.id || typeof item.entry !== 'string') throw new Error('无效案例入口');
    ids.add(item.id);
    if (item.kind === 'local') {
      if (item.entry !== '/case-assets/' + item.id + '/index.html' ||
          !Object.hasOwn(payload.assets, item.entry)) throw new Error('无效本地案例入口');
    } else if (item.kind === 'external') {
      const entry = new URL(item.entry);
      if (entry.protocol !== 'https:' || entry.username || entry.password || entry.port) throw new Error('无效站外案例入口');
    } else throw new Error('无效案例类型');
  }
  const assetPath = /^\/case-assets\/([a-z0-9-]+)(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+$/;
  for (const [route, asset] of Object.entries(payload.assets)) {
    const id = route.match(assetPath)?.[1];
    if (!ids.has(id) || typeof asset?.type !== 'string' ||
        (typeof asset.text !== 'string' && typeof asset.bytes !== 'string')) throw new Error('无效案例资源');
  }
  return payload;
}

export function followPublishedCases(local, endpoint, { fetcher = fetch, now = Date.now } = {}) {
  let handler = createLibrary(local);
  let checkedUntil = 0;
  return async function serve(request) {
    if (now() >= checkedUntil) {
      checkedUntil = now() + 60_000;
      try {
        const response = await fetcher(endpoint, {
          redirect: 'error', signal: AbortSignal.timeout(7500)
        });
        if (!response.ok) throw new Error('发布目录不可用');
        const raw = await response.text();
        if (raw.length > 3_000_000) throw new Error('发布目录超过大小限制');
        const { cases, assets } = readPublishedCatalog(JSON.parse(raw));
        const shell = Object.fromEntries(Object.entries(local.assets).filter(([route]) => route.startsWith('/library/')));
        handler = createLibrary({ cases, assets: { ...shell, ...assets }, repository: local.repository, origin: 'published', feed: local.feed });
      } catch (error) {
        console.warn('Could not refresh the public case catalog:', error.message);
      }
    }
    return handler(request);
  };
}
