import {BATCH,STAGES,Warehouse,BACKUP_LIFETIME_MS} from './warehouse-engine.mjs?v=26';
import {createScene} from './warehouse-scene.mjs?v=29';

const $=id=>document.getElementById(id);
const canvas=$('warehouse');
const scene=createScene(canvas);
let sim=new Warehouse(Date.now(),{compact:true});
let selected='UL-01';
const prefersReducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=prefersReducedMotion;
let lastPaint=0;
let visibleEvent;
const INCIDENTS={
  recovering:['Ⅱ','서버 복구 감지 · 1초 안전 정지','로봇을 멈춘 뒤 서버·현장 기록을 대조합니다. 확인된 작업부터 메인 시스템 운전을 재개합니다.'],
  online:['✓','서버 연결 · 공동 작업 중','로봇 18대와 컨베이어 6대가 같은 작업표를 공유합니다. 공정을 마친 상자는 다음 로봇에게 인계합니다.'],
  handover:['!','서버 장애 감지 · 1초 전환 중','현재 위치에서 잠시 대기하며 받은 작업표와 구역 점유권을 확인합니다.'],
  backup:['DAOS','DAOS 가동 중 · 백업 데이터로 작업 계속','서버가 끊기기 전에 저장한 작업표와 구역 점유권으로 상자 운반과 인계를 이어갑니다.'],
  stopped:['■','안전 정지 · DAOS 꺼짐','현재 위치에서 대기합니다. 서버를 복구하거나 DAOS를 켜면 조건에 따라 작업을 이어갑니다.'],
  waiting:['…','백업 작업표 미수신','서버를 복구한 뒤 오른쪽 위에서 백업 작업표를 전송해 주세요.'],
  expired:['■','백업 작업표 만료 · 안전 정지','만료 전 권한과 통로가 확보된 로봇은 통로를 비웁니다. 만료 뒤에는 정지하고 복구를 기다립니다.'],
  drained:['✓','현장 작업표 처리 완료','저장한 물량의 상차를 마쳤습니다. 다음 작업표를 받으려면 연결을 복구해 주세요.'],
};
const WORK_SOURCES={
  recovering:'서버 연결 감지 · 메인 전환 대기',
  online:'중앙 서버 작업표 사용 중',
  handover:'서버 끊김 · 백업 확인 중',
  backup:'DAOS 가동 · 백업 데이터 사용 중',
  stopped:'DAOS 꺼짐 · 안전 정지',
  waiting:'백업 데이터 대기 중',
  expired:'백업 데이터 만료',
  drained:'백업 작업 완료',
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
const edgeRows=sim.edges.map(edge=>{
  const node=document.createElement('li');
  $('edge-layer').append(node);
  return node;
});
const stages=STAGES.map(role=>{
  const legend=document.createElement('span');
  legend.innerHTML='<i></i>';
  legend.style.setProperty('--robot',role.color);
  legend.append(`${role.design} ${role.count}대`);
  $('legend').append(legend);
  const item=document.createElement('div'),label=document.createElement('span'),count=document.createElement('strong');
  label.textContent=role.label;
  item.append(label,count);
  $('pipeline').append(item);
  return count;
});

const modes={online:'정상 운전',outage:'장애·대기',backup:'DAOS 운전',recovering:'복구 전환'};
const modeColors={online:'var(--timeline-online)',outage:'var(--timeline-outage)',backup:'var(--timeline-backup)',recovering:'var(--timeline-recovering)'};
const TIMELINE_REFERENCE_MS=60_000;
const EMPTY_ARC_COLOR='#e6e3ef';
let timelineFinishedAt=null;
let pausedAt=paused?sim.startedAt:null;
let pausedDuration=0;
let centralOnline=null;
let localOutage=false;
let centralChecked=false;
let centralReachable=false;
let lastCentralPoll=-Infinity;
let centralRequest=false;
function demoNow(wall=Date.now()){
  return (pausedAt??wall)-pausedDuration;
}
let timelineSession=null;
let timelineSize=-1;

function elapsedLabel(ms,precise=false){
  const seconds=Math.max(0,Math.floor(ms/1000));
  const stamp=[Math.floor(seconds/60),seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
  return precise?`${stamp}.${Math.floor(Math.max(0,ms)%1000/100)}`:stamp;
}

function paintOverview(finished,total){
  if(timelineSession!==sim||finished<total)timelineFinishedAt=null;
  const wall=demoNow();
  if(finished===total&&timelineFinishedAt===null)timelineFinishedAt=wall;
  const now=timelineFinishedAt??wall;
  const elapsed=Math.max(0,now-sim.startedAt);
  const fill=timelineFinishedAt!==null?100:Math.min(98,elapsed/TIMELINE_REFERENCE_MS*100);
  const mode=sim.operatingMode;
  const overview=$('overview-mode');
  overview.dataset.mode=mode;
  set('overview-mode',paused?'일시정지':modes[mode]);
  set('shipment-percent',`${Math.floor(finished/total*100)}%`);
  $('shipment-progress').max=total;
  $('shipment-progress').value=finished;
  set('shipment-count',`${finished} / ${total}개 상차 완료`);
  set('run-elapsed',elapsedLabel(elapsed));
  const timeline=$('mode-timeline');
  const transitions=[{now:sim.startedAt,mode:'online'},...sim.specialEvents.filter(event=>event.mode&&event.now<=now)];
  if(timelineSession!==sim||timelineSize!==sim.specialEvents.length){
    timelineSession=sim;
    timelineSize=sim.specialEvents.length;
    $('special-empty').hidden=timelineSize>0;
    $('special-events').replaceChildren(...sim.specialEvents.slice().reverse().map(event=>{
      const row=document.createElement('li');
      row.dataset.kind=event.kind;
      const time=document.createElement('time');
      time.dateTime=new Date(event.now).toISOString();
      time.textContent=`+${elapsedLabel(Math.max(0,event.now-sim.startedAt),true)}`;
      time.title='일시정지를 제외한 시연 경과 시간';
      const body=document.createElement('div'), title=document.createElement('strong'), detail=document.createElement('p');
      title.textContent=event.title;
      detail.textContent=event.detail;
      body.append(title,detail);
      row.append(time,body);
      return row;
    }));
  }
  const stops=[], descriptions=[];
  transitions.forEach((event,index)=>{
    const end=transitions[index+1]?.now??now;
    const startElapsed=Math.max(0,event.now-sim.startedAt);
    const endElapsed=Math.max(0,end-sim.startedAt);
    if(endElapsed<=startElapsed)return;
    const startAngle=startElapsed/Math.max(elapsed,1)*fill;
    const endAngle=endElapsed/Math.max(elapsed,1)*fill;
    stops.push(`${modeColors[event.mode]} ${startAngle}% ${endAngle}%`);
    descriptions.push(`${modes[event.mode]} ${elapsedLabel(Math.max(0,event.now-sim.startedAt),true)} ~ ${elapsedLabel(endElapsed,true)}`);
  });
  if(fill<100)stops.push(`${EMPTY_ARC_COLOR} ${fill}% 100%`);
  timeline.style.background=`conic-gradient(${stops.join(', ')})`;
  const summary=[timelineFinishedAt===null?'시연 진행 중':'전체 상차 완료',...descriptions].join(', ');
  timeline.setAttribute('aria-label',summary);
  timeline.title=summary;
}

const positionNames={station:'작업대',conveyor:'컨베이어',robot:'운반 로봇',arm:'로봇팔',shipped:'상차 완료'};
const stageName=stage=>STAGES[stage]?.label??'상차 완료';
let renderedComparison;

function describePosition(position){
  if(!position)return '중앙 위치 기록 없음';
  const coordinates=position.coordinates?.map(value=>Number(value).toFixed(2)).join(', ');
  return [position.holder??positionNames[position.kind],coordinates&&`(${coordinates})`,stageName(position.stage)].filter(Boolean).join(' · ');
}

function paintPositionComparison(){
  if($('position-comparison').hidden)return;
  const audit=sim.audit;
  $('position-comparison-table').hidden=!audit;
  if(!audit){
    set('position-comparison-times','');
    set('position-comparison-note',sim.mode==='recovering'?'전환 위치와 로그를 대조 중입니다.':
      '서버를 끊었다가 복구하면 상자별 위치와 대조 결과가 표시됩니다.');
    return;
  }
  const stamp=at=>elapsedLabel(Math.max(0,at-sim.startedAt),true);
  const unchanged=audit.comparison.filter(row=>row.result==='unchanged').length;
  const allHeld=audit.comparison.filter(row=>row.result==='held').length;
  set('position-comparison-note',`에폭 ${audit.epoch} · 상자 ${audit.received}개 · 대조 통과 ${audit.verified}개 · 변경 없음 ${unchanged}개 · 보류 ${allHeld}개`);
  set('position-comparison-times',`시연 경과 시간 · 중앙 장애 +${stamp(audit.centralCapturedAt)} → 전환 위치 저장 +${stamp(audit.capturedAt)} → 대조 완료 +${stamp(audit.completedAt)}`);
  if(renderedComparison===audit)return;
  renderedComparison=audit;
  const cells=audit.comparison.map(({id,central,position,logs,result,reason})=>{
    const row=document.createElement('tr');
    const heading=document.createElement('th');
    heading.scope='row';heading.textContent=id;row.append(heading);
    const cell=(...lines)=>{
      const td=document.createElement('td');
      for(const line of lines){
        const item=document.createElement('div');item.textContent=line;td.append(item);
      }
      row.append(td);
      return td;
    };
    cell(describePosition(central));
    cell(...(logs.length?logs.map(log=>`${log.node} #${log.sequence} · (${log.location}) · ${log.edge} ${log.replicated?'복제 확인':'복제 누락·불일치'}`):['장애 중 완료 로그 없음']));
    const scan=position.scan?.location;
    cell(describePosition(position),scan==='SCAN-MISMATCH'?'스캔 위치 불일치':scan?`마지막 스캔 지점 (${scan})`:'스캔 좌표 기록 없음');
    const outcome=cell({held:'확인 보류',matched:'일치 · 운전 재개',unchanged:'변경 없음'}[result],reason);
    outcome.dataset.result=result;
    return row;
  });
  $('position-comparison-rows').replaceChildren(...cells);
}

function paint(){
  const now=demoNow();
  const online=sim.mode==='online',phase=sim.offlinePhase(now)??'online';
  const alarm=sim.alarmActive(now);
  const manualStop=online&&paused&&!sim.daosEnabled;
  const warningStop=phase==='stopped'||manualStop;
  const recoveryStatus={
    stop:['Ⅱ','전환 시점 위치 확보','로봇과 컨베이어를 멈추고 현재 상자 위치를 저장했습니다. 1초 정지 후 중앙으로 전송합니다.'],
    positions:['↑','전환 시점 위치 전송 중',`상자 ${sim.positionPacket?.positions.size??0}개의 위치를 메인 서버로 보내고 있습니다.`],
    reconcile:['✓','메인 서버 위치 수신 완료',`위치가 달라진 상자 ${sim.positionPacket?.changed.length??0}개를 확인했습니다. 작업 이력을 대조한 뒤 재개합니다.`],
  };
  const [icon,title,detail]=manualStop
    ?['Ⅱ','일시정지 · DAOS 꺼짐','로봇과 컨베이어가 멈췄습니다. 계속 실행을 누르면 시연을 재개합니다.']
    :phase==='recovering'?recoveryStatus[sim.recoveryPhase]:INCIDENTS[phase];
  const jobs=[...sim.jobs.values()],finished=jobs.filter(job=>job.stage===STAGES.length&&!job.auditHold).length;
  paintOverview(finished,jobs.length);
  paintPositionComparison();
  const connection=$('connection');
  $('mode').dataset.mode=sim.mode;
  $('incident').dataset.phase=warningStop?'stopped':alarm?'alert':phase;
  $('work-source').dataset.phase=warningStop?'stopped':phase;
  $('stop-warning').hidden=!warningStop;
  set('work-source',manualStop?'DAOS 꺼짐 · 일시정지':phase==='recovering'?title:WORK_SOURCES[phase]);
  $('send-backup').disabled=!online;
  const packet=sim.positionPacket;
  $('position-transfer').hidden=!packet?.received;
  if(packet?.received&&$('position-transfer').open){
    const samples=(packet.changed.length?packet.changed:[...packet.positions]).slice(0,5);
    const kinds={station:'작업대',conveyor:'컨베이어',robot:'운반 중',arm:'로봇팔 공정',shipped:'상차 완료'};
    set('position-transfer-sample',samples.map(([id,position])=>
      [id,kinds[position.kind],position.holder,position.coordinates?.join(', ')].filter(Boolean).join(' · ')).join('\n'));
  }
  $('audit-result').hidden=!online||!sim.audit;
  if(online&&sim.audit)set('audit-result',`전환 위치 ${sim.audit.received}개 수신 · ${sim.audit.changed}개 변경 · 3중 대조 일치 ${sim.audit.verified}개 / 확인 보류 ${sim.audit.held}개 · 엣지 복제 ${sim.audit.replicated}건 · 운전 세대 ${sim.epoch}`);
  const {online:normal,offline:backupRun,switchMs}=sim.kpi;
  const ratio=normal.stages>0&&backupRun.seconds>0
    ?Math.round((backupRun.stages/backupRun.seconds)/(normal.stages/normal.seconds)*100):null;
  set('kpi-continue',ratio===null?'비교 표본 대기':`정상 대비 ${ratio}% · 장애 중 ${backupRun.stages}공정`);
  set('kpi-switch',switchMs===null?'장애 시 측정':`${(switchMs/1000).toFixed(2)}초`);
  const checks=sim.audit?.checks;
  set('kpi-audit',checks?`${sim.audit.held}개 / ${checks.duplicates}건`:'복구 시 측정');
  const auditPending=phase==='recovering';
  const auditStatus=auditPending?(sim.recoveryPhase==='reconcile'?'대조 중':'위치 수신 대기'):'대기';
  set('audit-ids',`이벤트 ID와 중복 검사 · ${!auditPending&&checks?`${checks.ids}/${checks.candidates}개 통과 · 중복 ${checks.duplicates}건`:auditStatus}`);
  set('audit-chain',`선행 공정과 엣지 기록 대조 · ${!auditPending&&checks?`${checks.chain}/${checks.ids}개 통과`:auditStatus}`);
  set('audit-scan',`전환 시점 위치와 스캔 대조 · ${!auditPending&&checks?`${checks.scans}/${checks.chain}개 통과`:auditStatus}`);
  $('daos-switch').setAttribute('aria-checked',String(sim.daosEnabled));
  connection.dataset.recover=String(sim.mode==='offline');
  set('daos-value',sim.daosEnabled?'ON':'OFF');
  set('pause',paused?'계속 실행':'일시정지');
  connection.disabled=centralOnline===false;
  set('connection',centralOnline===false?'메인 관제센터에서 연결 복구':localOutage?'시연 서버 연결 복구':'시연 서버 연결 끊기');
  set('central-connection-status',centralOnline===false?'메인 관제센터 · 서버 장애 감지':
    centralChecked?(centralReachable?'메인 관제센터 · 연결 상태 공유 중':'메인 관제센터 확인 불가 · 로컬 시연 가능'):'메인 관제센터 상태 확인 중');
  for(const id of ['fault-scan','fault-replica'])$(id).disabled=sim.mode!=='offline'||!sim.localTransfers.length;
  set('mode',sim.mode==='recovering'?'서버 연결됨 · 안전 전환 중':online?'시연 서버 연결됨':'시연 서버 연결 끊김');
  set('incident-icon',icon);
  set('incident-title',title);
  set('incident-detail',detail);
  set('drive-mode',manualStop?'일시정지':{recovering:'메인 전환 · 안전 정지',online:'정상 운전',handover:'운전 전환',backup:'DAOS 백업 운전',stopped:'안전 정지',waiting:'백업 대기',expired:'유효기간 만료',drained:'작업 완료'}[phase]);
  set('batch',BATCH);
  set('total',`${jobs.length-finished}개 남음`);
  const remaining=Math.max(0,Math.ceil((sim.backupAt+BACKUP_LIFETIME_MS-now)/1000));
  set('backup',sim.backupAt===null?'미전송':`${sim.backupRemaining}개 · 잔여 공정 ${sim.backupStagesRemaining}건 · ${remaining}초`);
  const currentStep=phase==='recovering'?'step-reconcile':online?(sim.audit?'step-reconcile':'step-prepare'):'step-continue';
  for(const id of ['step-prepare','step-continue','step-reconcile']){
    $(id).setAttribute('aria-current',id===currentStep?'step':'false');
  }
  set('track-prepare',sim.backupAt===null?'작업표 미전송':`저장된 작업표 · 상자 ${sim.backup.size}개`);
  const outageSummary={
    handover:'전환 중 · 작업표 확인',
    backup:`백업 사용 중 · 공정 완료 ${sim.localTransfers.length}건`,
    stopped:'DAOS 꺼짐 · 안전 정지',
    waiting:'백업 작업표 대기',
    expired:'작업표 만료 · 안전 정지',
    drained:`백업 작업 완료 · 공정 ${sim.localTransfers.length}건`,
  };
  set('track-continue',outageSummary[phase]??(sim.audit?`장애 중 공정 기록 ${sim.audit.replicated}건`:'연결 끊기 대기'));
  set('track-reconcile',phase==='recovering'?title:online&&sim.audit?`위치 ${sim.audit.received}개 수신 · ${sim.audit.changed}개 변경 · ${sim.audit.held}개 보류`:'연결 복구 대기');
  set('completed',`${finished} / ${jobs.length}개`);
  set('pending',online?`복구 합산 ${sim.synced}건`:`복구 대기 ${sim.pending}건`);
  const moving=!paused&&(online||phase==='backup')?sim.robots.filter(robot=>robot.next||robot.job).length:0;
  set('active',`이동 및 작업 ${moving} / ${sim.robots.length}대`);
  const running=!paused&&(online||phase==='backup');
  set('facility-mode',running?(phase==='backup'?'DAOS · 컨베이어 백업 운전':'중앙 · 컨베이어 운전'):'컨베이어 · 정지');
  const inTransit=sim.jobs.get(sim.armTraceId)??jobs.find(job=>job.belt&&!job.auditHold);
  const handoff=sim.armHandoff??(inTransit?.belt?{kind:'transit',id:inTransit.id,beltId:inTransit.belt.id}:null);
  for(const step of $('arm-flow-stages').children){
    if(step.dataset.step===handoff?.kind)step.setAttribute('aria-current','step');
    else step.removeAttribute('aria-current');
  }
  if(handoff){
    const label={
      unload:handoff.robot?`${handoff.robot} · 입고 상자를 하차해 인계대로 이동`:'입고 도크 · 하차 로봇 대기',
      transport:handoff.robot?`${handoff.robot} · 상자를 받아 컨베이어로 운반`:'입고 인계대 · 운반 로봇 인수 대기',
      transit:handoff.robot?`${handoff.robot} 인계 → ${handoff.beltId} 이송 · 로봇팔 대기`:`${handoff.beltId} · 이송 중, 로봇팔 대기`,
      arrival:`${handoff.beltId} · 끝 지점 도착, 인수 대기`,
      pickup:`${handoff.robot} · 도착 및 스캔 확인 후 인수`,
      placed:handoff.beltId?`${handoff.robot} · ${handoff.beltId}에 내려놓음`:`${handoff.robot} · 팔레트에 내려놓음`,
    };
    set('arm-flow-detail',`상자 ${handoff.id} · ${label[handoff.kind]}`);
  }else set('arm-flow-detail','상자가 도착할 때까지 로봇팔이 대기합니다.');
  set('belt-count',`이송 중 ${jobs.filter(job=>job.belt).length}개 / 벨트 6대`);
  set('check-count',`검증 통과 ${sim.checkTotals.passed}건 · 보류 ${jobs.filter(job=>job.auditHold).length}개`);
  const latest=sim.checks[0];
  set('check-latest',latest?`${latest.previous} → ${latest.robot} · ${latest.id} · ${latest.ok?'인계 기록 / 가상 스캔 일치':'불일치, 후속 작업 차단'}`:'상자 코드·수량·도크·선행 공정 완료를 대조합니다.');
  set('central-layer',`${phase==='recovering'?'연결 감지 · 복구 대조 대기':online?'연결됨 · 권한 자동 발급':'중앙 연결 끊김 · 기존 권한 유지'} · 구역 권한 ${[...sim.central.leases.values()].reduce((total,leases)=>total+leases.length,0)}건 · 에폭 ${sim.epoch}`);
  for(const [index,edge] of sim.edges.entries()){
    const summary=`${edge.label} · ${edge.alive?'연결':'끊김'} · 활성 점유·예약 ${edge.reservations.size}칸 · 누적 ${edge.claims}회 / 로그 ${edge.log.size}건`;
    if(edgeRows[index].textContent!==summary)edgeRows[index].textContent=summary;
  }
  set('robot-layer',`이동·작업 ${moving}대 / 로컬 로그 ${sim.localTransfers.length}건`);
  const sharedEdge=sim.edges[1];
  $('shared-edge').setAttribute('aria-pressed',String(!sharedEdge.alive));
  set('shared-edge',sharedEdge.alive?'공유 통로 엣지 끊기':'공유 통로 엣지 복구');
  const decisions={GREEN:0,YELLOW:0,RED:0};
  if(phase==='backup'){
    for(const robot of sim.robots)if(robot.drg)decisions[robot.drg]++;
  }
  set('drg-status',phase==='backup'?`최근 판단 · 초록 ${decisions.GREEN} / 노랑 ${decisions.YELLOW} / 빨강 ${decisions.RED}`:'DRG 판단은 백업 운전 중 표시됩니다.');
  stages.forEach((node,index)=>{
    const total=jobs.filter(job=>job.stage===index).length;
    const busy=sim.robots.filter(robot=>robot.stage===index&&robot.job).length;
    const label=`${total}개 · 배정 ${busy}대`;
    if(node.textContent!==label)node.textContent=label;
  });
  sim.robots.forEach((robot,index)=>{
    const button=fleetRows[index];
    const label=sim.robotStatus(robot,phase);
    button.setAttribute('aria-pressed',String(selected===robot.id));
    if(button.children[2].textContent!==label)button.children[2].textContent=label;
  });
  const robot=sim.robots.find(item=>item.id===selected),role=STAGES[robot.stage];
  const status=sim.robotStatus(robot,phase);
  set('map-robot',`${robot.id} · ${role.design}`);
  set('map-robot-status',status);
  set('robot-name',`${robot.id} · ${role.design}`);
  const inspector=$('robot-records');
  if(inspector.parentElement.open){
    const leases=(sim.central.leases.get(robot.id)??[]).map(lease=>({
      ...lease,taskIds:[...lease.taskIds].slice(0,3),taskCount:lease.taskIds.size,
      from:new Date(lease.from).toISOString(),until:new Date(lease.until).toISOString(),
    }));
    set('robot-records',JSON.stringify({leases,latestEvent:robot.localLog.at(-1)??null},null,2));
  }
  set('robot-rule',role.rule);
  set('robot-note',`${status} · 공정 완료 ${robot.done}개`);
  set('robot-check',robot.lastCheck?`${robot.lastCheck.previous}의 기록과 가상 스캔 ${robot.lastCheck.ok?'일치 · 후속 작업 허용':'불일치 · 작업자 확인 필요'}`:'상자 인수 시 선행 공정 결과를 검증합니다.');
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

function showEventFilter(special){
  $('all-event-panel').hidden=special;
  $('special-event-panel').hidden=!special;
  $('show-all-events').setAttribute('aria-pressed',String(!special));
  $('show-special-events').setAttribute('aria-pressed',String(special));
}
$('show-all-events').addEventListener('click',()=>showEventFilter(false));
$('show-special-events').addEventListener('click',()=>showEventFilter(true));

$('show-position-comparison').addEventListener('click',()=>{
  const panel=$('position-comparison'),button=$('show-position-comparison');
  panel.hidden=!panel.hidden;
  button.setAttribute('aria-expanded',String(!panel.hidden));
  paintPositionComparison();
});
$('expand-events').addEventListener('click',()=>{
  const button=$('expand-events');
  const expanded=button.closest('.operations-overview').classList.toggle('events-expanded');
  button.setAttribute('aria-expanded',String(expanded));
  set('expand-events',expanded?'이벤트 접기':'이벤트 펼치기');
});

$('send-backup').addEventListener('click',()=>{
  if(sim.sendBackup(demoNow())){
    set('backup-result',`현장 작업표 전송 완료 · 상자 ${sim.backup.size}개 · 시연 유효시간 ${BACKUP_LIFETIME_MS/1000}초`);
    paint();
  }
});
$('daos-switch').addEventListener('click',()=>{sim.setDaos(!sim.daosEnabled);paint();});
$('shared-edge').addEventListener('click',()=>{sim.setSharedEdge(!sim.edges[1].alive,demoNow());paint();});
function applyConnection(){
  const now=demoNow();
  if(localOutage||centralOnline===false){
    if(sim.mode!=='offline'){
      sim.disconnect(now);
      set('fault-status','DAOS 장애 운전 중 공정 기록이 생기면 사용할 수 있습니다.');
      set('backup-result','중앙 연결 끊김 · 작업표 자동 갱신 중단');
    }
  }else if(sim.mode==='offline'){
    sim.restore(now);
    set('backup-result','연결 감지 · 전환 시점 위치 저장');
  }
}

async function pollCentral(){
  if(centralRequest)return;
  centralRequest=true;
  try{
    const response=await fetch('/robot/central-status',{cache:'no-store',signal:AbortSignal.timeout(4500)});
    if(!response.ok)throw Error('중앙 상태 확인 실패');
    const {online}=await response.json();
    if(typeof online!=='boolean')throw Error('잘못된 중앙 응답');
    centralOnline=online;
    centralReachable=true;
    applyConnection();
  }catch{
    centralReachable=false;
    // A failed request must not resume a server that last reported an outage.
  }finally{
    centralRequest=false;
    centralChecked=true;
    paint();
  }
}

$('connection').addEventListener('click',()=>{
  localOutage=!localOutage;
  applyConnection();
  paint();
});
for(const kind of ['scan','replica']){
  $(`fault-${kind}`).addEventListener('click',()=>{
    const id=sim.injectRecoveryFault(kind,demoNow());
    set('fault-status',id?`${id} 오류 재현 준비 완료 · 연결 복구 후 확인 보류를 확인하세요.`:'재현할 새 공정 기록을 기다려 주세요.');
    paint();
  });
}
$('pause').addEventListener('click',()=>{
  const wall=Date.now();
  paused=!paused;
  if(paused)pausedAt=wall;
  else if(pausedAt!==null){
    pausedDuration+=wall-pausedAt;
    pausedAt=null;
  }
  sim.recordSpecial('notice',paused?'시연 일시정지':'시연 계속 실행',
    paused?'사용자가 로봇과 설비의 시연을 일시정지했습니다.':'사용자가 시연을 다시 실행했습니다.',demoNow(wall));
  paint();
});
$('reset').addEventListener('click',()=>{
  sim=new Warehouse(Date.now(),{compact:true});
  paused=prefersReducedMotion;
  pausedDuration=0;
  pausedAt=paused?sim.startedAt:null;
  localOutage=false;
  applyConnection();
  set('backup-result','현장 작업표 자동 갱신 중');
  paint();
});
canvas.addEventListener('click',event=>{
  const robot=scene.pick(event,sim.robots);
  if(robot){selected=robot;paint();}
});
let previous=performance.now();
function animate(now){
  const wall=demoNow();
  if(now-lastCentralPoll>=1500){
    lastCentralPoll=now;
    void pollCentral();
  }
  const wasRecovering=sim.mode==='recovering';
  sim.updateConnection(wall);
  if(wasRecovering&&sim.mode==='online') set('backup-result','전환 시점 위치 반영 및 대조 완료 · 메인 시스템 재개');
  sim.maintainBackup(wall);
  sim.updateOutage(wall);
  if(!paused)sim.tick(Math.min((now-previous)/1000,.06),wall);
  previous=now;
  if(now-lastPaint>180){lastPaint=now;paint();}
  scene.draw(sim,selected,paused&&!sim.daosEnabled&&sim.mode==='online',wall,paused);
  requestAnimationFrame(animate);
}
paint();
requestAnimationFrame(animate);
