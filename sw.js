/* Lets the app open with no internet once it has been visited. Network first, so people always get the
   newest version when online; the saved copy is used only when the network is unavailable.
   Accounts (Supabase) and AI calls are never cached. */
const CACHE = 'mtw-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'config.js', 'engine.js', 'app.js', 'account.js', 'tabhelp.js', 'budget.js', 'impact.js',
  'glossary.js', 'sliders.js', 'ai.js', 'plan.js', 'marginal.js', 'suggest.js', 'home.js', 'guide.js', 'pwa.js',
  'vendor/chart.umd.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const LIBS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await Promise.all(LIBS.map(async u => { try { await c.put(u, await fetch(u, { mode: 'no-cors' })); } catch {} }));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !(u.origin === location.origin || LIBS.includes(r.url))) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(r);
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    } catch {
      return (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('index.html') : Response.error());
    }
  })());
});
