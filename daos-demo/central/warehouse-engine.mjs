export const SIZE = [32, 23];
export const RACKS = [5,10,15].flatMap(y => [9,14,19].map(x => [x,y,3,2]));
export const STAGES = [
  {label:'하차', code:'UL', count:4, color:'#71e4fa', stations:[[2,4],[2,11],[2,18]], rule:'캐시에 있는 당일 작업의 상자를 하차하고 입고 버퍼에 인계합니다.'},
  {label:'운반', code:'AM', count:5, color:'#a4aaff', stations:[[6,4],[6,11],[6,18]], rule:'버퍼의 상자를 공유 통로로 운반합니다. 다른 로봇이 점유한 칸에는 진입하지 않습니다.'},
  {label:'분류', code:'ST', count:4, color:'#dca7fc', stations:[[23,4],[23,11],[23,18]], rule:'저장된 주문의 배송 시간대에 맞춰 상자를 분류합니다.'},
  {label:'출차 배정', code:'DP', count:3, color:'#ffd089', stations:[[27,3],[27,10],[27,17]], rule:'장애 전에 허브 배차가 확정된 상자만 가상 출차 대기열에 넣습니다.'},
  {label:'상차', code:'LD', count:4, color:'#96ebbb', stations:[[30,5],[30,12],[30,19]], rule:'가상 출차 배정까지 마친 상자를 상차합니다. 실제 기사 앱의 배송 상태는 현장에서 관리합니다.'},
];
const key = ([x,y]) => y * SIZE[0] + x;
const nextCells = ([x,y]) => [[x+1,y],[x,y+1],[x-1,y],[x,y-1]].filter(([a,b]) => a>=0 && a<SIZE[0] && b>=0 && b<SIZE[1]);
const walls = new Set(RACKS.flatMap(([x,y,w,h]) => Array.from({length:w*h}, (_,i)=>key([x+i%w,y+Math.floor(i/w)]))));
export const PARKING = [
  [[1,2],[1,7],[1,14],[1,20]], [[5,2],[5,8],[5,15],[5,20],[8,20]],
  [[24,1],[24,7],[24,14],[24,21]], [[26,1],[26,8],[26,15]], [[29,1],[29,8],[29,15],[29,21]],
];
export const timeSlot = time => time >= '18:00' ? 2 : time >= '12:00' ? 1 : time >= '06:00' ? 0 : -1;

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
    this.clock = null;
    this.mode = 'connecting';
    this.daosEnabled = true;
    this.outageAt = null;
    this.reportedPhase = null;
    this.epoch = null;
    this.events = [];
    this.pending = 0;
    this.synced = 0;
    this.resetFleet();
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
  snapshot({online,clock,orders,resetRevision}) {
    const previous = this.mode;
    this.clock = clock;
    if (this.epoch !== null && this.epoch !== resetRevision) {
      this.jobs.clear();
      this.pending = this.synced = 0;
      this.events = [];
      this.resetFleet();
      this.note('관제','전체 시연 리셋을 반영했습니다.');
    }
    this.epoch = resetRevision;
    if (!online) return this.disconnect();
    const incoming = new Set(orders.map(order=>order.id));
    for (const [id,job] of this.jobs) {
      if (!incoming.has(id)) {
        if (job.robot) job.withdrawn = true;
        else this.jobs.delete(id);
      }
    }
    const lanes = new Map();
    for (const order of orders) {
      const group = order.date + '/' + order.segment;
      const lane = lanes.get(group) ?? 0;
      lanes.set(group,lane+1);
      const existing = this.jobs.get(order.id);
      if (existing) {
        existing.withdrawn = false;
        existing.dispatch = order.dispatch;
      } else this.jobs.set(order.id,{...order,stage:0,robot:null,lane:lane%3});
    }
    this.mode = 'online';
    if (previous !== 'online') {
      const count = this.pending;
      this.synced += count;
      this.pending = 0;
      this.note('관제',count?`연결 복구 · 로컬 공정 기록 ${count}건을 화면에 합쳤습니다.`:'DAOS 메인 서버에서 작업표를 받았습니다.');
    }
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
    if ([...this.jobs.values()].some(job=>this.eligible(job))) return 'backup';
    return 'waiting';
  }
  updateOutage(now) {
    const phase = this.offlinePhase(now);
    const messages = {
      stopped:'DAOS OFF · 서버가 복구될 때까지 로봇 공정을 정지합니다.',
      backup:'DAOS 가동 · 미리 저장한 당일 작업표로 로봇 운전을 이어갑니다.',
      waiting:'DAOS 대기 · 지금 시작할 수 있는 백업 작업표가 없습니다.',
    };
    if (phase === this.reportedPhase || !messages[phase]) return;
    this.reportedPhase = phase;
    this.note('관제',messages[phase]);
  }
  eligible(job) {
    return !job.withdrawn && job.date === this.clock?.date && job.segment <= timeSlot(this.clock.time);
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
  tick(dt,now=Date.now()) {
    if (this.mode !== 'online' && this.offlinePhase(now) !== 'backup') return;
    const occupied = new Set(this.robots.flatMap(robot => [key(robot.cell),...(robot.next?[key(robot.next)]:[])]));
    const reserved = new Set(this.robots.flatMap(robot=>robot.stations));
    for (const robot of this.robots) {
      if (!robot.job && !robot.next && key(robot.cell)===key(robot.home)) {
        for (const job of this.jobs.values()) {
          if (job.robot || job.stage!==robot.stage || !this.eligible(job) || (robot.stage>=3&&job.dispatch==null)) continue;
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
        if (robot.work < 0.55 + Math.min(job.quantity,10)*0.07) continue;
        if (robot.fetching) {
          robot.fetching = false;
          robot.target = this.goalFor(robot.stage,job);
          robot.work = 0;
          continue;
        }
        if (job.withdrawn) {
          this.jobs.delete(job.id);
        } else if (robot.stage >= 3 && job.dispatch == null) {
          job.stage = 3;
          this.note(robot.id,'허브 배차 변경 · 상자를 출차 대기로 되돌렸습니다.');
        } else {
          job.stage++;
          robot.done++;
          this.note(robot.id,`${job.product} ${job.quantity}개 · ${STAGES[robot.stage].label} 완료`,this.mode==='offline');
        }
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
