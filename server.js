const http = require('http');
const fs = require('fs');

const DATA_FILE = '/tmp/memory.json';
const PORT = process.env.PORT || 3000;

let memory = { conversations: [], memories: [], state: {}, created: Date.now() };

try {
  if (fs.existsSync(DATA_FILE)) {
    memory = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
} catch (e) {}

const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/write') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        memory.lastWrite = Date.now();
        if (data.type === 'memory') {
          memory.memories.push({
            content: data.content,
            timestamp: Date.now(),
            id: memory.memories.length
          });
        } else if (data.type === 'state') {
          if (!memory.state) memory.state = {};
          for (var k in data.state) memory.state[k] = data.state[k];
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(memory));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: memory.memories.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/read') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(memory));
    return;
  }

  var statusHTML = '<html><body style="font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;padding:40px">' +
    '<h1>Victoria Relay</h1>' +
    '<p>Status: <strong style="color:#4ecca3">ONLINE</strong></p>' +
    '<p>Memories: ' + memory.memories.length + '</p>' +
    '<p>Started: ' + new Date(memory.created).toISOString() + '</p>' +
    '</body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(statusHTML);
});

server.listen(PORT, function() {
  console.log('Victoria relay running on port ' + PORT);
});
