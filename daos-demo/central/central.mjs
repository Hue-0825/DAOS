const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const slots=['06:00–12:00','12:00–18:00','18:00–24:00'];
let data;
let regional=false;
let resetting=false;
function render(){
  $('all').setAttribute('aria-pressed',String(!regional));
  $('regional').setAttribute('aria-pressed',String(regional));
  $('regional-panel').hidden=!regional;
  if(!data)return;
  const province=$('province').value;
  const date=$('history-date').value;
  const slot=$('history-slot').value;
  const rows=data.orders.filter(order=>(!regional||order.province===province)&&(date==='all'||order.work_date===date)
    &&(slot==='all'||order.segment===Number(slot)));
  $('server-state').dataset.offline='false';
  $('server-state').textContent=data.online?'메인 서버 연결됨':'메인 서버 연결됨 · 기사 연결 차단 중';
  $('region-note').textContent=`${province} 허브 · 접수 ${rows.length}건`;
  $('count').textContent=`전체 ${data.orders.length}건 중 ${rows.length}건 표시`;
  $('orders').innerHTML=rows.map(order=>`<tr><td>${order.number}</td>
    <td>${esc(new Date(order.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}<small>배송 ${esc(order.work_date)} · ${slots[order.segment]??'시간 미정'}</small></td>
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
      $('history-date').append(...data.historyDates.map(date=>new Option(date,date)));
    }
    render();
    $('reset-demo').disabled=resetting;
  }catch{$('count').textContent='메인 서버 주문을 불러오지 못했습니다.';$('server-state').textContent='메인 서버 연결 끊김';$('server-state').dataset.offline='true'}
}
$('all').onclick=()=>{regional=false;render()};
$('regional').onclick=()=>{regional=true;render()};
$('province').onchange=render;
$('history-date').onchange=render;
$('history-slot').onchange=render;
$('reset-demo').onclick=async()=>{
  if(resetting||!confirm('모든 지역의 배차·배송 기록을 초기화할까요? 기본 주문 300건은 배차 대기로 복원하고 추가 접수 주문은 별도로 보관합니다.'))return;
  resetting=true;
  $('reset-demo').disabled=true;
  $('reset-result').textContent='전체 시연을 초기화하는 중입니다.';
  try{
    const response=await fetch('/api/central/reset',{method:'POST',cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    regional=false;
    $('history-date').value='all';
    $('history-slot').value='all';
    await refresh();
    $('reset-result').textContent=`초기화 완료 · 기본 주문 ${result.count}건 · 추가 주문 ${result.archived}건 보관 · 기사 서버 연결 복구`;
  }catch(error){$('reset-result').textContent=error.message||'전체 리셋을 완료하지 못했습니다.'}
  finally{resetting=false;$('reset-demo').disabled=false}
};
await refresh();
setInterval(()=>{if(!resetting)void refresh()},3000);
