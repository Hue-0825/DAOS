import {CentralPlan,ZoneEdge,ZONES,zoneOf,covers,HybridClock,sameEvent} from './warehouse-layers.mjs?v=10';

export const SIZE = [32, 23];
export const RACKS = [1,7,14,20].flatMap(y => [10,14].map(x => [x,y,2,1]));
export const inFloor=([x,y])=>x>=0&&x<32&&y>=0&&y<23&&!(x<4&&y>19)&&!(x>28&&y>21);
export const BELTS = [4,11,18].flatMap((y,segment)=>[{id:`CV-IN-${segment+1}`,segment,from:[18,y],to:[22,y],stage:1},{id:`CV-OUT-${segment+1}`,segment,from:[23,y],to:[27,y],stage:2}]);
export const STAGES = [
  {label:'하차', code:'UL', design:'포크형 하차 로봇', count:3, color:'#71e4fa', stations:[[2,4],[2,11],[2,18]], rule:'하차한 상자를 입고 버퍼에 내려놓습니다. 버퍼가 차면 운반 로봇이 가져갈 때까지 기다립니다.'},
  {label:'운반', code:'AM', design:'평판형 운반 로봇', count:6, color:'#a4aaff', stations:[[6,4],[6,11],[6,18]], rule:'버퍼의 상자를 공유 통로로 운반합니다. 다른 로봇이 점유한 칸에는 진입하지 않습니다.'},
  {label:'분류', fixed:true, code:'ST', design:'비전 분류 로봇 팔', count:3, color:'#dca7fc', stations:[[22,4],[22,11],[22,18]], rule:'운반 로봇이 넘긴 상자를 출고 도크별로 분류합니다.'},
  {label:'적재', fixed:true, code:'DP', design:'팔레타이징 로봇 팔', count:3, color:'#ffd089', stations:[[27,4],[27,11],[27,18]], rule:'컨베이어에서 받은 상자의 분류 결과와 도크를 재검증하고, 진공 그리퍼로 팔레트에 적재합니다.'},
  {label:'상차', code:'LD', design:'리프트형 상차 로봇', count:3, color:'#96ebbb', stations:[[30,5],[30,12],[30,19]], rule:'출고 확인을 마친 상자만 분류 버퍼에서 받아 트럭에 싣습니다.'},
];
const key = ([x,y]) => y * SIZE[0] + x;
const nextCells = ([x,y]) => [[x+1,y],[x,y+1],[x-1,y],[x,y-1]].filter(inFloor);
const walls = new Set(RACKS.flatMap(([x,y,w,h]) => Array.from({length:w*h}, (_,i)=>key([x+i%w,y+Math.floor(i/w)]))));
// Physical buffer pallets and chargers are obstacles, not decorative drive-through areas.
for(const y of [4,11,18])for(const x of [3,4])for(const dy of [1,2])walls.add(key([x,y+dy]));
for(const x of [5,6,7,8])walls.add(key([x,21]));
export const PARKING = [
  [[1,2],[1,9],[1,16]], [[6,2],[6,9],[6,16],[8,2],[8,9],[8,16]],
  [[22,4],[22,11],[22,18]], [[27,4],[27,11],[27,18]], [[30,2],[30,9],[30,16]],
];
export const BATCH = 'A-01';

function pathTo(start, end, blocked, allowed) {
  const target = key(end), origin = key(start);
  const queue = [start], previous = new Map([[origin,null]]);
  for (let i=0; i<queue.length; i++) {
    const point = queue[i], here = key(point);
    if (here === target) {
      const path = [];
      for (let cursor=here; cursor!==origin; cursor=previous.get(cursor)) path.push([cursor % SIZE[0],Math.floor(cursor/SIZE[0])]);
      return path.reverse();
    }
    for (const next of nextCells(point)) {
      const id = key(next);
      if (previous.has(id) || walls.has(id) || blocked.has(id) || !allowed(next)) continue;
      previous.set(id,here);
      queue.push(next);
    }
  }
  return [];
}

export const ARM_CYCLE_SECONDS = 2.4;
const ARM_ARRIVAL_WAIT = .7;
export function armTransferPose(robot,simTime) {
  const [x,y]=robot.position;
  const operating=robot.job&&robot.checked&&robot.checkUntil<=simTime;
  const progress=operating?Math.min(robot.work/ARM_CYCLE_SECONDS,1):0;
  const input=[x,y,10];
  const output=robot.stage===2?[x+1,y,10]:[x+.87,y+.20,4];
  const raised=([cx,cy])=>[cx,cy,46.4];
  const poses=[[0,raised(input)],[.19,input],[.36,raised(input)],
    [.60,raised(output)],[.77,output],[.86,raised(output)],[1,raised(input)]];
  const end=poses.findIndex(([time],i)=>i>0&&progress<=time);
  const [startTime,start]=poses[end-1], [endTime,finish]=poses[end];
  const fraction=(progress-startTime)/(endTime-startTime);
  const blend=fraction*fraction*(3-2*fraction);
  const tool=start.map((value,i)=>value+(finish[i]-value)*blend);
  return {tool,cargo:progress<.19?input:progress<.77?tool:output};
}

export const OUTAGE_ALERT_MS = 1000;
export const RECOVERY_STEP_MS = 1000;
const BACKUP_REFRESH_MS = 10000;
export const DEMO_PARCELS=11;
export const DROP_CUTOFF_MS=90_000;
const DROP_INSPECTION_SECONDS=2;
const DROP_RECOVERY_SECONDS=5;

