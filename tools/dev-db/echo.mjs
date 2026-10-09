// LOCAL DEV ONLY. Stand-in for a Vercel deploy hook: records every request, answers like the real hook does.
// GET /last returns the most recent recorded request (and is not itself recorded).
import http from 'node:http';
import { appendFileSync } from 'node:fs';

const PORT = Number(process.env.ECHO_PORT ?? 54332);
const LOG = process.env.ECHO_LOG ?? './echo.log';
let last = null;

http
  .createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'GET' && req.url.split('?')[0] === '/last') {
        res.writeHead(last ? 200 : 404, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(last ?? {}));
      }
      last = { ts: Date.now(), method: req.method, path: req.url, body: Buffer.concat(chunks).toString('utf8') };
      console.log(`${last.method} ${last.path} ${last.body}`);
      appendFileSync(LOG, JSON.stringify(last) + '\n');
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ job: { id: 'demo-job', state: 'PENDING', createdAt: Date.now() } }));
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`echo http://127.0.0.1:${PORT}/ (log: ${LOG})`));
