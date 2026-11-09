const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const slots=['06:00–12:00','12:00–18:00','18:00–24:00'];
let province='경상남도';
let data;
let busy=false;
function render(){
  if(!data)return;
  const region=Object.entries(data.regions).find(([,route])=>route.province===province);
  const map=region?.[0] ? `region-${region[0]}.svg` : 'campus.svg';
  const caption=region?.[1].name??'창원대학교 · 경남 대표 지도';
  if($('hub-map').getAttribute('src')!==map)$('hub-map').src=map;
  $('hub-map').alt=caption;
  $('hub-map-caption').textContent=caption;
  $('region-preview').hidden=false;
  $('server-state').dataset.offline=String(!data.online);
  $('server-state').textContent=data.online?'서버 연결됨':'기사 서버 연결 차단 중';
  $('count').textContent=`${data.orders.length}건`;
  $('driver').textContent=`${province} 시연 기사 1`;
  $('backup').textContent=!data.revision?'배차 확정 전':data.receipt?.revision===data.revision?'백업 완료':'기사 앱 저장 대기';
  $('connection').disabled=busy;
  $('connection').textContent=data.online?'메인 서버 연결 끊기':'메인 서버 복구';
  const groups=new Map();
  for(const order of data.orders){
    if(!order.region || order.dispatch_revision)continue;
    const key=`${order.work_date}/${order.region}`;
    if(!groups.has(key))groups.set(key,{date:order.work_date,region:order.region,count:0});
    groups.get(key).count++;
  }
  $('groups').innerHTML=[...groups.values()].map(group=>`<div class="group"><div><strong>${esc(data.regions[group.region].name)} · ${group.count}건</strong><br><small>${group.date} · ${slots[data.regions[group.region].segment]}</small></div><button type="button" data-date="${group.date}" data-region="${group.region}" ${busy?'disabled':''}>배차 확정</button></div>`).join('')||'<p>배차할 권역 주문이 없습니다.</p>';
  $('dispatches').innerHTML=data.dates.map(date=>{
    const count=data.orders.filter(order=>order.work_date===date&&order.dispatch_revision).length;
    return count?`<div class="group"><div><strong>${date} · ${count}건</strong><br><small>배차 확정</small></div><button class="cancel-button" type="button" data-cancel-date="${date}" ${busy||!data.online?'disabled':''}>배차 취소</button></div>`:'';
  }).join('')||'<p>확정된 배차가 없습니다.</p>';
  $('orders').innerHTML=data.orders.map(order=>{
    const status=order.delivered?'배송 완료':order.dispatch_revision?`배차 확정 · DAOS-${String(order.delivery_number).padStart(3,'0')}`:order.region?'배차 대기':'주소 확인 필요';
    return `<tr><td>${order.number}</td><td>${esc(order.work_date)}<small>${slots[order.segment]??'시간 미정'}</small></td>
      <td>${esc(order.city)} ${esc(order.address)}</td><td>${esc(order.product)} · ${order.quantity}개</td><td>${status}</td></tr>`;
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
    data=next;
    render();
  }catch{$('notice').textContent='허브 주문을 불러오지 못했습니다.';$('server-state').textContent='서버 연결 끊김';$('server-state').dataset.offline='true'}
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
$('province').onchange=()=>{province=$('province').value;data=null;$('groups').replaceChildren();$('dispatches').replaceChildren();$('orders').replaceChildren();$('connection').disabled=true;void refresh()};
$('groups').onclick=event=>{
  const button=event.target.closest('[data-region]');
  if(button)void post('/api/hub/dispatch',{province,date:button.dataset.date,region:button.dataset.region},
    result=>`${result.count}건을 ${province} 시연 기사 작업표에 배정했습니다.`);
};
$('dispatches').onclick=event=>{
  const button=event.target.closest('[data-cancel-date]');
  if(!button||busy||!data.online)return;
  const date=button.dataset.cancelDate;
  if(!confirm(`${date} ${province} 배차와 시연 배송 기록을 초기화할까요?`))return;
  void post('/api/hub/cancel',{province,date},result=>`${result.count}건 배차를 취소했습니다. 기사 앱은 연결 후 새 작업표를 받습니다.`);
};
$('connection').onclick=()=>void post('/api/ops/connection',{online:!data.online},()=>'기사 서버 상태를 변경했습니다.');
await refresh();
setInterval(()=>{if(!busy)void refresh()},3000);