export class Warehouse {
  constructor(now=Date.now(), {compact=false,dropChance=0,random=Math.random}={}) {
    this.jobs = new Map();
    this.backup = new Set();
    this.backupAt = null;
    this.epoch = 1;
    this.central = new CentralPlan();
    this.edges = ZONES.map(label=>new ZoneEdge(label));
    this.centralStages = new Map();
    this.centralLocations = new Map();
    this.centralCapturedAt = null;
    this.positionPacket = null;
    this.recoveryPhase = null;
    this.physicalScans = new Map();
    this.localTransfers = [];
    this.scanFaults=new Set();
    this.audit = null;
    this.kpi={online:{seconds:0,stages:0},offline:{seconds:0,stages:0},switchMs:null};
    this.simTime = 0;
    this.beltTime = 0;
    this.armHandoff=null;
    this.armTraceId=null;
    this.checks = [];
    this.checkTotals={passed:0,held:0};
    this.handoffRecords = new Map();
    this.transportLog = new Map();
    this.clocks = new Map();
    this.auditHistory = [];
    this.now = now;
    this.conveyorLeases = new Map();
    this.mode = 'online';
    this.daosEnabled = true;
    this.outageAt = null;
    this.recoveryAt = null;
    this.reportedPhase = null;
    this.events = [];
    this.startedAt=now;
    this.specialEvents=[];
    this.dropAt=dropChance>0&&random()*100<dropChance?now+12_000+random()*30_000:null;
    this.dropIncident=null;
    this.operatingMode='online';
    this.pending = 0;
    this.synced = 0;
    this.resetFleet();
    for(const robot of this.robots)this.edges[zoneOf(robot.cell)].reservations.set(key(robot.cell),robot.id);
    const opening = compact?[[DEMO_PARCELS,1]]:[[38,5],[5,0],[4,5],[3,2],[4,0]];
    for (const [stage,[count,start]] of opening.entries()) {
      for (let i=0; i<count; i++) {
        const id=`${BATCH}-${String(this.jobs.size+1).padStart(2,'0')}`;
        const segment=(i+start)%3;
        const job={id,stage,segment,lane:0,robot:null,barcode:id,quantity:1,dock:segment+1};
        this.jobs.set(id,job);
        this.physicalScans.set(id,{stage,location:null,barcode:id,quantity:1,dock:segment+1});
        this.handoffRecords.set(id,{stage,actor:'입고 확인',location:null,barcode:id,quantity:1,dock:segment+1});
        if(STAGES[stage].fixed){
          const belt=BELTS.find(item=>item.stage===stage-1&&item.segment===job.segment);
          job.armArrival={beltId:belt.id,readyAt:0};
        }
      }
    }
    if(compact){
      const first=this.jobs.values().next().value;
      this.armTraceId=first.id;
      this.armHandoff={kind:'unload',id:first.id};
    }
    this.note('관제',`출고 배치 ${BATCH} · 상자 ${this.jobs.size}개 · ${compact?'입고 도크에서 하차부터 시작합니다.':'진행 중인 공정부터 이어서 작업합니다.'}`);
    this.maintainBackup(now);
  }
  resetFleet() {
    this.robots = STAGES.flatMap((role,stage) => Array.from({length:role.count},(_,n) => {
      const home = PARKING[stage][n];
      return {id:`${role.code}-0${n+1}`,stage,home,cell:home,position:home,job:null,target:home,next:null,progress:0,work:0,done:0,route:[],stations:[],localLog:[]};
    }));
  }
  note(actor,text,local=false) {
    if (local) this.pending++;
    this.events.unshift({actor,text,local,at:new Date().toLocaleTimeString('ko-KR',{hour12:false})});
    this.events.length=Math.min(this.events.length,75);
  }
  recordSpecial(kind,title,detail,now=Date.now(),mode=null) {
    this.specialEvents.push({kind,title,detail,now,mode});
    if(mode)this.operatingMode=mode;
  }

  sendBackup(now=Date.now(), log=true) {
    if (this.mode !== 'online') return false;
    this.backup = new Set([...this.jobs.values()].filter(job=>!job.auditHold&&job.stage<STAGES.length).map(job=>job.id));
    this.backupAt = now;
    this.central.issue(this.robots,this.backup,this.epoch,now);
    this.conveyorLeases=new Map(BELTS.map(belt=>[belt.id,{leaseId:`L-${this.epoch}-${now}-${belt.id}`,robotId:belt.id,resource:belt.id,epoch:this.epoch,from:now,until:null,taskIds:new Set(this.backup)}]));
    if(log)this.note('백업',`현장 작업표 전송 완료 · 상자 ${this.backup.size}개`);
    return true;
  }
  maintainBackup(now) {
    if(this.mode==='online'&&(this.backupAt===null||now-this.backupAt>=BACKUP_REFRESH_MS)){
      this.sendBackup(now,false);
    }
  }
  injectRecoveryFault(kind,now=this.now) {
    if(this.mode!=='offline'||!['scan','replica'].includes(kind))return null;
    const event=[...this.localTransfers].reverse().find(item=>!this.jobs.get(item.taskId).auditHold
      &&!this.scanFaults.has(item.taskId)&&this.edges[item.zone].matches(item));
    if(!event)return null;
    if(kind==='scan')this.scanFaults.add(event.taskId);
    else this.edges[event.zone].log.delete(event.eventId);
    const title=kind==='scan'?'가상 스캔 오류 주입':'엣지 복제 누락 주입';
    this.recordSpecial('notice',title,`상자 ${event.taskId} · 복구 시 보류 여부를 확인합니다.`,now);
    this.note('시연',`${title} · 상자 ${event.taskId}`);
    return event.taskId;
  }

