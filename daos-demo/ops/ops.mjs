const $ = id => document.getElementById(id);
const slots = ['06:00–12:00','12:00–18:00','18:00–24:00'];
const regions = [['campus','sangnam'],['jangyu','yulha'],['yangsan','buwon']];
const regionNames = {campus:'창원대학교',sangnam:'창원 상남동 로터리',jangyu:'김해 장유1동',yulha:'장유 율하',yangsan:'양산 이마트 주변',buwon:'김해 부원역·시청'};
const places = await (await fetch('/ops/places.json')).json();
let snapshot;
let saving = false;
let loading = false;
let destinationKey = '';
let destinationScope = '';
const normalize = value => value.toLowerCase().replace(/[^가-힣a-z0-9]/g,'').replaceAll('로타리','로터리');
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

async function request(path, body) {
  const response = await fetch(`/api/ops${path}`, body === undefined ? {cache:'no-store'} :
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function availableRegions() {
  const segment = Number($('segment').value);
  const order = snapshot?.orders.find(item => item.work_date === $('date').value && item.segment === segment);
  return order ? [places[order.destination].region] : regions[segment];
}
function searchDestinations() {
  const allowed = availableRegions();
  const queries = $('destination-search').value.trim().split(/\s+/).map(normalize).filter(Boolean);
  return Object.entries(places).filter(([,place]) => {
    const name = normalize(`${place.label} ${regionNames[place.region]}`);
    return queries.length && allowed.includes(place.region) && queries.every(query => name.includes(query));
  });
}
function updateDestinations() {
  const allowed = availableRegions();
  if (destinationKey && !allowed.includes(places[destinationKey].region)) {
    destinationKey = '';
    $('destination-search').value = '';
  }
  $('destination-hint').textContent = `검색 가능 권역 · ${allowed.map(key=>regionNames[key]).join(' / ')}`;
  const results = $('destination-results');
  const hasQuery = Boolean($('destination-search').value.trim());
  results.hidden = !hasQuery || Boolean(destinationKey);
  if (!results.hidden) {
    const options = searchDestinations();
    results.innerHTML = options.length ? options.map(([key,place]) =>
      `<button type="button" data-destination="${key}"><strong>${escape(place.label)}</strong><small>${regionNames[place.region]}</small></button>`).join('')
      : '<p>이 시간대에 일치하는 배송지가 없습니다. 검색어나 배송 구간을 바꿔 보세요.</p>';
  }
  $('destination-selected').hidden = !destinationKey;
  $('destination-selected').textContent = destinationKey ? `선택됨 · ${regionNames[places[destinationKey].region]}` : '';
  $('destination-search').setCustomValidity(destinationKey || !hasQuery ? '' : '검색 결과에서 배송지를 선택해 주세요.');
  $('register').disabled = saving || !snapshot;
}
function selectDestination(key) {
  destinationKey = key;
  $('destination-search').value = places[key].label;
  updateDestinations();
  $('title').focus();
}
function statusFor(order) {
  if (order.daos_done || order.baseline_done) return 'completed';
  return order.revision === null ? 'pending' : 'dispatched';
}
function renderTable() {
  const { orders, dates } = snapshot;
  const date = $('filter-date').value;
  const status = $('filter-status').value;
  const query = normalize($('filter-search').value);
  const rows = orders.filter(order => {
    const destination = places[order.destination];
    const number = `DAOS-${String(order.number).padStart(3,'0')}`;
    return (date === 'all' || order.work_date === dates[Number(date)])
      && (status === 'all' || statusFor(order) === status)
      && (!query || normalize(`${number} ${order.title} ${order.cargo} ${destination.label} ${regionNames[destination.region]}`).includes(query));
  });
  $('orders').innerHTML = rows.length ? rows.map(order => {
    const destination = places[order.destination];
    const state = statusFor(order);
    const label = state === 'pending' ? '확정 대기' : state === 'dispatched' ? '배차 확정'
      : order.daos_done && order.baseline_done ? '두 방식 완료' : order.daos_done ? 'DAOS 완료' : '기존 방식 완료';
    return `<tr><td class="order-number">DAOS-${String(order.number).padStart(3,'0')}</td>
      <td>${order.work_date}<small>${slots[order.segment]}</small></td>
      <td><strong>${escape(destination.label)}</strong><small>${regionNames[destination.region]} · ${escape(order.instructions)}</small></td>
      <td><strong>${escape(order.title)}</strong><small>${escape(order.cargo)}</small></td>
      <td><span class="order-status ${state}">${label}</span></td></tr>`;
  }).join('') : `<tr><td class="empty-sheet" colspan="5">${orders.length ? '조건에 맞는 주문이 없습니다.' : '등록된 주문이 없습니다. 왼쪽에서 주문을 추가하세요.'}</td></tr>`;
  $('filtered-count').textContent = `전체 ${orders.length}건 중 ${rows.length}건 표시`;
}
function render() {
  const { online, revision, orders, receipt, progress, dates } = snapshot;
  $('connection').textContent = online ? '연결됨' : '장애 시연 중';
  $('toggle').textContent = online ? '메인 서버 연결 끊기' : '메인 서버 복구';
  $('toggle').disabled = saving;
  $('sample').disabled = saving || Boolean(orders.length);
  $('publish').disabled = saving || !orders.some(order => order.revision === null);
  $('receipt').textContent = !revision ? '배차 확정 전' : receipt?.revision === revision ? '백업 완료' : '기사 앱 저장 대기';
  $('receipt-note').textContent = revision ? `작업표 v${revision} · ${dates.map((date,i)=>`${i?'내일':'오늘'} ${orders.filter(o=>o.work_date===date&&o.revision!==null).length}건`).join(' / ')}` : '';
  const count = mode => progress.filter(item=>item.mode===mode).reduce((sum,item)=>sum+item.count,0);
  $('progress').textContent = `DAOS ${count('daos')}건 · 기존 ${count('baseline')}건`;
  $('progress-note').textContent = '오늘·내일 합계 · 오프라인 기록은 복구 후 반영';
  $('order-count').textContent = `확정 ${orders.filter(o=>o.revision!==null).length}건 · 대기 ${orders.filter(o=>o.revision===null).length}건`;
  if ($('date').options[0]?.value !== dates[0]) {
    $('date').replaceChildren(...dates.map((date,i)=>new Option(`${i?'내일':'오늘'} · ${date}`,date)));
  }
  const scope = availableRegions().join(',');
  if (scope !== destinationScope) {
    destinationScope = scope;
    updateDestinations();
  }
  $('register').disabled = saving;
  renderTable();
}
async function refresh() {
  if (loading || saving) return;
  loading = true;
  try {
    const next = await request('');
    if (JSON.stringify(snapshot) !== JSON.stringify(next)) { snapshot = next; render(); }
  }
  catch { $('notice').textContent = '운영 웹에서 서버 상태를 확인할 수 없습니다.'; }
  finally { loading = false; }
}
async function act(path, body, message) {
  if (saving || !snapshot) return false;
  saving = true;
  render();
  let success = false;
  try { await request(path,body); $('notice').textContent = message; success = true; }
  catch (error) { $('notice').textContent = error.message; }
  finally { saving = false; render(); await refresh(); }
  return success;
}
for (const id of ['date','segment']) $(id).addEventListener('change',() => {
  destinationScope = availableRegions().join(',');
  updateDestinations();
});
$('destination-search').addEventListener('input',() => {
  destinationKey = '';
  updateDestinations();
});
$('destination-search').addEventListener('keydown',event => {
  if (event.key !== 'Enter' || event.isComposing || destinationKey) return;
  const options = searchDestinations();
  if (options.length === 1) {
    event.preventDefault();
    selectDestination(options[0][0]);
  }
});
$('destination-results').addEventListener('click',event => {
  const button = event.target.closest('[data-destination]');
  if (button) selectDestination(button.dataset.destination);
});
for (const id of ['filter-date','filter-status','filter-search']) $(id).addEventListener('input',() => {
  if (snapshot) renderTable();
});
$('order').addEventListener('submit',async event=>{
  event.preventDefault();
  if (!destinationKey) return;
  const saved = await act('/orders',{
    date:$('date').value,segment:Number($('segment').value),drop:destinationKey,
    title:$('title').value,cargo:$('cargo').value,to:$('instructions').value,
  },'주문을 등록했습니다. 배차를 확정하면 기사 앱에 전송됩니다.');
  if (saved) { $('title').value=''; $('cargo').value=''; $('title').focus(); }
});
$('sample').addEventListener('click',()=>void act('/sample',{},'오늘과 내일 시연 주문을 등록했습니다.'));
$('publish').addEventListener('click',()=>void act('/publish',{},'배차를 확정했습니다. 기사 앱의 백업 완료를 기다립니다.'));
$('toggle').addEventListener('click',()=>void act('/connection',{online:!snapshot.online},
  snapshot.online?'기사 서버 연결을 끊었습니다.':'기사 서버를 복구했습니다.'));
await refresh();
setInterval(refresh,3000);
