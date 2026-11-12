import {PARKING,RACKS,SIZE,STAGES,BELTS,inFloor,ARM_CYCLE_SECONDS} from './warehouse-engine.mjs?v=25';

const W=1320,H=700;
const project=(x,y,z=0)=>[540+(x-y)*20,69+(x+y)*10.7-z];
const recoveryBubbles={
  stop:{step:'1/3',label:'상자 위치 저장',accent:'#865016',fill:'#fff1d6',ink:'#623a0e'},
  positions:{step:'2/3',label:'메인 서버로 전송',accent:'#2855a1',fill:'#e2edff',ink:'#173c76'},
  reconcile:{step:'3/3',label:'위치 수신 · 대조',accent:'#6543a5',fill:'#eee5ff',ink:'#442776'},
};

export function createScene(canvas){
  const ctx=canvas.getContext('2d');
  const backdrop=document.createElement('canvas');
  backdrop.width=W;
  backdrop.height=H;
  const bg=backdrop.getContext('2d');
  const objects=[];
  const signs=[];
  const boxes=[['#b58953','#805a34','#a27343'],['#7d97a5','#496776','#688894'],['#c6a16d','#8c633d','#a77b52']];
  const storage=['#8095ab','#354c65','#4f6983'];
  const palettes=[
    {top:'#b6c9d8',left:'#607d96',right:'#435d77'},
    {top:'#8495ac',left:'#3f506b',right:'#2d3b52'},
    {top:'#e5e8ef',left:'#afb9cd',right:'#7a88a4'},
    {top:'#edb679',left:'#c38648',right:'#926338'},
    {top:'#9bf3b8',left:'#49a474',right:'#2d825d'},
  ];

  function polygon(target,points,fill,stroke,width=1){
    target.beginPath();
    points.forEach(([x,y],index)=>index?target.lineTo(x,y):target.moveTo(x,y));
    target.closePath();
    if(fill){target.fillStyle=fill;target.fill();}
    if(stroke){target.strokeStyle=stroke;target.lineWidth=width;target.stroke();}
  }
  function rectangle(target,x,y,w,d,fill,stroke){
    polygon(target,[project(x,y),project(x+w,y),project(x+w,y+d),project(x,y+d)],fill,stroke);
  }
  function line(target,points,color,width=1,dash=[]){
    target.beginPath();
    target.setLineDash(dash);
    points.forEach(([x,y],index)=>index?target.lineTo(x,y):target.moveTo(x,y));
    target.strokeStyle=color;
    target.lineWidth=width;
    target.stroke();
    target.setLineDash([]);
  }
  function prism(target,x,y,w,d,z,h,[top,left,right],outline='#102135'){
    const a=project(x,y,z+h),b=project(x+w,y,z+h),c=project(x+w,y+d,z+h),e=project(x,y+d,z+h);
    const bb=project(x+w,y,z),cc=project(x+w,y+d,z),ee=project(x,y+d,z);
    polygon(target,[e,c,cc,ee],left,outline);
    polygon(target,[b,c,cc,bb],right,outline);
    polygon(target,[a,b,c,e],top,outline);
  }
  function text(target,value,x,y,color,size=12,align='left'){
    target.font=`750 ${size}px system-ui, sans-serif`;
    target.textAlign=align;
    target.fillStyle=color;
    target.fillText(value,x,y);
  }
  function sign(target,label,x,y,color='#b9d7e9'){
    const [sx,sy]=project(x,y);
    target.font='750 12px system-ui, sans-serif';
    const w=target.measureText(label).width+16;
    target.fillStyle='#102034';
    target.fillRect(sx-w/2,sy-16,w,19);
    target.strokeStyle='#33526a';
    target.strokeRect(sx-w/2,sy-16,w,19);
    text(target,label,sx,sy-3,color,12,'center');
  }
  function rack(x,y){
    objects.push({depth:x+y+2.1,draw(target){
      prism(target,x,y,1.5,0.74,0,4,storage);
      for(let level=0;level<3;level++){
        const z=level*11+5;
        for(let crate=0;crate<3;crate++){
          prism(target,x+.10+crate*.44,y+.08,.39,.56,z,6,boxes[(crate+level)%boxes.length]);
        }
        prism(target,x,y,1.5,.74,z+7,3,storage);
      }
      for(const [dx,dy] of [[0,0],[1.44,0],[0,.69],[1.44,.69]]){
        prism(target,x+dx,y+dy,.06,.06,0,37,['#85a9be','#426884','#426884'],'#395d75');
      }
    }});
  }
  function station(x,y,w,d,height,style){
    objects.push({depth:x+y+w+d,draw:target=>prism(target,x,y,w,d,0,height,style)});
  }

  const gradient=bg.createRadialGradient(610,335,80,610,335,690);
  gradient.addColorStop(0,'#26435a');
  gradient.addColorStop(1,'#0b1728');
  bg.fillStyle=gradient;
  bg.fillRect(0,0,W,H);

  const footprint=[[-.5,-.5],[31.5,-.5],[31.5,21.5],[28.5,21.5],[28.5,22.5],[3.5,22.5],[3.5,19.5],[-.5,19.5]];
  polygon(bg,footprint.map(([x,y])=>project(x,y)), '#23364d','#58627e',2);
  for(let i=0;i<footprint.length;i++){
    const a=footprint[i],b=footprint[(i+1)%footprint.length];
    polygon(bg,[project(...a),project(...b),project(...b,-14),project(...a,-14)],'#18263c','#334863');
  }
  for(let x=0;x<SIZE[0];x++)for(let y=0;y<SIZE[1];y++){
    if(inFloor([x,y])&&(x+y)%2===0)rectangle(bg,x-.5,y-.5,1,1,'#273b51');
  }
  for(const y of [4,11,18])line(bg,[project(4,y+.5),project(18,y+.5)],'#758093',1.1,[5,7]);
  for(const x of [8,17])line(bg,[project(x+.5,1),project(x+.5,21)],'#758093',1.1,[5,7]);
  for(let x=0;x<32;x+=2)prism(bg,x-.45,-.48,1.93,.22,0,25,['#3a5b72','#294356','#1b354a'],'#294255');
  for(let y=0;y<19;y+=2)prism(bg,-.49,y-.45,.19,1.93,0,18,['#375a71','#29455a','#2c4b5f'],'#294255');

  function drawTruck(target,x,y,inbound){
    const body=inbound?['#a5c9de','#597b97','#416481']:['#d2d4e4','#828ca8','#626e8d'];
    const cab=inbound?['#6fb9cc','#327286','#225365']:['#9e9bd0','#655d95','#47426e'];
    prism(target,x-.52,y-1.56,1.04,3.08,2,3,['#536277','#26384b','#35475b']);
    for(const axle of [-.94,-.55,1.1]){
      for(const side of [-.55,.55]){
        const [wx,wy]=project(x+side,y+axle,3.5);
        target.beginPath();target.ellipse(wx,wy,4.6,6,-.32,0,Math.PI*2);
        target.fillStyle='#101923';target.fill();
        target.beginPath();target.ellipse(wx,wy,2.1,2.8,-.32,0,Math.PI*2);
        target.fillStyle='#8b9db0';target.fill();
      }
    }
    prism(target,x-.51,y-1.53,1.02,2.07,6,17,body);
    for(let rib=-1.36;rib<.45;rib+=.25)
      line(target,[project(x+.51,y+rib,7),project(x+.51,y+rib,21)],'#c3d5e24f',.8);
    prism(target,x-.49,y+.62,.98,.94,5,8,cab);
    prism(target,x-.45,y+.64,.9,.58,13,6,cab);
    polygon(target,[project(x-.4,y+1.23,18),project(x+.4,y+1.23,18),project(x+.4,y+1.43,13.6),project(x-.4,y+1.43,13.6)],'#162a3e','#a7bfcc');
    polygon(target,[project(x+.46,y+.74,17.9),project(x+.46,y+1.16,17.9),project(x+.46,y+1.29,13.7),project(x+.46,y+.74,13.7)],'#274257','#8398ad');
    line(target,[project(x-.24,y+1.568,8),project(x+.24,y+1.568,8)],'#182b3c',3);
    for(const side of [-.35,.35]){
      line(target,[project(x+side-.07,y+1.57,9),project(x+side+.07,y+1.57,9)],'#fff0bb',2.5);
      prism(target,x+side-.05,y-1.57,.1,.05,6,2,['#f3a4a4','#b85158','#db7076']);
    }
    line(target,[project(x-.47,y+1.58,5),project(x+.47,y+1.58,5)],'#a4b2c4',2);
  }

  const outlines=['#5094a6','#7383b4','#9c6caa','#9a7951','#578779'];
  function drawConveyor(target,belt,moving,time){
    const [x,y]=belt.from, length=belt.to[0]-x;
    const steel=['#9aaec1','#50667c','#657c92'];
    const frame=['#57697e','#28374b','#374a60'];
    for(const offset of [.18,length/2,length-.18]){
      for(const side of [-.31,.25]){
        prism(target,x+offset,y+side,.10,.09,0,8,steel);
        prism(target,x+offset-.07,y+side-.05,.23,.18,0,1,frame);
      }
      prism(target,x+offset,y-.30,.10,.63,2,1,frame);
    }
    prism(target,x,y-.37,length,.74,6,3,frame);
    for(let roller=.09;roller<length;roller+=.19){
      const shine=moving? .52+.38*Math.cos(roller*5-time*12):.45;
      line(target,[project(x+roller,y-.28,10),project(x+roller,y+.28,10)],'#121c2c',3);
      line(target,[project(x+roller-.028,y-.28,10),project(x+roller-.028,y+.28,10)],`rgba(200,220,236,${shine})`,1.5);
    }
    for(const side of [-.39,.30])prism(target,x,y+side,length,.09,8,4,steel);
    prism(target,x+length*.55,y+.37,.40,.29,3,5,frame);
    const [lightX,lightY]=project(x+length*.66,y+.68,6);
    target.fillStyle=moving?'#83e0b3':'#697d91';
    target.fillRect(lightX-2,lightY-1,4,2);
  }

  for (const [index,role] of STAGES.entries()) {
    for (const [n,[x,y]] of role.stations.entries()) {
      rectangle(bg,x-1.05,y-1,2.1,2.1,'#0d2639',outlines[index]);
      for(let i=-.77;i<.8;i+=.34)line(bg,[project(x+i,y+.83),project(x+i+.11,y+.64)],outlines[index],1.2);
      signs.push([`${role.label} ${n+1}`,x+.15,y+1.15,role.color]);
      if(index===0 || index===4){
        const truckX=index===0?x-1.35:x+1.35;
        objects.push({depth:truckX+y+1.8,draw:target=>drawTruck(target,truckX,y,index===0)});
      } else if(!role.fixed) {
        station(x-.73,y-.7,.42,.6,index===3?11:5,
          index===3?['#7fb8c9','#31536a','#446d81']:boxes[index%boxes.length]);
      }
    }
  }
  for(const parking of PARKING)for(const [x,y] of parking)rectangle(bg,x-.36,y-.36,.72,.72,null,'#58788b');
  for(const [x,y,w] of RACKS){
    if(y===20){
      objects.push({depth:x+y+1.2,draw:target=>{
        prism(target,x-.4,y-.4,1.8,1,0,3,['#b19573','#75604d','#8c7254']);
        for(let col=0;col<3;col++)for(let level=0;level<2;level++)prism(target,x-.28+col*.53,y-.30,.47,.65,3+level*8,8,boxes[col%3]);
      }});
    }else{
      for(let dx=0;dx<w;dx+=1.48)rack(x+dx-.45,y-.47);
      for(let dx=0;dx<w;dx+=1.48)rack(x+dx-.45,y+.47);
    }
  }
  // Marked buffer and charger areas fill the factory without adding moving agents.
  for(const y of [4,11,18]){
    rectangle(bg,3,y+1.2,3,1.6,'#2d3a4d','#968664');
    objects.push({depth:5+y+2,draw:target=>{
      prism(target,3.3,y+1.4,1.4,1,0,3,['#b59b78','#705840','#8d7455']);
      for(let k=0;k<2;k++)prism(target,3.4+k*.6,y+1.5,.51,.72,3,9,boxes[k]);
    }});
  }
  for(let n=0;n<3;n++){
    const x=5+n*1.25,y=21;
    rectangle(bg,x-.4,y-.4,.9,.9,'#243c40','#71a9a1');
    station(x-.4,y-.7,.75,.2,9,['#9ba9b9','#4b566d','#65718c']);
  }
  sign(bg,'입고 대기',4.4,19.8,'#dfbf83');
  sign(bg,'충전 · 대기',6.2,22,'#96d9c0');
  sign(bg,'보관 랙 / 재고 버퍼',12.2,3.7,'#b8c8dd');
  sign(bg,'출고 대기 팔레트',13,22,'#dfbf83');
  text(bg,'DAOS / ROBOTS + FACILITY',30,38,'#acc6d9',15);
  text(bg,'INBOUND  /  SORTATION  /  OUTBOUND',30,57,'#6b8da6',10);
  line(bg,[[30,69],[154,69]],'#638299',1);

  let lastFrame;
  let bubbleLayout=[];
  let armHitAreas=new Map();
  function resize(){
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=W*ratio;
    canvas.height=H*ratio;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    if(lastFrame)draw(...lastFrame);
  }
  resize();
  window.addEventListener('resize',resize);

  function drawRobot(robot,active,sim,recordHit=true){
    const [x,y]=robot.position;
    const [sx,sy]=project(x,y);
    const {top,left,right}=palettes[robot.stage];
    ctx.save();ctx.translate(sx,sy);ctx.scale(STAGES[robot.stage].fixed?1.6:1.3,STAGES[robot.stage].fixed?1.6:1.3);ctx.translate(-sx,-sy);
    ctx.fillStyle='#07111c9c';
    ctx.beginPath();ctx.ellipse(sx,sy+3,13,5,0,0,Math.PI*2);ctx.fill();
    if(active){
      ctx.beginPath();ctx.ellipse(sx,sy+2,15,7,0,0,Math.PI*2);
      ctx.strokeStyle=top;ctx.lineWidth=1.5;ctx.stroke();
    }
    const body=[top,left,right],dark=['#34505b','#172831','#263c46'];
    const metal=['#cad3d1','#718786','#8a9e9d'];
    const sensor=['#d4f4ed','#567c7c','#739895'];
    prism(ctx,x-.30,y-.26,.59,.51,0,4,dark);
    let deck=9;
    switch(robot.stage){
      case 0: // Forklift: counterweight, twin mast rails and steel forks.
        prism(ctx,x-.43,y-.29,.50,.58,3,10,body);
        prism(ctx,x-.37,y-.22,.24,.42,13,3,dark);
        for(const side of [-.23,.17]){
          prism(ctx,x+.02,y+side,.09,.09,3,19,metal);
          prism(ctx,x+.11,y+side,.48,.10,3,2,metal);
        }
        prism(ctx,x+.02,y-.24,.10,.50,19,3,body);
        deck=5;
        break;
      case 1: // Transport AMR: wide, low pallet deck and sensor strip.
        prism(ctx,x-.46,y-.36,.91,.72,2,6,body);
        prism(ctx,x-.38,y-.31,.74,.62,8,2,dark);
        prism(ctx,x-.46,y+.30,.90,.05,4,1,['#aaa6f5','#7775c4','#7775c4']);
        for(const side of [-.23,.17])prism(ctx,x-.33,y+side,.66,.06,10,1,metal);
        prism(ctx,x+.38,y-.17,.06,.33,6,1,sensor);
        deck=11;
        break;
      case 2:
      case 3: { // Fixed industrial arm: bolted base, shoulder, elbow, wrist, tool.
        prism(ctx,x-.45,y-.40,.90,.80,0,7,dark);
        prism(ctx,x-.32,y-.29,.64,.58,7,9,body);
        for(const dx of [-.33,.30])for(const dy of [-.28,.25])prism(ctx,x+dx,y+dy,.06,.06,7,2,metal);
        const operating=robot.job&&robot.checked&&robot.checkUntil<=sim.simTime;
        const progress=operating?Math.min(robot.work/ARM_CYCLE_SECONDS,1):0;
        // The arm art is enlarged around its anchor; undo that scale for real transfer points.
        const scale=1.6;
        const input=[x,y,10/scale];
        const output=robot.stage===2?[x+1/scale,y,10/scale]:[x+.87/scale,y+.20/scale,4/scale];
        const raised=([a,b])=>[a,b,29];
        const poses=[[0,raised(input)],[.19,input],[.36,raised(input)],
          [.60,raised(output)],[.77,output],[.86,raised(output)],[1,raised(input)]];
        const end=poses.findIndex(([time],i)=>i>0&&progress<=time);
        const [startTime,start]=poses[end-1], [endTime,finish]=poses[end];
        const fraction=(progress-startTime)/(endTime-startTime);
        const blend=fraction*fraction*(3-2*fraction);
        const [toolX,toolY,toolZ]=start.map((value,i)=>value+(finish[i]-value)*blend);
        const toolLength=robot.stage===2?19:15;
        const shoulder=project(x-.30,y+.62,18);
        const elbow=project(x-.42+(toolX-x)*.3,y+.45,44+toolZ*.13);
        const wrist=project(toolX,toolY,toolZ+toolLength+7);
        if(recordHit){
          armHitAreas.set(robot.id,[shoulder,elbow,wrist,[wrist[0],wrist[1]+toolLength]]
            .map(([px,py])=>[sx+(px-sx)*scale,sy+(py-sy)*scale]));
        }
        ctx.lineCap='round';ctx.lineJoin='round';
        line(ctx,[shoulder,elbow,wrist],'#172139',16);
        line(ctx,[shoulder,elbow],top,12);line(ctx,[elbow,wrist],left,11);
        line(ctx,[shoulder.map((v,i)=>v+(i?-2:-3)),elbow.map((v,i)=>v+(i?-2:-3))],'#e3e4ed',2);
        line(ctx,[elbow.map((v,i)=>v+(i?-2:-2)),wrist.map((v,i)=>v+(i?-2:-2))],top,3);
        line(ctx,[[shoulder[0]+6,shoulder[1]],[elbow[0]+7,elbow[1]],[wrist[0]+4,wrist[1]]],'#121b2a',2);
        for(const [jx,jy]of [shoulder,elbow,wrist]){ctx.beginPath();ctx.arc(jx,jy,5.5,0,Math.PI*2);ctx.fillStyle='#35445c';ctx.fill();ctx.strokeStyle=top;ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(jx,jy,2,0,Math.PI*2);ctx.fillStyle='#aab7cb';ctx.fill();}
        const [wx,wy]=wrist;
        line(ctx,[[wx,wy],[wx,wy+10]],'#d4dce9',4);
        if(robot.stage===2){
          line(ctx,[[wx-7,wy+9],[wx-7,wy+18],[wx-3,wy+19]],'#cbd6e6',2.5);
          line(ctx,[[wx+7,wy+9],[wx+7,wy+18],[wx+3,wy+19]],'#cbd6e6',2.5);
          prism(ctx,x-.65,y-.6,.18,.16,12,23,dark);
          prism(ctx,x-.68,y-.62,.27,.23,35,5,body);
          if(robot.checking)line(ctx,[project(x-.5,y-.5,35),project(x+.1,y+.1,9)],'#7ff1fa',1.6,[3,2]);
        }else{
          line(ctx,[[wx-9,wy+10],[wx+9,wy+10]],top,4);
          for(const dx of [-6,6]){ctx.beginPath();ctx.ellipse(wx+dx,wy+15,4,2,0,0,Math.PI*2);ctx.fillStyle='#191b2e';ctx.fill();}
          prism(ctx,x+.46,y-.12,.57,.52,0,3/scale,['#bda27c','#705a46','#917455']);
        }
        if(robot.job){
          const [cx,cy,cz]=progress<.19?input:progress<.77?[toolX,toolY,toolZ]:output;
          const half=.22/scale, boxHeight=8/scale;
          prism(ctx,cx-half,cy-half,2*half,2*half,cz,boxHeight,boxes[0]);
          line(ctx,[project(cx,cy-half,cz+boxHeight),project(cx,cy+half,cz+boxHeight)],'#f7dba0',1.25);
        }
        deck=8;
        break;
      }
      case 4: // Loader: lift cage and raised pallet platform.
        prism(ctx,x-.42,y-.36,.84,.72,2,6,body);
        for(const side of [-.24,.16]){
          prism(ctx,x-.28,y+side,.10,.10,8,10,metal);
          prism(ctx,x+.17,y+side,.10,.10,8,10,metal);
        }
        prism(ctx,x-.34,y-.30,.68,.60,17,3,body);
        prism(ctx,x-.30,y-.24,.60,.48,20,1,metal);
        deck=21;
        break;
    }
    if(robot.job&&!robot.fetching&&!STAGES[robot.stage].fixed){
      const offset=robot.stage===0?.23:-.17;
      prism(ctx,x+offset,y-.16,.34,.34,deck,7,boxes[robot.stage%boxes.length]);
      line(ctx,[project(x+offset+.15,y-.15,deck+7),project(x+offset+.15,y+.17,deck+7)],'#e0c29a',1);
    }
    if(!STAGES[robot.stage].fixed){
      for(const dx of [-.35,.28])for(const dy of [-.32,.27])prism(ctx,x+dx,y+dy,.13,.12,0,4,dark);
      const [lx,ly]=project(x-.18,y-.12,robot.stage===0?18:12);
      ctx.beginPath();ctx.arc(lx,ly,2.4,0,Math.PI*2);ctx.fillStyle='#9af5ef';ctx.fill();
    }
    ctx.restore();
    if(recordHit)text(ctx,robot.id,sx,sy+17,top,11,'center');
  }
  function drawBubbles(sim,selected,manualStop,now){
    const phase=sim.offlinePhase(now)??'online';
    const backup=phase==='backup';
    const stopped=phase==='stopped'||manualStop;
    const recovery=phase==='recovering'?recoveryBubbles[sim.recoveryPhase]:null;
    const badgeWidth=backup||stopped||recovery?32:0;
    const warning=['recovering','handover','expired'].includes(phase);
    const fill=recovery?.fill??(stopped?'#ffe1e4':backup?'#d7eee2':warning?'#efe2cb':'#e0e8f1');
    const height=20,gap=5;
    const previous=new Map(bubbleLayout.map(item=>[item.robot.id,item]));
    const layout=[];
    const occupied=[{left:20,top:18,width:235,height:55},{left:1082,top:14,width:225,height:162}];
    const overlaps=(left,top,width)=>occupied.some(box=>
      left<box.left+box.width+gap&&left+width+gap>box.left&&
      top<box.top+box.height+gap&&top+height+gap>box.top);
    ctx.font='750 12px system-ui, sans-serif';
    const robots=[...sim.robots].sort((a,b)=>
      Number(b.id===selected)-Number(a.id===selected)||Number(Boolean(b.job))-Number(Boolean(a.job)));
    for(const robot of robots){
      const [x,y]=project(...robot.position);
      const label=recovery?.label??(manualStop?'일시정지':sim.robotStatus(robot,phase));
      const width=Math.max(recovery?105:50,Math.ceil(ctx.measureText(label).width)+14)+badgeWidth;
      const anchor=STAGES[robot.stage].fixed?(armHitAreas.get(robot.id)?.[1]??[x,y-68]):[x,y-27];
      const base=anchor[1]-height-9;
      const preferred=previous.get(robot.id);
      let best=null;
      for(let row=-5;row<=4;row++){
        for(let column=-4;column<=4;column++){
          const left=Math.max(gap,Math.min(W-width-gap,anchor[0]-width/2+column*37));
          const top=Math.max(gap,Math.min(H-height-gap,base+row*25));
          if(overlaps(left,top,width))continue;
          const score=Math.hypot(left+width/2-anchor[0],(top-base)*1.45)
            +(preferred?Math.min(18,Math.hypot(left-preferred.left,top-preferred.top)*.35):0);
          if(!best||score<best.score)best={left,top,score};
        }
      }
      // A separate fallback region search keeps every status readable in dense clusters.
      if(!best){
        for(let top=gap;top<=H-height-gap&&!best;top+=height+gap){
          for(let left=gap;left<=W-width-gap;left+=width+gap){
            if(!overlaps(left,top,width)){best={left,top};break;}
          }
        }
      }
      if(!best)continue;
      const item={robot,x:anchor[0],y:anchor[1],left:best.left,top:best.top,width,height,label};
      layout.push(item);occupied.push(item);
    }
    bubbleLayout=layout;
    for(const {x,y,left,width,top} of layout){
      const fromX=Math.max(left+4,Math.min(left+width-4,x));
      line(ctx,[[fromX,y>top?top+height:top],[x,y]],stopped?'#f1858d':backup?'#8eb5a1':'#a2b5c7',.8);
    }
    for(const {robot,x,y,left,width,label,top} of layout){
      const center=left+width/2;
      const color=recovery?.accent??(stopped?'#dc5360':backup?'#669980':STAGES[robot.stage].color);
      ctx.beginPath();
      ctx.roundRect(left,top,width,height,4);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle=robot.id===selected?'#fff':color;
      ctx.lineWidth=robot.id===selected?1.5:.8;
      ctx.stroke();
      if(badgeWidth){
        ctx.beginPath();
        ctx.roundRect(left+3,top+2,badgeWidth-2,height-4,3);
        ctx.fillStyle=recovery?.accent??(stopped?'#a92132':'#23634b');
        ctx.fill();
        text(ctx,recovery?.step??(stopped?'주의':'DAOS'),left+2+badgeWidth/2,top+13,'#fff',9,'center');
      }
      text(ctx,label,center+badgeWidth/2,top+13,recovery?.ink??(stopped?'#851b29':'#22374a'),12,'center');
    }
  }

  function draw(sim,selected,manualStop=false,now=Date.now(),paused=false){
    lastFrame=[sim,selected,manualStop,now,paused];
    armHitAreas.clear();
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(backdrop,0,0);
    const focused=sim.robots.find(robot=>robot.id===selected);
    if(focused?.route.length){
      const points=[focused.position,...focused.route].map(([x,y])=>project(x,y));
      line(ctx,points,STAGES[focused.stage].color,1.5,[4,5]);
    }
    const cargo=[...sim.buffers()].map(({point:[x,y],count,held,stage})=>({depth:x+y-.18,draw:target=>{
      const [sx,sy]=project(x+.36,y-.27);
      const armInput=stage===2||stage===3;
      if(armInput){
        for(let i=0;i<Math.min(2,count);i++){
          const center=x-i*.52;
          prism(target,center-.22,y-.22,.44,.44,10,8,boxes[0],i===0?'#f7d27c':'#102135');
          line(target,[project(center,y-.22,18),project(center,y+.22,18)],'#f7dba0',2);
        }
      }else{
        for(let i=0;i<Math.min(2,count);i++)prism(target,x+.19,y-.46,.43,.38,i*5,5,boxes[stage%boxes.length]);
      }
      if(held)sign(target,`보류 ${held}`,x+.38,y-.25,'#ff9aa6');
      else if(count>1)text(target,String(count),sx+8,sy-7,'#fff2cc',10,'center');
    }}));
    const beltCargo=[...sim.jobs.values()].filter(job=>job.belt).map(job=>{
      const belt=job.belt,x=belt.from[0]+(belt.to[0]-belt.from[0])*belt.progress,y=belt.from[1];
      return {depth:x+y+.4,draw:target=>{prism(target,x-.22,y-.22,.44,.44,10,8,boxes[0]);line(target,[project(x,y-.22,18),project(x,y+.22,18)],'#f7dba0',2);}};
    });
    const phase=sim.offlinePhase(now)??'online';
    const running=!paused&&(phase==='online'||phase==='backup');
    const movingBelts=new Set([...sim.jobs.values()].filter(job=>job.belt).map(job=>job.belt.id));
    const conveyors=BELTS.map(belt=>({
      depth:belt.from[0]+belt.from[1]+.18,
      draw:target=>drawConveyor(target,belt,running&&movingBelts.has(belt.id),sim.beltTime),
    }));
    const sorted=objects.concat(conveyors,cargo,beltCargo,sim.robots.map(robot=>({depth:robot.position[0]+robot.position[1]+.2,draw:()=>drawRobot(robot,robot.id===selected,sim)})))
      .sort((a,b)=>a.depth-b.depth);
    for(const object of sorted)object.draw(ctx);
    for(const label of signs)sign(ctx,...label);
    drawBubbles(sim,selected,manualStop,now);
    // A stable equipment detail view makes each machine identifiable at desktop size.
    if(focused){
      ctx.fillStyle='#171e34ee';ctx.strokeStyle='#65588f';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(1087,19,215,152,7);ctx.fill();ctx.stroke();
      const [px,py]=project(...focused.position);
      ctx.save();
      ctx.beginPath();ctx.rect(1093,46,203,99);ctx.clip();
      ctx.translate(1194,134);ctx.scale(.96,.96);ctx.translate(-px,-py);
      drawRobot(focused,false,sim,false);ctx.restore();
      text(ctx,'선택 장비 · '+focused.id,1100,40,'#c3b6ea',12);
      text(ctx,STAGES[focused.stage].design,1194,159,'#f2effb',15,'center');
    }
  }
  function pick(event,robots){
    const rect=canvas.getBoundingClientRect();
    const pointer=[(event.clientX-rect.left)/rect.width*W,(event.clientY-rect.top)/rect.height*H];
    const [mx,my]=pointer;
    const clicked=bubbleLayout.find(({left,top,width,height})=>
      mx>=left&&mx<=left+width&&my>=top&&my<=top+height);
    if(clicked)return clicked.robot.id;
    if(mx>=1087&&mx<=1302&&my>=19&&my<=171)return null;
    let best=null,distance=23;
    for(const robot of robots){
      const [x,y]=project(...robot.position);
      let length=Math.hypot(mx-x,my-y+7);
      const joints=armHitAreas.get(robot.id)??[];
      for(let i=1;i<joints.length;i++){
        const [ax,ay]=joints[i-1],[bx,by]=joints[i];
        const dx=bx-ax,dy=by-ay;
        const ratio=Math.max(0,Math.min(1,((mx-ax)*dx+(my-ay)*dy)/(dx*dx+dy*dy)));
        length=Math.min(length,Math.hypot(mx-ax-ratio*dx,my-ay-ratio*dy));
      }
      if(length<distance){best=robot.id;distance=length;}
    }
    return best;
  }
  return {draw,pick};
}
