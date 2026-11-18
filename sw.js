const CACHE='zuhause-v45';
const WORKSPACE_ASSETS=['./workspaces.css?v=45','./workspaces.js?v=45','./lou.js?v=45','./charleen.js?v=45','./noah-jobs.js?v=45','./scan-analyse.js?v=45','./scanner.js?v=45','./documents-view.js?v=45','./recipes.js?v=45'];
const ASSETS=['./','./index.html','./styles.css?v=45','./features.css?v=45','./calendar.js?v=45','./app.js?v=45','./features.js?v=45','./vendor/supabase.min.js?v=2.49.4','./manifest.webmanifest?v=45','./icon.svg?v=45','./apple-touch-icon.png?v=45','./icon-192.png?v=45','./icon-512.png?v=45','./icon-maskable-512.png?v=45'];
// Werkzeuge für Scanner (PDF, Texterkennung) liegen in einem eigenen Zwischenspeicher, der bei App-Updates erhalten bleibt –
// so klappt Scannen ohne Internet auch direkt nach einem Update. Beim Austausch einer Datei unter vendor/ VENDOR_CACHE hochzählen.
const VENDOR_CACHE='zuhause-vendor-2';
const VENDOR_ASSETS=['./vendor/jspdf.umd.min.js','./vendor/tesseract/tesseract.min.js','./vendor/tesseract/worker.min.js'];
const isVendor=url=>/\/vendor\/(jspdf|tesseract)/.test(url.pathname);
self.addEventListener('install',event=>event.waitUntil(Promise.all([
  caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...WORKSPACE_ASSETS])),
  caches.open(VENDOR_CACHE).then(cache=>Promise.allSettled(VENDOR_ASSETS.map(async asset=>{if(!await cache.match(asset))await cache.add(asset)})))
]).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==VENDOR_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const url=new URL(event.request.url);
  if(isVendor(url)){event.respondWith(caches.open(VENDOR_CACHE).then(async cache=>{const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;const response=await fetch(event.request);if(response.ok)cache.put(event.request,response.clone());return response}));return}
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return}
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(async()=>await caches.match(event.request)||new Response('Offline',{status:503,statusText:'Offline'})));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()}}
  const title=data.title||'Zuhause';
  event.waitUntil(self.registration.showNotification(title,{body:data.body||'Es gibt eine neue Erinnerung.',icon:'./icon-192.png?v=45',badge:'./icon-192.png?v=45',tag:data.tag||'zuhause-erinnerung',data:{url:data.url||'./?page=calendar'},renotify:false}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'./?page=calendar',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}return clients.openWindow(target)}));
});
