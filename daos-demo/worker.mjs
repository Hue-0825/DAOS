const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short' });
const dateKey = (offset = 0) => dateFormat.format(new Date(Date.now() + offset * 86_400_000));
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const fixtures = JSON.parse(ASSETS['/driver/jobs.json']);
const places = JSON.parse(ASSETS['/ops/places.json']);
const routing = JSON.parse(ASSETS['/central/routing.json']);
const types = { html:'text/html', mjs:'text/javascript', js:'text/javascript', css:'text/css', svg:'image/svg+xml', webmanifest:'application/manifest+json', json:'application/json' };
const controlSql = 'SELECT online, revision, reset_revision, demo_date, demo_time FROM control WHERE id = 1';
const clockView = row => ({date:row.demo_date,time:row.demo_time});
const driverDay = '(SELECT demo_date FROM control WHERE id=1)';
const driverWindow = `${driverDay} AND date(${driverDay},'+1 day')`;
const publishedSql = `SELECT id, rowid AS number, work_date AS date, segment, title, cargo, destination AS "drop", instructions AS "to" FROM orders WHERE province = ? AND revision IS NOT NULL AND work_date BETWEEN ${driverWindow} ORDER BY segment, rowid`;
const guard = '(SELECT online FROM control WHERE id = 1) = 1';
const run = (db, sql, ...args) => args.length ? db.prepare(sql).bind(...args) : db.prepare(sql);
const DEFAULT_PROVINCE = '경상남도';
const provinceFrom = request => new URL(request.url).searchParams.get('province') ?? DEFAULT_PROVINCE;
const versionSql=`SELECT COALESCE(MAX(revision),0) FROM (
  SELECT revision FROM orders WHERE province = ? AND work_date >= ?
  UNION ALL SELECT revision FROM dispatch_reset WHERE province = ? AND work_date >= ?
)`;
const versionArgs=province=>[province,dates()[0],province,dates()[0]];
const revisionFor=(db,province)=>run(db,`SELECT (${versionSql}) AS revision`,...versionArgs(province));
function modeFor(value,province) {
  const mode=value==='baseline'?'baseline':'daos';
  return province===DEFAULT_PROVINCE?mode:`${province}|${mode}`;
}