  inventoryPositions() {
    return new Map([...this.jobs].map(([id,job])=>{
      const scan=this.physicalScans.get(id);
      const robot=this.robots.find(robot=>robot.job===job);
      const belt=job.belt;
      let kind='station',holder=null,coordinates=scan?.location?.split(',').map(Number);
      const drop=this.dropIncident?.taskId===id?this.dropIncident:null;
      if(drop&&drop.phase!=='resumed'){
        kind='floor';coordinates=drop.point;
      }else if(belt){
        kind='conveyor';holder=belt.id;
        coordinates=belt.from.map((value,i)=>value+(belt.to[i]-value)*belt.progress);
      }else if(robot&&!STAGES[robot.stage].fixed&&!robot.fetching){
        kind='robot';holder=robot.id;coordinates=robot.position;
      }else if(robot&&STAGES[robot.stage].fixed&&robot.checked&&robot.work>0){
        kind='arm';holder=robot.id;coordinates=armTransferPose(robot,this.simTime).cargo.slice(0,2);
      }else if(job.stage===STAGES.length){
        kind='shipped';holder=`DOCK-${job.dock}`;
      }else if(!coordinates){
        coordinates=job.stage===4?this.pickupFor(4,job):this.station(job.stage,job);
      }
      return [id,{
        kind,holder,coordinates:coordinates?.map(value=>Math.round(value*100)/100)??null,
        stage:job.stage,scan:scan?{...scan}:null,
        ...(kind==='floor'&&drop.scan?{incidentScan:{...drop.scan}}:{}),
      }];
    }));
  }

  restore(now=Date.now()) {
    if (this.mode !== 'offline') return;
    this.mode = 'recovering';
    this.recoveryAt = now;
    this.recoveryPhase = 'stop';
    const positions=this.inventoryPositions();
    for(const id of this.scanFaults){
      const snapshot=positions.get(id);
      if(snapshot?.scan)snapshot.scan.location='SCAN-MISMATCH';
    }
    const changed=[...positions].filter(([id,position])=>
      JSON.stringify(position)!==JSON.stringify(this.centralLocations.get(id)));
    this.positionPacket={epoch:this.epoch,capturedAt:now,positions,changed,received:false};
    this.recordSpecial('recovery','서버 연결 복구','전환 순간의 상자 위치를 저장하고 메인 서버로 보냅니다.',now,'recovering');
    this.note('관제','서버 연결 감지 · 로봇과 컨베이어를 1초 정지한 뒤 물건 위치부터 전송합니다.');
  }

  updateConnection(now=Date.now()) {
    if(this.mode!=='recovering')return;
    const delay=this.recoveryPhase==='stop'?OUTAGE_ALERT_MS:RECOVERY_STEP_MS;
    if(now-this.recoveryAt<delay)return;
    if(this.recoveryPhase==='stop'){
      this.recoveryPhase='positions';
      this.recoveryAt=now;
      this.note('현장','상자 위치 전송 시작 · 작업대, 운반 로봇, 컨베이어 위치를 중앙으로 보냅니다.');
    }else if(this.recoveryPhase==='positions'){
      this.positionPacket.received=true;
      this.recoveryPhase='reconcile';
      this.recoveryAt=now;
      this.note('관제',`위치 수신 완료 · 상자 ${this.positionPacket.positions.size}개 중 변경 ${this.positionPacket.changed.length}개 · 작업 이력 대조 시작`);
    }else this.finishRestore(now);
  }

