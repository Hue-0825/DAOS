const W=1040,H=560;
const project=(x,y,z=0)=>[491+(x-y)*24.6,64+(x+y)*13.2-z];
const floorColor='#1b2d45';

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

  const gradient=bg.createRadialGradient(503,236,20,503,236,535);
  gradient.addColorStop(0,'#1a304c');
  gradient.addColorStop(1,'#0a1425');
  bg.fillStyle=gradient;
  bg.fillRect(0,0,W,H);
  for(let i=0;i<18;i++){
    const y=22+i*31;
    line(bg,[[0,y],[W,y]],'#182638',.55);
  }
  prism(bg,0,0,20,14.5,-13,13,[floorColor,'#17283d','#112136']);
  for(let i=0;i<20;i++)for(let j=0;j<14;j++){
    if((i+j)%2===0)rectangle(bg,i,j,1,1,'#20324b');
  }
  const zones=[
    [1.15,2.4,6.25,2.35,'#163e53','#3e7189'],
    [1.3,5.1,6.1,2.1,'#322f57','#66558c'],
    [13.9,5.1,4.7,3.0,'#4a3933','#86634d'],
    [12.6,9.2,4.8,2.4,'#3f363e','#6e5864'],
    [1.65,10.55,5.9,3.1,'#214641','#427865'],
  ];
  for(const zone of zones)rectangle(bg,...zone);
  for(let i=1;i<20;i++)line(bg,[project(i,0),project(i,14.5)],'#36516b',.42);
  for(let j=1;j<15;j++)line(bg,[project(0,j),project(20,j)],'#36516b',.42);

  for(let i=0;i<20;i+=2)prism(bg,i,0,1.94,.18,0,36,['#364e69','#263d55','#15283d'],'#1d314a');
  for(let i=0;i<14;i+=2)prism(bg,0,i,.18,1.94,0,30,['#304962','#223a51','#253f56'],'#1d314a');
  for(let i=1;i<20;i+=2.4){
    const [x,y]=project(i,.14,24);
    line(bg,[[x-11,y-5],[x+11,y+7]],'#65a8c8',2.4);
  }

  for(const [x,y] of [[2.4,5.6],[4.35,5.6],[5.1,2],[7.1,1.9],[9,1.65],[10.85,1.65],[14,2.15],[16,2.15],[16.7,8.9],[18.25,8.9]])rack(x,y);
  for(const [x,y] of [[1.3,3.2],[1.55,3.95],[4.2,2.3],[6.55,3.33],[17.9,4.48],[17.8,5.9],[17.9,6.85],[12.9,9.65]]){
    station(x,y,.64,.63,10,boxes[Math.floor(x+y)%boxes.length]);
  }
  for(const [x,y] of [[15.45,6.75],[14.62,9.9]])station(x,y,1.6,.45,12,['#b4a9d1','#6a5c90','#8d79ac']);
  station(2.45,10.58,1.5,.47,9,['#7fdfb2','#3f8f72','#418d74']);
  station(1.2,12.8,.38,1.0,15,['#7e9fa7','#406876','#355965']);
  for(const [label,x,y,color] of [
    ['01 입고장',2.55,2.15,'#9eddef'],['02 보관 선반',5.7,5.1,'#dec7f4'],
    ['03 포장대',16.2,7.9,'#ecd7f7'],['04 출고장',17.35,4.5,'#ffda9b'],
    ['충전 · 순찰',3.5,13.68,'#a9f5ca']
  ])signs.push([label,x,y,color]);
  text(bg,'DAOS / WAREHOUSE 01',30,34,'#91b5d0',12);
  text(bg,'ISOMETRIC FLOOR · LIVE SIMULATION',30,51,'#5e809b',9);
  line(bg,[[25,69],[146,69]],'#52718b',1);
  text(bg,'A',27,532,'#587a95',10);
  line(bg,[[40,527],[121,527]],'#365575',2);
  text(bg,'B',129,532,'#587a95',10);

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
  function drawRobot(target,robot,index,active){
    const [x,y]=robot.position;
    const [sx,sy]=project(x,y);
    const palette=palettes[index];
    target.fillStyle='#07111c9c';
    target.beginPath();target.ellipse(sx,sy+3,21,8,0,0,Math.PI*2);target.fill();
    if(active){
      target.beginPath();target.ellipse(sx,sy+1,25,11,0,0,Math.PI*2);
      target.strokeStyle=robot.color;target.lineWidth=1.7;target.stroke();
    }
    prism(target,x-.39,y-.38,.79,.75,1,12,[palette.top,palette.left,palette.right]);
    prism(target,x-.16,y-.12,.31,.27,13,4,['#142a3d','#203950','#203950']);
    if(robot.cargo)prism(target,x-.25,y-.27,.45,.42,16,8,boxes[index%boxes.length]);
    const label=robot.id;
    target.font='800 11px ui-monospace, monospace';
    const w=target.measureText(label).width+12;
    target.fillStyle='#0a1628';
    target.fillRect(sx-w/2,sy-39,w,16);
    target.fillStyle=robot.color;
    target.fillRect(sx-w/2,sy-39,2,16);
    text(target,label,sx,sy-27,robot.color,10,'center');
    if(['hold','charge'].includes(robot.state)){
      target.beginPath();target.arc(sx+15,sy-16,3.4,0,Math.PI*2);
      target.fillStyle=robot.state==='charge'?'#7ee9ad':'#ffd083';
      target.fill();
    }
  }
  function draw(sim,selected){
    lastFrame=[sim,selected];
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(backdrop,0,0);
    const restricted=sim.mode!=='online';
    rectangle(ctx,9,5.55,4.35,4.78,restricted?'#85523c95':'#44533360',restricted?'#f5a75e':'#9b995b');
    line(ctx,[project(9,7.14),project(9,7.66)],restricted?'#ffb973':'#e2cf80',3.2);
    line(ctx,[project(11.49,10.4),project(12.11,10.4)],restricted?'#ffb973':'#e2cf80',3.2);
    for(const robot of sim.robots){
      const path=robot.dockPath?[robot.position,...robot.dockPath]:robot.route;
      const active=selected===robot.id;
      line(ctx,path.map(([x,y])=>project(x,y)),active?robot.color:'#6c9cb482',active?2:1,[5,4]);
    }
    const sorted=objects.concat(sim.robots.map((robot,i)=>({depth:robot.position[0]+robot.position[1]+.1,draw:target=>drawRobot(target,robot,i,robot.id===selected)})))
      .sort((a,b)=>a.depth-b.depth);
    for(const object of sorted)object.draw(ctx);
    for(const label of signs)sign(ctx,...label);
    const [x,y]=project(10.45,8.35);
    const warning=restricted?(sim.owner?'교차구역 · 이탈 중':'교차구역 · 진입 제한'):'공유 교차구역';
    ctx.fillStyle='#111c29';
    ctx.fillRect(x-65,y+25,130,18);
    text(ctx,warning,x,y+38,restricted?'#ffce92':'#e6d99a',11,'center');
  }
  function pick(event,robots){
    const r=canvas.getBoundingClientRect();
    const pointer=[(event.clientX-r.left)/r.width*W,(event.clientY-r.top)/r.height*H];
    let best=null,distance=37;
    for(const robot of robots){
      const [x,y]=project(...robot.position);
      const length=Math.hypot(pointer[0]-x,pointer[1]-y+13);
      if(length<distance){best=robot.id;distance=length;}
    }
    return best;
  }
  return {draw,pick};
}
