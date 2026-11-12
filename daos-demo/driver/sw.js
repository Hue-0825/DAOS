const CACHE = 'daos-dispatch-driver-v11';
const ASSETS = ['index.html', 'style.css', 'app.mjs', 'campus.svg', 'jangyu.svg', 'yangsan.svg', 'sangnam.svg', 'yulha.svg', 'buwon.svg', 'icon.svg', 'app.webmanifest', 'region-seoul.svg', 'region-busan.svg', 'region-daegu.svg', 'region-incheon.svg', 'region-gwangju.svg', 'region-daejeon.svg', 'region-ulsan.svg', 'region-sejong.svg', 'region-gyeonggi.svg', 'region-gangwon.svg', 'region-chungbuk.svg', 'region-chungnam.svg', 'region-jeonbuk.svg', 'region-jeonnam.svg', 'region-gyeongbuk.svg', 'region-jeju.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload',redirect:'error'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('daos-dispatch-driver-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

const staticPaths=new Set(ASSETS.map(asset=>new URL(asset,self.registration.scope).pathname));

self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'&&[new URL('./',self.registration.scope).pathname,new URL('index.html',self.registration.scope).pathname].includes(url.pathname)){
    event.respondWith(fetch(event.request).catch(async()=> (await caches.open(CACHE)).match('index.html')));
    return;
  }
  if(!staticPaths.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const exact=await cache.match(event.request);
    if(exact)return exact;
    try{
      const response=await fetch(event.request);
      if(response.ok&&!response.redirected)await cache.put(event.request,response.clone());
      if(response.ok&&!response.redirected)return response;
      return await cache.match(event.request,{ignoreSearch:true})??response;
    }catch(error){
      const fallback=await cache.match(event.request,{ignoreSearch:true});
      if(fallback)return fallback;
      throw error;
    }
  })());
});
