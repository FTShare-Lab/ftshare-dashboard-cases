import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrarySource } from './case-source.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('需要发布目录');
const { assets, cases } = await loadLibrarySource(root, 'https://github.com/FTShare-Lab/ftshare-dashboard-cases');
await mkdir(output, { recursive: true });
const publicAssets = Object.fromEntries(Object.entries(assets).filter(([route]) => route.startsWith('/case-assets/')));
await writeFile(join(output, 'catalog.json'), JSON.stringify({ version: 1, cases, assets: publicAssets }) + '\n');

const prefix = 'https://ftshare-lab.github.io/ftshare-dashboard-cases';
const readable = cases.map(item => item.kind === 'local' ? { ...item, entry: prefix + item.entry } : item);
const sharedAssets = Object.fromEntries(Object.entries(assets).filter(([route]) =>
  /^\/library\/(?:echarts\.min\.js|(?:ECHARTS-LICENSE|ECHARTS-NOTICE|LICENSE-d3)\.txt)$/.test(route)));
for (const [route, asset] of Object.entries({ ...publicAssets, ...sharedAssets })) {
  const file = join(output, route.slice(1));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, asset.bytes ? Buffer.from(asset.bytes, 'base64') : asset.text);
}
await writeFile(join(output, 'browse.json'), JSON.stringify({ version: 1, cases: readable }) + '\n');
