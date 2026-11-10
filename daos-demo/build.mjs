import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const assets = {};
for (const folder of ['driver', 'ops', 'shop', 'central', 'hub']) {
  for (const file of await readdir(folder)) {
    if (file.endsWith('.jpg')) continue;
    assets[`/${folder}/${file}`] = await readFile(`${folder}/${file}`, 'utf8');
  }
}
await mkdir('dist/server', { recursive: true });
const [worker,share,sso] = await Promise.all(['worker.mjs','share-access.mjs','portal-sso.mjs'].map(path=>readFile(path,'utf8')));
await writeFile('dist/server/index.js', `const ASSETS = ${JSON.stringify(assets)};\n${share}\n${sso}\n${worker}`);
