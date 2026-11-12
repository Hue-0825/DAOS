// Stable storage dates preserve order IDs and audit history; the demo calendar rolls in KST.
export const STORAGE_DAY='2026-11-09';
export const koreaDay=(now=Date.now())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',dateStyle:'short'}).format(new Date(now));
export const dayDistance=(from,to)=>Math.round((Date.parse(to)-Date.parse(from))/86400000);
export function shiftCalendar(value,days){
  const shift=text=>{
    if(typeof text!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|\/)/.test(text))return text;
    const stamp=Date.parse(text.slice(0,10));
    return Number.isFinite(stamp)?new Date(stamp+days*86400000).toISOString().slice(0,10)+text.slice(10):text;
  };
  if(typeof value==='string')return shift(value);
  if(Array.isArray(value))return value.map(item=>shiftCalendar(item,days));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[shift(key),shiftCalendar(item,days)]));
  return value;
}
export async function calendarApi(request,db,path,handler,now=Date.now()){
  const base=koreaDay(now),delta=dayDistance(STORAGE_DAY,base);
  const url=new URL(request.url);
  for(const [key,value]of url.searchParams)url.searchParams.set(key,shiftCalendar(value,-delta));
  const options={method:request.method,headers:request.headers};
  if(!['GET','HEAD'].includes(request.method)){
    const raw=await request.text();
    if(raw)options.body=JSON.stringify(shiftCalendar(JSON.parse(raw),-delta));
  }
  const response=await handler(new Request(url,options),db,path);
  if(!response.headers.get('Content-Type')?.includes('application/json'))return response;
  const data=shiftCalendar(await response.json(),delta);
  if(data.clock)data.clock.calendarBase=base;
  if(data.date&&data.time)data.calendarBase=base;
  if(data.historyDates)data.queueStart=shiftCalendar('2026-11-14',delta);
  return Response.json(data,{status:response.status,headers:response.headers});
}