function validateOrder(item) {
  return item && [dateKey(), dateKey(1)].includes(item.date) && [0,1,2].includes(item.segment)
    && Object.hasOwn(places,item.drop) && fixtures.some(job => job.segment === item.segment && places[job.drop].region === places[item.drop].region) && [item.title,item.cargo,item.to].every(value => typeof value === 'string' && value.trim() && value.length <= 140);
}
function orderInsert(db, item, id = crypto.randomUUID()) {
  const sameRegion = Object.keys(places).filter(key => places[key].region === places[item.drop].region);
  return run(db, `INSERT OR IGNORE INTO orders (id,work_date,segment,title,cargo,destination,instructions,revision) SELECT ?, ?, ?, ?, ?, ?, ?, NULL
    WHERE NOT EXISTS (SELECT 1 FROM orders WHERE province = '경상남도' AND work_date = ? AND segment = ? AND destination NOT IN (${sameRegion.map(()=>'?').join(',')}))`,
    id, item.date, item.segment, item.title.trim(), item.cargo.trim(), item.drop, item.to.trim(),
    item.date, item.segment, ...sameRegion);
}
async function sampleId(date, key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${date}/${key}`)));
  const hex = Array.from(bytes.slice(0,16),byte=>byte.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function jobView(job) {
  const location=places[job.drop];
  return { ...job, drop:location.anchor??job.drop, place:location, key: `${job.date}/${job.id}` };
}
function validEvent(event) {
  if (!event || typeof event.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(event.id) ||
      typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      typeof event.key !== 'string' || !Number.isFinite(Date.parse(event.at))) return false;
  if (event.state === 'picked') return event.key === `${event.date}/pickup`;
  if (event.state === 'started') return [1,2].some(index => event.key === `${event.date}/start/${index}`);
  return event.state === 'delivered' && event.key.startsWith(`${event.date}/`) && /^[0-9a-f-]{36}$/i.test(event.key.slice(11));
}

const intakeSql = `SELECT intake.rowid AS number, intake.*, orders.rowid AS delivery_number,
  orders.revision AS dispatch_revision,
  EXISTS (SELECT 1 FROM events WHERE job_key = intake.work_date || '/' || intake.id AND mode IN ('daos',intake.province || '|daos') AND state = 'delivered') AS delivered,
  EXISTS (SELECT 1 FROM events WHERE job_key = intake.work_date || '/' || intake.id AND mode IN ('baseline',intake.province || '|baseline') AND state = 'delivered') AS baseline_delivered
  FROM intake LEFT JOIN orders ON intake.id = orders.id`;
const DEMO_DATES=['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13'];
const INITIAL_DATES=DEMO_DATES.slice(0,3);
const STAGED_DATES=DEMO_DATES.slice(3);
const GYEONGNAM_ROUTES=[['campus','jangyu','yangsan'],['sangnam','yulha','buwon'],['campus','yulha','yangsan'],['sangnam','jangyu','buwon'],['campus','yulha','yangsan']];
const mapStop = place => Number.isFinite(place?.x)&&Number.isFinite(place?.y);
const QUEUE_START='2026-11-14';
const DAILY_CAPACITY=100;
const validDemoDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=dates()[0]
  &&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
const released=column=>`(${column} <= '2026-11-11' OR ${column} IN (SELECT work_date FROM hub_release))`;
const dates=()=>DEMO_DATES;
const windowDates=()=>[DEMO_DATES[0],DEMO_DATES.at(-1)];
const isText = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
const compact = value => value.replace(/\s+/g,'');
function routeAddress(province, city, address) {
  if (province !== DEFAULT_PROVINCE) {
    const region=Object.keys(routing.regions).find(key=>routing.regions[key].province===province);
    const stop=Object.entries(places).find(([,place])=>place.region===region&&place.anchor&&compact(address).includes(compact(place.label)));
    return region ? [stop?.[0]??`prov_${region}`,region,routing.regions[region].segment] : [];
  }
  const normalized = compact(address);
  const matches = Object.entries(places).filter(([,place]) =>
    !routing.regions[place.region].province && routing.regions[place.region].city === city && normalized.includes(compact(place.label)));
  if (matches.length !== 1) return [];
  const [destination, place] = matches[0];
  return [destination, place.region, routing.regions[place.region].segment];
}

async function demoOrders() {
  const national=routing.provinces.filter(name=>name!==DEFAULT_PROVINCE);
  return Promise.all(dates().flatMap((date,day)=>Array.from({length:100},async (_,index)=>{
    const segment=index%3;
    const province=index<20?DEFAULT_PROVINCE:national[(index-20)%national.length];
    const region=province===DEFAULT_PROVINCE?GYEONGNAM_ROUTES[day][segment]
      :Object.keys(routing.regions).find(key=>routing.regions[key].province===province);
    const detail=routing.regions[region];
    const stops=Object.keys(places).filter(key=>places[key].region===region&&(province===DEFAULT_PROVINCE||places[key].anchor)&&places[key].sample!==false).slice(0,4);
    const visit=province===DEFAULT_PROVINCE?Math.floor(index/3):Math.floor((index-20)/national.length);
    const destination=day===0&&index===14?'yssangyong':stops[(visit+day)%stops.length];
    const id=await sampleId(date,`history-v1/${index}`);
    const created=new Date(Date.parse(`${date}T00:00:00+09:00`)+(index+1)*60000).toISOString();
    return [id,created,date,province,detail.city,places[destination].label,`시연 고객 ${String(day*100+index+1).padStart(3,'0')}`,
      Object.values(routing.products)[index%5],index%4+1,'시연용 · 건물 입구에서 담당자 인계',destination,region,segment];
  })));
}
function insertDemoOrders(db,plan,restore=false) {
  const statements=[];
  for(let i=0;i<plan.length;i+=7){
    const rows=plan.slice(i,i+7);
    const conflict=restore?`DO UPDATE SET city=excluded.city,address=excluded.address,instructions=excluded.instructions,
      destination=excluded.destination,region=excluded.region,segment=excluded.segment`:'DO NOTHING';
    statements.push(run(db,`INSERT INTO intake VALUES ${rows.map(()=>'(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')} ON CONFLICT(id) ${conflict}`,...rows.flat()));
  }
  return statements;
}

async function intakeApi(request, db, path) {
  if (path === '/api/shop/clock' && request.method === 'GET') {
    const control=await run(db,controlSql).all();
    return json(clockView(control.results[0]));
  }
  if (path === '/api/shop/options' && request.method === 'GET') {
    const control=await run(db,controlSql).all();
    const stops=Object.entries(places).filter(([,place])=>mapStop(place)).map(([id,place])=>{
      const route=routing.regions[place.region];
      return {id,label:place.label,city:route.city,province:route.province??DEFAULT_PROVINCE};
    });
    return json({ dates:dates(), provinces:routing.provinces, products:routing.products, catalog:routing.catalog, stops,clock:clockView(control.results[0]) });
  }
  if (path === '/api/shop/orders' && request.method === 'POST') {
    const item = await request.json();
    if (!item || !routing.provinces.includes(item.province)
        || !Object.hasOwn(routing.products,item.product) || !Number.isInteger(item.quantity)
        || item.quantity < 1 || item.quantity > 99 || !isText(item.recipient,35)
        || typeof item.instructions !== 'string' || item.instructions.length > 100) {
      return json({error:'배송지와 주문 정보를 확인해 주세요.'},400);
    }
    let city,address,destination,region,segment;
    if (item.destination!==undefined) {
      const place=typeof item.destination==='string'&&Object.hasOwn(places,item.destination)?places[item.destination]:null;
      const route=place&&routing.regions[place.region];
      if (!mapStop(place)||(route.province??DEFAULT_PROVINCE)!==item.province) {
        return json({error:'선택한 시·도의 등록 배송지를 골라 주세요.'},400);
      }
      [city,address,destination,region,segment]=[route.city,place.label,item.destination,place.region,route.segment];
    } else {
      if (!isText(item.city,30)||!isText(item.address,100))return json({error:'배송 주소를 확인해 주세요.'},400);
      city=item.city.trim();
      address=item.address.trim();
      [destination=null,region=null,segment=null]=routeAddress(item.province,city,address);
    }
    const id = crypto.randomUUID();
    // Pick and insert in one SQL statement so simultaneous checkouts cannot overfill a day.
    const result = await run(db,`WITH RECURSIVE limits(start,capacity) AS (VALUES (?,?)), queue(work_date) AS (
      SELECT MAX(limits.start,date(demo_date,'+1 day'),
        COALESCE((SELECT MAX(work_date) FROM intake WHERE work_date>=limits.start),limits.start),
        COALESCE((SELECT date(MAX(work_date),'+1 day') FROM hub_release WHERE work_date>=limits.start),limits.start))
      FROM control,limits WHERE id=1
      UNION ALL
      SELECT date(queue.work_date,'+1 day') FROM queue
      WHERE (SELECT COUNT(*) FROM intake WHERE intake.work_date=queue.work_date)>=(SELECT capacity FROM limits)
    )
    INSERT INTO intake
    SELECT ?, ?, queue.work_date, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM queue ORDER BY queue.work_date DESC LIMIT 1
    RETURNING rowid AS number,work_date AS date`,QUEUE_START,DAILY_CAPACITY,id,new Date().toISOString(),item.province,city,address,item.recipient.trim(),
      routing.products[item.product],item.quantity,item.instructions.trim(),destination,region,segment).all();
    return json({...result.results[0],province:item.province},201);
  }
  if (path === '/api/central/connection' && request.method === 'POST') {
    const {online}=await request.json();
    if(typeof online!=='boolean')return json({error:'연결 상태를 확인해 주세요.'},400);
    await run(db,'UPDATE control SET online=? WHERE id=1',Number(online)).run();
    return json({online});
  }
  if (path === '/api/central/clock' && request.method === 'POST') {
    const {date,time}=await request.json();
    if(!validDemoDate(date)||typeof time!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))return json({error:'시연 날짜와 시간을 확인해 주세요.'},400);
    await run(db,'UPDATE control SET demo_date=?, demo_time=? WHERE id=1',date,time).run();
    return json({date,time});
  }
  if (path === '/api/central/warehouse' && request.method === 'GET') {
    const province = provinceFrom(request);
    if (!routing.provinces.includes(province)) return json({error:'시·도 허브를 확인해 주세요.'},400);
    const [control, queue] = await db.batch([
      run(db,controlSql),
      run(db,`SELECT intake.id, intake.work_date AS date, intake.segment, intake.quantity, intake.product,
        orders.revision AS dispatch
        FROM intake LEFT JOIN orders ON orders.id = intake.id
        WHERE ${guard} AND intake.province = ? AND intake.region IS NOT NULL
          AND intake.segment BETWEEN 0 AND 2 AND intake.work_date BETWEEN ${driverWindow}
          AND ${released('intake.work_date')}
          AND NOT EXISTS (SELECT 1 FROM events WHERE job_key = intake.work_date || '/' || intake.id
            AND mode = CASE WHEN intake.province = '경상남도' THEN 'daos' ELSE intake.province || '|daos' END
            AND state = 'delivered')
        ORDER BY intake.work_date, intake.segment, intake.created_at, intake.rowid`,province),
    ]);
    const state = control.results[0];
    return json({online:Boolean(state.online),clock:clockView(state),resetRevision:state.reset_revision,
      provinces:routing.provinces,orders:state.online?queue.results:null});
  }
  if (path === '/api/central/orders' && request.method === 'GET') {
    const [result,control,releases]=await db.batch([
      run(db,`${intakeSql} WHERE intake.work_date >= ? ORDER BY intake.work_date,CASE WHEN intake.work_date < ? THEN COALESCE(intake.segment,3) ELSE 0 END,intake.created_at,intake.rowid`,dates()[0],QUEUE_START),
      run(db,controlSql),run(db,'SELECT work_date FROM hub_release'),
    ]);
    const historyDates=[...new Set([...dates(),...result.results.map(row=>row.work_date)])].sort();
    return json({ orders:result.results.map((row,index)=>({...row,display_number:index+1})), provinces:routing.provinces, regions:routing.regions,
      online:Boolean(control.results[0].online), clock:clockView(control.results[0]),historyDates, stagedDates:historyDates.filter(date=>!INITIAL_DATES.includes(date)),
      releasedDates:[...INITIAL_DATES,...releases.results.map(row=>row.work_date)] });
  }
  if (path === '/api/central/release' && request.method === 'POST') {
    const {date}=await request.json();
    if(!validDemoDate(date)||INITIAL_DATES.includes(date))return json({error:'전송할 배송일을 선택하세요.'},400);
    const [,count]=await db.batch([
      run(db,'INSERT OR IGNORE INTO hub_release SELECT ? WHERE EXISTS (SELECT 1 FROM intake WHERE work_date=?)',date,date),
      run(db,'SELECT COUNT(*) AS count FROM intake WHERE work_date=?',date),
    ]);
    const total=count.results[0].count;
    return total?json({date,count:total}):json({error:'전송할 주문이 없습니다.'},409);
  }
  if (path === '/api/central/reset' && request.method === 'POST') {
    const plan=await demoOrders();
    const activeWindow=windowDates();
    // These UUIDs are generated from fixed demo dates and indexes, never from request input.
    const ids=plan.map(([id])=>`'${id}'`).join(',');
    const extra=`work_date BETWEEN ? AND ? AND id NOT IN (${ids})`;
    const [,,removed]=await db.batch([
      run(db,'UPDATE control SET online=1, revision=revision+1, reset_revision=revision+1, demo_date=?, demo_time=? WHERE id=1',dates()[0],'06:00'),
      run(db,`INSERT OR IGNORE INTO demo_reset_archive SELECT * FROM intake WHERE ${extra}`,...activeWindow),
      run(db,`DELETE FROM intake WHERE ${extra}`,...activeWindow),
      run(db,`INSERT INTO dispatch_reset (province,work_date,revision)
        SELECT orders.province,orders.work_date,control.reset_revision FROM orders,control WHERE control.id=1
        ON CONFLICT(province,work_date) DO UPDATE SET revision=excluded.revision`),
      run(db,'DELETE FROM events'),
      run(db,'DELETE FROM orders'),
      run(db,'DELETE FROM province_receipt'),
      run(db,'DELETE FROM receipt'),
      run(db,'DELETE FROM hub_release'),
      ...dates().map(date=>run(db,`INSERT INTO dispatch_reset (province,work_date,revision)
        SELECT value,?,reset_revision FROM json_each(?),control WHERE control.id=1
        ON CONFLICT(province,work_date) DO UPDATE SET revision=excluded.revision`,date,JSON.stringify(routing.provinces))),
      ...insertDemoOrders(db,plan,true),
    ]);
    return json({count:INITIAL_DATES.length*100,staged:STAGED_DATES.length*100,archived:removed.meta.changes});
  }
  if (path === '/api/central/seed' && request.method === 'POST') {
    const groups=dates();
    const { removeDates=[] }=await request.json();
    if(!Array.isArray(removeDates)||removeDates.length>3||!removeDates.every(date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<groups[0])) {
      return json({error:'이전 시연 주문 날짜를 확인해 주세요.'},400);
    }
    const oldIds=await Promise.all(removeDates.flatMap(date=>Array.from({length:100},(_,i)=>sampleId(date,`history-v1/${i}`))));
    const cleanup=[];
    for(let i=0;i<oldIds.length;i+=50){
      const ids=oldIds.slice(i,i+50);
      cleanup.push(run(db,`DELETE FROM intake WHERE id IN (${ids.map(()=>'?').join(',')})
        AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.id=intake.id)`,...ids));
    }
    const plan=await demoOrders();
    const statements=insertDemoOrders(db,plan);
    const results=await db.batch([...cleanup,...statements]);
    const sum=items=>items.reduce((total,result)=>total+result.meta.changes,0);
    return json({ dates:groups, planned:plan.length, removed:sum(results.slice(0,cleanup.length)), inserted:sum(results.slice(cleanup.length)) });
  }
  if (path === '/api/hub/orders' && request.method === 'GET') {
    const province=provinceFrom(request);
    if(!routing.provinces.includes(province))return json({error:'허브를 선택해 주세요.'},400);
    const [intake,control,revision,receipt,releases] = await db.batch([
      run(db,`${intakeSql} WHERE intake.province = ? AND intake.work_date >= ? AND ${released('intake.work_date')} ORDER BY intake.work_date,intake.segment,intake.rowid`,province,dates()[0]),
      run(db,controlSql),revisionFor(db,province),
      run(db,'SELECT revision, saved_at FROM province_receipt WHERE province = ?',province),
      run(db,'SELECT work_date FROM hub_release ORDER BY work_date'),
    ]);
    return json({ orders:intake.results, provinces:routing.provinces, regions:routing.regions,
      receipt:receipt.results[0], online:control.results[0].online,clock:clockView(control.results[0]),
      revision:intake.results.some(order=>order.dispatch_revision)?revision.results[0].revision:0,dates:[...INITIAL_DATES,...releases.results.map(row=>row.work_date)] });
  }
  if (path === '/api/hub/dispatch' && request.method === 'POST') {
    const { province, date, region, segment:routedSegment } = await request.json();
    const route=routing.regions[region];
    if (!routing.provinces.includes(province) || !validDemoDate(date) || !Object.hasOwn(routing.regions,region)
        || (route.province??DEFAULT_PROVINCE)!==province || (routedSegment!==undefined&&![0,1,2].includes(routedSegment))) {
      return json({error:'해당 허브에 전송된 배송 권역만 배차할 수 있습니다.'},400);
    }
    const segment=routedSegment??route.segment;
    const [insert] = await db.batch([
      run(db,`INSERT OR IGNORE INTO orders (id,work_date,segment,title,cargo,destination,instructions,revision,province)
        SELECT intake.id,intake.work_date,intake.segment,intake.product,intake.quantity || '개',intake.destination,
          intake.address || CASE WHEN intake.instructions <> '' THEN ' · ' || intake.instructions ELSE '' END,
          (SELECT revision + 1 FROM control WHERE id = 1),intake.province
        FROM intake WHERE province = ? AND work_date = ? AND region = ? AND segment = ? AND destination IS NOT NULL
        AND ${released('intake.work_date')}`,province,date,region,segment),
      run(db,`UPDATE control SET revision = revision + 1 WHERE id = 1
        AND EXISTS (SELECT 1 FROM orders WHERE orders.revision = control.revision + 1)`),
    ]);
    return insert.meta.changes ? json({count:insert.meta.changes}) : json({error:'허브에 전송된 배차 대기 주문이 없습니다.'},409);
  }
  if(path==='/api/hub/cancel' && request.method==='POST'){
    const {province,date}=await request.json();
    if(!routing.provinces.includes(province)||!validDemoDate(date))return json({error:'취소할 지역과 배송일을 확인해 주세요.'},400);
    const exists='EXISTS(SELECT 1 FROM orders WHERE province = ? AND work_date = ? AND revision IS NOT NULL)';
    const reset='EXISTS(SELECT 1 FROM dispatch_reset WHERE province = ? AND work_date = ? AND revision=(SELECT revision FROM control WHERE id=1))';
    const [version,,,removed]=await db.batch([
      run(db,`UPDATE control SET revision=revision+1 WHERE id=1 AND online=1 AND ${exists}`,province,date),
      run(db,`INSERT INTO dispatch_reset SELECT ?,?,revision FROM control WHERE id=1 AND online=1 AND ${exists}
        ON CONFLICT(province,work_date) DO UPDATE SET revision=excluded.revision`,province,date,province,date),
      run(db,`DELETE FROM events WHERE mode IN (?,?) AND work_date = ? AND ${guard} AND ${reset}`,modeFor('daos',province),modeFor('baseline',province),date,province,date),
      run(db,`DELETE FROM orders WHERE province = ? AND work_date = ? AND revision IS NOT NULL AND ${guard} AND ${reset}`,province,date,province,date),
    ]);
    if(!version.meta.changes)return json({error:'서버가 연결된 상태에서 확정된 배차만 취소할 수 있습니다.'},409);
    return json({count:removed.meta.changes});
  }
  return null;
}

async function api(request, db, path) {
  const method = request.method;
  if (/^\/api\/(shop|central|hub)\//.test(path)) {
    return await intakeApi(request,db,path) ?? json({error:'요청을 찾을 수 없습니다.'},404);
  }
  if (path === '/api/ops' && method === 'GET') {
    const [control, orders, receipt, progress] = await db.batch([
      run(db, controlSql),
      run(db, `SELECT rowid AS number, orders.*,
        EXISTS (SELECT 1 FROM events WHERE job_key = orders.work_date || '/' || orders.id AND mode = 'daos' AND state = 'delivered') AS daos_done,
        EXISTS (SELECT 1 FROM events WHERE job_key = orders.work_date || '/' || orders.id AND mode = 'baseline' AND state = 'delivered') AS baseline_done
        FROM orders WHERE work_date BETWEEN ? AND ? ORDER BY work_date, segment, rowid`, dateKey(), dateKey(1)),
      run(db, 'SELECT revision, saved_at FROM receipt WHERE id = 1'),
      run(db, "SELECT mode, work_date AS date, COUNT(*) AS count FROM events WHERE state = 'delivered' AND work_date BETWEEN ? AND ? GROUP BY mode, work_date", dateKey(), dateKey(1)),
    ]);
    return json({ ...control.results[0], orders:orders.results, receipt:receipt.results[0], progress:progress.results, dates:[dateKey(),dateKey(1)] });
  }
  if (path === '/api/ops/orders' && method === 'POST') {
    const body = await request.json();
    if (!validateOrder(body)) return json({ error:'배송일, 권역과 주문 내용을 확인해 주세요.' }, 400);
    const added = await orderInsert(db, body).run();
    return added.meta.changes ? json({ ok:true }, 201) : json({ error:'같은 배송 구간에는 한 권역만 배정할 수 있습니다.' }, 409);
  }
  if (path === '/api/ops/sample' && method === 'POST') {
    const existing = await run(db, 'SELECT 1 FROM orders WHERE work_date BETWEEN ? AND ? LIMIT 1',dateKey(),dateKey(1)).all();
    if (existing.results.length) return json({ error:'시연 주문은 작업표가 비어 있을 때 채울 수 있습니다.' },409);
    const statements = await Promise.all(fixtures.map(async item => {
      const date = dateKey(item.day);
      return orderInsert(db, { ...item, date }, await sampleId(date,item.id));
    }));
    await db.batch(statements);
    return json({ ok:true }, 201);
  }
  if (path === '/api/ops/publish' && method === 'POST') {
    await db.batch([
      run(db, 'UPDATE control SET revision = revision + 1 WHERE id = 1 AND EXISTS(SELECT 1 FROM orders WHERE revision IS NULL AND work_date BETWEEN ? AND ?)',dateKey(),dateKey(1)),
      run(db, 'UPDATE orders SET revision = (SELECT revision FROM control WHERE id = 1) WHERE revision IS NULL AND work_date BETWEEN ? AND ?',dateKey(),dateKey(1)),
    ]);
    return json({ ok:true });
  }
  if (path === '/api/ops/connection' && method === 'POST') {
    const { online } = await request.json();
    if (typeof online !== 'boolean') return json({ error:'서버 상태를 선택해 주세요.' }, 400);
    await run(db, 'UPDATE control SET online = ? WHERE id = 1', Number(online)).run();
    return json({ ok:true });
  }
  if (path === '/api/driver' || path.startsWith('/api/driver/')) {
    const province=provinceFrom(request);
    if(!routing.provinces.includes(province))return json({error:'기사 앱의 시·도를 확인해 주세요.'},400);
    if (path === '/api/driver/clock' && method === 'GET') {
      const control=await run(db,controlSql).all();
      return json(clockView(control.results[0]));
    }
    if (path === '/api/driver' && method === 'GET') {
      const params=new URL(request.url).searchParams;
      const mode=modeFor(params.get('mode'),province);
      const [control,revision,jobs,events,resets,schedule] = await db.batch([
        run(db,controlSql),revisionFor(db,province),run(db,publishedSql,province),
        run(db,`SELECT id, job_key AS key, work_date AS date, state, recorded_at AS at FROM events WHERE mode = ? AND work_date BETWEEN ${driverWindow}`,mode),
        run(db,'SELECT work_date AS date,revision FROM dispatch_reset WHERE province = ?',province),
        run(db,`SELECT intake.work_date AS date, COUNT(*) AS total, COUNT(orders.revision) AS assigned
          FROM intake LEFT JOIN orders ON intake.id=orders.id
          WHERE intake.province=? AND intake.work_date>=? AND ${released('intake.work_date')}
          GROUP BY intake.work_date ORDER BY intake.work_date`,province,dates()[0]),
      ]);
      const clock=clockView(control.results[0]);
      if(!control.results[0].online)return json({error:'메인 서버 연결 끊김',clock},503);
      return json({clock,schedule:schedule.results,revision:revision.results[0].revision,resetRevision:control.results[0].reset_revision,jobs:jobs.results.map(jobView),events:events.results,resets:Object.fromEntries(resets.results.map(reset=>[reset.date,reset.revision]))});
    }
    if (path === '/api/driver/receipt' && method === 'POST') {
      const { revision } = await request.json();
      if(!Number.isInteger(revision)||revision<1)return json({error:'작업표 버전 오류'},400);
      const saved=await run(db,`INSERT INTO province_receipt SELECT ?, ?, ? WHERE ${guard}
        AND ? = (${versionSql})
        ON CONFLICT(province) DO UPDATE SET revision = excluded.revision, saved_at = excluded.saved_at`,
        province,revision,new Date().toISOString(),revision,...versionArgs(province)).run();
      return saved.meta.changes?json({ok:true}):json({error:'저장 확인을 받을 수 없습니다.'},503);
    }
    if (path === '/api/driver/events' && method === 'POST') {
      const {mode,events}=await request.json();
      if(!Array.isArray(events)||events.length>40||!events.length||!events.every(validEvent))return json({error:'배송 기록 형식 오류'},400);
      const sessionMode=modeFor(mode,province);
      const epoch=event=>Number.isInteger(event.epoch)&&event.epoch>=0?event.epoch:0;
      const fresh='? = COALESCE((SELECT revision FROM dispatch_reset WHERE province = ? AND work_date = ?),0)';
      const results=await db.batch([
        ...events.map(event=>run(db,`INSERT OR IGNORE INTO events SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}
          AND ${fresh} AND EXISTS (SELECT 1 FROM orders WHERE province = ? AND work_date = ? AND revision IS NOT NULL AND (? <> 'delivered' OR id = ?))`,
          event.id,sessionMode,event.key,event.date,event.state,event.at,epoch(event),province,event.date,province,event.date,event.state,event.key.slice(11))),
        run(db,controlSql),
        ...events.map(event=>run(db,`SELECT 1 FROM events WHERE mode = ? AND job_key = ? AND state = ? AND ${fresh}`,sessionMode,event.key,event.state,epoch(event),province,event.date)),
      ]);
      if(!results[events.length].results[0].online)return json({error:'메인 서버 연결 끊김'},503);
      return json({acknowledged:events.filter((_,index)=>results[events.length+1+index].results.length).map(event=>event.id)});
    }
  }
  return json({ error:'요청을 찾을 수 없습니다.' },404);
}

const robotSite = 'https://daos-logistics.ryker6365.chatgpt.site';
async function robotAccess(request,env) {
  const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  if (email && env.DAOS_ROBOT_KEY && await shareAuthorized(request,env)) {
    const expires=String(Math.floor(Date.now()/1000)+120);
    const signature=await shareSignature(env.DAOS_ROBOT_KEY,`robot-launch:${email}`,expires);
    return shareResponse(null,303,{Location:`${robotSite}/robot/activate#${expires}.${signature}`});
  }
  return shareResponse(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>DAOS 로봇 관제실 권한 확인</title><body style="font:16px system-ui;max-width:35rem;margin:10vh auto;padding:0 20px">
    <h1>로봇 관제실 권한 확인</h1><p>메인 관제센터에 접속 권한이 있는 계정으로 계속합니다.</p>
    <p><a href="/central/robot-access">권한 확인 계속하기</a> · <a href="/share">메인 관제센터 접속</a></p></body></html>`,200,
    {'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/central/warehouse.html') {
      return Response.redirect(new URL('/robot/',robotSite),302);
    }
    if (request.method === 'GET' && pathname === '/central/robot-access') return robotAccess(request,env);
    const sessionRoute=await ssoRoute(request,env,'central','/central/');
    if(sessionRoute)return sessionRoute;
    if(pathname==='/api/central/portal-auth' && request.method==='POST'){
      if(!env.DAOS_ROBOT_KEY || !shareMatch(request.headers.get('X-DAOS-Robot-Key'),env.DAOS_ROBOT_KEY))
        return json({authorized:false},403);
      let data;
      try{data=await request.json();}catch{return json({authorized:false},400);}
      const email=typeof data?.email==='string'?data.email.toLowerCase():null;
      const owner=Boolean(email && email===env.DAOS_SHARE_OWNER_EMAIL?.toLowerCase());
      const token=data?.token;
      const invited=typeof token==='string' && /^[a-f0-9]{64}$/.test(token) &&
        shareMatch(await shareHash(token),env.DAOS_SHARE_KEY_HASH);
      return json({authorized:owner||invited});
    }
    const portalSession=await ssoAuthorized(request,env,'central');
    const hostedSplit = Boolean(env.DAOS_SHOP_TOKEN);
    const split = hostedSplit || Boolean(env.SERVICE_TOKEN);
    if(env.DAOS_SHARE_KEY_HASH){
      const shared=await shareRoute(request,env,'/central/');
      if(shared)return shared;
    }
    if (pathname.startsWith('/api/')) {
      const token = request.headers.get('X-DAOS-Service-Key');
      if (hostedSplit) {
        const shop = token === env.DAOS_SHOP_TOKEN && pathname.startsWith('/api/shop/');
        const hub = token === env.DAOS_HUB_TOKEN && pathname.startsWith('/api/hub/');
        const driver = token === env.DAOS_DRIVER_TOKEN && (pathname === '/api/driver' || pathname.startsWith('/api/driver/'));
        const consoleView = (portalSession || (Boolean(request.headers.get('oai-authenticated-user-id'))
          && (!env.DAOS_SHARE_KEY_HASH || await shareAuthorized(request,env)))) && (
          (['/api/central/orders','/api/central/warehouse'].includes(pathname) && request.method === 'GET') ||
          (['/api/central/reset','/api/central/release','/api/central/clock','/api/central/connection'].includes(pathname) && request.method === 'POST' && request.headers.get('Origin') === new URL(request.url).origin)
        );
        const seed = pathname === '/api/central/seed' && request.method === 'POST'
          && Boolean(env.DAOS_SEED_TOKEN) && token === env.DAOS_SEED_TOKEN;
        const robot = Boolean(env.DAOS_ROBOT_KEY) && shareMatch(request.headers.get('X-DAOS-Robot-Key'),env.DAOS_ROBOT_KEY)
          && ((pathname === '/api/central/warehouse' && request.method === 'GET')
            || (pathname === '/api/central/connection' && request.method === 'POST' && !request.headers.has('Origin')));
        if (!shop && !hub && !driver && !consoleView && !seed && !robot) return json({error:'서버 간 연결이 필요합니다.'},401);
      } else if (env.SERVICE_TOKEN && request.headers.get('Authorization') !== `Bearer ${env.SERVICE_TOKEN}`) {
        return json({error:'서버 간 연결이 필요합니다.'},401);
      }
      const origin = request.headers.get('Origin');
      if (request.method === 'POST' && origin && origin !== new URL(request.url).origin) return json({error:'다른 사이트에서 변경할 수 없습니다.'},403);
      try { return await api(request, env.DB, pathname); }
      catch (error) {
        console.error(error);
        return json({ error:'서버에서 요청을 처리하지 못했습니다.' },500);
      }
    }
    if(env.DAOS_SHARE_KEY_HASH && !portalSession && !await shareAuthorized(request,env))return shareResponse(null,303,{Location:'/share'});
    if (hostedSplit && /^\/ops\/?$/.test(pathname) && env.DAOS_HUB_URL) return Response.redirect(env.DAOS_HUB_URL,302);
    if (hostedSplit && /^\/driver\/?$/.test(pathname) && env.DAOS_DRIVER_URL) return Response.redirect(new URL('/driver/',env.DAOS_DRIVER_URL),302);
    if (split && !['/','/central/'].includes(pathname) && !pathname.startsWith('/central/')) return new Response('Not found',{status:404});
    if (pathname === '/' && split) return Response.redirect(new URL('/central/',request.url),302);
    if (pathname === '/ops' || pathname === '/driver') return Response.redirect(new URL(`${pathname}/`,request.url),302);
    const path = pathname === '/' || pathname === '/ops/' ? '/ops/index.html'
      : pathname === '/driver/' ? '/driver/index.html' : pathname === '/central/' ? '/central/index.html' : pathname;
    const body = path === '/driver/jobs.json' ? undefined : ASSETS[path];
    if (typeof body !== 'string') return new Response('Not found',{ status:404 });
    return new Response(request.method === 'HEAD' ? null : body, { headers: {
      'Content-Type':`${types[path.split('.').at(-1)]}; charset=utf-8`,
      'Cache-Control':'no-cache',
    } });
  },
};
