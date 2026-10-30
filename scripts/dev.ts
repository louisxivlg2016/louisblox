import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const frontend = Bun.spawn(['bun', 'scripts/frontend.ts'], {
  cwd,
  env: { ...process.env, HOST: '0.0.0.0', PORT: '5173' },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});
const worker = Bun.spawn(['bunx', 'wrangler', 'dev', '--ip', '0.0.0.0', '--port', '8787'], {
  cwd,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});
const children = [frontend, worker];
let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const exitCode = await Promise.race(children.map((child) => child.exited));
stop();
await Promise.all(children.map((child) => child.exited));
process.exitCode = exitCode;
