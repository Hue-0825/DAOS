import assert from 'node:assert/strict';
import {Warehouse,STAGES,BACKUP_LIFETIME_MS} from '../robot/warehouse-engine.mjs';
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
const expired=new Warehouse(0);expired.disconnect(100);expired.tick(.05,BACKUP_LIFETIME_MS+1);assert.equal(expired.beltTime,0);
console.log('PASS: 54 parcels finish, 18 robots, independent scan mismatch blocked, conveyors stop/resume with DAOS and both transition pauses, expiry.');


const opening = new Warehouse(0,{compact:true});
assert.ok([...opening.jobs.values()].every(job=>job.stage===0&&!job.belt));
const handoffSteps=[];
let finishedAt=0;
for(let now=50;now<=65_000;now+=50){
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
assert.ok(finishedAt>=55_000&&finishedAt<=65_000);
console.log('PASS: empty opening belts, ordered tracked carton handoff, and approximately one-minute run.');
