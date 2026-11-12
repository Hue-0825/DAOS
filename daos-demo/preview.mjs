import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import worker from './dist/server/index.js';

const sqlite = new DatabaseSync(process.env.DAOS_DB_PATH ?? 'preview.sqlite');
for (const [table, migration] of [['control','0000_dispatch'],['intake','0001_intake'],['province_receipt','0002_province_dispatch'],['dispatch_reset','0003_dispatch_reset']]) {
  if (!sqlite.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(table)) {
    sqlite.exec(await readFile(`drizzle/${migration}.sql`, 'utf8'));
  }
}
if (sqlite.prepare('PRAGMA user_version').get().user_version < 4) {
  sqlite.exec(await readFile('drizzle/0004_november_demo.sql','utf8'));
  sqlite.exec('PRAGMA user_version = 4');
}
if (sqlite.prepare('PRAGMA user_version').get().user_version < 5) {
  const migration=await readFile('drizzle/0005_global_reset.sql','utf8');
  sqlite.exec(`BEGIN; ${migration} PRAGMA user_version = 5; COMMIT;`);
}
if (sqlite.prepare('PRAGMA user_version').get().user_version < 6) {
  const migration=await readFile('drizzle/0006_demo_routes.sql','utf8');
  sqlite.exec(`BEGIN; ${migration} PRAGMA user_version = 6; COMMIT;`);
}
for (const [version,filename] of [[7,'0007_hub_release'],[8,'0008_five_day_demo'],[9,'0009_shared_clock'],[10,'0010_yangsan_sample_stop']]) {
  if (sqlite.prepare('PRAGMA user_version').get().user_version < version) {
    const migration=await readFile(`drizzle/${filename}.sql`,'utf8');
    sqlite.exec(`BEGIN; ${migration} PRAGMA user_version = ${version}; COMMIT;`);
  }
}
function statement(sql, args) {
  return {
    execute() {
      const prepared = sqlite.prepare(sql);
      if (prepared.columns().length) return {results:prepared.all(...args)};
      return {results:[],meta:prepared.run(...args)};
    },
    async run() { return this.execute(); },
    async all() { return this.execute(); },
  };
}
const DB = {
  prepare(sql) { return {...statement(sql,[]),bind: (...args) => statement(sql,args)}; },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map(item=>item.execute());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};
const host = process.env.DAOS_PREVIEW_HOST ?? '127.0.0.1';
const port = Number(process.env.DAOS_PREVIEW_PORT ?? 8771);
createServer(async (incoming, outgoing) => {
  try {
    const body = [];
    for await (const part of incoming) body.push(part);
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    const token = process.env.DAOS_SERVICE_TOKEN;
    const headers = new Headers(incoming.headers);
    if (token && url.pathname.startsWith('/api/central/')) headers.set('Authorization',`Bearer ${token}`);
    const request = new Request(url, {
      method:incoming.method, headers,
      body:body.length ? Buffer.concat(body) : undefined,
    });
    const response = await worker.fetch(request,{DB,SERVICE_TOKEN:token});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end('Preview server error');
  }
}).listen(port,host,()=>console.log(`DAOS 운영 웹 http://${host}:${port}/central/`));
