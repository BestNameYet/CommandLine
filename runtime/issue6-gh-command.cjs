'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY;
const original = event.comment;
if (event.action !== 'created' || event.issue?.number !== 6 ||
    event.repository?.full_name !== repo ||
    original?.user?.login !== event.repository?.owner?.login) {
  throw Error('Only owner-authored commands on Issue #6 are accepted');
}
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
  if (!result.length || ['auth', 'alias', 'extension', 'config'].includes(result[0])) {
    throw Error('Invalid or restricted gh command');
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
  return s.length > 24000 ? s.slice(0, 24000) + '\n[TRUNCATED]' : s;
}

const source = String(original.body || '').trim();
if (source === 'gh>' || !/^gh>\s+/.test(source)) { console.log('No executable gh> input'); process.exit(0); }
let result;
try { result = gh(argsFrom(source.slice(3).trim())); }
catch (e) { result = { code: 1, stdout: '', stderr: e.message }; }

const output = JSON.stringify({
  type: 'gh-command-result',
  sourceCommentId: original.id,
  command: safe(source),
  exitCode: result.code,
  stdout: safe(result.stdout),
  stderr: safe(result.stderr)
}, null, 2);

function publish(body) {
  const response = gh(['api', 'repos/' + repo + '/issues/6/comments',
    '--method', 'POST', '-f', 'body=' + body, '--jq', '.id']);
  if (response.code !== 0) throw Error('Result publication failed: ' + safe(response.stderr));
  const id = Number(response.stdout.trim());
  if (!Number.isSafeInteger(id) || id < 1) throw Error('Invalid result comment ID');
  return id;
}
const outputCommentId = publish(output);
const referenceCommentId = publish(JSON.stringify({
  command: source,
  responseCommentId: outputCommentId
}, null, 2));
const removed = gh(['api', 'repos/' + repo + '/issues/comments/' + original.id,
  '--method', 'DELETE']);
if (removed.code !== 0) throw Error('Reference published but input cleanup failed');
try { publish('gh>'); }
catch (error) { console.error('Prompt publication failed: ' + error.message); }
console.log(JSON.stringify({ responseCommentId: outputCommentId,
  referenceCommentId, sourceCommentId: original.id }));
