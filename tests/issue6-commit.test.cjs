'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {getFileObject,validateFilename,parseCommand,issueApiPath,commitFile,handle} = require('../runtime/issue6-commit.cjs');
const wrapper = body => ({issue_url:'https://api.github.com/repos/BestNameYet/CommandLine/issues/7',body});
const file = {filename:'workspaces/repository-reviews/StateMachines/AGENTS.md',body:'# Test\n'};
test('parse commit command with safe numeric comment ID',()=>assert.equal(parseCommand('gh> commit 6370001'),6370001));
test('reject missing or extra arguments',()=>{
  for(const cmd of ['gh> commit','gh> commit nope','gh> commit 7 now','gh>commit 7','gh> commit 0','gh> commit 9007199254740993']) assert.throws(()=>parseCommand(cmd));
});
test('allow nested repository file paths',()=>assert.equal(validateFilename(file.filename),file.filename));
test('reject absolute, traversal, Git internals, control characters',()=>{
  for(const name of ['/etc/passwd','../etc/passwd','a/../b','a\\b','a//b','.git/config','folder/.git/config','a\n.txt','']) assert.throws(()=>validateFilename(name));
});
test('require referenced comment to be from issue 7',()=>assert.throws(()=>getFileObject({issue_url:'https://api.github.com/repos/x/y/issues/6',body:JSON.stringify(file)})));
test('parse direct JSON file object',()=>assert.deepEqual(getFileObject(wrapper(JSON.stringify(file))),file));
test('parse success command-result JSON stdout',()=>assert.deepEqual(getFileObject(wrapper(JSON.stringify({type:'gh-command-result',exitCode:0,stdout:JSON.stringify(file)}))),file));
test('do not commit failed command output',()=>assert.throws(()=>getFileObject(wrapper(JSON.stringify({type:'gh-command-result',exitCode:1,stdout:JSON.stringify(file)})))));
test('reject arbitrary Markdown and content without filename',()=>{
  assert.throws(()=>getFileObject(wrapper('```json\n{}\n```')));
  assert.throws(()=>getFileObject(wrapper('{}')));
});
test('reject body not being a string',()=>assert.throws(()=>getFileObject(wrapper(JSON.stringify({filename:'a.md',body:{}})))));
test('reject oversize file',()=>assert.throws(()=>getFileObject(wrapper(JSON.stringify({filename:'a.md',body:'A'.repeat(900001)})))));
test('URL-encode path segments',()=>assert.equal(issueApiPath('owner/repo','my folder/name.md'),'repos/owner/repo/contents/my%20folder/name.md'));
test('create content via gh API and return commit SHA',()=>{
  let put;
  const fakeGh = args => {
    if(args[1].includes('?ref=')) return {code:1,stdout:'',stderr:'gh: Not Found (HTTP 404)'};
    if(args.includes('PUT')) {put=args;return {code:0,stdout:JSON.stringify({commit:{sha:'created-sha'}}),stderr:''};}
    throw Error('unexpected '+args.join(' '));
  };
  const result=commitFile('owner/repo','main',789,file,fakeGh);
  assert.equal(result.status,'created');assert.equal(result.commitSha,'created-sha');assert.ok(put);
});
test('no-op identical file content',()=>{
  const fakeGh = args => {
    if(args[1].includes('?ref=')) return {code:0,stdout:JSON.stringify({type:'file',sha:'x',encoding:'base64',content:Buffer.from(file.body).toString('base64')}),stderr:''};
    throw Error('Should not commit');
  };
  assert.equal(commitFile('owner/repo','main',789,file,fakeGh).status,'unchanged');
});
test('reject server-side forbidden destination',()=>{
  const fakeGh=()=>({code:1,stdout:'',stderr:'HTTP 403 Forbidden'});
  assert.throws(()=>commitFile('owner/repo','main',789,file,fakeGh),/403/);
});
test('complete route publishes both receipts and resets input',()=>{
  const calls=[];
  const event={action:'edited',issue:{number:6},sender:{login:'owner'},repository:{full_name:'owner/repo',owner:{login:'owner'},default_branch:'main'},comment:{id:6358997143,body:'gh> commit 778',user:{type:'Bot'}}};
  const gh=args=>{
    calls.push(args);
    if(args[1]==='repos/owner/repo/issues/comments/6358997143' && !args.includes('PATCH')) return {code:0,stdout:JSON.stringify({body:event.comment.body}),stderr:''};
    if(args[1]==='repos/owner/repo/issues/comments/778') return {code:0,stdout:JSON.stringify({issue_url:'https://api.github.com/repos/owner/repo/issues/7',body:JSON.stringify(file)}),stderr:''};
    if(args[1].endsWith('?ref=main')) return {code:1,stdout:'',stderr:'HTTP 404'};
    if(args.includes('PUT')) return {code:0,stdout:JSON.stringify({commit:{sha:'123abc'}}),stderr:''};
    if(args.includes('PATCH') && args[1].endsWith('/6358997143')) return {code:0,stdout:'',stderr:''};
    if(args[1]==='repos/owner/repo/issues/6/comments?per_page=100') return {code:0,stdout:'',stderr:''};
    if(args[1]==='repos/owner/repo/issues/7/comments' && args.includes('POST')) return {code:0,stdout:'910',stderr:''};
    if(args[1]==='repos/owner/repo/issues/6/comments' && args.includes('POST')) return {code:0,stdout:'911',stderr:''};
    throw Error('unexpected '+args.join(' '));
  };
  const outcome=handle(event,{GITHUB_REPOSITORY:'owner/repo',ISSUE6_INPUT_COMMENT_ID:'6358997143'},gh);
  assert.equal(outcome.result.exitCode,0);assert.equal(outcome.result.commitSha,'123abc');
  assert.equal(outcome.responseCommentId,910);
  assert.equal(outcome.referenceCommentId,911);
  assert.equal(calls.filter(x=>x.includes('PUT')).length,1);
  assert.ok(calls.some(x=>x.includes('PATCH')&&x.includes('body=gh>')));
});
