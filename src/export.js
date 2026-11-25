import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrarySource } from './case-source.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('需要发布目录');
const { assets, cases } = await loadLibrarySource(root, 'https://github.com/FTShare-Lab/ftshare-dashboard-cases');
await mkdir(output, { recursive: true });
const publicAssets = Object.fromEntries(Object.entries(assets).filter(([route]) => route.startsWith('/case-assets/')));
await writeFile(join(output, 'catalog.json'), JSON.stringify({ version: 1, cases, assets: publicAssets }) + '\n');
