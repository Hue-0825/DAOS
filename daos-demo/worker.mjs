const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short' });
const dateKey = (offset = 0) => dateFormat.format(new Date(Date.now() + offset * 86_400_000));
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const fixtures = JSON.parse(ASSETS['/driver/jobs.json']);
const places = JSON.parse(ASSETS['/ops/places.json']);
const routing = JSON.parse(ASSETS['/central/routing.json']);
const types = { html:'text/html', mjs:'text/javascript', js:'text/javascript', css:'text/css', svg:'image/svg+xml', webmanifest:'application/manifest+json', json:'application/json' };
const controlSql = 'SELECT online, revision FROM control WHERE id = 1';
const publishedSql = 'SELECT id, rowid AS number, work_date AS date, segment, title, cargo, destination AS "drop", instructions AS "to" FROM orders WHERE province = ? AND revision IS NOT NULL AND work_date BETWEEN ? AND ? ORDER BY segment, rowid';
const guard = '(SELECT online FROM control WHERE id = 1) = 1';
const run = (db, sql, ...args) => args.length ? db.prepare(sql).bind(...args) : db.prepare(sql);
const DEFAULT_PROVINCE = '경상남도';
const provinceFrom = request => new URL(request.url).searchParams.get('province') ?? DEFAULT_PROVINCE;
const ordersFor = (db,province) => run(db, publishedSql, province,...windowDates());
const versionSql=`SELECT COALESCE(MAX(revision),0) FROM (
  SELECT revision FROM orders WHERE province = ? AND work_date BETWEEN ? AND ?
  UNION ALL SELECT revision FROM dispatch_reset WHERE province = ? AND work_date BETWEEN ? AND ?
)`;
const versionArgs=province=>[province,...windowDates(),province,...windowDates()];
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
  return { ...job, key: `${job.date}/${job.id}` };
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
  EXISTS (SELECT 1 FROM events WHERE job_key = intake.work_date || '/' || intake.id AND mode IN ('daos',intake.province || '|daos') AND state = 'delivered') AS delivered
  FROM intake LEFT JOIN orders ON intake.id = orders.id`;
const DEMO_DATES=['2026-11-09','2026-11-10','2026-11-11'];
const dates=()=>DEMO_DATES;
const windowDates=()=>[DEMO_DATES[0],DEMO_DATES.at(-1)];
const isText = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
const compact = value => value.replace(/\s+/g,'');
function routeAddress(province, city, address) {
  if (province !== DEFAULT_PROVINCE) {
    const region=Object.keys(routing.regions).find(key=>routing.regions[key].province===province);
    return region ? [`prov_${region}`,region,routing.regions[region].segment] : [];
  }
  const normalized = compact(address);
  const matches = Object.entries(places).filter(([,place]) =>
    !routing.regions[place.region].province && routing.regions[place.region].city === city && normalized.includes(compact(place.label)));
  if (matches.length !== 1) return [];
  const [destination, place] = matches[0];
  return [destination, place.region, routing.regions[place.region].segment];
}

async function intakeApi(request, db, path) {
  if (path === '/api/shop/options' && request.method === 'GET') {
    return json({ dates:dates(), provinces:routing.provinces, products:routing.products, catalog:routing.catalog,
      stops:Object.values(places).map(place=>({label:place.label,city:routing.regions[place.region].city,province:routing.regions[place.region].province??DEFAULT_PROVINCE})) });
  }
  if (path === '/api/shop/orders' && request.method === 'POST') {
    const item = await request.json();
    if (!item || !routing.provinces.includes(item.province) || !dates().includes(item.date)
        || !Object.hasOwn(routing.products,item.product) || !Number.isInteger(item.quantity)
        || item.quantity < 1 || item.quantity > 99 || !isText(item.city,30) || !isText(item.address,100)
        || !isText(item.recipient,35) || typeof item.instructions !== 'string' || item.instructions.length > 100) {
      return json({error:'배송일과 주소, 주문 정보를 확인해 주세요.'},400);
    }
    const id = crypto.randomUUID();
    const city = item.city.trim();
    const address = item.address.trim();
    const [destination=null,region=null,segment=null] = routeAddress(item.province,city,address);
    const result = await run(db, `INSERT INTO intake VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,new Date().toISOString(),item.date,item.province,city,address,item.recipient.trim(),
      routing.products[item.product],item.quantity,item.instructions.trim(),destination,region,segment).run();
    return json({ number:result.meta.last_row_id ?? result.meta.lastInsertRowid, province:item.province },201);
  }
  if (path === '/api/central/orders' && request.method === 'GET') {
    const [result,control]=await db.batch([
      run(db,`${intakeSql} WHERE intake.work_date BETWEEN ? AND ? ORDER BY intake.work_date,intake.created_at DESC,intake.rowid DESC`,...windowDates()),
      run(db,controlSql),
    ]);
    return json({ orders:result.results, provinces:routing.provinces, regions:routing.regions,
      online:Boolean(control.results[0].online), historyDates:dates() });
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
    const plan=await Promise.all(groups.flatMap((date,day)=>Array.from({length:100},async (_,index)=>{
      const province=index<20?DEFAULT_PROVINCE:routing.provinces.filter(name=>name!==DEFAULT_PROVINCE)[(index-20)%16];
      const region=province===DEFAULT_PROVINCE?['campus','jangyu','yangsan'][index%3]
        :Object.keys(routing.regions).find(key=>routing.regions[key].province===province);
      const detail=routing.regions[region];
      const stops=Object.keys(places).filter(key=>places[key].region===region);
      const destination=stops[index%stops.length];
      const id=await sampleId(date,`history-v1/${index}`);
      const created=new Date(Date.parse(`${date}T00:00:00+09:00`)+(index+1)*60000).toISOString();
      return [id,created,date,province,detail.city,places[destination].label,`시연 고객 ${String(day*100+index+1).padStart(3,'0')}`,
        Object.values(routing.products)[index%5],index%4+1,'시연용 · 지정 인계 지점',destination,region,detail.segment];
    })));
    const statements=[];
    for(let i=0;i<plan.length;i+=7){
      const rows=plan.slice(i,i+7);
      statements.push(run(db,`INSERT OR IGNORE INTO intake VALUES ${rows.map(()=>'(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')}`,...rows.flat()));
    }
    const results=await db.batch([...cleanup,...statements]);
    const sum=items=>items.reduce((total,result)=>total+result.meta.changes,0);
    return json({ dates:groups, planned:plan.length, removed:sum(results.slice(0,cleanup.length)), inserted:sum(results.slice(cleanup.length)) });
  }
  if (path === '/api/hub/orders' && request.method === 'GET') {
    const province=provinceFrom(request);
    if(!routing.provinces.includes(province))return json({error:'허브를 선택해 주세요.'},400);
    const [intake,control,revision,receipt] = await db.batch([
      run(db,`${intakeSql} WHERE intake.province = ? AND intake.work_date BETWEEN ? AND ? ORDER BY intake.work_date,intake.segment,intake.rowid`,province,...windowDates()),
      run(db,controlSql),revisionFor(db,province),
      run(db,'SELECT revision, saved_at FROM province_receipt WHERE province = ?',province),
    ]);
    return json({ orders:intake.results, provinces:routing.provinces, regions:routing.regions,
      receipt:receipt.results[0], online:control.results[0].online,revision:revision.results[0].revision,dates:dates() });
  }
  if (path === '/api/hub/dispatch' && request.method === 'POST') {
    const { province, date, region } = await request.json();
    const route=routing.regions[region];
    if (!routing.provinces.includes(province) || !dates().includes(date) || !Object.hasOwn(routing.regions,region)
        || (route.province??DEFAULT_PROVINCE)!==province) {
      return json({error:'해당 허브의 오늘부터 모레까지의 배송 권역만 배차할 수 있습니다.'},400);
    }
    const { segment } = route;
    const sameRegion = Object.keys(places).filter(key=>places[key].region === region);
    const [insert] = await db.batch([
      run(db,`INSERT OR IGNORE INTO orders (id,work_date,segment,title,cargo,destination,instructions,revision,province)
        SELECT intake.id,intake.work_date,intake.segment,intake.product,intake.quantity || '개',intake.destination,
          intake.address || CASE WHEN intake.instructions <> '' THEN ' · ' || intake.instructions ELSE '' END,
          (SELECT revision + 1 FROM control WHERE id = 1),intake.province
        FROM intake WHERE province = ? AND work_date = ? AND region = ? AND destination IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM orders WHERE province = ? AND work_date = ? AND segment = ? AND destination NOT IN (${sameRegion.map(()=>'?').join(',')}))`,
        province,date,region,province,date,segment,...sameRegion),
      run(db,`UPDATE control SET revision = revision + 1 WHERE id = 1
        AND EXISTS (SELECT 1 FROM orders WHERE orders.revision = control.revision + 1)`),
    ]);
    return insert.meta.changes ? json({count:insert.meta.changes}) : json({error:'대기 주문이 없거나 같은 시간대에 다른 권역이 이미 배차됐습니다.'},409);
  }
  if(path==='/api/hub/cancel' && request.method==='POST'){
    const {province,date}=await request.json();
    if(!routing.provinces.includes(province)||!dates().includes(date))return json({error:'취소할 지역과 배송일을 확인해 주세요.'},400);
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
    if (path === '/api/driver' && method === 'GET') {
      const mode=modeFor(new URL(request.url).searchParams.get('mode'),province);
      const [control,revision,jobs,events,resets] = await db.batch([
        run(db,controlSql),revisionFor(db,province),ordersFor(db,province),
        run(db,'SELECT id, job_key AS key, work_date AS date, state, recorded_at AS at FROM events WHERE mode = ? AND work_date BETWEEN ? AND ?',mode,...windowDates()),
        run(db,'SELECT work_date AS date,revision FROM dispatch_reset WHERE province = ?',province),
      ]);
      if(!control.results[0].online)return json({error:'메인 서버 연결 끊김'},503);
      return json({revision:revision.results[0].revision,jobs:jobs.results.map(jobView),events:events.results,resets:Object.fromEntries(resets.results.map(reset=>[reset.date,reset.revision]))});
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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const hostedSplit = Boolean(env.DAOS_SHOP_TOKEN);
    const split = hostedSplit || Boolean(env.SERVICE_TOKEN);
    if (pathname.startsWith('/api/')) {
      const token = request.headers.get('X-DAOS-Service-Key');
      if (hostedSplit) {
        const shop = token === env.DAOS_SHOP_TOKEN && pathname.startsWith('/api/shop/');
        const hub = token === env.DAOS_HUB_TOKEN && (pathname.startsWith('/api/hub/') || pathname === '/api/ops/connection');
        const driver = token === env.DAOS_DRIVER_TOKEN && (pathname === '/api/driver' || pathname.startsWith('/api/driver/'));
        const consoleView = pathname === '/api/central/orders' && request.method === 'GET'
          && Boolean(request.headers.get('oai-authenticated-user-id'));
        const seed = pathname === '/api/central/seed' && request.method === 'POST'
          && Boolean(env.DAOS_SEED_TOKEN) && token === env.DAOS_SEED_TOKEN;
        if (!shop && !hub && !driver && !consoleView && !seed) return json({error:'서버 간 연결이 필요합니다.'},401);
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
