const result = document.getElementById('result');
const grant = location.hash.slice(1);
history.replaceState(null,'','/robot/activate');
try {
  const response = await fetch('/robot/session',{
    method:'POST',headers:{'Content-Type':'text/plain'},body:grant,
  });
  if (!response.ok) throw Error('권한 확인 실패');
  location.replace('/robot/');
} catch {
  result.textContent='권한을 확인하지 못했습니다. 로봇 관제실과 메인 관제센터에 같은 ChatGPT 계정으로 로그인한 뒤 다시 열어 주세요.';
}
