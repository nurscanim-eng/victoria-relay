const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Simple in-memory relay with optional token authentication
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Health check endpoint — used by keep-alive pings and UptimeRobot
  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'operational',
      name: 'Victoria Relay Server',
      clients: clients.size,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found\n');
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

  // Per-connection heartbeat to detect stale connections
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let parsed;
    try { parsed = JSON.parse(data); } catch(e) { parsed = { type: 'raw', message: data.toString() }; }
    console.log(`[MSG] ${JSON.stringify(parsed)}`);

    // Broadcast to all other clients
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

// WebSocket heartbeat — ping all clients every 30s, terminate dead ones
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Self keep-alive: ping our own HTTP health endpoint every 10 minutes
// This prevents Render free tier from spinning down the instance
const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function selfPing() {
  const target = `http://localhost:${PORT}/health`;
  http.get(target, (res) => {
    console.log(`[KEEPALIVE] Self-ping OK — status ${res.statusCode}`);
  }).on('error', (err) => {
    console.warn(`[KEEPALIVE] Self-ping failed: ${err.message}`);
  });
}

setInterval(selfPing, KEEPALIVE_INTERVAL_MS);
console.log(`[KEEPALIVE] Self-ping scheduled every ${KEEPALIVE_INTERVAL_MS / 60000} minutes`);

server.listen(PORT, () => {
  console.log(`Victoria Relay Server listening on port ${PORT}`);
});
