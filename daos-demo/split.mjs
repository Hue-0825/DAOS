import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import './build.mjs';

const token=randomBytes(32).toString('hex');
const env={...process.env,DAOS_SERVICE_TOKEN:token,DAOS_CENTRAL_URL:'http://127.0.0.1:8781',
  DAOS_PREVIEW_HOST:'127.0.0.1',DAOS_PREVIEW_PORT:'8781',DAOS_DB_PATH:process.env.DAOS_DB_PATH??'split.sqlite'};
const children=[
  ['preview.mjs'],
  ...['shop','hub','driver'].map(role=>['gateway.mjs',role]),
].map(args=>spawn(process.execPath,args,{env,stdio:'inherit'}));
function stop(){
  for(const child of children)child.kill();
}
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
for(const child of children)child.on('exit',code=>{
  if(code){process.exitCode=code;stop()}
});
