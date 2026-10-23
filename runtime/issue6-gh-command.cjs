'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY;
const original = event.comment;
if (!['created', 'edited'].includes(event.action) || event.issue?.number !== 6 ||
    event.repository?.full_name !== repo) {
  throw Error('Only created or edited comments on Issue #6 are accepted');
}
if (original?.user?.type === 'Bot') process.exit(0);
if (!process.env.GH_TOKEN) throw Error('GH_TOKEN is required');

function argsFrom(input) {
  const result = [];
  let word = '', quote = '', active = false, escape = false;
  for (const char of input) {
    if (escape) { word += char; escape = false; active = true; }
    else if (char === '\\' && quote !== "'") { escape = true; }
    else if (quote) { if (char === quote) quote = ''; else word += char; }
    else if (char === "'" || char === '"') { quote = char; active = true; }
    else if (/\s/.test(char)) {
      if (active) { result.push(word); word = ''; active = false; }
    } else { word += char; active = true; }
  }
  if (quote || escape) throw Error('Unmatched quote or escape');
  if (active) result.push(word);
  if (result[0] === 'gh') result.shift();
  if (!result.length || result[0] === 'gh') {
    throw Error('Expected gh arguments without repeating gh');
  }
  return result;
}
function gh(args) {
  const r = spawnSync('gh', args, {
    encoding: 'utf8', shell: false, timeout: 90000, maxBuffer: 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' }
  });
  return { code: r.status === null ? 1 : r.status,
    stdout: String(r.stdout || ''), stderr: String(r.stderr || r.error?.message || '') };
}
function safe(value) {
  let s = String(value);
  s = s.replaceAll(process.env.GH_TOKEN, '[REDACTED]');
  return s;
}

const source = String(original.body || '').trim();
function resetPrompt() {
  const updated = gh(['api', 'repos/' + repo + '/issues/comments/' + original.id,
    '--method', 'PATCH', '-f', 'body=gh>']);
  if (updated.code !== 0) throw Error('Prompt update failed: ' + safe(updated.stderr));
}
if (!/^gh>(?:\s|$)/.test(source)) {
  // Re-read before editing so a stale event cannot erase a now-valid command.
  const current = gh(['api', 'repos/' + repo + '/issues/comments/' + original.id]);
  if (current.code !== 0) throw Error('Comment read failed: ' + safe(current.stderr));
  const comment = JSON.parse(current.stdout);
  if (comment.user?.type !== 'Bot' && !/^gh>(?:\s|$)/.test(String(comment.body || '').trim())) resetPrompt();
  process.exit(0);
}
if (source === 'gh>' || event.action !== 'created' ||
    original?.user?.login !== event.repository?.owner?.login) process.exit(0);
let result;
try { result = gh(argsFrom(source.slice(3).trim())); }
catch (e) { result = { code: 1, stdout: '', stderr: e.message }; }

const output = JSON.stringify({
  type: 'gh-command-result',
  sourceCommentId: original.id,
  exitCode: result.code,
  stdout: safe(result.stdout),
  stderr: safe(result.stderr)
}, null, 2);

function publish(body, issueNumber) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue6-response-'));
  try {
    const file = path.join(dir, 'body.json');
    fs.writeFileSync(file, JSON.stringify({ body }));
    const response = gh(['api', 'repos/' + repo + '/issues/' + issueNumber + '/comments',
      '--method', 'POST', '--input', file, '--jq', '.id']);
    if (response.code !== 0) throw Error('Result publication failed: ' + safe(response.stderr));
    const id = Number(response.stdout.trim());
    if (!Number.isSafeInteger(id) || id < 1) throw Error('Invalid result comment ID');
    return id;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const outputCommentId = publish(output, 7);
const referenceCommentId = publish(JSON.stringify({
  originatorCommentId: original.id,
  command: source,
  responseCommentId: outputCommentId
}, null, 2), 6);
resetPrompt();
console.log(JSON.stringify({ responseCommentId: outputCommentId,
  referenceCommentId, sourceCommentId: original.id }));
