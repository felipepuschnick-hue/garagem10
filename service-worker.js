// ══════════════════════════════════════════
//  GARAGEM 10 — SERVICE WORKER
// ══════════════════════════════════════════

const CACHE = 'garagem10-v3';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/ui-helpers.js',
  './js/db.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/capas/capa-sedan.webp',
  './images/capas/capa-suv.webp',
  './images/capas/capa-pickup.webp',
  './images/capas/capa-moto.webp',
  './images/estados/empty-state.webp',
  './images/categorias/icon-motor.webp',
  './images/categorias/icon-freio.webp',
  './images/categorias/icon-pneu.webp',
  './images/categorias/icon-suspensao.webp',
  './images/categorias/icon-eletrico.webp'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Nunca cacheia chamadas à API do Supabase — sempre busca dados frescos
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // cacheia novos assets estáticos do mesmo domínio
        if (resp.ok && e.request.method === 'GET' && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
