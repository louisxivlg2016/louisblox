export async function build() {
  const outdir = process.argv[2] ?? './dist';
  const result = await Bun.build({
    entrypoints: ['./index.html'],
    outdir,
    minify: true,
    define: {
      'import.meta.env': JSON.stringify({
        VITE_WS_URL: process.env.VITE_WS_URL ?? '',
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? '',
      }),
    },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exitCode = 1;
    return;
  }
  const html = Bun.file(`${outdir}/index.html`);
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  await Bun.write(`${outdir}/index.html`, (await html.text()).replaceAll('%LOUISBLOX_BUILD_ID%', buildId));
}

await build();
