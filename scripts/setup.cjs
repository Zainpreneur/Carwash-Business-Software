const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const run = (cmd, args, cwd) => {
  console.log(`\n> ${cmd} ${args.join(' ')}  (in ${path.relative(root, cwd) || '.'})`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
  if (r.error || r.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
};

// 1. Dependencies (only install what's missing)
if (!fs.existsSync(path.join(serverDir, 'node_modules'))) run(npm, ['install'], serverDir);
if (!fs.existsSync(path.join(clientDir, 'node_modules'))) run(npm, ['install'], clientDir);

// 2. Local env file (JWT secret, ports, client URL)
const envPath = path.join(serverDir, '.env');
if (!fs.existsSync(envPath)) {
  const example = path.join(serverDir, '.env.example');
  if (fs.existsSync(example)) {
    fs.copyFileSync(example, envPath);
    console.log('\n> Created server/.env from server/.env.example');
  }
}

// 3. Local database: create + push schema + seed only when the DB file is missing.
//    Existing data is left untouched (reset anytime with FORCE_SEED=1 or deleting the file).
const dbUrl = (process.env.LIBSQL_URL || 'file:local.db').replace(/^file:/, '');
const dbIsRemote = /^(sqlite:https?)/.test(dbUrl) || /^https?:/.test(dbUrl);
const dbPath = dbIsRemote ? null : path.resolve(serverDir, dbUrl);

if (process.env.FORCE_SEED === '1' || (dbPath && !fs.existsSync(dbPath))) {
  run(npm, ['run', 'db:push'], serverDir);
  run(npm, ['run', 'seed'], serverDir);
} else {
  console.log('\n> local.db already exists - skipping schema push + seed.');
  console.log('  (delete server/local.db or set FORCE_SEED=1 to start fresh)');
}

console.log('\nSetup complete! Launch with:');
console.log('  npm.cmd run start   - one process, production build (use daily)');
console.log('  npm.cmd run dev     - Vite + API with hot reload (for development)');