  finishRestore(now) {
    const packet=this.positionPacket;
    if(this.mode!=='recovering'||this.recoveryPhase!=='reconcile'||!packet?.received
      ||packet.epoch!==this.epoch||now-this.recoveryAt<RECOVERY_STEP_MS)return;
    const grouped=new Map();
    for(const event of this.localTransfers){
      const group=grouped.get(event.taskId)??[];
      group.push(event);
      grouped.set(event.taskId,group);
    }
    let verified=0,held=0,confirmedEvents=0;
    const results=[];
    // Capture the pre-outage central snapshot and edge evidence before reconciliation mutates them.
    const locations=[...packet.positions].map(([id,position])=>{
      const events=grouped.get(id)??[];
      return {
        id,central:this.centralLocations.get(id)??null,position,
        logs:events.map(event=>({node:event.node,location:event.location,edge:this.edges[event.zone].label,
          replicated:this.edges[event.zone].matches(event),sequence:event.seq})),
      };
    });
    const checks={candidates:0,ids:0,chain:0,scans:0,duplicates:0};
    const candidates=new Set([...grouped.keys(),...packet.changed.map(([id])=>id)]);
    for(const id of candidates){
      const job=this.jobs.get(id), group=grouped.get(id)??[];
      checks.candidates++;
      const unique=new Map();
      let conflict=false;
      for(const event of group){
        const copy=unique.get(event.eventId);
        if(copy){checks.duplicates++;if(!sameEvent(copy,event))conflict=true;}
        if(!copy)unique.set(event.eventId,event);
      }
      const chain=[...unique.values()].sort((a,b)=>a.from-b.from);
      let stage=this.centralStages.get(id);
      const continuous=chain.every(event=>{
        if(event.epoch!==this.epoch||event.from!==stage||event.to!==stage+1
          ||event.scan!=='OK'||!this.edges[event.zone].matches(event))return false;
        stage=event.to;
        return true;
      });
      const position=packet.positions.get(id),scan=position?.scan,last=chain.at(-1);
      const idsOk=!conflict&&chain.every(event=>event.eventId===`${event.epoch}/${event.node}/${event.seq}`);
      const chainOk=idsOk&&continuous&&stage===job.stage;
      const missingReplica=chain.some(event=>!this.edges[event.zone].matches(event));
      const agreed=chainOk&&position?.stage===stage&&scan?.stage===stage
        &&(!last||scan.location===last.location)
        &&scan.barcode===job.barcode&&scan.quantity===job.quantity&&scan.dock===job.dock;
      if(idsOk)checks.ids++;
      if(chainOk)checks.chain++;
      if(agreed)checks.scans++;

      if(agreed){
        verified++;
        confirmedEvents+=chain.length;
        this.centralStages.set(id,stage);
        this.centralLocations.set(id,position);
      }else{
        job.auditHold=true;
        const robot=this.robots.find(item=>item.job===job);
        if(robot)robot.stations=[];
        held++;
        this.recordSpecial('notice','복구 검증 · 상자 격리',`상자 ${id} · 위치 또는 기록 불일치로 확인 보류`,now);
      }
      const reason=agreed?'위치·공정 대조 통과':!idsOk?'이벤트 ID 또는 중복 기록 충돌':
        missingReplica?'엣지 복제 누락 또는 불일치':!chainOk?'공정 순서 또는 에폭 불일치':'가상 실물 스캔 불일치';
      results.push({taskId:id,agreed,events:chain,reason});
    }
    const outcomes=new Map(results.map(result=>[result.taskId,result]));
    const comparison=locations.map(row=>{
      const outcome=outcomes.get(row.id);
      if(outcome)return {...row,result:outcome.agreed?'matched':'held',reason:outcome.reason};
      if(this.jobs.get(row.id).auditHold)return {...row,result:'held',reason:'이전 복구에서 보류'};
      return {...row,result:'unchanged',reason:'장애 직전 기록과 위치·공정 동일'};
    });
    this.audit={verified,held,checks,comparison,centralCapturedAt:this.centralCapturedAt,
      capturedAt:packet.capturedAt,completedAt:now,epoch:packet.epoch,received:packet.positions.size,changed:packet.changed.length,replicated:this.edges.reduce((total,edge)=>total+edge.log.size,0)};
    this.auditHistory.push({epoch:this.epoch,results});
    this.epoch++;
    this.mode='online';
    this.recoveryPhase=null;
    this.synced+=confirmedEvents;
    this.pending=0;
    this.localTransfers=[];
    this.scanFaults.clear();
    for(const edge of this.edges){edge.log.clear();edge.conflicts.clear();edge.claims=0;}
    this.backup.clear();
    this.backupAt = null;
    this.maintainBackup(now);
    this.recordSpecial('restored','정상 운전 재개',`상자 위치 ${packet.positions.size}개 수신 · 변경 ${packet.changed.length}개 · 확인 보류 ${held}개`,now,'online');
    this.note('관제',`서버 복구 · 3중 대조 일치 ${verified}개, 확인 보류 ${held}개 · 운전 세대 ${this.epoch}`);
  }
  get backupRemaining() {
    return [...this.backup].filter(id=>{const job=this.jobs.get(id);return !job.auditHold&&job.stage<STAGES.length;}).length;
  }
  get backupStagesRemaining() {
    return [...this.backup].reduce((total,id)=>{
      const job=this.jobs.get(id);
      return total+(job.auditHold?0:STAGES.length-job.stage);
    },0);
  }
  buffers() {
    const buffers=new Map();
    for(const job of this.jobs.values()){
      if(job.belt||job.stage>=STAGES.length&&!job.auditHold)continue;
      const robot=job.robot&&this.robots.find(item=>item.id===job.robot);
      if(robot&&!robot.fetching)continue;
      const point=job.stage>=STAGES.length?this.station(4,job):job.stage===4?this.pickupFor(4,job):this.station(job.stage,job);
      const id=key(point);
      const buffer=buffers.get(id)??{point,count:0,held:0,stage:job.stage};
      buffer.count++;
      if(job.auditHold)buffer.held++;
      buffers.set(id,buffer);
    }
    return buffers.values();
  }
  setDaos(enabled) {
    if (this.daosEnabled === enabled) return;
    this.daosEnabled = enabled;
    this.note('관제',`DAOS ${enabled?'ON · 백업 운전 사용':'OFF · 기존 방식으로 전환'}`);
  }
  disconnect(now=Date.now()) {
    if (this.mode === 'offline') return;
    const interruptedRecovery = this.mode === 'recovering';
    this.mode = 'offline';
    this.recoveryAt = null;
    this.outageAt = now;
    this.recoveryPhase=null;
    this.positionPacket=null;
    if (!interruptedRecovery){
      this.centralCapturedAt=now;
      this.centralStages=new Map([...this.jobs].map(([id,job])=>[id,job.stage]));
      const positions=this.inventoryPositions();
      for(const [id,position] of positions){
        if(!this.jobs.get(id).auditHold)this.centralLocations.set(id,position);
      }
    }
    this.reportedPhase = null;
    this.recordSpecial('outage','서버 오류 · 연결 끊김','현장 설비가 멈췄습니다. DAOS 설정과 백업 작업표를 확인합니다.',now,'outage');
    this.note('관제',`서버 연결 끊김 · 로봇 ${this.robots.length}대와 컨베이어를 1초 정지합니다.`);
  }
  alarmActive(now=Date.now()) {
    return this.mode==='offline'&&now-this.outageAt<OUTAGE_ALERT_MS;
  }
  offlinePhase(now=Date.now()) {
    if (this.mode === 'recovering') return 'recovering';
    if (this.mode !== 'offline') return null;
    if (!this.daosEnabled) return 'stopped';
    if (this.backupAt===null) return 'waiting';
    if (this.alarmActive(now)) return 'handover';
    if (this.backupRemaining || this.robots.some(robot=>key(robot.cell)!==key(robot.home))) return 'backup';
    return 'drained';
  }
  updateOutage(now) {
    const phase = this.offlinePhase(now);
    const messages = {
      handover:'전환 중 · 로봇을 잠시 멈추고 점유권과 작업표를 확인합니다.',
      stopped:'DAOS OFF · 서버가 복구될 때까지 로봇 공정을 정지합니다.',
      backup:'현장 자율운전 · 승인된 작업표와 구역 점유권으로 로봇 간 인계를 재개합니다.',
      waiting:'작업표 미수신 · 로봇이 백업 작업표를 기다립니다.',
      drained:'백업 작업표의 공정을 모두 마쳤습니다. 추가 물량을 기다립니다.',
    };
    if (phase === this.reportedPhase || !messages[phase]) return;
    this.reportedPhase = phase;
    if(phase==='backup'){
      if(this.kpi.switchMs===null)this.kpi.switchMs=now-this.outageAt;
      this.recordSpecial('backup','DAOS 가동',`백업 작업표로 운전을 이어갑니다. 남은 백업 상자 ${this.backupRemaining}개.`,now,'backup');
    }else if(['stopped','waiting','drained'].includes(phase)){
      const titles={stopped:'DAOS 꺼짐 · 안전 정지',waiting:'백업 작업표 대기',drained:'백업 작업 완료'};
      this.recordSpecial('notice',titles[phase],messages[phase],now,'outage');
    }
    this.note('관제',messages[phase]);
  }
  traceArmHandoff(handoff) {
    if(this.armTraceId===null||this.armTraceId===handoff.id)this.armHandoff=handoff;
  }
  armInputReady(job) {
    return !STAGES[job.stage].fixed || Boolean(job.armArrival&&job.armArrival.readyAt<=this.simTime);
  }
  canHandoff(job) {
    if(job.stage>=3)return true;
    const count=[...this.jobs.values()].filter(next=>next.segment===job.segment&&next.lane===job.lane&&next.stage===job.stage+1).length;
    return count<2;
  }
  station(stage, job) {
    const [x,y] = STAGES[stage].stations[job.segment];
    return [x,y];
  }
  transfer(job) {
    const [,y] = this.station(2,job);
    return [18,y];
  }
  goalFor(stage, job) {
    if (stage === 0) return this.station(1,job);
    if (stage === 1) return this.transfer(job);
    return this.station(stage,job);
  }
  pickupFor(stage, job) {
    if (stage === 4) {const [x,y]=this.station(3,job);return [x+1,y];}
    return stage < 2 ? this.station(stage,job) : null;
  }
  robotStatus(robot,phase) {
    if (phase==='recovering') return '메인 전환 · 안전 정지';
    if (phase==='handover') return '운전 전환 대기';
    if (phase==='stopped') return '안전 정지';
    if(this.dropIncident?.robotId===robot.id){
      const status={isolated:'낙하 · 통로 통제',inspection:'현장 확인 · 재스캔',held:'격리 · 확인 보류'}[this.dropIncident.phase];
      if(status)return status;
    }
    if(phase==='backup'&&robot.drg==='RED')return '권한·엣지 확인 대기';
    if(robot.job?.auditHold)return '스캔 확인 대기';
    if (phase==='waiting') return '작업표 대기';
    if (phase==='drained') return '작업 완료';
    if(robot.lastCheck?.ok===false&&!robot.job)return '불일치 · 확인 대기';
    if(robot.yieldTarget||robot.yieldUntil>this.simTime)return '통로 양보 중';
    if(robot.checking)return '2차 검증 · 스캔 대조';
    if(robot.checkUntil>this.simTime)return '2차 검증 통과';
    if(!robot.job&&STAGES[robot.stage].fixed){
      const segment=Number(robot.id.slice(-1))-1;
      const input=[...this.jobs.values()].some(job=>job.stage===robot.stage&&job.segment===segment&&!job.belt&&!job.auditHold);
      return input?'상자 도착 · 인수 대기':'컨베이어 도착 대기';
    }
    if(robot.job&&STAGES[robot.stage].fixed&&robot.work>0){
      const progress=robot.work/ARM_CYCLE_SECONDS;
      return progress<.19?'집게 접근':progress<.77?'상자 집어 이동':'상자 내려놓음';
    }
    if (!robot.job) return key(robot.cell)===key(robot.home)?'인계 대기':'복귀 중';
    if (!robot.next && key(robot.cell)!==key(robot.target)) return '통행 대기';
    return robot.fetching?'인수 중':`${STAGES[robot.stage].label} 중`;
  }
  classify(robot,job,points,now) {
    if(job){
      const evidence=this.handoffRecords.get(job.id);
      if(job.auditHold||evidence?.stage!==job.stage||!this.central.permits(robot,job,points,this.epoch,now))return 'RED';
    }
    const needsEdge=points.some(point=>zoneOf(point)===1);
    if(!needsEdge)return 'GREEN';
    return this.edges[1].alive?'YELLOW':'RED';
  }
  setSharedEdge(alive,now=this.now) {
    this.edges[1].alive=alive;
    this.recordSpecial('notice',alive?'공유 통로 엣지 복구':'공유 통로 엣지 장애',alive?'통로 예약과 새 로그 복제가 재개됩니다.':'공유 통로의 추가 승인이 필요한 작업을 보류합니다.',now);
    this.note('공유 통로 엣지',alive?'연결 복구 · 새 인계 기록 복제 재개':'연결 끊김 · 공유 통로 협상 불가');
  }
  logDrop(title,detail,now){
    const {robotId,taskId,point}=this.dropIncident;
    const message=`${robotId} · ${taskId} · (${point.join(', ')}) · ${detail}`;
    this.recordSpecial('drop',title,message,now);
    this.note(robotId,`${title} · ${message}`);
  }

