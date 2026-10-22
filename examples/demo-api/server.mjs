import http from 'node:http';
import os from 'node:os';

const port = Number(process.env.PORT || 3000);
let ready = true;
const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const code = path === '/readyz' && !ready ? 503 : 200;
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    app: 'k8s-lab-demo-api',
    version: process.env.APP_VERSION || '1.0.0',
    hostname: os.hostname(),
    path,
    ready
  }));
});
server.listen(port, '0.0.0.0');
process.on('SIGTERM', () => {
  ready = false;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
});
