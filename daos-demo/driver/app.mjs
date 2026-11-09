const KEY_BASE = 'daos.driver.dispatch.v1';
const PROVINCES = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];
const DEFAULT_PROVINCE = '경상남도';
const RETENTION_MS = 6 * 60 * 60 * 1000;
const PLACES = {
  library: { name: '중앙도서관', building: '2호관' },
  admin: { name: '대학본부', building: '1호관' },
  union: { name: '제1학생회관', building: '5호관' },
  gym: { name: '체육관', building: '8호관' },
  engineering: { name: '공대1호관', building: '51호관' },
  dorm: { name: '학생생활관 1동', building: '71호관' },
  jcenter: { name: '장유1동 행정복지센터', region: 'jangyu' },
  jmarket: { name: '장유전통시장', region: 'jangyu' },
  jpost: { name: '장유우체국', region: 'jangyu' },
  jterminal: { name: '장유여객터미널', region: 'jangyu' },
  jclinic: { name: '장유보건지소', region: 'jangyu' },
  yemart: { name: '이마트 양산점', region: 'yangsan' },
  ystation: { name: '양산역', region: 'yangsan' },
  ybus: { name: '양산시외버스터미널', region: 'yangsan' },
  yhealth: { name: '양산시보건소', region: 'yangsan' },
  yfire: { name: '중부119안전센터', region: 'yangsan' },
  smarket: { name: '상남시장', region: 'sangnam' },
  splaza: { name: '상남분수광장', region: 'sangnam' },
  scross: { name: '상남오거리', region: 'sangnam' },
  scenter: { name: '상남동 행정복지센터', region: 'sangnam' },
  sbuilding: { name: '상남프라자', region: 'sangnam' },
  ylibrary: { name: '김해기적의도서관', region: 'yulha' },
  ycafe: { name: '율하카페거리', region: 'yulha' },
  ypost: { name: '김해율하우체국', region: 'yulha' },
  ycenter: { name: '장유3동 행정복지센터', region: 'yulha' },
  yheritage: { name: '관동유적모형관', region: 'yulha' },
  bstation: { name: '부원역', region: 'buwon' },
  bmall: { name: '아이스퀘어 몰', region: 'buwon' },
  bcenter: { name: '부원동 행정복지센터', region: 'buwon' },
  bcity: { name: '김해시청 제2청사', region: 'buwon' },
  bpost: { name: '부원동우체국', region: 'buwon' },
  prov_seoul: { name: '서울시청 주변', region: 'seoul' },
  prov_busan: { name: '부산시청 주변', region: 'busan' },
  prov_daegu: { name: '동대구역 주변', region: 'daegu' },
  prov_incheon: { name: '인천시청 주변', region: 'incheon' },
  prov_gwangju: { name: '광주광역시청 주변', region: 'gwangju' },
  prov_daejeon: { name: '대전시청 주변', region: 'daejeon' },
  prov_ulsan: { name: '울산시청 주변', region: 'ulsan' },
  prov_sejong: { name: '세종시청 주변', region: 'sejong' },
  prov_gyeonggi: { name: '수원역 주변', region: 'gyeonggi' },
  prov_gangwon: { name: '춘천역 주변', region: 'gangwon' },
  prov_chungbuk: { name: '청주시청 주변', region: 'chungbuk' },
  prov_chungnam: { name: '천안역 주변', region: 'chungnam' },
  prov_jeonbuk: { name: '전주역 주변', region: 'jeonbuk' },
  prov_jeonnam: { name: '순천역 주변', region: 'jeonnam' },
  prov_gyeongbuk: { name: '포항역 주변', region: 'gyeongbuk' },
  prov_jeju: { name: '제주시청 주변', region: 'jeju' },
};
const HUB = PLACES.admin;
const SEGMENTS = ['06:00–12:00', '12:00–18:00', '18:00–24:00'];
const MAPS = {
  campus: { name: '창원대', title: '창원대학교 지도', file: 'campus.svg?v=20' },
  jangyu: { name: '장유1동', title: '김해 장유1동 지도', file: 'jangyu.svg' },
  yangsan: { name: '양산 이마트', title: '양산 이마트 주변 지도', file: 'yangsan.svg' },
  sangnam: { name: '상남동 로터리', title: '창원 상남동 로터리 지도', file: 'sangnam.svg' },
  yulha: { name: '장유 율하', title: '장유 율하 지도', file: 'yulha.svg' },
  buwon: { name: '김해 부원역·시청', title: '김해 부원역·시청 지도', file: 'buwon.svg' },
  seoul: { name: '서울시청 주변', title: '서울특별시 · 서울시청 주변 지도', file: 'region-seoul.svg' },
  busan: { name: '부산시청 주변', title: '부산광역시 · 부산시청 주변 지도', file: 'region-busan.svg' },
  daegu: { name: '동대구역 주변', title: '대구광역시 · 동대구역 주변 지도', file: 'region-daegu.svg' },
  incheon: { name: '인천시청 주변', title: '인천광역시 · 인천시청 주변 지도', file: 'region-incheon.svg' },
  gwangju: { name: '광주광역시청 주변', title: '광주광역시 · 광주광역시청 주변 지도', file: 'region-gwangju.svg' },
  daejeon: { name: '대전시청 주변', title: '대전광역시 · 대전시청 주변 지도', file: 'region-daejeon.svg' },
  ulsan: { name: '울산시청 주변', title: '울산광역시 · 울산시청 주변 지도', file: 'region-ulsan.svg' },
  sejong: { name: '세종시청 주변', title: '세종특별자치시 · 세종시청 주변 지도', file: 'region-sejong.svg' },
  gyeonggi: { name: '수원역 주변', title: '경기도 · 수원역 주변 지도', file: 'region-gyeonggi.svg' },
  gangwon: { name: '춘천역 주변', title: '강원특별자치도 · 춘천역 주변 지도', file: 'region-gangwon.svg' },
  chungbuk: { name: '청주시청 주변', title: '충청북도 · 청주시청 주변 지도', file: 'region-chungbuk.svg' },
  chungnam: { name: '천안역 주변', title: '충청남도 · 천안역 주변 지도', file: 'region-chungnam.svg' },
  jeonbuk: { name: '전주역 주변', title: '전북특별자치도 · 전주역 주변 지도', file: 'region-jeonbuk.svg' },
  jeonnam: { name: '순천역 주변', title: '전라남도 · 순천역 주변 지도', file: 'region-jeonnam.svg' },
  gyeongbuk: { name: '포항역 주변', title: '경상북도 · 포항역 주변 지도', file: 'region-gyeongbuk.svg' },
  jeju: { name: '제주시청 주변', title: '제주특별자치도 · 제주시청 주변 지도', file: 'region-jeju.svg' },
};
const STATES = { ready: '일괄 집하 대기', waiting: '구간 출발 대기', picked: '배송 대기', delivered: '배송 완료' };
const $ = id => document.getElementById(id);
function isMobileDevice(device) {
  return device.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod|Windows Phone/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}
