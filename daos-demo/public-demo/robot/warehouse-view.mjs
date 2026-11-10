import {BATCH,STAGES,Warehouse,BACKUP_LIFETIME_MS} from './warehouse-engine.mjs?v=5';
import {createScene} from './warehouse-scene.mjs?v=5';

const $=id=>document.getElementById(id);
const canvas=$('warehouse');
const scene=createScene(canvas);
let sim=new Warehouse();
let selected='UL-01';
const prefersReducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=prefersReducedMotion;
let lastPaint=0;
let visibleEvent;
const INCIDENTS={
  online:['✓','서버 연결 · 공동 작업 중','20대가 같은 출고 배치의 작업표를 공유합니다. 공정을 마친 상자는 다음 로봇에게 인계합니다.'],
  backup:['↻','현장 자율운전 · 로봇 간 인계 계속','받아 둔 작업표로 이어서 처리합니다. 지도에는 각 로봇이 수행 중인 공정과 대기 상태를 표시합니다.'],
  stopped:['■','안전 정지 · DAOS 꺼짐','현재 위치에서 대기합니다. 서버를 복구하거나 DAOS를 켜면 조건에 따라 작업을 이어갑니다.'],
  waiting:['…','백업 작업표 미수신','서버를 복구한 뒤 오른쪽 위에서 백업 작업표를 전송해 주세요.'],
  expired:['■','백업 작업표 만료 · 안전 정지','예약한 이동 칸까지만 도달한 뒤 대기합니다. 연결 복구 후 기록을 대조합니다.'],
  drained:['✓','현장 작업표 처리 완료','저장한 물량의 상차를 마쳤습니다. 다음 작업표를 받으려면 연결을 복구해 주세요.'],
};
function set(id,text){if($(id).textContent!==text)$(id).textContent=text;}
const fleetRows=sim.robots.map(robot=>{
  const button=document.createElement('button');
  const role=STAGES[robot.stage];
  button.type='button';
  button.className='robot-row';
  button.style.setProperty('--robot',role.color);
  button.innerHTML='<i></i><b></b><em></em>';
  button.children[1].textContent=`${robot.id} · ${role.label}`;
  button.addEventListener('click',()=>{selected=robot.id;paint();});
  $('fleet').append(button);
  return button;
});
const stages=STAGES.map(role=>{
  const legend=document.createElement('span');
  legend.innerHTML='<i></i>';
  legend.style.setProperty('--robot',role.color);
  legend.append(`${role.label} ${role.count}대`);
  $('legend').append(legend);
  const item=document.createElement('div'),label=document.createElement('span'),count=document.createElement('strong');
  label.textContent=role.label;
  item.append(label,count);
  $('pipeline').append(item);
  return count;
});

