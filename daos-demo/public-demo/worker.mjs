const central = 'https://daos-dispatch-demo.ryker6365.chatgpt.site';
const cookieName = '__Host-daos-robot';
const sessionSeconds = 3600;
const encoder = new TextEncoder();
const privateHeaders = {
  'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',
};
const media={html:'text/html',css:'text/css',mjs:'text/javascript',txt:'text/plain',xml:'application/xml'};
const json=(data,status)=>Response.json(data,{status,headers:privateHeaders});

function page(message,links,script='') {
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>DAOS 로봇 관제실</title><link rel="stylesheet" href="/robot/warehouse.css">${script}
    <header class="topbar"><a class="wordmark" href="/">DAOS / 통합 사이트</a></header><main class="frame"><section class="panel operation">
    <div><h1>물류센터 로봇 관제실</h1><p id="result" role="status">${message}</p></div><div class="operation-actions">${links}</div>
    </section></main></html>`,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}

function asset(path,request,extra={}) {
  const body=ASSETS[path];
  if (typeof body !== 'string') return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:body,{headers:{
    'Content-Type':`${media[path.split('.').at(-1)]}; charset=utf-8`,'Cache-Control':'no-cache',...extra,
  }});
}

const payload=(purpose,email,expires)=>encoder.encode(JSON.stringify([`robot-${purpose}:${email}`,expires]));
const signingKey=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
async function signed(key,purpose,email,expires) {
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,payload(purpose,email,expires)));
  return expires+'.'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function verify(key,purpose,email,token) {
  const match=/^(\d{10})\.([a-f0-9]{64})$/.exec(token??'');
  if (!match || Number(match[1])<=Math.floor(Date.now()/1000)) return false;
  return crypto.subtle.verify('HMAC',key,Uint8Array.from(match[2].match(/../g),hex=>parseInt(hex,16)),payload(purpose,email,match[1]));
}
const readCookie=request=>request.headers.get('Cookie')?.split(';').map(item=>item.trim())
  .find(item=>item.startsWith(cookieName+'='))?.slice(cookieName.length+1);
const robotApi=new Map([['/api/central/warehouse','GET'],['/api/central/connection','POST']]);

async function proxy(request,url,env) {
  const method=robotApi.get(url.pathname);
  if (request.method!==method) return json({error:'지원하지 않는 요청입니다.'},405);
  let body;
  if (method==='POST') {
    if (request.headers.get('Origin')!==url.origin) return json({error:'이 화면에서만 연결을 변경할 수 있습니다.'},403);
    try {
      const item=await request.json();
      if (typeof item?.online!=='boolean') throw Error('Invalid connection state');
      body=JSON.stringify({online:item.online});
    } catch {return json({error:'연결 상태를 확인해 주세요.'},400);}
  }
  const headers={'Content-Type':'application/json','X-DAOS-Robot-Key':env.DAOS_ROBOT_KEY};
  if (env.DAOS_CENTRAL_ACCESS) headers['OAI-Sites-Authorization']=`Bearer ${env.DAOS_CENTRAL_ACCESS}`;
  try {
    const upstream=await fetch(new URL(url.pathname+url.search,central),
      {method,body,headers,redirect:'manual',signal:AbortSignal.timeout(4500)});
    if (!upstream.headers.get('Content-Type')?.includes('application/json')) throw Error('Invalid response');
    return new Response(upstream.body,{status:upstream.status,headers:{...privateHeaders,'Content-Type':'application/json'}});
  } catch {return json({error:'메인 서버에 연결할 수 없습니다.'},503);}
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname;
    if (path==='/robot'||path==='/robot.html') return Response.redirect(new URL('/robot/',url),302);
    if (path==='/robot/activate') return page('메인 관제센터의 접근 권한을 확인하고 있습니다.',
      '<a href="/robot/">관제실로 돌아가기</a>','<script type="module" src="/robot/activate.mjs"></script>');
    if (path.startsWith('/robot/') && !['/robot/','/robot/index.html','/robot/session'].includes(path)) return asset(path,request);
    if (!path.startsWith('/robot/') && !robotApi.has(path)) return asset(path==='/'?'/index.html':path,request);
    const email=request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase();
    const key=env.DAOS_ROBOT_KEY&&email?await signingKey(env.DAOS_ROBOT_KEY):null;
    if (path==='/robot/session') {
      if (!key || request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
          !await verify(key,'launch',email,await request.text())) return json({error:'권한을 확인하지 못했습니다.'},403);
      const session=await signed(key,'session',email,String(Math.floor(Date.now()/1000)+sessionSeconds));
      return new Response(null,{status:204,headers:{...privateHeaders,
        'Set-Cookie':`${cookieName}=${session}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}`,
      }});
    }
    if (key && await verify(key,'session',email,readCookie(request))) {
      if (robotApi.has(path)) return proxy(request,url,env);
      return asset('/robot/index.html',request,privateHeaders);
    }
    if (robotApi.has(path)) return json({error:'로봇 관제실 접근 권한이 필요합니다.'},401);
    return email?
      page('메인 관제센터에 로그인한 계정의 접근 권한을 확인합니다.',`<a href="${central}/central/robot-access">메인 관제센터 권한 확인 →</a>`):
      page('메인 관제센터에 사용하는 ChatGPT 계정으로 로그인해 주세요.',
        '<a href="/signin-with-chatgpt?return_to=%2Frobot%2F" target="_top">ChatGPT로 로그인 →</a>');
  },
};
