const CACHE='zuhause-v58';
const WORKSPACE_ASSETS=['./workspaces.css?v=58','./workspaces.js?v=58','./lou.js?v=58','./charleen.js?v=58','./noah-jobs.js?v=58','./scan-analyse.js?v=58','./scanner.js?v=58','./documents-view.js?v=58','./recipes.js?v=58'];
const ASSETS=['./','./index.html','./styles.css?v=58','./features.css?v=58','./calendar.js?v=58','./app.js?v=58','./features.js?v=58','./vendor/supabase.min.js?v=2.118.0','./manifest.webmanifest?v=58','./icon.svg?v=58','./apple-touch-icon.png?v=58','./icon-192.png?v=58','./icon-512.png?v=58','./icon-maskable-512.png?v=58'];
// Werkzeuge für Scanner (PDF, Texterkennung) liegen in einem eigenen Zwischenspeicher, der bei App-Updates erhalten bleibt –
// so klappt Scannen ohne Internet auch direkt nach einem Update. Beim Austausch einer Datei unter vendor/ VENDOR_CACHE hochzählen.
const VENDOR_CACHE='zuhause-vendor-2';
const VENDOR_ASSETS=['./vendor/jspdf.umd.min.js','./vendor/tesseract/tesseract.min.js','./vendor/tesseract/worker.min.js'];
// Texterkennung (Rechenkern ~3,8 MB + deutsche Sprachdaten ~1,3 MB): nach der Installation im Hintergrund holen, damit der
// allererste Scan auch ohne Internet Text erkennt. Einmalig – der Zwischenspeicher bleibt über App-Updates erhalten.
const VENDOR_LATER=['./vendor/tesseract/tesseract-core-simd-lstm.wasm.js','./vendor/tesseract/lang/deu.traineddata.gz'];
const VENDOR_LATER_OLD=['./vendor/tesseract/tesseract-core-lstm.wasm.js','./vendor/tesseract/lang/deu.traineddata.gz']; // Geräte ohne SIMD (ältere iPhones)
const isVendor=url=>/\/vendor\/(jspdf|tesseract)/.test(url.pathname);
self.addEventListener('install',event=>event.waitUntil(Promise.all([
  caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...WORKSPACE_ASSETS])),
  caches.open(VENDOR_CACHE).then(cache=>Promise.allSettled(VENDOR_ASSETS.map(async asset=>{if(!await cache.match(asset))await cache.add(asset)})))
]).then(()=>self.skipWaiting())));
// Die App bittet ein paar Sekunden nach dem Start darum (blockiert so weder Installation noch Aktivierung).
self.addEventListener('message',event=>{if(event.data?.type==='precache-ocr')event.waitUntil(caches.open(VENDOR_CACHE).then(cache=>Promise.allSettled((event.data.simd===false?VENDOR_LATER_OLD:VENDOR_LATER).map(async asset=>{if(!await cache.match(asset))await cache.add(asset)}))))});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('zuhause-')&&key!==CACHE&&key!==VENDOR_CACHE)/* nur eigene Speicher löschen – Origin CAD liegt unter derselben Adresse */.map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
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
  event.waitUntil(self.registration.showNotification(title,{body:data.body||'Es gibt eine neue Erinnerung.',icon:'./icon-192.png?v=58',badge:'./icon-192.png?v=58',tag:data.tag||'zuhause-erinnerung',data:{url:data.url||'./?page=calendar'},renotify:false}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(String(event.notification.data?.url||'./?page=calendar').replace(/^\//,'./'),self.registration.scope).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}return clients.openWindow(target)}));
});
