import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const [role,projectId]=process.argv.slice(2);
if(!['shop','hub','driver'].includes(role)||!projectId)throw Error('Site role and project ID required');
const destination=new URL(`../daos-${role}-site/`,import.meta.url);
await mkdir(new URL('.openai/',destination),{recursive:true});
await writeFile(new URL('.openai/hosting.json',destination),JSON.stringify({project_id:projectId,d1:null,r2:null})+'\n');
await writeFile(new URL('.gitignore',destination),'dist/\n');
const assets={};
for(const file of await readdir(new URL(`${role}/`,import.meta.url))){
  if(file==='jobs.json')continue;
  const url=new URL(`${role}/${file}`,import.meta.url);
  assets[file]=file.endsWith('.jpg')?{base64:(await readFile(url)).toString('base64')}:await readFile(url,'utf8');
}
if(role==='hub'){
  const maps=await readdir(new URL('driver/',import.meta.url));
  for(const file of maps.filter(name=>name.endsWith('.svg')&&name!=='icon.svg')) {
    assets[file]=await readFile(new URL(`driver/${file}`,import.meta.url),'utf8');
  }
}
const [gateway,share]=await Promise.all(['gateway-worker.mjs','share-access.mjs'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
await writeFile(new URL('worker.mjs',destination),`const ROLE=${JSON.stringify(role)};\nconst ASSETS=${JSON.stringify(assets)};\n${share}\n${gateway}`);
await writeFile(new URL('build.mjs',destination),[
  "import { mkdir, copyFile } from 'node:fs/promises';",
  "await mkdir('dist/server',{recursive:true});",
  "await copyFile('worker.mjs','dist/server/index.js');",
].join('\n')+'\n');
