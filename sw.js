// Companion SW v1.0.0 \u2014 network-first for index.html, same pattern as
// Heartwood's own service worker. Two jobs:
//   1) Having a real fetch handler is what makes Chrome treat this as a
//      genuinely installable app (needed for Fully Single App Kiosk to
//      see it as a real app, not just a bookmark shortcut).
//   2) If the tablet's offline at a cold start (not mid-sale, but the
//      page hasn't loaded yet at all), this serves the last-known-good
//      copy instead of a blank error page \u2014 the till can still open
//      and queue sales offline, same as the mid-session resilience
//      already built into the app itself. 💚
const CACHE_NAME = 'companion-v1';
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(APP_SHELL); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;

  // index.html: always try the network first so a fresh deploy is picked
  // up immediately, only falling back to the cached copy if genuinely offline.
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request)
        .then(function(res){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          return res;
        })
        .catch(function(){ return caches.match('/'); })
    );
    return;
  }

  // Everything else (manifest, icons): cache-first, network fallback.
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request);
    })
  );
});
