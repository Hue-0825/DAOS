const SHARE_COOKIE='__Host-daos-share';
const SHARE_LIFETIME=7*24*60*60;
const shareEncoder=new TextEncoder();
const shareHeaders={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const shareHex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
const shareHash=value=>crypto.subtle.digest('SHA-256',shareEncoder.encode(value)).then(shareHex);
const shareMatch=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
};
async function validShareToken(token,env) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return false;
  const hash=await shareHash(token);
  if(shareMatch(hash,env.DAOS_SHARE_KEY_HASH))return true;
  return Number(env.DAOS_GUEST_INVITE_UNTIL)>Math.floor(Date.now()/1000)
    && shareMatch(hash,env.DAOS_GUEST_INVITE_HASH);
}
async function shareSignature(secret,user,expires){
  const key=await crypto.subtle.importKey('raw',shareEncoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return shareHex(await crypto.subtle.sign('HMAC',key,shareEncoder.encode(JSON.stringify([user,expires]))));
}
const shareIdentity=request=>request.headers.get('oai-authenticated-user-id');
async function shareAuthorized(request,env) {
  const user=shareIdentity(request);
  if(!user||!env.DAOS_SHARE_KEY_HASH)return false;
  const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  if(email&&email===env.DAOS_SHARE_OWNER_EMAIL?.toLowerCase())return true;
  const cookie=request.headers.get('Cookie')?.split(';').map(part=>part.trim())
    .find(part=>part.startsWith(SHARE_COOKIE+'='))?.slice(SHARE_COOKIE.length+1);
  const match=/^(\d{10})\.([a-f0-9]{64})$/.exec(cookie??'');
  if(!match||Number(match[1])<=Math.floor(Date.now()/1000))return false;
  return shareMatch(match[2],await shareSignature(env.DAOS_SHARE_KEY_HASH,user,match[1]));
}

const SHARE_SCRIPT=`
const state=document.getElementById('message');
const hash=location.hash.slice(1);
if(/^[a-f0-9]{64}$/.test(hash)){
  sessionStorage.setItem('daos-share-key',hash);
  history.replaceState(null,'','/share');
}
async function openSharedSite(){
  const token=sessionStorage.getItem('daos-share-key');
  if(!token)return;
  if(document.body.dataset.signedIn!=='yes'){
    state.textContent='ChatGPT 계정으로 로그인하면 공유 화면이 열립니다.';
    return;
  }
  state.textContent='공유 권한을 확인하는 중입니다.';
  try{
    const response=await fetch('/share',{method:'POST',headers:{'Content-Type':'text/plain'},body:token});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    sessionStorage.removeItem('daos-share-key');
    location.replace(result.next);
  }catch(error){state.textContent=error.message||'공유 링크를 다시 열어 주세요.';}
}
void openSharedSite();
`;
function shareResponse(body,status=200,extra={}) {
  return new Response(body,{status,headers:{...shareHeaders,...extra}});
}
function shareJson(data,status=200,extra={}) {
  return shareResponse(JSON.stringify(data),status,{'Content-Type':'application/json; charset=utf-8',...extra});
}
async function shareRoute(request,env,root) {
  const url=new URL(request.url);
  const user=shareIdentity(request);
  if(url.pathname==='/share.js'&&request.method==='GET'){
    return shareResponse(SHARE_SCRIPT,200,{'Content-Type':'text/javascript; charset=utf-8'});
  }
  if(url.pathname==='/share'&&request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin||!user)return shareJson({error:'먼저 ChatGPT 계정으로 로그인하세요.'},403);
    const token=(await request.text()).trim();
    if(!await validShareToken(token,env)){
      return shareJson({error:'공유 링크를 확인하거나 새 링크를 받아 주세요.'},403);
    }
    const expires=String(Math.floor(Date.now()/1000)+SHARE_LIFETIME);
    const signature=await shareSignature(env.DAOS_SHARE_KEY_HASH,user,expires);
    return shareJson({next:root},200,{'Set-Cookie':`${SHARE_COOKIE}=${expires}.${signature}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SHARE_LIFETIME}`});
  }
  if(url.pathname!=='/share'||request.method!=='GET')return null;
  if(await shareAuthorized(request,env))return shareResponse(null,303,{Location:root});
  const signIn='/signin-with-chatgpt?return_to=%2Fshare';
  return shareResponse(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>DAOS 공유 화면</title><script src="/share.js" defer></script></head>
    <body data-signed-in="${user?'yes':'no'}" style="font:16px system-ui;max-width:36rem;margin:12vh auto;padding:0 20px;color:#211c37">
    <h1>DAOS 공유 화면</h1><p id="message" role="status">${user?'받은 공유 링크를 열어 주세요.':'공유 링크를 받은 분은 ChatGPT 계정으로 로그인하세요.'}</p>
    ${user?'':`<a href="${signIn}" target="_top">ChatGPT로 로그인</a>`}</body></html>`,200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"});
}
