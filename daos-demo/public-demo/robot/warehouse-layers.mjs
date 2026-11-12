export const ZONES = ['입고 구역','공유 통로','출고 구역'];
const ZONES_BY_ROLE = [[0],[0,1,2],[1,2],[2],[2]];
export const zoneOf = ([x]) => x<11?0:x<22?1:2;
export const LEASE_MARGIN_MS = 500;

export function covers(lease, taskId, epoch, now, duration=0) {
  return Boolean(lease && lease.epoch===epoch && lease.from<=now && lease.taskIds.has(taskId)
    && (lease.until===null || (now<lease.until && now+duration+LEASE_MARGIN_MS<=lease.until)));
}

export class CentralPlan {
  constructor() {
    this.leases=new Map();
    this.revision=0;
  }

  issue(robots,jobIds,epoch,from,until=null) {
    const taskIds=new Set(jobIds);
    const revision=++this.revision;
    this.leases=new Map(robots.map(robot=>[robot.id,ZONES_BY_ROLE[robot.stage].map(zone=>({
      leaseId:`L-${epoch}-${revision}-${robot.id}-${zone}`,
      robotId:robot.id,epoch,resource:`ZONE-${zone}`,zone,from,until,taskIds,
    }))]));
  }

  permits(robot,job,points,epoch,now,duration) {
    const leases=this.leases.get(robot.id)??[];
    return points.every(point=>leases.some(lease=>lease.zone===zoneOf(point)
      && covers(lease,job.id,epoch,now,duration)));
  }

  canRoute(robot,point) {
    return ZONES_BY_ROLE[robot.stage].includes(zoneOf(point));
  }
}

export class HybridClock {
  constructor() { this.physicalMs=0; this.counter=0; }

  tick(now, remote={physicalMs:0,counter:0}) {
    const physicalMs=Math.max(now,this.physicalMs,remote.physicalMs);
    const localCounter=physicalMs===this.physicalMs?this.counter:-1;
    const remoteCounter=physicalMs===remote.physicalMs?remote.counter:-1;
    this.physicalMs=physicalMs;
    this.counter=Math.max(localCounter,remoteCounter)+1;
    return {physicalMs,counter:this.counter};
  }
}

const eventFields=['eventId','taskId','epoch','seq','event','node','from','to','zone','location','rackId','scan','barcode','quantity','dock'];
export function sameEvent(a,b) {
  return Boolean(a&&b&&eventFields.every(field=>a[field]===b[field])
    && a.hlc?.physicalMs===b.hlc?.physicalMs && a.hlc?.counter===b.hlc?.counter);
}

export class ZoneEdge {
  constructor(label) {
    this.label=label;
    this.alive=true;
    this.claims=0;
    this.reservations=new Map();
    this.log=new Map();
    this.conflicts=new Set();
    this.clock=new HybridClock();
  }

  reserve(cell,robotId,occupied,requireEdge) {
    if((requireEdge&&!this.alive)||occupied.has(cell)||this.reservations.has(cell))return false;
    this.reservations.set(cell,robotId);
    occupied.add(cell);
    this.claims++;
    return true;
  }

  release(cell,robotId) {
    if(this.reservations.get(cell)===robotId)this.reservations.delete(cell);
  }

  receive(event,epoch,now) {
    if(!this.alive||event.epoch!==epoch)return false;
    const copy=this.log.get(event.eventId);
    if(copy){
      if(!sameEvent(copy,event))this.conflicts.add(event.eventId);
      return !this.conflicts.has(event.eventId);
    }
    this.clock.tick(now,event.hlc);
    this.log.set(event.eventId,{...event,hlc:{...event.hlc}});
    return true;
  }

  matches(event) {
    return !this.conflicts.has(event.eventId)&&sameEvent(this.log.get(event.eventId),event);
  }
}
