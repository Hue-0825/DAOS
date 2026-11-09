import {STAGES,Warehouse,timeSlot} from './warehouse-engine.mjs';
import {createScene} from './warehouse-scene.mjs';

const $ = id => document.getElementById(id);
const canvas = $('warehouse');
const scene = createScene(canvas);
const area = $('province');
const sims = new Map();
const getSim = province => {
  if(!sims.has(province)) sims.set(province,new Warehouse());
  return sims.get(province);
};
let selected = 'UL-01';
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let fetching = false;
let accessError = false;
let revision = null;
let lastPaint = 0;

const fleetRows = getSim(area.value).robots.map(robot => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'robot-row';
  const role = STAGES[robot.stage];
  button.style.setProperty('--robot',role.color);
  button.innerHTML = '<i></i><b></b><em></em>';
  button.children[1].textContent = `${robot.id} · ${role.label}`;
  button.addEventListener('click',() => {selected=robot.id; paint();});
  $('fleet').append(button);
  return button;
});
const stages = STAGES.map(role => {
  const legend=document.createElement('span');
  legend.innerHTML='<i></i>';
  legend.style.setProperty('--robot',role.color);
  legend.append(`${role.label} ${role.count}대`);
  $('legend').append(legend);
  const item=document.createElement('div');
  const label=document.createElement('span');
  label.textContent=role.label;
  const count=document.createElement('strong');
  item.append(label,count);
  $('pipeline').append(item);
  return count;
});

function state(robot) {
  if(robot.job) return robot.next ? (robot.fetching?'인수 위치로 이동':'작업 위치로 이동') :
    robot.work>0 && robot.cell.every((v,i)=>v===robot.target[i]) ? '작업 중' : '통행 대기';
  return robot.cell===robot.home || robot.cell.every((v,i)=>v===robot.home[i]) ? '대기' : '대기 위치 복귀';
}
function set(id,text) {
  if($(id).textContent!==text) $(id).textContent=text;
}
let visibleEvent;
function paint() {
  const sim=getSim(area.value);
  const rows=[...sim.jobs.values()].filter(job=>!job.withdrawn);
  const today=rows.filter(job=>job.date===sim.clock?.date);
  const active=today.filter(job=>sim.eligible(job));
  const needsDispatch=active.filter(job=>job.stage===3&&job.dispatch==null).length;
  const savedTomorrow=rows.length-today.length;
  const online=sim.mode==='online';
  const clock=sim.clock;
  $('mode').dataset.mode=sim.mode;
  set('mode',accessError?'접근 권한 필요':online?'● 연결됨':sim.mode==='offline'?'● 연결 끊김':'확인 중');
  set('clock',clock?`${clock.date.slice(5)} ${clock.time}`:'—');
  set('today',`${today.length}건`);
  set('tomorrow',`${savedTomorrow}건`);
  set('completed',`${today.filter(job=>job.stage===STAGES.length).length}건`);
  set('pending',online?`복구 합산 ${sim.synced}건`:`대기 ${sim.pending}건`);
  set('active',`이동 및 작업 ${sim.robots.filter(robot=>robot.job||robot.next).length} / ${sim.robots.length}대`);
  set('notice',accessError?'메인 관제센터의 공유 링크로 접근 권한을 활성화한 뒤 이 화면을 다시 열어 주세요.' :
    !clock?'DAOS 메인 서버에서 작업표를 확인하고 있습니다.' :
    !online&&!rows.length?'이 화면에 보관된 작업표가 없습니다. 메인 관제센터에서 연결을 복구해 주세요.' :
    !online?`비상 운전 · 저장된 당일 작업만 처리합니다. 허브 배차 대기 ${needsDispatch}건` :
    !today.length?'선택한 허브에 전송된 당일 작업표가 없습니다.' :
    timeSlot(clock.time)<0?'당일 첫 작업은 시연 시각 06:00부터 시작합니다.' :
    `작업 가능 ${active.length}건 · 허브 배차 대기 ${needsDispatch}건 · 다음날 작업은 날짜가 바뀌면 열립니다.`);
  stages.forEach((node,index) => {
    const count=active.filter(job=>job.stage===index).length;
    const label=`${count}건`;
    if(node.textContent!==label) node.textContent=label;
  });
  sim.robots.forEach((robot,index)=>{
    const button=fleetRows[index], label=state(robot);
    button.setAttribute('aria-pressed',String(selected===robot.id));
    if(button.children[2].textContent!==label) button.children[2].textContent=label;
  });
  const robot=sim.robots.find(item=>item.id===selected);
  const role=STAGES[robot.stage];
  set('robot-name',`${robot.id} · ${role.label}`);
  set('robot-rule',role.rule);
  set('robot-note',`${state(robot)} · 공정 완료 ${robot.done}건`);
  set('robot-task',robot.job?`${robot.job.product} ${robot.job.quantity}개 · 작업대 ${robot.job.segment+1}`:'현재 배정된 상자 없음');
  if(visibleEvent!==sim.events[0]){
    visibleEvent=sim.events[0];
    $('events').replaceChildren(...sim.events.map(event=>{
      const item=document.createElement('li');
      const time=document.createElement('time');
      const who=document.createElement('b');
      const message=document.createElement('span');
      time.textContent=event.at;who.textContent=event.actor;message.textContent=event.text;
      if(event.local)message.className='local';
      item.append(time,who,message);
      return item;
    }));
  }
}

async function refresh() {
  if(fetching)return;
  fetching=true;
  const province=area.value;
  try{
    const response=await fetch(`/api/central/warehouse?province=${encodeURIComponent(province)}`,
      {cache:'no-store',signal:AbortSignal.timeout(3500)});
    if(response.status===401||response.status===403){
      accessError=true;
      sims.clear();
      return;
    }
    if(!response.ok)throw Error('작업표 조회 실패');
    const snapshot=await response.json();
    accessError=false;
    if(revision!==null&&revision!==snapshot.resetRevision) sims.clear();
    revision=snapshot.resetRevision;
    if(area.options.length===1){
      for(const name of snapshot.provinces.filter(name=>name!==province)) area.add(new Option(name,name));
    }
    if(!snapshot.online){
      for(const sim of sims.values())sim.snapshot(snapshot);
    }
    getSim(province).snapshot(snapshot);
  }catch{
    for(const sim of sims.values())sim.disconnect();
  }finally{
    fetching=false;
    paint();
    if(province!==area.value) void refresh();
  }
}

function toggleText(){$('pause').textContent=paused?'계속 실행':'일시정지';}
toggleText();
$('pause').addEventListener('click',()=>{paused=!paused;toggleText();});
area.addEventListener('change',()=>{paint();void refresh();});
canvas.addEventListener('click',event=>{
  const robot=scene.pick(event,getSim(area.value).robots);
  if(robot){selected=robot;paint();}
});
let previous=performance.now();
function animate(now) {
  const sim=getSim(area.value);
  if(!paused)sim.tick(Math.min((now-previous)/1000,.06));
  previous=now;
  if(now-lastPaint>180){lastPaint=now;paint();}
  scene.draw(sim,selected);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
void refresh();
setInterval(refresh,2400);
