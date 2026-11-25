import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadLibrarySource } from './case-source.js';
import { createLibrary } from './library.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const repository = 'https://github.com/FTShare-Lab/ftshare-dashboard-cases';
const port = Number(process.env.PORT || 8770);
const respond = createLibrary({
  ...await loadLibrarySource(root, repository),
  creationUrl: 'https://ftshare-visualization.zippymarshmallow.chatgpt.site/create'
});
createServer(async (request, response) => {
  const method = request.method === 'GET' || request.method === 'HEAD' ? request.method : 'POST';
  const result = respond(new Request('http://localhost' + request.url, { method })) ?? new Response(null, { status: 404 });
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`FtShare 看板库 http://127.0.0.1:${port}/`));
