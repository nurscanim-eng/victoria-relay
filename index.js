const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Victoria Relay Server — operational.\n');
});

const wss = new WebSocket.Server({ noServer: true });

const clients = new Set();

server.on('upgrade', (request, socket, head) => {
  const query = url.parse(request.url, true).query;

  if (AUTH_TOKEN && query.token !== AUTH_TOKEN) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    console.log('[AUTH] Rejected connection: invalid or missing token');
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[+] Client connected: ${ip} | Total: ${clients.size}`);

  ws.send(JSON.stringify({ type: 'system', message: 'Victoria Relay connected. Awaiting commands.' }));

  ws.on('message', (data) => {
    let parsed;
    try { parsed = JSON.parse(data); } catch(e) { parsed = { type: 'raw', message: data.toString() }; }
    console.log(`[MSG] ${JSON.stringify(parsed)}`);

    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(parsed));
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[-] Client disconnected | Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[ERR] ${err.message}`);
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Victoria Relay Server listening on port ${PORT}`);
});
