import { watch } from 'node:fs';
import { build } from './build';

await build();

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: Number(process.env.PORT ?? 5173),
  development: false,
  async fetch(request) {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Invalid path', { status: 400 });
    }
    if (pathname.split('/').includes('..') || pathname.includes('\0')) return new Response('Invalid path', { status: 400 });
    const file = Bun.file(`dist${pathname === '/' ? '/index.html' : pathname}`);
    if (await file.exists()) return new Response(file, { headers: pathname === '/' || pathname === '/index.html' ? { 'Cache-Control': 'no-store' } : undefined });
    return new Response('Not found', { status: 404 });
  },
});

let timer: ReturnType<typeof setTimeout> | undefined;
let building = false;
let pending = false;
async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  pending = false;
  try {
    await build();
  } catch (error) {
    console.error(error);
  } finally {
    building = false;
    if (pending) await rebuild();
  }
}
for (const source of ['index.html', 'src', 'assets', 'son', 'worker']) {
  watch(source, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(rebuild, 250);
  });
}

console.log(`LouisBlox frontend: http://0.0.0.0:${server.port}`);

export {};
