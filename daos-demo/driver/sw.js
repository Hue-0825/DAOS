const CACHE = 'daos-dispatch-driver-v4';
const ASSETS = ['./', 'index.html', 'style.css?v=17', 'app.mjs?v=17', 'campus.svg?v=5', 'jangyu.svg', 'yangsan.svg', 'sangnam.svg', 'yulha.svg', 'buwon.svg', 'icon.svg', 'app.webmanifest', 'region-seoul.svg', 'region-busan.svg', 'region-daegu.svg', 'region-incheon.svg', 'region-gwangju.svg', 'region-daejeon.svg', 'region-ulsan.svg', 'region-sejong.svg', 'region-gyeonggi.svg', 'region-gangwon.svg', 'region-chungbuk.svg', 'region-chungnam.svg', 'region-jeonbuk.svg', 'region-jeonnam.svg', 'region-gyeongbuk.svg', 'region-jeju.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('daos-dispatch-driver-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/driver/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached ?? fetch(event.request)));
});
