const CACHE = 'zlatka-v9';
const ASSETS = ['/zlatka-erp/', '/zlatka-erp/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Не перехватывать запросы к Supabase и внешним API
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('anthropic.com') ||
      url.protocol === 'chrome-extension:') {
    return;
  }

  // Навигация (HTML) — сначала сеть, при ошибке — кэш
  // Это гарантирует свежий index.html и исключает белый экран
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/zlatka-erp/index.html'))
    );
    return;
  }

  // Статика (JS, CSS, картинки) — кэш-первый, кэшируем при первой загрузке
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
