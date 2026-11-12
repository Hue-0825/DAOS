import assert from 'node:assert/strict';
import {Warehouse,STAGES} from '../robot/warehouse-engine.mjs';
const motion=s=>JSON.stringify({robots:s.robots,jobs:[...s.jobs],beltTime:s.beltTime,checks:s.checkTotals});
const s=new Warehouse(0);
assert.equal(s.robots.length,18);assert.deepEqual(STAGES.map(role=>role.count),[3,6,3,3,3]);
for(let n=1;n<=14000;n++){s.maintainBackup(n*50);s.tick(.05,n*50)}
assert.equal([...s.jobs.values()].filter(j=>j.stage===5).length,54);assert.equal(s.checkTotals.held,0);assert.ok(s.checkTotals.passed>200);
const bad=new Warehouse(0),job=[...bad.jobs.values()].find(j=>j.stage===2);
bad.physicalScans.get(job.id).dock=99;
for(let n=1;n<800;n++){bad.maintainBackup(n*50);bad.tick(.05,n*50)}
assert.equal(job.stage,2);assert.equal(job.auditHold,true);assert.ok(bad.checks.some(c=>c.id===job.id&&!c.ok));
const off=new Warehouse(0);let now=0;
while(![...off.jobs.values()].some(j=>j.belt)){now+=50;off.maintainBackup(now);off.tick(.05,now)}
off.sendBackup(now);off.disconnect(now);const stop=motion(off);off.tick(.05,now+999);assert.equal(motion(off),stop);
const belt=[...off.jobs.values()].find(j=>j.belt).belt,p=belt.progress;off.tick(.05,now+1000);assert.ok(belt.progress>p);
off.setDaos(false);const stopped=motion(off);off.tick(.05,now+1100);assert.equal(motion(off),stopped);
off.setDaos(true);off.restore(now+1200);const recovering=motion(off);off.tick(.05,now+2199);assert.equal(motion(off),recovering);off.updateConnection(now+2200);off.updateConnection(now+3200);off.updateConnection(now+4200);assert.equal(off.mode,'online');
console.log('PASS: 54 parcels finish, 18 robots, independent scan mismatch blocked, conveyors stop/resume with DAOS and both transition pauses.');


const opening = new Warehouse(0,{compact:true});
assert.ok([...opening.jobs.values()].every(job=>job.stage===0&&!job.belt));
const handoffSteps=[];
let finishedAt=0;
for(let now=50;now<=130_000;now+=50){
  opening.maintainBackup(now);
  opening.tick(.05,now);
  const step=opening.armHandoff?.kind;
  if(step&&handoffSteps.at(-1)!==step)handoffSteps.push(step);
  if([...opening.jobs.values()].every(job=>job.stage===5)){
    finishedAt=now;
    break;
  }
}
assert.deepEqual(handoffSteps.slice(0,6),['unload','transport','transit','arrival','pickup','placed']);
assert.ok(finishedAt>=110_000&&finishedAt<=130_000);
console.log('PASS: empty opening belts, ordered tracked carton handoff, and approximately two-minute run.');

function dropRun(chance,roll=0){
  return new Warehouse(0,{compact:true,dropChance:chance,random:()=>roll});
}

function runTo(warehouse,end){
  for(let now=warehouse.now+50;now<=end;now+=50){
    warehouse.maintainBackup(now);
    warehouse.tick(.05,now);
  }
}

function reachDrop(warehouse){
  while(!warehouse.dropIncident&&warehouse.now<90_000)runTo(warehouse,warehouse.now+50);
  assert.ok(warehouse.dropIncident,'AM robot must drop a carton before the cutoff');
  return warehouse.dropIncident;
}

const never=dropRun(0);
const missed=dropRun(33,.33);
for(const warehouse of [never,missed]){
  runTo(warehouse,90_000);
  assert.equal(warehouse.dropIncident,null);
}
const incidentRun=dropRun(33,.32);
const drop=reachDrop(incidentRun);
const affected=incidentRun.robots.find(robot=>robot.id===drop.robotId);
assert.equal(affected.stage,1);
assert.equal(drop.phase,'isolated');
assert.equal(incidentRun.inventoryPositions().get(drop.taskId).kind,'floor');
const progress=incidentRun.kpi.online.stages;
runTo(incidentRun,incidentRun.now+2_100);
assert.equal(drop.phase,'inspection');
assert.deepEqual(affected.cell,drop.point);
assert.ok(incidentRun.robots.every(robot=>robot===affected||
  [robot.cell,robot.next].every(point=>point?.join(',')!==drop.point.join(','))));
assert.ok(incidentRun.kpi.online.stages>=progress);
runTo(incidentRun,130_000);
assert.equal(drop.phase,'resumed');
assert.equal(incidentRun.jobs.get(drop.taskId).stage,5);
assert.equal(incidentRun.specialEvents.filter(event=>event.kind==='drop').length,3);

const cutoff=dropRun(100);
cutoff.dropAt=90_000;
runTo(cutoff,130_000);
assert.equal(cutoff.dropIncident,null);

const duringOutage=dropRun(100);
runTo(duringOutage,10_000);
duringOutage.sendBackup(duringOutage.now,false);
duringOutage.disconnect(duringOutage.now);
const offlineDrop=reachDrop(duringOutage);
duringOutage.restore(duringOutage.now);
const floor=duringOutage.positionPacket.positions.get(offlineDrop.taskId);
assert.equal(floor.kind,'floor');
assert.deepEqual(floor.coordinates,offlineDrop.point);
runTo(duringOutage,duringOutage.now+3_000);
assert.equal(offlineDrop.phase,'isolated','recovery stop must freeze incident handling');
runTo(duringOutage,duringOutage.now+5_200);
assert.equal(offlineDrop.phase,'resumed');

const mismatch=dropRun(100);
const heldDrop=reachDrop(mismatch);
mismatch.physicalScans.get(heldDrop.taskId).quantity=2;
runTo(mismatch,mismatch.now+7_000);
assert.equal(heldDrop.phase,'held');
assert.equal(mismatch.jobs.get(heldDrop.taskId).auditHold,true);
assert.equal(mismatch.inventoryPositions().get(heldDrop.taskId).kind,'floor');
console.log('PASS: per-run probability, 90-second cutoff, floor isolation, restart, DAOS outage snapshot, and failed rescan quarantine.');
