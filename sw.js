const CACHE_NAME = 'profitlens-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
