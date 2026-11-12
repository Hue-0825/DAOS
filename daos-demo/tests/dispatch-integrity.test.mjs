import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
import {koreaDay} from '../calendar.mjs';

const sql=new DatabaseSync(':memory:');
const migrations=(await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
for(const name of migrations)sql.exec(await readFile(new URL('../drizzle/'+name,import.meta.url),'utf8'));
function statement(query,args=[]){
  return {
    bind:(...values)=>statement(query,values),
    run(){
      const stmt=sql.prepare(query);
      return stmt.columns().length?{results:stmt.all(...args)}:{meta:stmt.run(...args),results:[]};
    },
    all(){return this.run();},
  };
}
const DB={prepare:statement,async batch(statements){
  sql.exec('BEGIN');
  try{
    const results=statements.map(item=>item.run());
    sql.exec('COMMIT');
    return results;
  }catch(error){sql.exec('ROLLBACK');throw error;}
}};
const send=(path,body)=>worker.fetch(new Request('http://test.local'+path,{
  method:body?'POST':'GET',body:body&&JSON.stringify(body),
  headers:{'Content-Type':'application/json'},
}),{DB});
const today=koreaDay(Date.now());
const row=sql.prepare("SELECT province, region, segment FROM intake WHERE work_date='2026-11-09' AND destination IS NOT NULL LIMIT 1").get();
const order={...row,date:today};
const revision=()=>sql.prepare('SELECT revision FROM control WHERE id=1').get().revision;
const before=revision();
const dispatch=()=>send('/api/hub/dispatch',order);
const result=await Promise.all([dispatch(),dispatch()]);
assert.deepEqual(result.map(item=>item.status).sort(),[200,409]);
assert.equal(revision(),before+1);
assert.equal((await dispatch()).status,409);
assert.equal(revision(),before+1);
const path='/api/driver/events?province='+encodeURIComponent(row.province);
const event={id:crypto.randomUUID(),key:today+'/pickup',date:today,state:'picked',at:new Date().toISOString()};
const post=async item=>(await send(path,{mode:'daos',events:[item]})).json();
assert.deepEqual((await post(event)).acknowledged,[event.id]);
assert.deepEqual((await post(event)).acknowledged,[event.id]);
const duplicate={...event,id:crypto.randomUUID()};
const rejected=await post(duplicate);
assert.deepEqual(rejected.acknowledged,[]);
assert.deepEqual(rejected.unverified,[duplicate.id]);
assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM events').get().count,1);
assert.equal(new URL((await send('/')).headers.get('location')).pathname,'/central/');
assert.equal(new URL((await send('/ops/')).headers.get('location')).pathname,'/central/');
console.log('PASS concurrent dispatch, no-op revision, exact UUID acknowledgment, and local central entry.');
