const CACHE='zuhause-v16';
const WORKSPACE_ASSETS=['./workspaces.css?v=16','./workspaces.js?v=16'];
const ASSETS=['./','./index.html','./styles.css?v=16','./features.css?v=16','./calendar.js?v=16','./app.js?v=16','./features.js?v=16','./vendor/supabase.min.js?v=2.49.4','./manifest.webmanifest?v=16','./icon.svg?v=16','./apple-touch-icon.png?v=16','./icon-192.png?v=16','./icon-512.png?v=16','./icon-maskable-512.png?v=16'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...WORKSPACE_ASSETS])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return}
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(async()=>await caches.match(event.request)||new Response('Offline',{status:503,statusText:'Offline'})));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()}}
  const title=data.title||'Zuhause';
  event.waitUntil(self.registration.showNotification(title,{body:data.body||'Es gibt eine neue Erinnerung.',icon:'./icon-192.png?v=16',badge:'./icon-192.png?v=16',tag:data.tag||'zuhause-erinnerung',data:{url:data.url||'./?page=calendar'},renotify:false}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'./?page=calendar',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}return clients.openWindow(target)}));
});
