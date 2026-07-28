import { spawn } from 'node:child_process';

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code && !process.exitCode) process.exitCode = code;
  });
}

const vitePort = process.env.VITE_DEV_PORT || '5176';

run('stream', 'node', ['scripts/stream-server.js']);
run('vite', 'vite', ['--host', '127.0.0.1', '--port', vitePort]);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
