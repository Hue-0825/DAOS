export const SIZE = [32, 23];
export const RACKS = [5,10,15].flatMap(y => [9,14,19].map(x => [x,y,3,2]));
export const STAGES = [
  {label:'하차', code:'UL', count:4, color:'#71e4fa', stations:[[2,4],[2,11],[2,18]], rule:'하차한 상자를 입고 버퍼에 내려놓습니다. 버퍼가 차면 운반 로봇이 가져갈 때까지 기다립니다.'},
  {label:'운반', code:'AM', count:5, color:'#a4aaff', stations:[[6,4],[6,11],[6,18]], rule:'버퍼의 상자를 공유 통로로 운반합니다. 다른 로봇이 점유한 칸에는 진입하지 않습니다.'},
  {label:'분류', code:'ST', count:4, color:'#dca7fc', stations:[[23,4],[23,11],[23,18]], rule:'운반 로봇이 넘긴 상자를 출고 도크별로 분류합니다.'},
  {label:'출차 배정', code:'DP', count:3, color:'#ffd089', stations:[[27,3],[27,10],[27,17]], rule:'분류가 끝난 상자에 지정된 출고 도크를 확인하고 상차팀에 넘깁니다.'},
  {label:'상차', code:'LD', count:4, color:'#96ebbb', stations:[[30,5],[30,12],[30,19]], rule:'출고 확인을 마친 상자만 분류 버퍼에서 받아 트럭에 싣습니다.'},
];
const key = ([x,y]) => y * SIZE[0] + x;
const nextCells = ([x,y]) => [[x+1,y],[x,y+1],[x-1,y],[x,y-1]].filter(([a,b]) => a>=0 && a<SIZE[0] && b>=0 && b<SIZE[1]);
const walls = new Set(RACKS.flatMap(([x,y,w,h]) => Array.from({length:w*h}, (_,i)=>key([x+i%w,y+Math.floor(i/w)]))));
export const PARKING = [
  [[1,2],[1,7],[1,14],[1,20]], [[5,2],[5,8],[5,15],[5,20],[8,20]],
  [[24,1],[24,7],[24,14],[24,21]], [[26,1],[26,8],[26,15]], [[29,1],[29,8],[29,15],[29,21]],
];
export const BATCH = 'A-01';

function pathTo(start, end, blocked) {
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
      if (previous.has(id) || walls.has(id) || blocked.has(id)) continue;
      previous.set(id,here);
      queue.push(next);
    }
  }
  return [];
}

export const OUTAGE_ALERT_MS = 2000;

