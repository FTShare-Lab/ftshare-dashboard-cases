import { fileURLToPath } from 'node:url';
import { loadLibrarySource } from './case-source.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { cases, assets } = await loadLibrarySource(root, 'https://github.com/FTShare-Lab/ftshare-dashboard-cases');
console.log(`已验证 ${cases.length} 个案例、${Object.keys(assets).length} 个资源。`);
for (const item of cases) console.log(item.id + '  ' + item.title);
