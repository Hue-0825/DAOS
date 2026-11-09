import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const role = process.argv[2];
const ports = { shop:8780, hub:8782, driver:8783 };
const prefixes = { shop:'/api/shop/', hub:'/api/hub/', driver:'/api/driver' };
if (!Object.hasOwn(ports,role) || !process.env.DAOS_SERVICE_TOKEN) throw Error('DAOS split.mjs로 시작하세요.');
const backend = process.env.DAOS_CENTRAL_URL;
const host = process.env.DAOS_DEVICE_HOST ?? '127.0.0.1';
const media = {html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',svg:'image/svg+xml',jpg:'image/jpeg',webmanifest:'application/manifest+json'};
const root = role === 'driver' ? '/driver/' : '/';
function allowed(path) {
  return role === 'driver' ? path === '/api/driver' || path.startsWith('/api/driver/')
    : path.startsWith(prefixes[role]);
}
createServer(async (request,response) => {
  try {
    const url = new URL(request.url,`http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      if (!allowed(url.pathname)) return response.writeHead(404).end();
      const origin = request.headers.origin;
      if (request.method==='POST' && origin && origin!==url.origin) return response.writeHead(403).end();
      const chunks=[];
      let size=0;
      for await(const chunk of request){
        size+=chunk.length;
        if(size>100000)return response.writeHead(413).end();
        chunks.push(chunk);
      }
      const upstream=await fetch(new URL(url.pathname+url.search,backend),{
        method:request.method,headers:{'Authorization':`Bearer ${process.env.DAOS_SERVICE_TOKEN}`,
          'Content-Type':request.headers['content-type']??'application/json'},
        body:chunks.length?Buffer.concat(chunks):undefined,
        signal:AbortSignal.timeout(5000),
      });
      response.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});
      return response.end(Buffer.from(await upstream.arrayBuffer()));
    }
    if (role==='driver' && url.pathname==='/') return response.writeHead(302,{Location:root}).end();
    if (!url.pathname.startsWith(root)) return response.writeHead(404).end();
    const file=url.pathname.slice(root.length)||'index.html';
    const extension=file.split('.').at(-1);
    if (!/^[a-z0-9.-]+$/i.test(file) || !Object.hasOwn(media,extension)) return response.writeHead(404).end();
    const folder=role==='hub'&&extension==='svg'?'driver':role;
    const body=await readFile(join(folder,file));
    response.writeHead(200,{'Content-Type':`${media[extension]}; charset=utf-8`,'Cache-Control':'no-cache'});
    response.end(request.method==='HEAD'?null:body);
  } catch(error) {
    if(error.code==='ENOENT')return response.writeHead(404).end();
    response.writeHead(503,{'Content-Type':'application/json'});
    response.end(JSON.stringify({error:'메인 서버에 연결할 수 없습니다.'}));
  }
}).listen(ports[role],host,()=>console.log(`${role} · http://${host}:${ports[role]}${root}`));
