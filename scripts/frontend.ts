await import('./build');

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
    if (await file.exists()) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`LouisBlox frontend: http://0.0.0.0:${server.port}`);

export {};
