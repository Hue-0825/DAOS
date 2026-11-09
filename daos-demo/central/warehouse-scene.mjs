import {PARKING,RACKS,SIZE,STAGES} from './warehouse-engine.mjs?v=2';

const W=1320,H=700;
const project=(x,y,z=0)=>[540+(x-y)*20,69+(x+y)*10.7-z];
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
    {top:'#60ecff',left:'#2594bc',right:'#187694'},
    {top:'#b1b4ff',left:'#6467ba',right:'#535491'},
    {top:'#e9b4ff',left:'#9958be',right:'#783d9b'},
    {top:'#ffd28e',left:'#c48232',right:'#a2672c'},
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

  prism(bg,-.5,-.5,SIZE[0],SIZE[1],-16,16,['#23364d','#17283d','#12263a']);
  for(let x=0;x<SIZE[0];x++)for(let y=0;y<SIZE[1];y++){
    if((x+y)%2===0)rectangle(bg,x-.5,y-.5,1,1,'#273b51');
  }
  for(let y=1;y<22;y+=3)line(bg,[project(0,y+.5),project(31.4,y+.5)],'#47667b',.7,[4,5]);
  for(let x=2;x<32;x+=4)line(bg,[project(x+.5,0),project(x+.5,22.4)],'#47667b',.7,[4,5]);
  for(let x=0;x<32;x+=2)prism(bg,x-.45,-.48,1.93,.22,0,25,['#3a5b72','#294356','#1b354a'],'#294255');
  for(let y=0;y<23;y+=2)prism(bg,-.49,y-.45,.19,1.93,0,18,['#375a71','#29455a','#2c4b5f'],'#294255');

  const outlines=['#5094a6','#7383b4','#9c6caa','#9a7951','#578779'];
  for (const [index,role] of STAGES.entries()) {
    for (const [n,[x,y]] of role.stations.entries()) {
      rectangle(bg,x-1.05,y-1,2.1,2.1,'#0d2639',outlines[index]);
      for(let i=-.77;i<.8;i+=.34)line(bg,[project(x+i,y+.83),project(x+i+.11,y+.64)],outlines[index],1.2);
      signs.push([`${role.label} ${n+1}`,x+.15,y+1.15,role.color]);
      if(index===0 || index===4){
        const truckX=index===0?x-1.35:x+1.35;
        station(truckX-.42,y-1.07,.83,2.15,21,['#a9bed0','#4d6f89','#6c8da4']);
        station(truckX-.42,y+1.08,.83,.63,14,['#75b5cc','#30647d','#5293aa']);
        station(truckX-.28,y+1.54,.55,.18,16,['#a2d3e5','#234654','#315869']);
      } else {
        station(x-.73,y-.7,.42,.6,index===3?11:5,
          index===3?['#7fb8c9','#31536a','#446d81']:boxes[index%boxes.length]);
      }
    }
  }
  for(const parking of PARKING)for(const [x,y] of parking)rectangle(bg,x-.36,y-.36,.72,.72,null,'#58788b');
  for(const [x,y,w] of RACKS){
    for(let dx=0;dx<w;dx+=1.48)rack(x+dx-.45,y-.47);
    for(let dx=0;dx<w;dx+=1.48)rack(x+dx-.45,y+.47);
  }
  text(bg,'DAOS / FULFILLMENT FLOOR',30,38,'#acc6d9',15);
  text(bg,'INBOUND  /  SORTATION  /  OUTBOUND',30,57,'#6b8da6',10);
  line(bg,[[30,69],[154,69]],'#638299',1);

  let lastFrame;
  function resize(){
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=W*ratio;
    canvas.height=H*ratio;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    if(lastFrame)draw(...lastFrame);
  }
  resize();
  window.addEventListener('resize',resize);

  function drawRobot(robot,active){
    const [x,y]=robot.position;
    const [sx,sy]=project(x,y);
    const {top,left,right}=palettes[robot.stage];
    ctx.fillStyle='#07111c9c';
    ctx.beginPath();ctx.ellipse(sx,sy+3,13,5,0,0,Math.PI*2);ctx.fill();
    if(active){
      ctx.beginPath();ctx.ellipse(sx,sy+2,15,7,0,0,Math.PI*2);
      ctx.strokeStyle=top;ctx.lineWidth=1.5;ctx.stroke();
    }
    prism(ctx,x-.32,y-.32,.64,.64,1,robot.stage===0||robot.stage===4?11:8,[top,left,right]);
    prism(ctx,x-.16,y-.12,.32,.25,9,3,['#142a3d','#203950','#203950']);
    if(robot.job && !robot.fetching && robot.stage!==3)prism(ctx,x-.20,y-.22,.42,.42,12,7,boxes[robot.stage%boxes.length]);
    if(active||robot.job){
      const w=43;
      ctx.fillStyle='#0a1628';
      ctx.fillRect(sx-w/2,sy-32,w,14);
      text(ctx,robot.id,sx,sy-22,top,9,'center');
    }
  }
  const badges={
    alert:['!','#ffd069','#422400',22],
    backup:['DAOS','#a8f0c7','#143e2b',39],
    stopped:['정지','#ffb5ac','#511f19',31],
    waiting:['대기','#f6d38a','#3f2a10',31],
  };
  function drawStatus(robot,badge){
    const [label,fill,ink,width]=badge;
    const [x,y]=project(...robot.position);
    ctx.fillStyle=fill;
    ctx.beginPath();
    ctx.roundRect(x-width/2,y-52,width,18,4);
    ctx.fill();
    polygon(ctx,[[x-4,y-35],[x+4,y-35],[x,y-29]],fill);
    text(ctx,label,x,y-39,ink,label==='!'?15:10,'center');
  }
  function draw(sim,selected){
    lastFrame=[sim,selected];
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(backdrop,0,0);
    for(const robot of sim.robots){
      const active=selected===robot.id;
      if(robot.route.length && (active||robot.job)){
        line(ctx,[robot.position,...robot.route].map(([x,y])=>project(x,y)),active?STAGES[robot.stage].color:'#73a0bb64',active?2:1,[4,5]);
      }
    }
    const sorted=objects.concat(sim.robots.map(robot=>({depth:robot.position[0]+robot.position[1]+.2,draw:()=>drawRobot(robot,robot.id===selected)})))
      .sort((a,b)=>a.depth-b.depth);
    for(const object of sorted)object.draw(ctx);
    for(const label of signs)sign(ctx,...label);
    const badge=badges[sim.offlinePhase()];
    if(badge)for(const robot of sim.robots)drawStatus(robot,badge);
  }
  function pick(event,robots){
    const rect=canvas.getBoundingClientRect();
    const pointer=[(event.clientX-rect.left)/rect.width*W,(event.clientY-rect.top)/rect.height*H];
    let best=null,distance=25;
    for(const robot of robots){
      const [x,y]=project(...robot.position);
      const length=Math.hypot(pointer[0]-x,pointer[1]-y+7);
      if(length<distance){best=robot.id;distance=length;}
    }
    return best;
  }
  return {draw,pick};
}
