// LOCAL DEV ONLY. Emulates Supabase's gateway: /rest/v1/<x>  ->  PostgREST /<x>.
// No dependencies. Bodies are streamed both ways; status, headers (incl. Content-Range, Content-Profile) pass through.
import http from 'node:http';

const PORT = Number(process.env.PROXY_PORT ?? 54331);
const UP_HOST = process.env.UPSTREAM_HOST ?? '127.0.0.1';
const UP_PORT = Number(process.env.UPSTREAM_PORT ?? 54330);
const PREFIX = '/rest/v1/';
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade']);

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    if (!req.url.startsWith(PREFIX)) return json(res, 404, { message: 'not found' });

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (k !== 'host' && k !== 'expect' && !HOP.has(k)) headers[k] = v;

    const up = http.request({ host: UP_HOST, port: UP_PORT, method: req.method, path: '/' + req.url.slice(PREFIX.length), headers }, (ur) => {
      // rawHeaders keeps header order, casing and duplicates; drop hop-by-hop + transfer-encoding (node re-frames the body itself).
      const out = [];
      for (let i = 0; i < ur.rawHeaders.length; i += 2) {
        const k = ur.rawHeaders[i].toLowerCase();
        if (!HOP.has(k) && k !== 'transfer-encoding') out.push(ur.rawHeaders[i], ur.rawHeaders[i + 1]);
      }
      res.writeHead(ur.statusCode, ur.statusMessage, out);
      ur.pipe(res);
    });
    up.on('error', (e) => {
      if (res.headersSent) return res.destroy();
      json(res, 502, { message: `upstream error: ${e.message}` });
    });
    res.on('close', () => { if (!res.writableEnded) up.destroy(); });
    req.pipe(up);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`proxy http://127.0.0.1:${PORT}/rest/v1/ -> http://${UP_HOST}:${UP_PORT}/`));
