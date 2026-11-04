const V="vcaj-v2",CORE=["./","index.html","style.css","vcaj-theme.css","vcaj-enhance.js","manifest.webmanifest","offline.html","stats.html","stats.js","vcaj-extra.css"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==location.origin)return; // Firebase/live data always goes to network
 e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==="navigate"?caches.match("offline.html"):undefined))));
});
