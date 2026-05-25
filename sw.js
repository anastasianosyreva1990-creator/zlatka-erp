const CACHE = 'zlatka-v4';
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
    return; // пропустить — браузер сам обработает
  }

  // Для остальных — сначала кэш, потом сеть
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
