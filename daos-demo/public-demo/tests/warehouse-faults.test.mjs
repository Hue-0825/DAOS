import assert from 'node:assert/strict';
import {Warehouse,SIZE} from '../robot/warehouse-engine.mjs';
import {zoneOf} from '../robot/warehouse-layers.mjs';

for(const kind of ['scan','replica']){
  const sim=new Warehouse(0,{compact:true});
  sim.disconnect(100);
  assert.equal(sim.injectRecoveryFault(kind),null);
  for(let i=22;i<=230;i++)sim.tick(.05,i*50);
  const task=sim.injectRecoveryFault(kind,11500);
  assert.ok(task);
  const centralBefore=sim.centralLocations.get(task);
  sim.restore(11600);
  for(const now of [12600,13600,14600])sim.updateConnection(now);
  assert.equal(sim.mode,'online');
  assert.equal(sim.audit.held,1);
  assert.equal(sim.jobs.get(task).auditHold,true);
  const evidence=sim.audit.comparison.find(row=>row.id===task);
  assert.equal(evidence.result,'held');
  assert.deepEqual(evidence.central,centralBefore);
  assert.ok(evidence.position.coordinates.length===2);
  if(kind==='scan')assert.equal(evidence.position.scan.location,'SCAN-MISMATCH');
  else assert.ok(evidence.logs.some(log=>!log.replicated));
  assert.ok(sim.specialEvents.some(event=>event.title==='복구 검증 · 상자 격리'));
}

const key=([x,y])=>y*SIZE[0]+x;
function place(sim,placements){
  for(const edge of sim.edges)edge.reservations.clear();
  for(const [robot,cell,target] of placements){
    Object.assign(robot,{cell,position:cell,target});
    sim.edges[zoneOf(cell)].reservations.set(key(cell),robot.id);
  }
}
{
  const sim=new Warehouse(0);
  const [a,b]=sim.robots.filter(robot=>robot.stage===1);
  sim.robots=[a,b];
  sim.jobs.clear();
  const allowed=new Set([[10,5],[10,6],[11,5],...[10,11,12,13,14,15].map(x=>[x,4])].map(key));
  sim.central.canRoute=(_,point)=>allowed.has(key(point));
  place(sim,[[a,[12,4],[15,4]],[b,[13,4],[10,4]]]);
  sim.tick(.05,50);
  assert.ok(a.route.length&&b.route.length);
  for(let i=2;i<=250;i++){
    sim.tick(.05,i*50);
    assert.notDeepEqual(a.cell,b.cell);
    assert.notDeepEqual(a.next,b.cell);
    assert.notDeepEqual(b.next,a.cell);
  }
  assert.deepEqual(a.cell,[15,4]);
  assert.deepEqual(b.cell,[10,4]);
  assert.equal(sim.edges.reduce((count,edge)=>count+edge.reservations.size,0),2);
  assert.ok(sim.specialEvents.some(event=>event.title==='통로 양보'));
}
{
  const sim=new Warehouse(0);
  const robot=sim.robots.find(robot=>robot.stage===1);
  sim.robots=[robot];
  sim.jobs.clear();
  place(sim,[[robot,[16,4],[18,4]]]);
  sim.sendBackup(0,false);
  sim.disconnect(100);
  for(let now=38500;now<=46000;now+=50)sim.tick(.05,now);
  assert.notEqual(zoneOf(robot.cell),1);
  assert.equal(sim.offlinePhase(46000),'expired');
  const settled=[...robot.position];
  sim.tick(.05,46500);
  assert.deepEqual(robot.position,settled);
}
{
  const sim=new Warehouse(0,{compact:true});
  assert.ok([...sim.buffers()].some(buffer=>buffer.stage===0));
  const count=sim.backupStagesRemaining;
  sim.disconnect(100);
  for(let i=22;i<=230;i++)sim.tick(.05,i*50);
  assert.ok(sim.backupStagesRemaining<count);
}
console.log('PASS: scan and replica quarantine, retained routes, head-on yield, occupancy release, pre-expiry clearance, visible inbound cargo, and remaining stages.');
