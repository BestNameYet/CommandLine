'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {getContent,getReadme,resolveCheckedPath}=require('./local-repository-adapter');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'node-api-conversion-'));
const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
try {
 git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
 fs.writeFileSync(path.join(dir,'README.md'),'sample\n');
 fs.mkdirSync(path.join(dir,'sub'));fs.writeFileSync(path.join(dir,'sub','a.txt'),'data');
 git('add','.');git('commit','-qm','fixture');
 const file=getContent(dir,{path:'sub/a.txt'});
 assert.equal(file.type,'file');assert.equal(Buffer.from(file.content,'base64').toString(),'data');
 assert.equal(getReadme(dir).name,'README.md');
 assert.deepEqual(getContent(dir,{path:'sub'}).map(e=>e.name),['a.txt']);
 assert.throws(()=>resolveCheckedPath(dir,'../outside'),/Invalid/);
 assert.throws(()=>getContent(dir,{path:'sub/a.txt',ref:'not-head'}),/Non-HEAD/);
 fs.writeFileSync(path.join(dir,'sub','a.txt'),'changed');
 assert.throws(()=>getContent(dir,{path:'sub/a.txt'}),/not clean/);
 console.log('PASS: content, README, directory, traversal, ref, dirty checkout');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
