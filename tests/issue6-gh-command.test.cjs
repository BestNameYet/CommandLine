const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'runtime/issue6-gh-command.cjs'), 'utf8');

function run({ body = 'ordinary text', action = 'created', login = 'owner', type = 'User', sender = login, number = 6, id = 123, currentBody = body, failPatch = false } = {}) {
  const event = { action, sender: { login: sender }, repository: { full_name: 'owner/repo', owner: { login: 'owner' } }, issue: { number }, comment: { id, body, user: { login, type } } };
  const calls = [];
  const exit = Symbol('exit');
  let exitCode = 0;
  const spawnSync = (exe, args) => {
    calls.push(Array.from(args));
    if (args.includes('PATCH')) return { status: failPatch ? 1 : 0, stdout: '', stderr: failPatch ? 'forbidden' : '' };
    if (args.includes('POST')) return { status: 0, stdout: String(1000 + calls.length), stderr: '' };
    if (args[0] === 'api' && args[1] === `repos/owner/repo/issues/comments/${id}`) return { status: 0, stdout: JSON.stringify({ body: currentBody, user: { type } }), stderr: '' };
    return { status: 0, stdout: 'command output', stderr: '' };
  };
  const fakeFs = { readFileSync: () => JSON.stringify(event), mkdtempSync: () => '/tmp/test-response', writeFileSync: () => {}, rmSync: () => {} };
  try {
    vm.runInNewContext(source, { require: name => name === 'node:fs' ? fakeFs : name === 'node:child_process' ? { spawnSync } : require(name), process: { env: { GITHUB_EVENT_PATH: '/event.json', GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'test-token', ISSUE6_INPUT_COMMENT_ID: '123' }, exit: code => { exitCode = code; throw exit; } }, console: { log: () => {} } });
  } catch (error) { if (error !== exit) throw error; }
  return { calls, exitCode };
}
const patches = result => result.calls.filter(args => args.includes('PATCH'));
const posts = result => result.calls.filter(args => args.includes('POST'));

for (const action of ['created', 'edited']) test(`invalid ${action} comment is edited at the same ID`, () => {
  const result = run({ action });
  assert.deepEqual(patches(result), [['api', 'repos/owner/repo/issues/comments/123', '--method', 'PATCH', '-f', 'body=gh>']]);
  assert.equal(posts(result).length, 0);
  assert.equal(result.calls.some(args => args.includes('DELETE')), false);
});
test('invalid comment from another human is normalized', () => assert.equal(patches(run({ login: 'visitor' })).length, 1));
test('bot response remains unchanged', () => assert.equal(run({ login: 'github-actions[bot]', type: 'Bot' }).calls.length, 0));
test('bare prompt remains unchanged', () => assert.equal(run({ body: 'gh>' }).calls.length, 0));
test('edited owner command executes, publishes, and resets', () => {
  const result = run({ action: 'edited', body: 'gh> issue list' });
  assert.deepEqual(result.calls[0], ['issue', 'list']);
  assert.equal(posts(result).length, 2);
  assert.equal(patches(result).length, 1);
});
test('edited bare prompt does not execute', () => assert.equal(run({ action: 'edited', body: 'gh>' }).calls.length, 0));
test('owner can edit the original bot-authored prompt into a command', () => {
  const result = run({ action: 'edited', body: 'gh> issue list', login: 'github-actions[bot]', type: 'Bot', sender: 'owner' });
  assert.deepEqual(result.calls[0], ['issue', 'list']);
  assert.equal(posts(result).length, 2);
  assert.equal(patches(result).length, 1);
});
test('visitor cannot execute by editing a bot-authored prompt', () => assert.equal(run({ action: 'edited', body: 'gh> issue list', login: 'github-actions[bot]', type: 'Bot', sender: 'visitor' }).calls.length, 0));
for (const action of ['created', 'edited']) test(`commands in another comment never execute (${action})`, () => {
  const result = run({ action, id: 124, body: 'gh> issue list' });
  assert.equal(posts(result).length, 0);
  assert.deepEqual(patches(result), [['api', 'repos/owner/repo/issues/comments/124', '--method', 'PATCH', '-f', 'body=gh>']]);
});
test('invalid text in the bot-authored input is reset on owner edit', () => assert.equal(patches(run({ action: 'edited', login: 'github-actions[bot]', type: 'Bot', sender: 'owner' })).length, 1));
test('another human cannot execute', () => assert.equal(run({ login: 'visitor', body: 'gh> issue list' }).calls.length, 0));
test('owner command still publishes results and resets its input', () => {
  const result = run({ body: 'gh> issue list' });
  assert.deepEqual(result.calls[0], ['issue', 'list']);
  assert.equal(posts(result).length, 2);
  assert.equal(patches(result).length, 1);
});
test('malformed marker is normalized', () => assert.equal(patches(run({ body: 'gh>oops' })).length, 1));
test('stale invalid event does not erase a currently valid input', () => assert.equal(patches(run({ currentBody: 'gh> issue list' })).length, 0));
test('failed normalization is reported', () => assert.throws(() => run({ failPatch: true }), /Prompt update failed/));
test('other issue is rejected without mutations', () => assert.throws(() => run({ number: 7 }), /Issue #6/));
