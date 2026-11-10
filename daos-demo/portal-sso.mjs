const ssoCookieName='__Host-daos-sso';
const ssoEncoder=new TextEncoder();
const ssoHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const ssoKey=(secret,usage)=>crypto.subtle.importKey('raw',ssoEncoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,[usage]);
const ssoData=(role,purpose,expires,nonce)=>ssoEncoder.encode(JSON.stringify([role,purpose,expires,nonce]));
async function ssoMint(secret,role,purpose,lifetime) {
  const expires=String(Math.floor(Date.now()/1000)+lifetime),nonce=crypto.randomUUID();
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await ssoKey(secret,'sign'),ssoData(role,purpose,expires,nonce)));
  return [expires,nonce,Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')].join('.');
}
async function ssoVerify(secret,role,purpose,token) {
  if (!secret) return false;
  const match=/^(\d{10})\.([0-9a-f-]{36})\.([a-f0-9]{64})$/.exec(token??'');
  if (!match || Number(match[1])<=Math.floor(Date.now()/1000)) return false;
  return crypto.subtle.verify('HMAC',await ssoKey(secret,'verify'),
    Uint8Array.from(match[3].match(/../g),hex=>parseInt(hex,16)),ssoData(role,purpose,match[1],match[2]));
}
function ssoAuthorized(request,env,role) {
  const token=request.headers.get('Cookie')?.split(';').map(part=>part.trim())
    .find(part=>part.startsWith(ssoCookieName+'='))?.slice(ssoCookieName.length+1);
  return ssoVerify(env.DAOS_SSO_KEY,role,'session',token);
}
const ssoScript=`
const grant=location.hash.slice(1);
history.replaceState(null,'','/daos-session');
try{
  if(!grant)throw Error('Missing grant');
  const response=await fetch('/daos-session',{method:'POST',headers:{'Content-Type':'text/plain'},body:grant});
  if(!response.ok)throw Error('Session rejected');
  location.replace((await response.json()).next);
}catch{
  document.getElementById('message').textContent='세션을 열지 못했습니다. 통합 시연 사이트에서 이 화면을 다시 열어 주세요.';
}
`;
async function ssoRoute(request,env,role,root) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/daos-session.mjs'&&request.method==='GET')
    return new Response(ssoScript,{headers:{...ssoHeaders,'Content-Type':'text/javascript; charset=utf-8'}});
  if(path!=='/daos-session')return null;
  if(request.method==='GET')return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>DAOS 통합 로그인</title>
    <script type="module" src="/daos-session.mjs"></script><h1>DAOS 통합 로그인</h1>
    <p id="message" role="status">통합 시연 사이트의 권한을 확인하고 있습니다.</p>
    <a href="https://daos-logistics.ryker6365.chatgpt.site/">통합 시연 사이트로 돌아가기</a></html>`,
    {headers:{...ssoHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'"}});
  if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||
    !await ssoVerify(env.DAOS_SSO_KEY,role,'launch',await request.text()))
    return Response.json({error:'유효한 통합 시연 권한이 필요합니다.'},{status:403,headers:ssoHeaders});
  const lifetime=3600;
  const session=await ssoMint(env.DAOS_SSO_KEY,role,'session',lifetime);
  return Response.json({next:root},{headers:{...ssoHeaders,
    'Set-Cookie':`${ssoCookieName}=${session}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${lifetime}`,
  }});
}
