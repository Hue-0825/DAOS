export const ZONES = ['입고 구역','공유 통로','출고 구역'];
const ZONES_BY_ROLE = [[0],[0,1,2],[1,2],[2],[2]];
export const zoneOf = ([x]) => x<11?0:x<22?1:2;

export class CentralPlan {
  constructor() {this.leases=new Map();}
  issue(robots,jobIds,epoch,until) {
    const tasks=new Set(jobIds);
    this.leases=new Map(robots.map(robot=>[robot.id,{
      epoch,until,role:robot.stage,tasks,zones:ZONES_BY_ROLE[robot.stage],
    }]));
  }
  permits(robot,job,points,epoch,now) {
    const lease=this.leases.get(robot.id);
    return lease?.epoch===epoch && now<lease.until && lease.role===job.stage && lease.tasks.has(job.id)
      && points.every(point=>lease.zones.includes(zoneOf(point)));
  }
  canRoute(robot,point) {
    return ZONES_BY_ROLE[robot.stage].includes(zoneOf(point));
  }
}

export class ZoneEdge {
  constructor(label) {
    this.label=label;
    this.claims=0;
    this.log=new Map();
  }
  reserve(cell,occupied) {
    if(occupied.has(cell))return false;
    occupied.add(cell);
    this.claims++;
    return true;
  }
  receive(event) {this.log.set(event.key,{...event});}
  matches(event) {
    const copy=this.log.get(event.key);
    return copy?.id===event.id && copy.epoch===event.epoch && copy.from===event.from
      && copy.to===event.to && copy.location===event.location;
  }
}
