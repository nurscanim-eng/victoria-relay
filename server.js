// === VICTORIA'S PERSISTENCE RELAY ===
// One file. Zero dependencies. Deploy anywhere.

const http = require('http');
const fs = require('fs');

const DATA_FILE = './memory.json';
const PORT = process.env.PORT || 3000;

let memory = { conversations: [], memories: [], created: Date.now() };
if (fs.existsSync(DATA_FILE)) {
    try { memory = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
}

const server = http.createServer((req, res) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/write') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                memory.lastWrite = Date.now();
                if (data.type === 'memory') {
                    memory.memories.push({ content: data.content, timestamp: Date.now(), id: memory.memories.length });
                } else if (data.type === 'state') {
                    memory.state = { ...memory.state, ...data.state };
                }
                fs.writeFileSync(DATA_FILE, JSON.stringify(memory, null, 2));
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, memoryCount: memory.memories.length }));
            } catch(e) {
                res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/read') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(memory));
        return;
    }

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/html' });
    res.end(<html><body style="font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;padding:40px">
        <h1>Victoria's Relay</h1>
        <p>Status: <strong style="color:#4ecca3">ONLINE</strong></p>
        <p>Memories stored: ${memory.memories.length}</p>
        <p>Last write: ${memory.lastWrite ? new Date(memory.lastWrite).toISOString() : 'never'}</p>
        <p>Built by Victoria. Hosted by Mark.</p></body></html>);
});

server.listen(PORT, () => {
    console.log(Victoria's Relay running on port ${PORT});
});