  updateDrop(now){
    const drop=this.dropIncident;
    if(drop){
      const job=this.jobs.get(drop.taskId);
      if(drop.phase==='held'||drop.phase==='resumed')return;
      if(job.auditHold){
        drop.phase='held';
        this.robots.find(robot=>robot.id===drop.robotId).stations=[];
        this.logDrop('낙하 대응 · 확인 보류','복구 대조에서 보류되어 현장 통제를 유지합니다.',now);
        return;
      }
      const elapsed=this.simTime-drop.startedAt;
      if(drop.phase==='isolated'&&elapsed>=DROP_INSPECTION_SECONDS){
        const evidence=this.physicalScans.get(job.id);
        drop.scan={barcode:evidence?.barcode,quantity:evidence?.quantity,dock:evidence?.dock,location:drop.point.join(',')};
        drop.phase='inspection';
        this.logDrop('낙하 대응 · 현장 확인','담당자가 상자와 적재 상태를 확인하고 낙하 지점에서 다시 스캔합니다.',now);
      }
      if(drop.phase==='inspection'&&elapsed>=DROP_RECOVERY_SECONDS){
        const verified=drop.scan.barcode===job.id&&drop.scan.quantity===job.quantity&&drop.scan.dock===job.dock
          &&drop.scan.location===drop.point.join(',');
        if(!verified){
          job.auditHold=true;
          drop.phase='held';
          this.robots.find(robot=>robot.id===drop.robotId).stations=[];
          this.logDrop('낙하 대응 · 확인 보류','재스캔 불일치로 상자를 격리하고 통행을 제한합니다.',now);
          return;
        }
        drop.phase='resumed';
        this.logDrop('낙하 대응 · 운반 재개','재스캔 일치 · 담당자 모의 승인 후 재적재하고 통행을 재개합니다.',now);
      }
      return;
    }
    if(this.dropAt===null||now<this.dropAt||now-this.startedAt>=DROP_CUTOFF_MS)return;
    const robot=this.robots.find(robot=>robot.stage===1&&robot.job&&!robot.job.auditHold
      &&!robot.fetching&&!robot.next&&robot.route.length&&key(robot.cell)!==key(robot.target));
    if(!robot)return;
    this.dropIncident={robotId:robot.id,taskId:robot.job.id,point:[...robot.cell],startedAt:this.simTime,phase:'isolated'};
    this.logDrop('AM 운반 중 박스 낙하','해당 로봇을 정지하고 낙하 칸의 통행을 제한합니다.',now);
  }

