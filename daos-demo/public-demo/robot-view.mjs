import { createSimulation, disconnect, reconnect, stepSimulation } from './robot-sim.mjs';
import { createScene } from './warehouse-scene.mjs';

const $=id=>document.getElementById(id);
const scene=createScene($('warehouse'));
const modes={online:'● 연결됨',offline:'● 연결 끊김',recovery:'● 복구 확인 중'};
const states={work:'작업 중',offline:'독립 운행',exit:'안전 이탈',hold:'대기',return:'충전 복귀',charge:'충전 중'};
const pad=n=>String(n).padStart(2,'0');
const timeLabel=t=>`${pad(Math.floor(t/60))}:${pad(Math.floor(t%60))}`;
let sim=createSimulation();
let selected=sim.robots[0].id;
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let previous=performance.now();
let interfaceAt=-Infinity;
let lastLog=0;
const rows=new Map();

for(const robot of sim.robots){
  const button=document.createElement('button');
  button.type='button';
  button.className='robot-row';
  button.style.setProperty('--robot',robot.color);
  button.innerHTML=`<i aria-hidden="true"></i><span><b>${robot.id} · ${robot.role}</b><small></small></span><em></em>`;
  button.onclick=()=>select(robot.id);
  $('fleet').append(button);
  rows.set(robot.id,button);
}

function select(id){
  selected=id;
  updateInterface();
  scene.draw(sim,selected);
}

function updateEvents(){
  if(lastLog===sim.nextId)return;
  lastLog=sim.nextId;
  const rows=sim.events.map(event=>{
    const li=document.createElement('li');
    const time=document.createElement('time');
    const owner=document.createElement('b');
    const message=document.createElement('span');
    time.textContent=timeLabel(event.at);
    owner.textContent=event.robot;
    message.textContent=event.local?`로컬 저장 · ${event.message}`:event.message;
    if(event.local)message.className='local';
    li.append(time,owner,message);
    return li;
  });
  if(!rows.length){
    const empty=document.createElement('li');
    empty.textContent='로봇의 작업을 시작합니다.';
    rows.push(empty);
  }
  $('events').replaceChildren(...rows);
}

function updateInterface(){
  $('mode').textContent=modes[sim.mode];
  $('mode').dataset.mode=sim.mode;
  $('connection').textContent=sim.mode==='online'?'서버 연결 끊기':sim.mode==='offline'?'연결 복구':'복구 확인 중';
  $('connection').classList.toggle('restore',sim.mode!=='online');
  $('connection').disabled=sim.mode==='recovery';
  $('pause').textContent=paused?'계속 실행':'일시정지';
  $('pause').setAttribute('aria-pressed',String(paused));
  $('completed').textContent=sim.robots.reduce((sum,robot)=>sum+robot.done,0)+'건';
  $('pending').textContent=sim.pending.length+'건';
  $('synced').textContent=sim.synced+'건';
  $('time').textContent=timeLabel(sim.time);
  for(const robot of sim.robots){
    const button=rows.get(robot.id);
    button.setAttribute('aria-pressed',String(robot.id===selected));
    button.querySelector('small').textContent=`배터리 ${Math.floor(robot.battery)}% · 완료 ${robot.done}건`;
    button.querySelector('em').textContent=states[robot.state];
  }
  const robot=sim.robots.find(item=>item.id===selected);
  $('robot-name').textContent=`${robot.id} · ${robot.role}`;
  $('robot-rule').textContent=robot.rule;
  $('robot-note').textContent=robot.note;
  $('robot-task').textContent=robot.task;
  updateEvents();
}

$('connection').onclick=()=>{
  if(sim.mode==='online')disconnect(sim);
  else if(sim.mode==='offline')reconnect(sim);
  updateInterface();
  scene.draw(sim,selected);
};
$('pause').onclick=()=>{paused=!paused;updateInterface();};
$('reset').onclick=()=>{
  sim=createSimulation();
  selected=sim.robots[0].id;
  lastLog=0;
  updateInterface();
  scene.draw(sim,selected);
};
$('warehouse').addEventListener('click',event=>{
  const hit=scene.pick(event,sim.robots);
  if(hit)select(hit);
});
document.addEventListener('visibilitychange',()=>{previous=performance.now()});
function animate(now){
  const dt=Math.min(0.05,Math.max(0,(now-previous)/1000));
  previous=now;
  if(!paused){
    stepSimulation(sim,dt);
    scene.draw(sim,selected);
  }
  if(now-interfaceAt>180){
    updateInterface();
    interfaceAt=now;
  }
  requestAnimationFrame(animate);
}

scene.draw(sim,selected);
updateInterface();
requestAnimationFrame(animate);
