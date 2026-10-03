// Retirement worker served at the former /sw.js URL during site migration.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('snipers-offline-'))await caches.delete(name);
  await self.clients.claim();await self.registration.unregister();
})()));
self.addEventListener('fetch',event=>event.respondWith(fetch(event.request,{cache:'no-store'})));
