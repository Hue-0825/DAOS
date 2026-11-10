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
const destinations=new Map([
  ['central',central],
  ['shop','https://daos-shop-demo.ryker6365.chatgpt.site'],
  ['hub','https://daos-hub-demo.ryker6365.chatgpt.site'],
  ['driver','https://daos-phone-driver.ryker6365.chatgpt.site'],
]);
const portalCookie='__Host-daos-portal';
const portalLifetime=7*24*60*60;
const redirect=(path,headers={})=>new Response(null,{status:303,headers:{...privateHeaders,Location:path,...headers}});
const sessionToken=(request,name)=>request.headers.get('Cookie')?.split(';').map(value=>value.trim())
  .find(value=>value.startsWith(name+'='))?.slice(name.length+1);
function accessPage(message,actions) {
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>DAOS 통합 시연 로그인</title>
    <link rel="stylesheet" href="/style.css"><main class="shell section"><p class="eyebrow">DAOS / 통합 로그인</p>
    <h1>운영 웹 접속</h1><p>${message}</p><div class="actions">${actions}</div><p class="access"><a href="/">통합 사이트로 돌아가기</a></p></main></html>`,
    {headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function operatorAllowed(email,token,env) {
  const headers={'Content-Type':'application/json','X-DAOS-Robot-Key':env.DAOS_ROBOT_KEY};
  if(env.DAOS_CENTRAL_ACCESS)headers['OAI-Sites-Authorization']=`Bearer ${env.DAOS_CENTRAL_ACCESS}`;
  try{
    const response=await fetch(central+'/api/central/portal-auth',{
      method:'POST',headers,body:JSON.stringify({email,token}),redirect:'manual',signal:AbortSignal.timeout(4500),
    });
    if(!response.ok)return null;
    return (await response.json()).authorized===true;
  }catch{return null;}
}
function shareCode(value) {
  if(/^[a-f0-9]{64}$/.test(value))return value;
  try{
    const url=new URL(value);
    if(url.origin===central&&url.pathname==='/share'&&/^#[a-f0-9]{64}$/.test(url.hash))return url.hash.slice(1);
  }catch{}
  return null;
}
async function portalAccess(request,url,env,user,email,key) {
  const next=url.searchParams.get('next');
  const dest=destinations.has(next)||next==='robot'?'/open/'+next:'/';
  const returnPath=dest==='/'?'/access':'/access?next='+next;
  if(!user||!key){
    return accessPage('ChatGPT로 한 번 로그인한 뒤 통합 사이트 메뉴에서 모든 운영 화면을 열 수 있습니다.',
      `<a class="primary" href="/signin-with-chatgpt?return_to=${encodeURIComponent(returnPath)}" target="_top">ChatGPT로 로그인</a>`);
  }
  if(await verify(key,'portal',user,sessionToken(request,portalCookie)))return redirect(dest);
  let token=null;
  if(request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin)return json({error:'잘못된 요청입니다.'},403);
    const fields=new URLSearchParams(await request.text());
    token=shareCode(fields.get('share')?.trim()??'');
  }
  const allowed=await operatorAllowed(email,token,env);
  if(allowed){
    const session=await signed(key,'portal',user,String(Math.floor(Date.now()/1000)+portalLifetime));
    return redirect(dest,{'Set-Cookie':`${portalCookie}=${session}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${portalLifetime}`});
  }
  const prompt=allowed===null?'지금은 메인 서버에서 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.':
    request.method==='POST'?'메인 관제센터 공유 링크를 확인해 주세요.':'처음 한 번만 받은 메인 관제센터 공유 링크를 입력해 운영 권한을 확인합니다.';
  return accessPage(prompt,`<form class="access-form" method="post" action="${returnPath}">
    <label for="share">메인 관제센터 공유 링크</label><input id="share" name="share" type="password" autocomplete="off" maxlength="300" required>
    <button class="primary" type="submit">시연 권한 확인</button></form>`);
}
async function roleGrant(secret,role) {
  const expires=String(Math.floor(Date.now()/1000)+90),nonce=crypto.randomUUID();
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(secret),
    encoder.encode(JSON.stringify([role,'launch',expires,nonce]))));
  return [expires,nonce,Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')].join('.');
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname;
    const user=request.headers.get('oai-authenticated-user-id');
    const email=user&&request.headers.get('oai-authenticated-user-email')?.toLowerCase();
    const key=env.DAOS_ROBOT_KEY&&user?await signingKey(env.DAOS_ROBOT_KEY):null;
    const portalSession=key&&await verify(key,'portal',user,sessionToken(request,portalCookie));
    if(path==='/access'&&['GET','POST'].includes(request.method))return portalAccess(request,url,env,user,email,key);
    if(path==='/'||path==='/index.html'){
      const label=portalSession?'통합 로그인 완료':user?'시연 권한 확인':'통합 로그인';
      const nav=portalSession?`<span class="access-badge">${label}</span>`:`<a class="access-badge" href="/access">${label}</a>`;
      return new Response(request.method==='HEAD'?null:ASSETS['/index.html'].replace('<!-- DAOS_ACCESS -->',nav),
        {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    if(path.startsWith('/open/')&&request.method==='GET'){
      const role=path.slice('/open/'.length);
      if(!destinations.has(role)&&role!=='robot')return new Response('Not found',{status:404});
      if(!portalSession)return redirect('/access?next='+role);
      if(role==='robot')return redirect('/robot/');
      const secret=env['DAOS_SSO_'+role.toUpperCase()];
      if(!secret)return json({error:'운영 화면의 통합 로그인을 준비 중입니다.'},503);
      return redirect(destinations.get(role)+'/daos-session#'+await roleGrant(secret,role));
    }
    if (path==='/robot'||path==='/robot.html') return Response.redirect(new URL('/robot/',url),302);
    if (path==='/robot/activate') return page('메인 관제센터의 접근 권한을 확인하고 있습니다.',
      '<a href="/robot/">관제실로 돌아가기</a>','<script type="module" src="/robot/activate.mjs"></script>');
    if (path.startsWith('/robot/') && !['/robot/','/robot/index.html','/robot/session'].includes(path)) return asset(path,request);
    if (!path.startsWith('/robot/')) return asset(path==='/'?'/index.html':path,request);

    if (path==='/robot/session') {
      if (!key || !email || request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
          !await verify(key,'launch',email,await request.text())) return json({error:'권한을 확인하지 못했습니다.'},403);
      const session=await signed(key,'session',email,String(Math.floor(Date.now()/1000)+sessionSeconds));
      return new Response(null,{status:204,headers:{...privateHeaders,
        'Set-Cookie':`${cookieName}=${session}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}`,
      }});
    }
    if (portalSession || (key && email && await verify(key,'session',email,readCookie(request)))) {
      return asset('/robot/index.html',request,privateHeaders);
    }
    return email?
      page('메인 관제센터에 로그인한 계정의 접근 권한을 확인합니다.',`<a href="${central}/central/robot-access">메인 관제센터 권한 확인 →</a>`):
      page('메인 관제센터에 사용하는 ChatGPT 계정으로 로그인해 주세요.',
        '<a href="/signin-with-chatgpt?return_to=%2Frobot%2F" target="_top">ChatGPT로 로그인 →</a>');
  },
};
