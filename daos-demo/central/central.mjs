const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let data;
let regional=false;
function render(){
  $('all').setAttribute('aria-pressed',String(!regional));
  $('regional').setAttribute('aria-pressed',String(regional));
  $('regional-panel').hidden=!regional;
  if(!data)return;
  const province=$('province').value;
  const date=$('history-date').value;
  const rows=data.orders.filter(order=>(!regional||order.province===province)&&(date==='all'||order.work_date===date));
  $('server-state').dataset.offline='false';
  $('server-state').textContent=data.online?'메인 서버 연결됨':'메인 서버 연결됨 · 기사 연결 차단 중';
  $('region-note').textContent=`${province} 허브 · 접수 ${rows.length}건`;
  $('count').textContent=`전체 ${data.orders.length}건 중 ${rows.length}건 표시`;
  $('orders').innerHTML=rows.map(order=>`<tr><td>${order.number}</td>
    <td>${esc(new Date(order.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}<small>배송 ${esc(order.work_date)}</small></td>
    <td>${esc(order.recipient)}</td><td>${esc(order.product)} · ${order.quantity}개</td>
    <td>${esc(order.province)} ${esc(order.city)} ${esc(order.address)}<small>${esc(order.instructions)}</small></td>
    <td>${esc(order.province)}<small>${esc(data.regions[order.region]?.name)}</small></td>
    <td>${order.delivered?'배송 완료':order.dispatch_revision?'배차 확정':'허브 접수'}</td></tr>`).join('')
    ||'<tr><td colspan="7" class="empty-sheet">접수된 주문이 없습니다.</td></tr>';
}
async function refresh(){
  try{
    const response=await fetch('/api/central/orders',{cache:'no-store'});
    if(!response.ok)throw Error();
    data=await response.json();
    if(!$('province').options.length){$('province').replaceChildren(...data.provinces.map(name=>new Option(name,name)));$('province').value='경상남도'}
    if ($('history-date').options.length===1) {
      const labels=['오늘','내일','모레'];
      $('history-date').append(...data.historyDates.map((date,i)=>new Option(`${labels[i]} · ${date}`,date)));
    }
    render();
  }catch{$('count').textContent='메인 서버 주문을 불러오지 못했습니다.';$('server-state').textContent='메인 서버 연결 끊김';$('server-state').dataset.offline='true'}
}
$('all').onclick=()=>{regional=false;render()};
$('regional').onclick=()=>{regional=true;render()};
$('province').onchange=render;
$('history-date').onchange=render;
await refresh();
setInterval(refresh,3000);
