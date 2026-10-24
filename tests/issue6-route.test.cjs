'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {selectRoute} = require('../runtime/issue6-route.cjs');
function event(body, overrides={}) {
  return {
    action: 'edited', issue: {number:6},
    repository: {full_name:'BestNameYet/CommandLine',owner:{login:'BestNameYet'}},
    sender:{login:'BestNameYet',type:'User'},
    comment:{id:6358997143,body,user:{login:'github-actions[bot]',type:'Bot'}},
    ...overrides
  };
}
const route = e => selectRoute(e, 'BestNameYet/CommandLine');
test('commit commands route to the write workflow',()=>assert.equal(route(event('gh> commit 6372767395')),'commit'));
test('invalid commit ID is still routed to write workflow for error handling',()=>assert.equal(route(event('gh> commit bad')),'commit'));
test('other gh commands use read-only workflow',()=>assert.equal(route(event('gh> api repos/BestNameYet/CommandLine')),'gh'));
test('bare prompt is non-executable',()=>assert.equal(route(event('gh>')),'normalize'));
test('non-command text is normalized',()=>assert.equal(route(event('ordinary')),'normalize'));
test('other human comments only normalized',()=>assert.equal(route(event('gh> commit 123',{comment:{id:6,body:'gh> commit 123',user:{type:'User'}}})),'normalize'));
test('other bot comments ignored',()=>assert.equal(route(event('gh> commit 123',{comment:{id:6,body:'gh> commit 123',user:{type:'Bot'}}})),'ignore'));
test('only owner edits input',()=>assert.equal(route(event('gh> commit 123',{sender:{login:'attacker',type:'User'}})),'ignore'));
test('created input events ignored',()=>assert.equal(route(event('gh> commit 123',{action:'created'})),'ignore'));
test('comments from other issues ignored',()=>assert.equal(route(event('gh> commit 123',{issue:{number:7}})),'ignore'));
test('bot-caused events ignored',()=>assert.equal(route(event('gh> commit 123',{sender:{login:'github-actions[bot]',type:'Bot'}})),'ignore'));
