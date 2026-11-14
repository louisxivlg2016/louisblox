export function watchBuildVersion() {
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const current = document.querySelector('meta[name="louisblox-build"]')?.getAttribute('content');
      if (!current || current.startsWith('%')) return;
      const response = await fetch(`/?version-check=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const html = await response.text();
      const latest = new DOMParser().parseFromString(html, 'text/html').querySelector('meta[name="louisblox-build"]')?.getAttribute('content');
      if (latest && latest !== current) window.location.reload();
    } catch {
    } finally {
      checking = false;
    }
  };
  window.setInterval(check, 15000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  void check();
}