const mobile = isMobileDevice(navigator);
document.documentElement.classList.toggle('driver-mobile', mobile);
const blank = () => ({ snapshot: null, pending: [], confirmed: [], demoOffline: false, demoDate: null, demoTime: null, baseline: false, baselineEvents: [], completedDays: {} });
let db = blank();
let readError = false;
let province = DEFAULT_PROVINCE;
try {
  const requested = new URLSearchParams(location.search).get('province') ?? localStorage.getItem(`${KEY_BASE}.province`);
  if (PROVINCES.includes(requested)) province=requested;
} catch { readError=true; }
const keyForProvince = () => province===DEFAULT_PROVINCE?KEY_BASE:`${KEY_BASE}.${province}`;
function loadProvince() {
  db=blank();
  try {
    const raw=localStorage.getItem(keyForProvince());
    if(raw) db=JSON.parse(raw);
    readError=false;
  }catch{readError=true}
}
loadProvince();
$('driver-province').replaceChildren(...PROVINCES.map(name=>new Option(name,name)));
$('driver-province').value=province;
let connected = false;
let serverJobs = [];
let serverEvents = [];
let busy = false;
let shellReady = false;
let displayedDate;

let selected = null;
let noticeTimer;
const timezone = { timeZone: 'Asia/Seoul' };
const DEMO_DATES=['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13'];
const timeFormat = new Intl.DateTimeFormat('ko-KR', { ...timezone, hour:'2-digit', minute:'2-digit', hour12:false });
const dateKey=(offset=0)=>DEMO_DATES[offset];
const workDate=()=>DEMO_DATES.includes(db.demoDate)?db.demoDate:dateKey();
$('clock-day').replaceChildren(...DEMO_DATES.map((date,index)=>new Option(date,String(index))));
function dateLabel(key) {
  const [, month, date] = key.split('-');
  return `${Number(month)}/${Number(date)}`;
}
function save(next) {
  try {
    localStorage.setItem(keyForProvince(), JSON.stringify(next));
    db = next;
    readError = false;
    return true;
  } catch {
    readError = true;
    toast('기기 저장에 실패했습니다. 저장 공간 또는 브라우저 설정을 확인해 주세요.');
    return false;
  }
}
function toast(message) {
  $('notice').textContent = message;
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4200);
}
function completionFor(date) {
  return db.completedDays?.[date];
}
function expired(completion) {
  return completion && Date.now() >= completion.purgeAt;
}
function completedDays(jobs, deliveryEvents, previous = db.completedDays) {
  const days = { ...previous };
  const delivered = new Map(deliveryEvents.filter(event => event.state === 'delivered').map(event => [event.key, event]));
  for (const date of new Set(jobs.map(job => job.date))) {
    const day = jobs.filter(job => job.date === date);
    if (!day.every(job => delivered.has(job.key))) {
      delete days[date];
      continue;
    }
    if (days[date]?.total === day.length) continue;
    const lastDelivery = Math.max(...day.map(job => Date.parse(delivered.get(job.key).at)));
    days[date] = { total: day.length, purgeAt: lastDelivery + RETENTION_MS };
  }
  return days;
}
function pruneExpired() {
  const snapshot = db.snapshot;
  if (!snapshot) return false;
  // Older installs may already have completed deliveries without a retention timestamp.
  const known = db.completedDays ?? {};
  const completions = completedDays(snapshot.jobs, [...db.confirmed, ...db.pending]);
  const jobs = snapshot.jobs.filter(job => !expired(completions[job.date]));
  const changed = Object.keys(known).length !== Object.keys(completions).length || Object.keys(completions).some(date => completions[date] !== known[date]);
  if (!changed && jobs.length === snapshot.jobs.length) return false;
  return save({ ...db, snapshot: { ...snapshot, jobs }, completedDays: completions });
}
function events() {
  return db.baseline ? serverEvents : [...db.confirmed, ...db.pending];
}
function pickupKey(date) {
  return `${date}/pickup`;
}
function hasPickup(date) {
  return events().some(event => event.key === pickupKey(date) && event.state === 'picked');
}
function stateFor(job) {
  if (events().some(event => event.key === job.key && event.state === 'delivered')) return 'delivered';
  if (!hasPickup(job.date)) return 'ready';
  return hasStarted(job.date, segmentFor(job)) ? 'picked' : 'waiting';
}
function startKey(date, index) {
  return `${date}/start/${index}`;
}
function hasStarted(date, index) {
  return index === 0 || events().some(event => event.key === startKey(date, index) && event.state === 'started');
}
function jobsOn(date) {
  const jobs = db.baseline ? (connected ? serverJobs : []) : (db.snapshot?.jobs ?? []);
  return jobs.filter(job => job.date === date && (db.baseline || !expired(completionFor(job.date))));
}
function segmentFor(job) {
  // Offline snapshots from the previous demo did not carry a segment field.
  return job.segment ?? Number(['CW-103', 'CW-202'].includes(job.id));
}
function segmentsOn(date) {
  return SEGMENTS.map((slot, index) => ({ slot, index, jobs: jobsOn(date).filter(job => segmentFor(job) === index) }))
    .filter(segment => segment.jobs.length);
}
function nextSegment(date) {
  return segmentsOn(date).find(segment => segment.jobs.some(job => stateFor(job) !== 'delivered'));
}
function clockTime() {
  return db.demoDate === workDate() ? db.demoTime : null;
}
const locationFor=job=>job.place?{...PLACES[job.drop],...job.place,name:job.place.label}:PLACES[job.drop];
function mapFor(segment) {
  return MAPS[segment ? locationFor(segment.jobs[0])?.region??'campus' : 'campus'];
}
function activeSegment(date = workDate()) {
  const next = nextSegment(date);
  const time = clockTime();
  return next && (!time || time >= next.slot.slice(0, 5)) ? next : null;
}
function backupSummary(date) {
  const segments = segmentsOn(date);
  const open = date === workDate() ? activeSegment(date) : null;
  const waiting = date === workDate() && !open ? nextSegment(date) : null;
  const descriptions = segments.map(segment => {
    const remaining = segment.jobs.filter(job => stateFor(job) !== 'delivered').length;
    const state = !remaining ? '완료' : date !== workDate() ? '해당일에 열림' : open?.index === segment.index ? '현재 구간' : waiting?.index === segment.index ? '시작 시각 대기' : '이전 구간 완료 후 열림';
    return `<li><span>${segment.slot} · ${mapFor(segment).name} · ${segment.jobs.length}건</span><small>${state}</small></li>`;
  }).join('');
  return `<div class="backup-day"><strong>${date === workDate() ? '운행일' : '다음날'} ${dateLabel(date)}</strong>${descriptions ? `<ul>${descriptions}</ul>` : '<p>저장된 작업 없음</p>'}</div>`;
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function deliveryNumber(job) {
  // Keep stored job keys stable so older delivery records still match.
  return job.number ? `DAOS-${String(job.number).padStart(3, '0')}` : job.id;
}
function render() {
  displayedDate = workDate();
  const dayJobs = jobsOn(displayedDate);
  const segment = activeSegment(displayedDate);
  const waiting = segment ? null : nextSegment(displayedDate);
  const time = clockTime();
  const jobs = segment?.jobs ?? [];
  const completion = db.baseline ? null : completionFor(displayedDate);
  const archived = !dayJobs.length && expired(completion);
  const total = archived ? completion.total : dayJobs.length;
  const delivered = archived ? total : dayJobs.filter(item => stateFor(item) === 'delivered').length;
  const finished = total > 0 && delivered === total;
  const picked = hasPickup(displayedDate);
  const previewing = displayedDate !== dateKey();
  const previewLabel = '선택일';
  const job = jobs.find(item => item.key === selected) ?? jobs.find(item => stateFor(item) !== 'delivered');
  selected = job?.key ?? null;
  const offline = !connected;
  const blocked = offline && db.baseline;
  $('workspace').hidden = blocked;
  $('current-province').textContent = province;
  $('driver-hub-label').textContent = `${province} 허브`;
  $('workspace').classList.toggle('workspace-no-map', !dayJobs.length && !finished);
  $('map-card').hidden = finished || !dayJobs.length;
  $('completion').hidden = !finished;
  const cleanupNote = archived ? ' · 기기에서 완료 작업표를 삭제했습니다.'
    : !db.baseline && completion ? ' · 완료 6시간 후 작업표 자동 삭제' : '';
  $('completion-note').textContent = `${delivered}건 배송 완료${cleanupNote}`;
  $('blocked').hidden = !blocked;
  $('mode-daos').setAttribute('aria-pressed', String(!db.baseline));
  $('mode-baseline').setAttribute('aria-pressed', String(Boolean(db.baseline)));
  $('connection').dataset.offline = offline;
  $('connection').innerHTML = `<span class="dot"></span>${busy ? '연결 확인 중' : blocked ? '서버 연결 끊김' : offline ? '오프라인 모드' : '서버 연결됨'}`;
  $('reset').disabled = busy;
  $('status').dataset.offline = offline;
  let title, status;
  if (readError) {
    title = '기기 저장 오류';
    status = '작업 기록을 저장할 수 있는지 브라우저 설정을 확인해 주세요.';
  } else if (db.baseline) {
    title = blocked ? '기존 방식 · 작업표 조회 중단' : '기존 방식 · 서버에서 작업표 조회';
    status = blocked ? '서버 복구를 기다리는 중입니다.' : '운행일과 다음날 작업표를 서버에서 확인합니다.';
  } else if (!db.snapshot) {
    title = busy ? '작업표 내려받는 중' : '저장된 작업표 없음';
    status = '처음에는 연결 상태에서 운행일과 다음날 작업표를 받아야 합니다.';
  } else {
    title = offline ? '네트워크 또는 서버 연결 끊김' : '작업표 저장됨';
    const when = timeFormat.format(new Date(db.snapshot.at));
    status = offline ? `저장한 작업표를 사용합니다. 마지막 갱신 ${when}` : `운행일과 다음날 작업표 · 마지막 갱신 ${when}`;
  }
  const pending = db.baseline ? '' : db.pending.length ? `미동기화 기록 ${db.pending.length}건` : shellReady ? '오프라인 지도 준비됨' : '';
  $('status').innerHTML = `<span class="status-icon" aria-hidden="true">${offline ? '◈' : '✓'}</span><div class="status-text"><strong>${title}</strong> · ${status}</div><span class="sync-count${!db.baseline && db.pending.length ? ' pending-count' : ''}">${pending}</span>`;
  const first=DEMO_DATES.indexOf(displayedDate);
  const dates=DEMO_DATES.slice(first,first+2);
  const count = dates.filter(date => jobsOn(date).length).length;
  const summary = `<p class="storage-total"><strong>${count}일치</strong> 작업표가 이 기기에 저장됨</p><div class="backup-days">${dates.map(backupSummary).join('')}</div>`;
  $('storage-summary').innerHTML = db.baseline
    ? '<p class="storage-total"><strong>0일치</strong> · 기존 방식에서는 서버에서만 작업표를 조회합니다.</p>'
    : summary;
  $('preview-date').textContent = previewing ? '오늘로 돌아가기' : '다음날 작업 열기';
  $('preview-date').disabled = !previewing && !jobsOn(dateKey(1)).length;
  $('clock-reset').disabled = !previewing && !time;
  $('preview-banner').hidden = !previewing && !time;
  $('preview-banner').textContent = `시연 시간 · ${previewing ? previewLabel : '오늘'} ${dateLabel(displayedDate)}${time ? ` ${time}` : ''} · 한국시간`;
  $('work-title').textContent = previewing ? `${previewLabel} 배정된 작업 · 시연` : '오늘 배정된 작업';
  $('backup').hidden = !offline || db.baseline || !db.snapshot;
  $('backup').innerHTML = `<div class="backup-title"><h2>오프라인 작업표</h2><p>배송 순서와 시연 시각에 따라 저장된 작업을 이어갑니다.</p></div>${summary}`;
  $('pickup-summary').hidden = !dayJobs.length;
  $('pickup-summary').innerHTML = `<div><strong>하루치 일괄 집하</strong><p>${pickupPoint()} · 하루 물량 ${dayJobs.length}건</p></div>
    <button id="pickup-all" class="primary" type="button" ${picked || !segment || readError ? 'disabled' : ''}>${picked || !waiting && !segment ? '집하 완료' : '일괄 집하 완료 기록'}</button>`;
  $('pickup-all').addEventListener('click', recordPickup);
  const departure = $('segment-start');
  departure.hidden = !segment || segment.index === 0 || hasStarted(displayedDate, segment.index);
  departure.disabled = !picked || readError;
  departure.textContent = segment ? `${segment.index + 1}구간 배송 시작` : '';
  const handoff = waiting ?? (!departure.hidden ? segment : null);
  const activeMap = mapFor(segment ?? waiting);
  $('next-delivery').hidden = !handoff;
  if (handoff) {
    $('next-delivery-title').textContent = `다음 배송 권역은 ${activeMap.name}입니다`;
    $('next-delivery-time').textContent = `${handoff.slot} · ${handoff.jobs.length}건`;
  }
  const mapImage = $('map-image');
  if (!finished && mapImage.getAttribute('src') !== activeMap.file) {
    mapImage.src = activeMap.file;
    setZoom(1);
  }
  mapImage.alt = `${activeMap.title} · OpenStreetMap 건물과 도로`;
  const place=job&&!handoff&&stateFor(job)!=='delivered'?locationFor(job):null;
  $('delivery-pins').innerHTML=Number.isFinite(place?.x)&&Number.isFinite(place?.y)
    ? `<span class="delivery-pin selected" style="left:${place.x}%;top:${place.y}%" title="${escape(place.name)}">●<b>${escape(place.name)}</b></span>`
    : '';
  $('map-title').textContent = activeMap.title;
  $('viewport').setAttribute('aria-label', activeMap.title);
  $('work-date').textContent = `${previewing ? '선택일 시연' : '오늘'} ${dateLabel(displayedDate)} · ${segment ? `${segment.slot} · ${segment.index + 1}구간 ${activeMap.name} · ${offline ? '기기에 저장된 6시간 구간' : '6시간 배송 구간'}` : waiting ? `${waiting.slot.slice(0, 5)}부터 다음 구간 시작` : '현재 열려 있는 구간 없음'}`;
  $('progress').textContent = `하루 배송 ${delivered} / ${total}건 완료`;
  $('jobs').innerHTML = jobs.length ? jobs.map(item => {
    const state = stateFor(item);
    return `<button class="job" type="button" data-key="${escape(item.key)}" aria-pressed="${item.key === selected}">
      <span class="job-top"><small>${escape(deliveryNumber(item))}</small><span class="pill ${state}">${STATES[state]}</span></span>
      <strong>${escape(item.title)}</strong><span class="pair">배송지 · ${escape(locationFor(item).name)}</span>
      <span class="job-end">${escape(item.cargo)}</span>
    </button>`;
  }).join('') : `<p class="empty">${waiting ? `시연 시각을 ${waiting.slot.slice(0, 5)} 이후로 설정하면 다음 배송 구간을 열 수 있습니다.` : finished ? '이 날짜의 배송을 모두 마쳤습니다.' : '이 날짜에 받은 작업이 없습니다.'}</p>`;
  renderDeliveryDetail(handoff ? null : job);
  if (mobile) renderMobileAction(job, blocked);
}
function renderDeliveryDetail(job) {
  const detail = $('detail');
  detail.hidden = !job;
  if (!job) {
    detail.replaceChildren();
    return;
  }
  const drop = locationFor(job);
  const state = stateFor(job);
  const label = state === 'delivered' ? '배송 완료됨' : '배송 완료 기록';
  const hasPending = !db.baseline && db.pending.some(event => event.key === job.key);
  const note = state === 'ready' ? '하루치 일괄 집하를 기록하면 배송을 시작할 수 있습니다.'
    : hasPending ? '기기에 저장됨 · 서버 복구 시 동기화' : '인계 장소와 현장 안내를 확인하세요.';
  detail.innerHTML = `<div class="detail-title"><h3>${escape(job.title)}</h3><span>${escape(deliveryNumber(job))} · ${SEGMENTS[segmentFor(job)]}</span></div>
    <div class="stop"><small>배송지</small><b>${escape(drop.name)}${drop.building ? ` · ${escape(drop.building)}` : ''}</b><p>${escape(job.to)}</p></div>
    <div class="actions"><button id="record" class="primary" type="button" ${state !== 'picked' || readError ? 'disabled' : ''}>${label}</button><p>${note}</p></div>`;
  $('record').addEventListener('click', () => recordDelivery(job));
}
function pickupPoint() {
  return province===DEFAULT_PROVINCE?`${HUB.name} · ${HUB.building}`:`${province} 지역 허브`;
}
function renderMobileAction(job, blocked) {
  const candidates = [$('pickup-all'), $('segment-start'), $('record')];
  const action = blocked ? null : candidates.find(button => button && !button.disabled && !button.hidden && !button.closest('[hidden]'));
  $('mobile-actions').hidden = !action;
  document.documentElement.classList.toggle('has-mobile-action', Boolean(action));
  if (!action) return;
  const delivery = action.id === 'record';
  $('mobile-action-title').textContent = delivery ? locationFor(job).name : action.id === 'pickup-all' ? pickupPoint() : $('map-title').textContent;
  $('mobile-action-note').textContent = delivery ? deliveryNumber(job) : $('work-date').textContent;
  $('mobile-action').textContent = action.textContent;
  $('mobile-action').dataset.target = action.id;
}
$('mobile-action').addEventListener('click', () => {
  const action = $($('mobile-action').dataset.target);
  if (action && !action.disabled && !$('mobile-actions').hidden) action.click();
});
async function driverRequest(path, body) {
  const options = { cache:'no-store', signal:AbortSignal.timeout(3500) };
  if (body) {
    options.method = 'POST';
    options.headers = { 'Content-Type':'application/json' };
    options.body = JSON.stringify(body);
  }
  const native = window.webkit?.messageHandlers?.driverRequest;
  const url = new URL(`/api/driver${path}`,native?'https://daos.invalid':location.origin);
  url.searchParams.set('province',province);
  if(native){
    const reply=await native.postMessage({path:url.pathname+url.search,body:body??null});
    if(reply.status!==200)throw new Error('기사 서버 연결 끊김');
    return JSON.parse(reply.body);
  }
  const response = await fetch(url, options);
  if (response.status === 401 || response.status === 403 || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('기사 서버 로그인 필요');
  }
  if (!response.ok) throw new Error('기사 서버 연결 끊김');
  return response.json();
}
async function recordEvent(key, date, state, message) {
  // LAN previews can be opened before HTTPS is configured.
  const id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte=>byte.toString(16).padStart(2,'0')).join('')
    .replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
  const event = { id, key, date, state, at:new Date().toISOString(), epoch:db.resets?.[date]??0 };
  if (db.baseline) {
    if (!connected || busy) return;
    busy = true;
    render();
    try {
      const result = await driverRequest('/events', { mode:'baseline', events:[event] });
      if (result.acknowledged.includes(event.id)) {
        serverEvents = [...serverEvents, event];
        toast('서버에 작업 기록을 반영했습니다.');
      }
    } catch {
      connected = false;
    } finally {
      busy = false;
      render();
    }
    return;
  }
  const pending = [...db.pending, event];
  const completions = state === 'delivered' ? completedDays(jobsOn(date), [...db.confirmed, ...pending]) : db.completedDays;
  if (!save({ ...db, pending, completedDays:completions })) return render();
  toast(message);
  render();
  if (connected) void refresh();
}
function recordPickup() {
  const date = workDate();
  if (!activeSegment(date) || hasPickup(date) || readError) return render();
  recordEvent(pickupKey(date), date, 'picked', '하루 물량 일괄 집하를 기록했습니다.');
}
function recordDelivery(job) {
  if (job.date !== workDate() || stateFor(job) !== 'picked' || readError) return render();
  if (!activeSegment()?.jobs.some(item => item.key === job.key)) return render();
  selected = null;
  recordEvent(job.key, job.date, 'delivered', '배송 완료를 기기에 저장했습니다.');
}

