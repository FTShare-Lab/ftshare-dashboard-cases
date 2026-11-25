const libraryHeaders = {
  'Content-Security-Policy': "default-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
const casePolicy = [
  'sandbox allow-scripts allow-downloads',
  "default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "frame-ancestors 'self'",
  "form-action 'none'", "base-uri 'none'"
].join('; ');
const typeHeaders = (type, extra) => ({ 'Content-Type': type, ...libraryHeaders, ...extra });

export const curatedCases = ['etf-flow', 'vix-watch'];
export const retiredCases = ['index-futures-basis'];

export function createLibrary({ cases, assets, repository, origin = 'bundled', feed, creationUrl }) {
  cases = cases.filter(item => !retiredCases.includes(item.id));
  const caseByPath = new Map(cases.map(item => [item.url, item]));
  const caseById = new Map(cases.map(item => [item.id, item]));
  const origins = [...new Set(cases.filter(item => item.kind === 'external').map(item => new URL(item.entry).origin))];
  const frameOrigins = feed ? ['https:'] : origins;
  const connect = feed ? "; connect-src 'self' " + new URL(feed).origin : '';
  const shellHeaders = typeHeaders('text/html; charset=utf-8', {
    'Content-Security-Policy': libraryHeaders['Content-Security-Policy'].replace(/frame-src 'self'/, ['frame-src', "'self'", ...frameOrigins].join(' ')) + connect
  });
  return request => {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === '/' && searchParams.has('view')) return null;
    const assetCase = pathname.match(/^\/case-assets\/([^/]+)\//)?.[1];
    const selectedCase = pathname.match(/^\/cases\/([^/]+)\/?$/)?.[1];
    if (retiredCases.includes(assetCase) || retiredCases.includes(selectedCase)) {
      return new Response('该看板已从目录移除。', { status: 410, headers: typeHeaders('text/plain; charset=utf-8') });
    }
    const home = pathname === '/' || pathname === '/contribute' || caseByPath.has(pathname) || (feed && /^\/cases\/[a-z][a-z0-9-]{0,63}$/.test(pathname));
    const api = pathname === '/api/cases';
    const asset = Object.hasOwn(assets, pathname) ? assets[pathname] : null;
    if (!(home || api || asset || pathname.startsWith('/cases/') || pathname.startsWith('/case-assets/'))) return null;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const body = value => request.method === 'HEAD' ? null : value;
    if (home) return new Response(body(assets['/library/index.html'].text), { headers: shellHeaders });
    if (api) return new Response(body(JSON.stringify({ version: 1, repository, cases, origin, feed, creationUrl, curatedCases, retiredCases })), {
      headers: typeHeaders('application/json; charset=utf-8', { 'Cache-Control': 'no-store' })
    });
    if (asset) {
      const value = asset.bytes ? Uint8Array.from(atob(asset.bytes), ch => ch.charCodeAt(0)) : asset.text;
      const dataOrigin = caseById.get(assetCase)?.origin;
      const headers = typeHeaders(asset.type, assetCase ? {
        'Content-Security-Policy': dataOrigin ? casePolicy.replace("connect-src 'self'", "connect-src 'self' " + dataOrigin) : casePolicy,
        'Access-Control-Allow-Origin': '*'
      } : {});
      return new Response(body(value), { headers });
    }
    return new Response(body('找不到这个看板。'), { status: 404, headers: typeHeaders('text/plain; charset=utf-8') });
  };
}

export function isLibraryRoute(request) {
  const { pathname, searchParams } = new URL(request.url);
  return (pathname === '/' && !searchParams.has('view')) || pathname === '/contribute' ||
    pathname === '/api/cases' || /^\/(?:library|cases|case-assets)\//.test(pathname);
}
