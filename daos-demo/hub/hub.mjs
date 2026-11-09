const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const slots=['06:00–12:00','12:00–18:00','18:00–24:00'];
let province='경상남도';
let selectedRegion;
let data;
let busy=false;
function render(){
  if(!data)return;
  const date=$('dispatch-date').value;
  const orders=data.orders.filter(order=>order.work_date===date);
  const routes=[...new Set(orders.map(order=>order.region).filter(Boolean))];
  if(!routes.includes(selectedRegion))selectedRegion=routes[0];
  const route=data.regions[selectedRegion];
  $('region-preview').hidden=!route;
  if(route){
    const map=`${route.province?'region-':''}${selectedRegion}.svg`;
    if($('hub-map').getAttribute('src')!==map)$('hub-map').src=map;
    const caption=`${province} · ${route.city} · ${route.name}`;
    $('hub-map').alt=caption;
    $('hub-map-caption').textContent=caption;
  }
  $('server-state').dataset.offline=String(!data.online);
  $('server-state').textContent=data.online?'서버 연결됨':'기사 서버 연결 차단 중';
  $('count').textContent=`${orders.length}건`;
  $('driver').textContent=`${province} 시연 기사 1`;
  $('backup').textContent=!data.revision?'배차 확정 전':data.receipt?.revision===data.revision?'백업 완료':'기사 앱 저장 대기';
  $('connection').disabled=busy;
  $('connection').textContent=data.online?'메인 서버 연결 끊기':'메인 서버 복구';
  function groupList(dispatched){
    return routes.map(region=>{
      const rows=orders.filter(order=>order.region===region&&Boolean(order.dispatch_revision)===dispatched);
      if(!rows.length)return '';
      const {name,city,segment}=data.regions[region];
      const addresses=[...new Set(rows.map(order=>order.address))];
      return `<div class="group"><div><strong>${esc(name)} · ${rows.length}건</strong>
        <small>${esc(province)} ${esc(city)} · ${slots[segment]}</small>
        <small class="addresses">${addresses.map(esc).join(' · ')}</small></div>
        <div class="group-actions"><button type="button" class="secondary" data-map-region="${region}" aria-pressed="${region===selectedRegion}">지도 보기</button>
        ${dispatched?'':`<button type="button" data-region="${region}" ${busy?'disabled':''}>배차 확정</button>`}</div></div>`;
    }).join('');
  }
  $('groups').innerHTML=groupList(false)||'<p>배차할 권역 주문이 없습니다.</p>';
  $('dispatches').innerHTML=groupList(true)||'<p>확정된 배차가 없습니다.</p>';
  const count=orders.filter(order=>order.dispatch_revision).length;
  $('reset').disabled=busy||!data.online||!count;
  $('reset-hint').textContent=!data.online?'서버를 복구하면 배차를 리셋할 수 있습니다.'
    :count?`확정 ${count}건과 해당 날짜의 시연 기록을 초기화합니다.`:'선택한 날짜에 확정된 배차가 없습니다.';
  $('orders').innerHTML=orders.map(order=>{
    const status=order.delivered?'배송 완료':order.dispatch_revision?`배차 확정 · DAOS-${String(order.delivery_number).padStart(3,'0')}`:order.region?'배차 대기':'주소 확인 필요';
    return `<tr><td>${order.number}</td><td>${esc(order.work_date)}<small>${slots[order.segment]??'시간 미정'}</small></td>
      <td>${esc(order.province)} ${esc(order.city)} ${esc(order.address)}</td><td>${esc(order.product)} · ${order.quantity}개</td><td>${status}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty-sheet">이 허브에 접수된 주문이 없습니다.</td></tr>';
}
async function refresh(){
  const selected=province;
  try{
    const response=await fetch(`/api/hub/orders?province=${encodeURIComponent(selected)}`,{cache:'no-store'});
    if(!response.ok)throw Error();
    const next=await response.json();
    if(selected!==province)return;
    if(!$('province').options.length){$('province').replaceChildren(...next.provinces.map(name=>new Option(name,name)));$('province').value=province}
    if(!$('dispatch-date').options.length)$('dispatch-date').replaceChildren(...next.dates.map(date=>new Option(date,date)));
    data=next;
    render();
  }catch{$('reset').disabled=true;$('notice').textContent='허브 주문을 불러오지 못했습니다.';$('server-state').textContent='서버 연결 끊김';$('server-state').dataset.offline='true'}
}
async function post(path,body,message){
  if(busy)return;
  busy=true;render();
  try{
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    $('notice').textContent=message(result);
  }catch(error){$('notice').textContent=error.message}
  finally{busy=false;await refresh()}
}
$('province').onchange=()=>{province=$('province').value;data=null;$('groups').replaceChildren();$('dispatches').replaceChildren();$('orders').replaceChildren();$('region-preview').hidden=true;$('reset').disabled=true;$('connection').disabled=true;void refresh()};
$('dispatch-date').onchange=render;
function selectMap(event){
  const button=event.target.closest('[data-map-region]');
  if(!button)return false;
  selectedRegion=button.dataset.mapRegion;
  render();
  $('region-preview').scrollIntoView({block:'nearest'});
  return true;
}
$('groups').onclick=event=>{
  if(selectMap(event))return;
  const button=event.target.closest('[data-region]');
  if(button)void post('/api/hub/dispatch',{province,date:$('dispatch-date').value,region:button.dataset.region},
    result=>`${result.count}건을 ${province} 시연 기사 작업표에 배정했습니다.`);
};
$('dispatches').onclick=selectMap;
$('reset').onclick=()=>{
  if($('reset').disabled)return;
  const date=$('dispatch-date').value;
  if(!confirm(`${date} ${province} 배차와 시연 배송 기록을 초기화할까요?`))return;
  void post('/api/hub/cancel',{province,date},result=>`${result.count}건 배차를 취소했습니다. 기사 앱은 연결 후 새 작업표를 받습니다.`);
};
$('connection').onclick=()=>void post('/api/ops/connection',{online:!data.online},()=>'기사 서버 상태를 변경했습니다.');
await refresh();
setInterval(()=>{if(!busy)void refresh()},3000);
