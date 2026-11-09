export const robotsSpec = [
  { id:'IN-01', role:'입고', color:'#43d8f3', task:'입고장 → 검수 선반', rule:'예약된 입고 작업은 전용 통로에서 마친 뒤 대기합니다.',
    route:[[2.5,4.2],[7,4.2],[7,2.9],[2.5,2.9],[2.5,4.2]], pickup:0, drop:1, locks:[], battery:86 },
  { id:'PK-02', role:'피킹', color:'#e7a8ff', task:'보관 선반 → 포장대', rule:'교차구역의 점유를 확인할 수 없으면 진입선 밖에서 멈춥니다.',
    route:[[6,7.4],[9,7.4],[13.4,7.4],[15.6,7.4],[13.4,7.4],[9,7.4],[6,7.4]], pickup:0, drop:3, locks:[2,5], battery:75 },
  { id:'OUT-03', role:'출고', color:'#ffc266', task:'포장대 → 출고장', rule:'교차구역 안에 있으면 확보한 출구까지만 이동합니다. 이후 새 진입을 보류합니다.',
    route:[[13.7,10.4],[11.8,10.4],[11.8,7.4],[11.8,5.5],[17.5,5.5],[11.8,5.5],[11.8,7.4],[11.8,10.4],[13.7,10.4]], pickup:0, drop:4, locks:[2,3,6,7], battery:68 },
  { id:'QC-04', role:'순찰', color:'#81e6a8', task:'안전 통로 순찰 · 충전', rule:'장애 중 배터리가 35% 이하면 전용 통로로 충전 구역에 돌아갑니다.',
    route:[[3.2,11.1],[7,11.1],[7,13],[3.2,13],[3.2,11.1]], pickup:null, drop:3, locks:[], battery:32 },
];

const samePoint=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<0.001;

export function createSimulation(){
  const robots=robotsSpec.map(spec=>({
    ...spec, position:[...spec.route[0]], node:0, edge:null, service:0.45, assigned:true, cargo:spec.pickup===0,
    done:0, state:'work', note:'사전 배정된 작업표 준비', dockPath:null,
  }));
  return {mode:'online',time:0,robots,owner:null,events:[],pending:[],synced:0,nextId:1,recovery:0};
}

function log(sim,robot,message,{local=true}={}){
  const event={id:sim.nextId++,at:sim.time,robot:robot?.id??'SYS',message,local:local&&sim.mode!=='online'};
  sim.events.unshift(event);
  if(sim.events.length>70)sim.events.pop();
  if(event.local)sim.pending.push(event);
}

function setState(sim,robot,state,note,announce=false){
  if(robot.state===state&&robot.note===note)return;
  robot.state=state;
  robot.note=note;
  if(announce)log(sim,robot,note);
}

export function disconnect(sim){
  if(sim.mode!=='online')return;
  sim.mode='offline';
  log(sim,null,'중앙 연결 차단. 사전 작업표와 비상 매뉴얼로 전환했습니다.',{local:false});
  for(const robot of sim.robots){
    if(robot.id==='QC-04'&&robot.battery<=35){
      robot.edge=null;
      const [x,y]=robot.position;
      // The patrol loop has its own open corridor between the robot and the charger.
      robot.dockPath=[[x,11.1],[3.2,11.1]].filter((point,index)=>!samePoint(point,index?[x,11.1]:robot.position));
      setState(sim,robot,'return','배터리 35% 이하 · 전용 통로로 충전 복귀',true);
    }else if(sim.owner===robot.id){
      setState(sim,robot,'exit','교차구역 점유 중 · 확보한 출구까지 이동',true);
    }else if(robot.assigned){
      setState(sim,robot,'offline','사전 배정 작업만 수행',true);
    }else{
      setState(sim,robot,'hold','새 작업 배정 대기',true);
    }
  }
}

export function reconnect(sim){
  if(sim.mode!=='offline')return;
  sim.mode='recovery';
  sim.recovery=2.2;
  log(sim,null,'연결 복구 · 교차구역과 로컬 기록을 확인하는 중입니다.',{local:false});
}

