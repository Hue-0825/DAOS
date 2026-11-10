const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const slots=['06:00–12:00','12:00–18:00','18:00–24:00'];
let data;
let regional=false;
let resetting=false;
let releasing=false;
let settingClock=false;
let changingConnection=false;
let formEdited=false;
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
  $('server-state').textContent=data.online?'기사 서버 연결됨':'기사 서버 연결 차단 중';
  $('server-state').dataset.offline=String(!data.online);
  $('connection-toggle').textContent=data.online?'서버 연결 끊기':'서버 연결 복구';
  $('connection-toggle').disabled=changingConnection||resetting;
  $('region-note').textContent=`${province} 허브 · 접수 ${rows.length}건`;
  $('count').textContent=`전체 ${data.orders.length}건 중 ${rows.length}건 표시`;
  const confirmed=rows.filter(order=>order.delivered).length;
  $('validation-summary').textContent=`서버 배송 완료 ${confirmed}건 · 배차 버전과 집하·배송 순서를 확인한 기록을 원장에 반영합니다.`;
  const sent=data.releasedDates.includes(date);
  const staged=data.stagedDates.includes(date);
  $('release-panel').hidden=!staged;
  const release=$('release-date');
  release.hidden=sent;
  release.disabled=releasing||resetting;
  release.textContent=`${date} 허브로 전송`;
  if(sent&&staged)$('release-result').textContent='지역 허브 전송 완료';
  if(data.clock){
    $('shared-clock').textContent=`${data.clock.date} ${data.clock.time} · 한국시간`;
    if(!formEdited){
      $('clock-date').value=data.clock.date;
      $('clock-time').value=data.clock.time;
    }
  }
  $('orders').innerHTML=rows.map(order=>`<tr><td>${String(order.display_number).padStart(3,'0')}</td>
    <td>${esc(new Date(order.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}<small>배송 ${esc(order.work_date)} · ${slots[order.segment]??'시간 미정'}</small></td>
    <td>${esc(order.recipient)}</td><td>${esc(order.product)} · ${order.quantity}개</td>
    <td>${esc(order.province)} ${esc(order.city)} ${esc(order.address)}<small>${esc(order.instructions)}</small></td>
    <td>${esc(order.province)}<small>${esc(data.regions[order.region]?.name)}</small></td>
    <td>${order.delivered?'배송 완료':order.dispatch_revision?'배차 확정':data.releasedDates.includes(order.work_date)?'허브 접수':'허브 전송 대기'}</td></tr>`).join('')
    ||'<tr><td colspan="7" class="empty-sheet">접수된 주문이 없습니다.</td></tr>';
}
async function refresh(){
  try{
    const response=await fetch('/api/central/orders',{cache:'no-store'});
    if(!response.ok)throw Error();
    data=await response.json();
    if(!$('province').options.length){$('province').replaceChildren(...data.provinces.map(name=>new Option(name,name)));$('province').value='경상남도'}
    const filter=$('history-date');
    if([...filter.options].slice(1).map(option=>option.value).join()!==data.historyDates.join()){
      const previous=filter.value;
      filter.replaceChildren(new Option('전체 배송일','all'),...data.historyDates.map(date=>new Option(date,date)));
      filter.value=data.historyDates.includes(previous)?previous:'all';
    }
    const clockOptions=[...new Set([...data.historyDates,'2026-11-14',data.clock.date])].sort();
    const clockDate=$('clock-date');
    if([...clockDate.options].map(option=>option.value).join()!==clockOptions.join()){
      const previous=clockDate.value;
      clockDate.replaceChildren(...clockOptions.map(date=>new Option(date,date)));
      clockDate.value=clockOptions.includes(previous)?previous:data.clock.date;
    }
    render();
    $('reset-demo').disabled=resetting||releasing||settingClock;
    $('clock-apply').disabled=settingClock||resetting;
  }catch{$('count').textContent='메인 서버 주문을 불러오지 못했습니다.';$('server-state').textContent='메인 서버 연결 끊김';$('server-state').dataset.offline='true'}
}
$('all').onclick=()=>{regional=false;render()};
$('regional').onclick=()=>{regional=true;render()};
$('province').onchange=render;
$('history-date').onchange=()=>{$('release-result').textContent='';render()};
$('history-slot').onchange=render;
$('release-date').onclick=async()=>{
  const date=$('history-date').value;
  if(!date||releasing||resetting)return;
  releasing=true;
  $('reset-demo').disabled=true;
  render();
  try{
    const response=await fetch('/api/central/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    $('release-result').textContent=`${date} 주문 ${result.count}건을 각 지역 허브로 전송했습니다.`;
    await refresh();
  }catch(error){$('release-result').textContent=error.message||'전송하지 못했습니다.'}
  finally{releasing=false;$('reset-demo').disabled=false;render()}
};
$('connection-toggle').onclick=async()=>{
  if(!data||changingConnection||resetting)return;
  changingConnection=true;
  const online=!data.online;
  render();
  try{
    const response=await fetch('/api/central/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({online})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    data.online=result.online;
    $('connection-result').textContent=result.online?'기사 작업 서버 연결을 복구했습니다.':'기사 작업 서버 연결을 차단했습니다. 시연 시간은 계속 공유됩니다.';
  }catch(error){$('connection-result').textContent=error.message}
  finally{changingConnection=false;render()}
};
$('clock-form').oninput=()=>{formEdited=true};
$('clock-form').onsubmit=async event=>{
  event.preventDefault();
  if(settingClock||resetting)return;
  settingClock=true;
  $('clock-apply').disabled=true;
  $('reset-demo').disabled=true;
  try{
    const response=await fetch('/api/central/clock',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({date:$('clock-date').value,time:$('clock-time').value})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    data.clock=result;
    formEdited=false;
    $('clock-result').textContent='모든 시연 화면에 시간을 적용했습니다.';
    render();
  }catch(error){$('clock-result').textContent=error.message}
  finally{settingClock=false;$('clock-apply').disabled=false;$('reset-demo').disabled=releasing}
};
$('reset-demo').onclick=async()=>{
  if(resetting||releasing||settingClock||changingConnection||!confirm('모든 배차·배송 기록을 초기화할까요? 9–11일 기본 주문 300건을 복원하고 12–13일 200건을 허브 전송 대기로 되돌립니다. 추가 접수 주문은 별도로 보관합니다.'))return;
  resetting=true;
  $('reset-demo').disabled=true;
  render();
  $('reset-result').textContent='전체 시연을 초기화하는 중입니다.';
  try{
    const response=await fetch('/api/central/reset',{method:'POST',cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    regional=false;
    $('history-date').value='all';
    $('history-slot').value='all';
    $('release-result').textContent='';
    formEdited=false;
    await refresh();
    $('reset-result').textContent=`초기화 완료 · 허브 주문 ${result.count}건 · 허브 전송 대기 ${result.staged}건 · 추가 주문 ${result.archived}건 보관`;
  }catch(error){$('reset-result').textContent=error.message||'전체 리셋을 완료하지 못했습니다.'}
  finally{resetting=false;$('reset-demo').disabled=false;render()}
};
await refresh();
setInterval(()=>{if(!resetting&&!releasing&&!settingClock&&!changingConnection)void refresh()},3000);
