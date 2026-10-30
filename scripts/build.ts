const result = await Bun.build({
  entrypoints: ['./index.html'],
  outdir: process.argv[2] ?? './dist',
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
}

export {};