export class Warehouse {
  constructor() {
    this.jobs = new Map();
    this.backup = new Set();
    this.backupAt = null;
    this.mode = 'online';
    this.daosEnabled = true;
    this.outageAt = null;
    this.reportedPhase = null;
    this.events = [];
    this.pending = 0;
    this.synced = 0;
    this.resetFleet();
    const opening = [[38,5],[5,0],[4,5],[3,2],[4,0]];
    for (const [stage,[count,start]] of opening.entries()) {
      for (let i=0; i<count; i++) {
        const id=`${BATCH}-${String(this.jobs.size+1).padStart(2,'0')}`;
        const position=(i+start)%9;
        this.jobs.set(id,{id,stage,segment:position%3,lane:Math.floor(position/3),robot:null});
      }
    }
    this.note('관제',`출고 배치 ${BATCH} · 상자 ${this.jobs.size}개, 진행 중인 공정부터 이어서 작업합니다.`);
  }
  resetFleet() {
    this.robots = STAGES.flatMap((role,stage) => Array.from({length:role.count},(_,n) => {
      const home = PARKING[stage][n];
      return {id:`${role.code}-0${n+1}`,stage,home,cell:home,position:home,job:null,target:home,next:null,progress:0,work:0,done:0,route:[],stations:[]};
    }));
  }
  note(actor,text,local=false) {
    if (local) this.pending++;
    this.events.unshift({actor,text,local,at:new Date().toLocaleTimeString('ko-KR',{hour12:false})});
    this.events.length=Math.min(this.events.length,75);
  }
  sendBackup(now=Date.now()) {
    if (this.mode !== 'online') return false;
    this.backup = new Set([...this.jobs.values()].filter(job=>job.stage<STAGES.length).map(job=>job.id));
    this.backupAt = now;
    this.note('백업',`현장 작업표 전송 완료 · 상자 ${this.backup.size}개`);
    return true;
  }
  restore() {
    if (this.mode !== 'offline') return;
    this.mode = 'online';
    const count = this.pending;
    this.synced += count;
    this.pending = 0;
    this.note('관제',`서버 복구 · 현장 공정 기록 ${count}건을 합쳐 정상 운전으로 복귀했습니다.`);
  }
  get backupRemaining() {
    return [...this.backup].filter(id=>this.jobs.get(id).stage<STAGES.length).length;
  }
  buffers() {
    const buffers=new Map();
    for(const job of this.jobs.values()){
      if(job.robot || job.stage===0 || job.stage>=STAGES.length)continue;
      const point=job.stage===1?this.station(1,job):job.stage===2?this.transfer(job):this.station(2,job);
      const id=key(point);
      const buffer=buffers.get(id)??{point,count:0,stage:job.stage};
      buffer.count++;
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
    this.mode = 'offline';
    this.outageAt = now;
    this.reportedPhase = null;
    this.note('관제','서버 연결 끊김 · 로봇 20대에 장애 경고를 표시합니다.');
  }
  offlinePhase(now=Date.now()) {
    if (this.mode !== 'offline') return null;
    if (now - this.outageAt < OUTAGE_ALERT_MS) return 'alert';
    if (!this.daosEnabled) return 'stopped';
    if (this.backupAt===null) return 'waiting';
    if (this.backupRemaining || this.robots.some(robot=>key(robot.cell)!==key(robot.home))) return 'backup';
    return 'drained';
  }
  updateOutage(now) {
    const phase = this.offlinePhase(now);
    const messages = {
      stopped:'DAOS OFF · 서버가 복구될 때까지 로봇 공정을 정지합니다.',
      backup:'현장 자율운전 · 받은 작업표로 로봇 간 인계를 재개합니다.',
      waiting:'작업표 미수신 · 로봇이 백업 작업표를 기다립니다.',
      drained:'백업 작업표의 공정을 모두 마쳤습니다. 추가 물량을 기다립니다.',
    };
    if (phase === this.reportedPhase || !messages[phase]) return;
    this.reportedPhase = phase;
    this.note('관제',messages[phase]);
  }
  canHandoff(job) {
    if(job.stage>=3)return true;
    const count=[...this.jobs.values()].filter(next=>next.segment===job.segment&&next.lane===job.lane&&next.stage===job.stage+1).length;
    return count<2;
  }
  station(stage, job) {
    const [x,y] = STAGES[stage].stations[job.segment];
    return [x,y+(job.lane-1)*2];
  }
  transfer(job) {
    const [,y] = this.station(2,job);
    return [22,y];
  }
  goalFor(stage, job) {
    if (stage === 0) return this.station(1,job);
    if (stage === 1) return this.transfer(job);
    return this.station(stage,job);
  }
  pickupFor(stage, job) {
    if (stage === 2) return this.transfer(job);
    if (stage === 4) return this.station(2,job);
    return stage < 2 ? this.station(stage,job) : null;
  }
  robotStatus(robot,phase) {
    if (phase==='alert') return '장애 감지';
    if (phase==='stopped') return '안전 정지';
    if (phase==='waiting') return '작업표 대기';
    if (phase==='drained') return '작업 완료';
    if (!robot.job) return key(robot.cell)===key(robot.home)?'인계 대기':'복귀 중';
    if (!robot.next && key(robot.cell)!==key(robot.target)) return '통행 대기';
    return robot.fetching?'인수 중':`${STAGES[robot.stage].label} 중`;
  }
  tick(dt,now=Date.now()) {
    if (this.mode !== 'online' && this.offlinePhase(now) !== 'backup') return;
    const occupied = new Set(this.robots.flatMap(robot => [key(robot.cell),...(robot.next?[key(robot.next)]:[])]));
    const reserved = new Set(this.robots.flatMap(robot=>robot.stations));
    for (const robot of this.robots) {
      if (!robot.job && !robot.next && key(robot.cell)===key(robot.home)) {
        for (const job of this.jobs.values()) {
          if (job.robot || job.stage!==robot.stage || (!this.backup.has(job.id)&&this.mode==='offline') || !this.canHandoff(job)) continue;
          const pickup = this.pickupFor(robot.stage,job);
          const goal = this.goalFor(robot.stage,job);
          const stations = (pickup?[pickup,goal]:[goal]).map(key);
          if (stations.some(id=>reserved.has(id)||occupied.has(id))) continue;
          robot.job = job;
          job.robot = robot.id;
          robot.work = 0;
          robot.target = pickup ?? goal;
          robot.fetching = Boolean(pickup);
          robot.stations = stations;
          for(const id of stations) reserved.add(id);
          break;
        }
      }
      if (!robot.next && key(robot.cell) === key(robot.target) && robot.job) {
        const job = robot.job;
        robot.work += dt;
        if (robot.work < (robot.stage===3?1.25:.65)) continue;
        if (robot.fetching) {
          robot.fetching = false;
          robot.target = this.goalFor(robot.stage,job);
          robot.work = 0;
          continue;
        }
        job.stage++;
        robot.done++;
        const next = STAGES[job.stage]?.label;
        this.note(robot.id,`${job.id} · ${next?`${STAGES[robot.stage].label} 완료 → ${next} 인계`:'트럭 상차 완료'}`,this.mode==='offline');
        job.robot = null;
        robot.job = null;
        robot.target = robot.home;
        for(const id of robot.stations) reserved.delete(id);
        robot.stations = [];
        continue;
      }
      if (!robot.next && key(robot.cell)!==key(robot.target)) {
        robot.route = pathTo(robot.cell,robot.target,occupied);
        robot.next = robot.route[0] ?? null;
        if (robot.next) occupied.add(key(robot.next));
      }
      if (!robot.next) {
        robot.route = [];
        continue;
      }
      robot.progress = Math.min(1,robot.progress + dt*5.8);
      robot.position = robot.cell.map((value,i)=>value+(robot.next[i]-value)*robot.progress);
      if (robot.progress === 1) {
        occupied.delete(key(robot.cell));
        robot.cell = robot.next;
        robot.next = null;
        robot.progress = 0;
      }
    }
  }
}