function paint(){
  const online=sim.mode==='online',phase=sim.offlinePhase()??'online';
  const alarm=sim.alarmActive();
  const [icon,title,detail]=alarm
    ? ['!',phase==='backup'?'서버 장애 감지 · 백업 운전 계속':'서버 장애 감지',INCIDENTS[phase][2]]
    : INCIDENTS[phase];
  const jobs=[...sim.jobs.values()],finished=jobs.filter(job=>job.stage===STAGES.length).length;
  const connection=$('connection');
  $('mode').dataset.mode=sim.mode;
  $('incident').dataset.phase=alarm?'alert':phase;
  $('send-backup').disabled=!online;
  $('scan-mismatch').hidden=phase!=='backup';
  $('audit-result').hidden=!sim.audit;
  if(sim.audit)set('audit-result',`복구 3중 대조 · 일치 ${sim.audit.verified}개 / 확인 보류 ${sim.audit.held}개 · 운전 세대 ${sim.epoch}`);
  $('daos-switch').setAttribute('aria-checked',String(sim.daosEnabled));
  connection.dataset.recover=String(!online);
  set('daos-value',sim.daosEnabled?'ON':'OFF');
  set('pause',paused?'계속 실행':'일시정지');
  set('connection',online?'시연 서버 연결 끊기':'시연 서버 연결 복구');
  set('mode',online?'시연 서버 연결됨':'시연 서버 연결 끊김');
  set('incident-icon',icon);
  set('incident-title',title);
  set('incident-detail',detail);
  set('drive-mode',{online:'정상 운전',backup:'현장 자율운전',stopped:'안전 정지',waiting:'백업 대기',expired:'유효기간 만료',drained:'작업 완료'}[phase]);
  set('batch',BATCH);
  set('total',`${jobs.length-finished}개 남음`);
  const remaining=Math.max(0,Math.ceil((sim.backupAt+BACKUP_LIFETIME_MS-Date.now())/1000));
  set('backup',sim.backupAt===null?'미전송':`${sim.backupRemaining}개 · ${remaining}초`);
  set('completed',`${finished} / ${jobs.length}개`);
  set('pending',online?`복구 합산 ${sim.synced}건`:`복구 대기 ${sim.pending}건`);
  const moving=!paused&&(online||phase==='backup')?sim.robots.filter(robot=>robot.next||robot.job).length:0;
  set('active',`이동 및 작업 ${moving} / ${sim.robots.length}대`);
  const handoffs=[...sim.buffers()].reduce((total,buffer)=>total+buffer.count,0);
  set('notice',`출고 배치 ${BATCH} · 공정 간 인계 대기 ${handoffs}개 · 지도에서 로봇을 누르면 맡은 상자를 확인할 수 있습니다.`);
  stages.forEach((node,index)=>{
    const total=jobs.filter(job=>job.stage===index).length;
    const busy=sim.robots.filter(robot=>robot.stage===index&&robot.job).length;
    const label=`${total}개 · 배정 ${busy}대`;
    if(node.textContent!==label)node.textContent=label;
  });
  sim.robots.forEach((robot,index)=>{
    const button=fleetRows[index],label=sim.robotStatus(robot,phase);
    button.setAttribute('aria-pressed',String(selected===robot.id));
    if(button.children[2].textContent!==label)button.children[2].textContent=label;
  });
  const robot=sim.robots.find(item=>item.id===selected),role=STAGES[robot.stage];
  set('robot-name',`${robot.id} · ${role.label}`);
  set('robot-rule',role.rule);
  set('robot-note',`${sim.robotStatus(robot,phase)} · 공정 완료 ${robot.done}개`);
  set('robot-task',robot.job?`상자 ${robot.job.id} · 출고 도크 ${robot.job.segment+1}`:'다음 상자 인계 대기');
  if(visibleEvent!==sim.events[0]){
    visibleEvent=sim.events[0];
    $('events').replaceChildren(...sim.events.map(event=>{
      const item=document.createElement('li'),time=document.createElement('time'),who=document.createElement('b'),message=document.createElement('span');
      time.textContent=event.at;who.textContent=event.actor;message.textContent=event.text;
      if(event.local)message.className='local';
      item.append(time,who,message);
      return item;
    }));
  }
}

$('send-backup').addEventListener('click',()=>{
  if(sim.sendBackup()){
    set('backup-result',`현장 작업표 전송 완료 · 상자 ${sim.backup.size}개 · 시연 유효시간 ${BACKUP_LIFETIME_MS/1000}초`);
    paint();
  }
});
$('scan-mismatch').addEventListener('click',()=>{
  const injected=sim.injectScanMismatch();
  set('backup-result',injected?'가상 스캔 불일치를 만들었습니다. 연결을 복구하면 해당 상자가 보류됩니다.':'완료된 인계 기록이 생긴 뒤 스캔 오류를 재현할 수 있습니다.');
  paint();
});
$('daos-switch').addEventListener('click',()=>{sim.setDaos(!sim.daosEnabled);paint();});
$('connection').addEventListener('click',()=>{
  if(sim.mode==='online')sim.disconnect();
  else {sim.restore();set('backup-result','연결 복구 · 현장 작업표 자동 갱신 중');}
  paint();
});
$('pause').addEventListener('click',()=>{paused=!paused;paint();});
$('reset').addEventListener('click',()=>{
  sim=new Warehouse();
  paused=prefersReducedMotion;
  set('backup-result','현장 작업표 자동 갱신 중');
  paint();
});
canvas.addEventListener('click',event=>{
  const robot=scene.pick(event,sim.robots);
  if(robot){selected=robot;paint();}
});
let previous=performance.now();
function animate(now){
  const wall=Date.now();
  sim.maintainBackup(wall);
  sim.updateOutage(wall);
  if(!paused)sim.tick(Math.min((now-previous)/1000,.06),wall);
  previous=now;
  if(now-lastPaint>180){lastPaint=now;paint();}
  scene.draw(sim,selected);
  requestAnimationFrame(animate);
}
paint();
requestAnimationFrame(animate);