function move(robot,target,distance){
  const dx=target[0]-robot.position[0],dy=target[1]-robot.position[1];
  const left=Math.hypot(dx,dy);
  if(left<=distance){robot.position=[...target];return true;}
  robot.position[0]+=dx/left*distance;
  robot.position[1]+=dy/left*distance;
  return false;
}

function advanceDock(sim,robot,dt){
  const target=robot.dockPath[0];
  if(target){
    if(move(robot,target,dt*1.35))robot.dockPath.shift();
  }else{
    robot.battery=Math.min(100,robot.battery+dt*7);
    if(sim.mode==='online'&&robot.battery>=35){
      robot.dockPath=null;
      robot.node=0;
      robot.assigned=false;
      robot.service=0.3;
      setState(sim,robot,'work','충전 확인 · 순찰 재개');
    }else setState(sim,robot,'charge','충전 구역 도착 · 안전 복귀 확인',true);
  }
}

function advance(sim,robot,dt){
  if(robot.dockPath){
    advanceDock(sim,robot,dt);
    return;
  }
  if(robot.service>0){robot.service=Math.max(0,robot.service-dt);return;}
  const next=robot.node+1;
  if(!robot.edge){
    if(sim.mode==='recovery'&&sim.owner!==robot.id){
      setState(sim,robot,'hold','복구 확인 대기');
      return;
    }
    if(!robot.assigned){
      if(sim.mode!=='online'){
        setState(sim,robot,'hold','사전 작업 완료 · 새 작업 대기',true);
        return;
      }
      robot.assigned=true;
      robot.cargo=robot.pickup===0;
      setState(sim,robot,'work','중앙에서 다음 작업 배정');
    }
    const locked=robot.locks.includes(next);
    if(locked&&sim.owner!==robot.id){
      if(sim.mode!=='online'||sim.owner){
        setState(sim,robot,'hold',sim.mode==='online'?'교차구역 양보 대기':'교차구역 진입 금지 · 정지선 대기',true);
        return;
      }
      sim.owner=robot.id;
    }
    robot.edge={next,locked};
    if(sim.mode==='online')setState(sim,robot,'work','배정 경로 이동');
    else if(sim.mode==='offline'&&sim.owner!==robot.id)setState(sim,robot,'offline','사전 배정 경로 이동');
  }

  robot.battery=Math.max(1,robot.battery-dt*0.12);
  if(!move(robot,robot.route[robot.edge.next],dt*1.62))return;
  robot.node=robot.edge.next;
  robot.edge=null;
  if(sim.owner===robot.id&&!robot.locks.includes(robot.node+1)){
    sim.owner=null;
    if(sim.mode==='offline'){
      setState(sim,robot,'offline','교차구역에서 안전하게 이탈',true);
    }
  }
  if(robot.node===robot.drop){
    robot.cargo=false;
    robot.done+=1;
    robot.service=0.8;
    log(sim,robot,robot.id==='QC-04'?'전용 통로 순찰 완료':'배정 화물 인계 완료');
  }
  if(robot.node===robot.route.length-1){
    robot.node=0;
    robot.assigned=false;
    robot.service=0.5;
  }
}

export function stepSimulation(sim,dt){
  sim.time+=dt;
  for(const robot of sim.robots)advance(sim,robot,dt);
  if(sim.mode!=='recovery')return;
  sim.recovery-=dt;
  if(sim.recovery>0||sim.owner)return;
  const confirmed=sim.pending.length;
  sim.synced+=confirmed;
  for(const event of sim.pending)event.local=false;
  sim.pending=[];
  sim.mode='online';
  for(const robot of sim.robots){
    if(robot.dockPath){
      if(!samePoint(robot.position,robot.route[0]))continue;
      robot.dockPath=null;
      robot.node=0;
      robot.assigned=false;
      robot.service=0.3;
    }
    setState(sim,robot,'work','검증 완료 · 중앙 배정 재개');
  }
  log(sim,null,`로컬 기록 ${confirmed}건 동기화 완료. 중앙 작업을 재개합니다.`,{local:false});
}