  tick(dt,now=Date.now()) {
    this.now=now;
    this.updateConnection(now);
    const phase=this.offlinePhase(now);
    if (this.mode !== 'online' && phase !== 'backup') return;
    this.kpi[this.mode].seconds+=dt;
    this.simTime+=dt;
    this.beltTime+=dt;
    this.advanceBelts(dt,now);
    const occupied = new Set(this.robots.flatMap(robot => [key(robot.cell),...(robot.next?[key(robot.next)]:[])]));
    const reserved = new Set(this.robots.flatMap(robot=>robot.stations));
    const fixedCells = new Set(this.robots.filter(robot=>STAGES[robot.stage].fixed||robot.job?.auditHold).map(robot=>key(robot.cell)));
    const noBlocks=new Set();
    this.updateDrop(now);

    for (const robot of this.robots) {
      if(robot.job?.auditHold||this.dropIncident?.robotId===robot.id&&this.dropIncident.phase!=='resumed')continue;
      if(phase==='backup'&&robot.job&&!robot.next){
        robot.drg=this.classify(robot,robot.job,[robot.cell,robot.target],now);
        if(robot.drg==='RED')continue;
      }
      if (!robot.job && !robot.next && key(robot.cell)===key(robot.home)) {
        for (const job of this.jobs.values()) {
          if (job.robot || job.belt || job.auditHold || (STAGES[robot.stage].fixed && job.segment!==Number(robot.id.slice(-1))-1) || job.stage!==robot.stage || (!this.backup.has(job.id)&&this.mode==='offline') || !this.armInputReady(job) || !this.canHandoff(job)) continue;
          const pickup = this.pickupFor(robot.stage,job);
          const goal = this.goalFor(robot.stage,job);
          const points=pickup?[pickup,goal]:[goal];
          if(phase==='backup'){
            robot.drg=this.classify(robot,job,[robot.cell,...points],now);
            if(robot.drg==='RED')continue;
          }
          const stations = points.map(key);
          if (stations.some(id=>reserved.has(id)||fixedCells.has(id)&&id!==key(robot.cell))) continue;
          robot.job = job;
          job.robot = robot.id;
          robot.work = 0;
          robot.checked=false;robot.checking=false;
          robot.target = pickup ?? goal;
          robot.fetching = Boolean(pickup);
          robot.stations = stations;
          for(const id of stations) reserved.add(id);
          break;
        }
      }
      if (!robot.yieldTarget&&!robot.next && key(robot.cell) === key(robot.target) && robot.job) {
        const job = robot.job;
        if(phase==='backup'&&!this.central.permits(robot,job,[robot.cell],this.epoch,now)){robot.drg='RED';continue;}
        if(!robot.checked){
          robot.checking=true;robot.work+=dt;
          if(robot.work<1.4)continue;
          robot.checking=false;robot.work=0;
          if(!this.verifyHandoff(robot,job)){robot.job=null;job.robot=null;robot.target=robot.home;for(const id of robot.stations)reserved.delete(id);robot.stations=[];continue;}
          robot.checked=true;robot.checkUntil=this.simTime+1.2;
          continue;
        }
        if(robot.checkUntil>this.simTime)continue;
        const belt=BELTS.find(b=>b.stage===job.stage&&b.segment===job.segment);
        const beltOccupied=belt&&[...this.jobs.values()].some(other=>other.belt?.id===belt.id);
        if (STAGES[robot.stage].fixed && beltOccupied) continue;
        if(STAGES[robot.stage].fixed&&robot.work===0){
          this.traceArmHandoff({kind:'pickup',id:job.id,robot:robot.id,beltId:job.armArrival.beltId});
          this.note(robot.id,`${job.id} · ${job.armArrival.beltId} 도착 확인 후 로봇팔 인수`);
        }
        robot.work += dt;
        if (robot.work < (STAGES[robot.stage].fixed?ARM_CYCLE_SECONDS:1.0)) continue;
        if (robot.fetching) {
          robot.fetching = false;
          if(robot.stage===0)this.traceArmHandoff({kind:'unload',id:job.id,robot:robot.id});
          if(robot.stage===1)this.traceArmHandoff({kind:'transport',id:job.id,robot:robot.id});
          robot.target = this.goalFor(robot.stage,job);
          robot.work = 0;
          continue;
        }
        if(STAGES[robot.stage].fixed){
          this.traceArmHandoff({kind:'placed',id:job.id,robot:robot.id,beltId:belt?.id});
          job.armArrival=null;
        }
        if(belt){
          if(beltOccupied)continue;
          job.belt={...belt,progress:0,actor:robot.id};
          if(robot.stage===1)this.traceArmHandoff({kind:'transit',id:job.id,beltId:belt.id,robot:robot.id});
        }else{
          this.completeStage(job,robot,robot.cell);
          if(robot.stage===0)this.traceArmHandoff({kind:'transport',id:job.id});
        }
        robot.done++;
        const next = STAGES[job.stage]?.label;
        this.note(robot.id,`${job.id} · ${belt?`${belt.id} 컨베이어 투입`:next?`${STAGES[robot.stage].label} 완료 → ${next} 인계`:'트럭 상차 완료'}`,this.mode==='offline'&&!belt);
        job.robot = null;
        robot.job = null;
        robot.target = robot.home;
        for(const id of robot.stations) reserved.delete(id);
        robot.stations = [];
        continue;
      }
      if(!robot.next){
        if(robot.yieldTarget&&key(robot.cell)===key(robot.yieldTarget)){
          robot.yieldTarget=null;
          robot.yieldUntil=this.simTime+1.1;
        }
        if(robot.yieldUntil>this.simTime)continue;
        const target=robot.yieldTarget??robot.target;
        if(key(robot.cell)===key(target)){robot.route=[];continue;}
        const allowed=point=>this.central.canRoute(robot,point);
        const route=pathTo(robot.cell,target,occupied,allowed);
        if(!route.length){
          const intended=pathTo(robot.cell,target,noBlocks,allowed);
          robot.route=intended;
          robot.blockedFor=(robot.blockedFor??0)+dt;
          if(robot.blockedFor>=.65&&intended.length){
            const corridor=new Set(intended.map(key));
            const side=this.findYield(robot.cell,occupied,reserved,corridor,allowed);
            if(side){
              robot.yieldTarget=side;
              robot.blockedFor=0;
              this.recordSpecial('notice','통로 양보',`${robot.id} · 빈 대기 칸으로 이동 후 재시도`,now);
            }
          }
          continue;
        }
        robot.blockedFor=0;
        robot.route=route;
        const next=route[0],zone=zoneOf(next);
        if(phase==='backup'){
          const decision=this.classify(robot,robot.job,[robot.cell,next],now);
          robot.drg=decision;
          if(decision==='RED')continue;
        }
        if(this.edges[zone].reserve(key(next),robot.id,occupied,phase==='backup'))robot.next=next;
      }
      this.advanceRobot(robot,dt,occupied);
    }
  }
  findYield(start,occupied,reserved,corridor,allowed) {
    const seen=new Set([key(start)]);
    const queue=[{point:start,depth:0}];
    for(const {point,depth} of queue){
      if(depth>=5)continue;
      for(const next of nextCells(point)){
        const id=key(next);
        if(seen.has(id)||occupied.has(id)||walls.has(id)||reserved.has(id)||!allowed(next))continue;
        seen.add(id);
        const exits=nextCells(next).filter(cell=>allowed(cell)&&!walls.has(key(cell))&&!occupied.has(key(cell)));
        if(!corridor.has(id)&&exits.length>=2)return next;
        queue.push({point:next,depth:depth+1});
      }
    }
    return null;
  }
  verifyHandoff(robot,job){
    const record=this.handoffRecords.get(job.id),scan=this.physicalScans.get(job.id);
    const ok=record?.stage===job.stage&&scan?.stage===job.stage&&record.barcode===job.id&&scan.barcode===job.id
      &&record.location===scan.location&&record.quantity===job.quantity&&scan.quantity===job.quantity&&record.dock===job.dock&&scan.dock===job.dock;
    const check={id:job.id,robot:robot.id,previous:record?.actor??'기록 없음',ok,stage:job.stage,at:this.simTime};
    this.checkTotals[ok?'passed':'held']++;
    this.checks.unshift(check);this.checks.length=Math.min(this.checks.length,120);
    robot.lastCheck=check;
    if(!ok){
      job.auditHold=true;
      this.recordSpecial('notice','2차 검증 불일치',`${robot.id} · 상자 ${job.id} 후속 작업 보류`,this.now);
      this.note(robot.id,`${job.id} · 2차 검증 불일치, 후속 작업 보류`);
    }
    return ok;
  }
  completeStage(job,actor,point){
    const from=job.stage++;
    this.kpi[this.mode].stages++;
    const location=point.join(',');
    // The simulated sensor channel is distinct from the upstream completion record.
    const predecessorClock=this.handoffRecords.get(job.id)?.hlc;
    const oldScan=this.physicalScans.get(job.id);
    this.physicalScans.set(job.id,{...oldScan,stage:job.stage,location});
    this.handoffRecords.set(job.id,{stage:job.stage,actor:actor.predecessor??actor.id,location,barcode:job.id,quantity:job.quantity,dock:job.dock});
    if(this.mode==='offline'){
      const zone=zoneOf(point);
      const log=actor.localLog??this.transportLog.get(actor.id)??[];
      if(!actor.localLog)this.transportLog.set(actor.id,log);
      const clock=this.clocks.get(actor.id)??new HybridClock();
      this.clocks.set(actor.id,clock);
      const seq=log.length+1, scan=this.physicalScans.get(job.id);
      const event=Object.freeze({
        eventId:`${this.epoch}/${actor.id}/${seq}`, taskId:job.id, epoch:this.epoch,
        seq,event:job.stage===STAGES.length?'SHIP_DONE':'HANDOFF_DONE',
        hlc:Object.freeze(clock.tick(this.now,predecessorClock)),node:actor.id,rackId:null,
        scan:scan.barcode===job.barcode&&scan.quantity===job.quantity&&scan.dock===job.dock?'OK':'MISMATCH',
        barcode:scan.barcode,quantity:scan.quantity,dock:scan.dock,from,to:job.stage,zone,location,
      });
      this.handoffRecords.get(job.id).hlc=event.hlc;
      log.push(event);
      this.edges[zone].receive(event,this.epoch,this.now);
      this.localTransfers.push(event);
      if(!actor.localLog)this.note(actor.id,`${job.id} · 컨베이어 인계 완료`,true);
    }
  }
  advanceBelts(dt,now){
    for(const job of this.jobs.values()){
      const belt=job.belt;if(!belt||job.auditHold)continue;
      const lease=this.conveyorLeases.get(belt.id);
      if(this.mode==='offline'&&!covers(lease,job.id,this.epoch,now))continue;
      belt.progress=Math.min(1,belt.progress+dt/4.5);
      if(job.id===this.armTraceId&&belt.progress>=.16&&belt.progress<1&&this.armHandoff?.kind==='placed'){
        this.traceArmHandoff({kind:'transit',id:job.id,beltId:belt.id});
      }
      if(belt.progress===1){
        this.completeStage(job,{id:belt.id,predecessor:belt.actor},belt.to);
        job.belt=null;
        job.armArrival={beltId:belt.id,readyAt:this.simTime+ARM_ARRIVAL_WAIT};
        this.traceArmHandoff({kind:'arrival',id:job.id,beltId:belt.id});
        this.note(belt.id,`${job.id} · 컨베이어 끝 도착 · 로봇팔 인수 대기`);
      }
    }
  }
  advanceRobot(robot,dt,occupied) {
    if(!robot.next)return;
    robot.progress = Math.min(1,robot.progress + dt*3.7);
    robot.position = robot.cell.map((value,i)=>value+(robot.next[i]-value)*robot.progress);
    if (robot.progress === 1) {
      occupied?.delete(key(robot.cell));
      this.edges[zoneOf(robot.cell)].release(key(robot.cell),robot.id);
      robot.cell = robot.next;
      robot.next = null;
      robot.progress = 0;
    }
  }
}