async function refresh() {
  const removed = pruneExpired();
  if (busy) return;
  if (!navigator.onLine) {
    connected = false;
    if (removed || displayedDate !== workDate()) render();
    return;
  }
  busy = true;
  const mode = db.baseline ? 'baseline' : 'daos';
  const wasConnected = connected;
  let changed = false;
  try {
    const requestedDate=workDate();
    const { jobs, revision, events:remote, resets={}, resetRevision=0 } = await driverRequest(`?mode=${mode}&date=${requestedDate}`);
    if(resetRevision && resetRevision!==db.resetRevision){
      if(!save({...blank(),resets,resetRevision}))return;
      selected=null;
      serverJobs=[];
      serverEvents=[];
      updateClockControls();
      toast('전체 시연이 초기화됐습니다.');
      changed=true;
      if(mode==='baseline'||requestedDate!==workDate())return;
    }
    if(requestedDate!==workDate())return;
    const cleared = Object.keys(resets).filter(date=>resets[date] !== db.resets?.[date]);
    const keep = event=>!cleared.includes(event.date);
    if(cleared.length){
      const previous=Object.fromEntries(Object.entries(db.completedDays??{}).filter(([date])=>!cleared.includes(date)));
      const snapshot=db.snapshot?{...db.snapshot,jobs:db.snapshot.jobs.filter(job=>keep(job))}:null;
      if(!save({...db,resets,snapshot,pending:db.pending.filter(keep),confirmed:db.confirmed.filter(keep),completedDays:previous}))return;
      changed=true;
      toast('취소된 배차와 해당 날짜의 시연 기록을 초기화했습니다.');
    }
    if (mode === 'baseline') {
      changed = changed || JSON.stringify(serverJobs) !== JSON.stringify(jobs) || JSON.stringify(serverEvents) !== JSON.stringify(remote);
      serverJobs = jobs;
      serverEvents = remote;
      connected = true;
      return;
    }
    const batch = db.pending.slice(0,40);
    const result = batch.length ? await driverRequest('/events', { mode, events:batch }) : { acknowledged:[] };
    const acknowledged = new Set(result.acknowledged);
    const confirmed = [...new Map([...db.confirmed,...remote,...batch.filter(event => acknowledged.has(event.id))]
      .map(event => [event.id,event])).values()];
    const pending = db.pending.filter(event => !acknowledged.has(event.id));
    const completions = completedDays(jobs, [...confirmed,...pending]);
    const retain = (db.snapshot?.jobs ?? []).filter(job => job.date < dateKey() && completions[job.date]);
    const available = [...jobs,...retain].filter(job => !expired(completions[job.date]));
    changed = changed || !db.snapshot || db.snapshot.revision !== revision
      || db.snapshot.date !== requestedDate || pending.length !== db.pending.length
      || confirmed.length !== db.confirmed.length;
    if (changed && !save({ ...db, resets, snapshot:{ at:new Date().toISOString(), date:requestedDate, revision, jobs:available },
      pending, confirmed, completedDays:completions })) return;
    connected = true;
    if (revision && db.snapshot.receipt !== revision) {
      await driverRequest('/receipt', { revision });
      save({ ...db, snapshot:{ ...db.snapshot, receipt:revision } });
    }
    if (acknowledged.size) toast(`배송 기록 ${acknowledged.size}건을 서버에 동기화했습니다.`);
  } catch {
    connected = false;
  } finally {
    busy = false;
    if (removed || displayedDate !== workDate() || wasConnected !== connected || changed) render();
  }
}
$('jobs').addEventListener('click', event => {
  const button = event.target.closest('button[data-key]');
  if (!button) return;
  selected = button.dataset.key;
  render();
  $('jobs').querySelector('[aria-pressed=true]')?.focus();
  if (mobile) $('map-card').scrollIntoView({ block:'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
$('segment-start').addEventListener('click', () => {
  const date = workDate();
  const segment = activeSegment(date);
  if (!segment || !hasPickup(date) || hasStarted(date, segment.index) || readError) return render();
  recordEvent(startKey(date, segment.index), date, 'started', `${segment.index + 1}구간 배송을 시작했습니다.`);
});
function setMode(baseline) {
  if (busy || Boolean(db.baseline) === baseline) return;
  if (!save({ ...db, baseline })) return;
  selected = null;
  render();
  void refresh();
}
$('mode-daos').addEventListener('click', () => setMode(false));
$('mode-baseline').addEventListener('click', () => setMode(true));
function updateClockControls() {
  $('clock-day').value = String(DEMO_DATES.indexOf(workDate()));
  $('clock-time').value = clockTime() ?? '06:00';
}
function setClock(date, time) {
  if (!save({ ...db, demoDate: date, demoTime: time })) return;
  selected = null;
  updateClockControls();
  render();
  void refresh();
}
$('demo-clock').addEventListener('submit', event => {
  event.preventDefault();
  setClock(dateKey(Number($('clock-day').value)), $('clock-time').value);
});
$('clock-reset').addEventListener('click', () => setClock(null, null));
$('preview-date').addEventListener('click', () => {
  const tomorrow = dateKey(1);
  if (workDate() !== dateKey()) setClock(null, null);
  else if (jobsOn(tomorrow).length) setClock(tomorrow, null);
});
$('driver-province').addEventListener('change', () => {
  if (busy) { $('driver-province').value=province; return; }
  province=$('driver-province').value;
  try{localStorage.setItem(`${KEY_BASE}.province`,province)}catch{}
  loadProvince();
  connected=false;
  serverJobs=[];
  serverEvents=[];
  selected=null;
  updateClockControls();
  render();
  void refresh();
});
$('settings').addEventListener('click', () => {
  const panel = $('demo-panel');
  panel.hidden = !panel.hidden;
  $('settings').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) updateClockControls();
});
$('reset').addEventListener('click', () => {
  if (!confirm('이 기기에 저장된 작업표와 미전송 기록을 지울까요?')) return;
  if (busy || !save(blank())) return;
  updateClockControls();
  connected = false;
  selected = null;
  void refresh();
});
window.addEventListener('offline', () => { connected = false; render(); });
window.addEventListener('online', refresh);
window.addEventListener('storage', event => {
  if (event.key !== keyForProvince()) return;
  try {
    db = event.newValue ? JSON.parse(event.newValue) : blank();
    render();
  } catch {
    readError = true;
    render();
  }
});
setInterval(refresh, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });

const viewport = $('viewport');
const scene = $('scene');
let zoom = 1, x = 0, y = 0, drag;
function updateView() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  const aspect = 1080 / 504;
  const baseWidth = Math.min(w, h * aspect);
  const maxX = Math.max(0, (baseWidth * zoom - w) / 2);
  const maxY = Math.max(0, (baseWidth * zoom / aspect - h) / 2);
  x = Math.max(-maxX, Math.min(maxX, x));
  y = Math.max(-maxY, Math.min(maxY, y));
  scene.style.width = `${baseWidth}px`;
  scene.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom})`;
  viewport.classList.toggle('zoomed', zoom > 1);
  $('zoom-out').disabled = zoom === 1;
  $('zoom-in').disabled = zoom === 4;
}
function setZoom(next) { zoom = Math.min(4, Math.max(1, next)); updateView(); }
$('zoom-in').addEventListener('click', () => setZoom(zoom + .5));
$('zoom-out').addEventListener('click', () => setZoom(zoom - .5));
$('zoom-reset').addEventListener('click', () => setZoom(1));
viewport.addEventListener('pointerdown', event => {
  if (zoom === 1 || event.target.closest('button') || event.button !== 0) return;
  drag = { id: event.pointerId, px: event.clientX, py: event.clientY, x, y };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  x = drag.x + event.clientX - drag.px;
  y = drag.y + event.clientY - drag.py;
  updateView();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  viewport.addEventListener(name, () => { drag = null; viewport.classList.remove('dragging'); });
}
new ResizeObserver(updateView).observe(viewport);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready)
    .then(() => { shellReady = true; render(); }).catch(() => {});
}
updateView();
void refresh();
