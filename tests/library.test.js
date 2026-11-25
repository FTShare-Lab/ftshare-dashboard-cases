import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadLibrarySource } from '../src/case-source.js';
import { createLibrary } from '../src/library.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = 'https://github.com/FTShare-Lab/ftshare-dashboard-cases';
const request = path => new Request('https://example.test' + path);

test('official dashboards use original addresses and have distinct share links', async () => {
  const respond = createLibrary(await loadLibrarySource(root, repo));
  const shop = await respond(request('/api/cases')).json();
  assert.deepEqual(shop.cases.slice(0, 2).map(item => [item.url, item.entry]), [
    ['/cases/etf-flow', 'https://etf.jtxaionline.com/'],
    ['/cases/vix-watch', 'https://etf.jtxaionline.com/vix/']
  ]);
  assert.match(respond(request('/cases/vix-watch')).headers.get('content-security-policy'), /frame-src 'self' https:\/\/etf\.jtxaionline\.com/);
  assert.equal(respond(request('/contribute')).status, 200);
  assert.equal(respond(request('/cases/missing')).status, 404);
  assert.equal(respond(request('/workbench')), null);
});

test('a new case needs only a directory and its assets run in a sandbox', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'ftshare-case-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await mkdir(join(temp, 'cases'));
  await cp(join(root, 'public'), join(temp, 'public'), { recursive: true });
  const location = join(temp, 'cases/my-market-study');
  await cp(join(root, 'templates/case'), location, { recursive: true });
  const asset = join(location, 'site/series.json');
  await writeFile(asset, '{"observations":[1,2]}');
  const payload = await loadLibrarySource(temp, repo);
  const respond = createLibrary(payload);
  assert.equal(payload.cases[0].url, '/cases/my-market-study');
  const frame = respond(request(payload.cases[0].entry));
  assert.match(frame.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.doesNotMatch(frame.headers.get('content-security-policy'), /allow-same-origin/);
  assert.equal(respond(request('/case-assets/my-market-study/series.json')).headers.get('access-control-allow-origin'), '*');
  assert.equal(respond(request('/case-assets/my-market-study/README.md')).status, 404);
  await writeFile(join(location, 'site/private.txt'), '-----BEGIN PRIVATE KEY-----');
  await assert.rejects(loadLibrarySource(temp, repo), /检测到凭据/);
  assert.ok((await readFile(asset, 'utf8')).includes('observations'));
});
