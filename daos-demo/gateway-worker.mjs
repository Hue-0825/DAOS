const root = ROLE === 'driver' ? '/driver/' : '/';
const media = {html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',svg:'image/svg+xml',jpg:'image/jpeg',webmanifest:'application/manifest+json'};
const json=(value,status)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function allowed(path) {
  if(ROLE==='driver')return path==='/api/driver'||path.startsWith('/api/driver/');
  return path.startsWith(`/api/${ROLE}/`);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(env.DAOS_SHARE_KEY_HASH){
      const shared=await shareRoute(request,env,root);
      if(shared)return shared;
      if(!await shareAuthorized(request,env))return url.pathname.startsWith('/api/')
        ? shareJson({error:'DAOS 공유 링크로 로그인하세요.'},401) : shareResponse(null,303,{Location:'/share'});
    }
    if(url.pathname.startsWith('/api/')){
      if(!allowed(url.pathname))return json({error:'요청을 찾을 수 없습니다.'},404);
      const origin=request.headers.get('Origin');
      if(request.method==='POST' && origin && origin!==url.origin)return json({error:'다른 사이트에서 변경할 수 없습니다.'},403);
      try{
        const body=request.method==='POST'?await request.text():undefined;
        if(body?.length>100000)return json({error:'요청 크기가 너무 큽니다.'},413);
        const response=await fetch(new URL(url.pathname+url.search,env.DAOS_CENTRAL_URL),{
          method:request.method,body,redirect:'manual',headers:{
            'Content-Type':'application/json',
            'OAI-Sites-Authorization':`Bearer ${env.DAOS_CENTRAL_ACCESS}`,
            'X-DAOS-Service-Key':env.DAOS_SERVICE_KEY,
          },
          signal:AbortSignal.timeout(5000),
        });
        if(!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Unexpected response');
        return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      }catch{return json({error:'메인 서버에 연결할 수 없습니다.'},503)}
    }
    if(ROLE==='driver'&&url.pathname==='/')return Response.redirect(new URL(root,url),302);
    if(!url.pathname.startsWith(root))return new Response('Not found',{status:404});
    const file=url.pathname.slice(root.length)||'index.html';
    if(!Object.hasOwn(ASSETS,file))return new Response('Not found',{status:404});
    const asset=ASSETS[file];
    const body=typeof asset==='string'?asset:Uint8Array.from(atob(asset.base64),char=>char.charCodeAt(0));
    return new Response(request.method==='HEAD'?null:body,{headers:{
      'Content-Type':media[file.split('.').at(-1)],'Cache-Control':'no-cache',
    }});
  },
};
