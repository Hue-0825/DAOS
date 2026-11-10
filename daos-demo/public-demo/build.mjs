import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const files = ['index.html','style.css','robots.txt','sitemap.xml',
  ...(await readdir('robot')).map(file=>`robot/${file}`)];
const assets = Object.fromEntries(await Promise.all(files.map(async file=>['/'+file,await readFile(file,'utf8')])));
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js',`const ASSETS=${JSON.stringify(assets)};\n${await readFile('worker.mjs','utf8')}`);
