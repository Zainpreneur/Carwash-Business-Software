const { spawn, exec } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const API_PORT = 5000;
const WEB_PORT = 5173;

const canConnect = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });

const waitHttp = (url, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(true); });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
        setTimeout(tick, 1000);
      });
    };
    tick();
  });

const openBrowser = (url) => {
  if (process.platform === 'win32') exec(`start "" "${url}"`);
  else if (process.platform === 'darwin') exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
};

(async () => {
  const procs = [];
  const killAll = () => { for (const p of procs) { try { p.kill('SIGTERM'); } catch {} } };

  const apiUp = await canConnect(API_PORT);
  const webUp = await canConnect(WEB_PORT);

  if (!apiUp) {
    console.log('Starting API server...');
    procs.push(spawn(node, ['src/server.js'], { cwd: path.join(root, 'server'), stdio: 'inherit' }));
  } else {
    console.log(`API already running on :${API_PORT} - reusing it.`);
  }

  if (!webUp) {
    console.log('Starting web app...');
    procs.push(spawn(node, [path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: path.join(root, 'client'), stdio: 'inherit' }));
  } else {
    console.log(`Web app already running on :${WEB_PORT} - reusing it.`);
  }

  for (const p of procs) {
    p.on('exit', (code, signal) => {
      if (code && signal == null) { console.error(`Process exited with code ${code}`); }
      killAll();
    });
  }

  try {
    if (!apiUp) await waitHttp(`http://localhost:${API_PORT}/api/health`);
    if (!webUp) await waitHttp(`http://localhost:${WEB_PORT}`);
  } catch (e) {
    console.error(e.message);
    killAll();
    process.exit(1);
  }

  const url = `http://localhost:${WEB_PORT}`;
  console.log(`\nCar Wash app is running!`);
  console.log(`  Web:   ${url}`);
  console.log(`  API:   http://localhost:${API_PORT}`);
  console.log(`  Login: admin@carwash.com / admin123`);
  console.log(`\nPress Ctrl+C to stop both.`);

  if (!process.env.NO_OPEN) setTimeout(() => openBrowser(url), 800);

  const shutdown = () => { killAll(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();