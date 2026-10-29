// кэш оболочки приложения, данные всегда с сети
const C = 'reefgo-v27';
const SHELL = ['./', './index.html', './app.js?v=27', './i18n.js?v=27', './reefs.json', './tides.json', './data/fish.json', './manifest.webmanifest', './icon.svg', './img/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { caches.open(C).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
});
