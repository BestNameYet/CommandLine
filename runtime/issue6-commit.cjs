'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const INPUT_ID = '6358997143';
const SLOT_MARKER = '<!-- issue6-response-slot:available -->';
const MAX_FILE_BYTES = 900_000; // GitHub Contents endpoint is not a large-file transport.

function validateFilename(filename) {
  if (typeof filename !== 'string' || !filename || filename.length > 512 ||
      /[\\\u0000-\u001f\u007f]/.test(filename) || filename.startsWith('/') ||
      filename.endsWith('/') || filename.includes('//') ||
      filename.split('/').some(p => p === '.' || p === '..' || p === '.git') ||
      !/^[\w.\- @()+/]+$/.test(filename)) {
    throw Error('Invalid repository-relative filename');
  }
  return filename;
}

function getFileObject(comment) {
  if (!comment || comment.issue_url?.split('/').pop() !== '7') {
    throw Error('Referenced comment does not belong to Issue #7');
  }
  let data;
  try { data = JSON.parse(comment.body); }
  catch { throw Error('Referenced comment must contain one JSON object'); }

  if (data?.type === 'gh-command-result') {
    if (data.exitCode !== 0) throw Error('Referenced command failed; refusing to commit its output');
    try { data = JSON.parse(data.stdout); }
    catch { throw Error('Referenced command stdout is not a JSON file object'); }
  }
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw Error('Referenced JSON must be a file object');
  }
  const filename = validateFilename(data.filename);
  if (typeof data.body !== 'string') throw Error('File object must have a string body');
  if (Buffer.byteLength(data.body, 'utf8') > MAX_FILE_BYTES) throw Error('File body exceeds 900000 bytes');
  return {filename, body: data.body};
}

function parseCommand(input) {
  const found = /^gh>\s+commit\s+([1-9][0-9]*)\s*$/.exec(String(input).trim());
  if (!found || !Number.isSafeInteger(Number(found[1]))) {
    throw Error('Expected: gh> commit <Issue-7-commentID>');
  }
  return Number(found[1]);
}

function gh(args, env = process.env) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8', shell: false, timeout: 90000, maxBuffer: 4 * 1024 * 1024,
    env: {...env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1'}
  });
  return {code: result.status ?? 1,
    stdout: String(result.stdout || ''), stderr: String(result.stderr || result.error?.message || '')};
}

function runGhOrThrow(args, runner) {
  const res = runner(args);
  if (res.code !== 0) throw Error(res.stderr.trim() || 'GitHub command failed');
  return res.stdout;
}

function saveBodyAsJson(payload) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'issue6-commit-'));
  const pathname = path.join(folder, 'body.json');
  fs.writeFileSync(pathname, JSON.stringify(payload), {mode: 0o600});
  return {folder, pathname};
}

function issueApiPath(repository, filename, suffix = '') {
  return `repos/${repository}/contents/${filename.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}

function commitFile(repository, branch, sourceId, file, runner) {
  const endpoint = issueApiPath(repository, file.filename);
  const existing = runner(['api', endpoint + `?ref=${encodeURIComponent(branch)}`]);
  let sha;
  if (existing.code === 0) {
    let obj;
    try { obj = JSON.parse(existing.stdout); }
    catch { throw Error('Existing repository file response was invalid JSON'); }
    if (obj.type !== 'file' || typeof obj.sha !== 'string') {
      throw Error('Target exists but is not an ordinary file');
    }
    sha = obj.sha;
    if (typeof obj.content === 'string' && obj.encoding === 'base64' &&
        Buffer.from(obj.content.replace(/\s+/g, ''), 'base64').equals(Buffer.from(file.body, 'utf8'))) {
      return {status: 'unchanged', filename: file.filename, commitSha: null};
    }
  } else if (!/HTTP 404\b/.test(existing.stderr)) {
    throw Error('Cannot inspect destination: ' + existing.stderr.trim());
  }

  const payload = {
    message: `Commit Issue #7 comment ${sourceId}: ${file.filename}`,
    content: Buffer.from(file.body, 'utf8').toString('base64'),
    branch,
    ...(sha ? {sha} : {})
  };
  const temporary = saveBodyAsJson(payload);
  try {
    const raw = runGhOrThrow(['api', endpoint, '--method', 'PUT', '--input', temporary.pathname], runner);
    const response = JSON.parse(raw);
    if (!response.commit?.sha) throw Error('GitHub commit response did not contain a commit SHA');
    return {status: sha ? 'updated' : 'created', filename: file.filename, commitSha: response.commit.sha};
  } finally {
    fs.rmSync(temporary.folder, {recursive: true, force: true});
  }
}

function publish(repository, runner, inputId, issue, body) {
  const endpoint = `repos/${repository}/issues/${issue}/comments`;
  let method = 'POST', destination = endpoint;
  if (issue === 6) {
    const slots = runGhOrThrow(['api', endpoint + '?per_page=100', '--paginate', '--jq',
      `.[] | select(.id != ${inputId} and .body == "${SLOT_MARKER}") | .id`], runner)
      .trim().split(/\s+/).filter(Boolean);
    if (slots.length) {
      const id = Number(slots[0]);
      if (!Number.isSafeInteger(id) || id < 1 || id === Number(inputId)) throw Error('Bad response slot');
      destination = `repos/${repository}/issues/comments/${id}`;
      method = 'PATCH';
    }
  }
  const temp = saveBodyAsJson({body});
  try {
    const result = runGhOrThrow(['api', destination, '--method', method, '--input', temp.pathname, '--jq', '.id'], runner);
    const id = Number(result.trim());
    if (!Number.isSafeInteger(id) || id < 1) throw Error('Invalid published comment ID');
    return id;
  } finally {
    fs.rmSync(temp.folder, {recursive: true, force: true});
  }
}

function handle(event, env = process.env, runner = a => gh(a, env)) {
  const repository = env.GITHUB_REPOSITORY;
  const owner = event.repository?.owner?.login;
  const comment = event.comment;
  const inputId = env.ISSUE6_INPUT_COMMENT_ID || INPUT_ID;
  if (event.action !== 'edited' || event.issue?.number !== 6 ||
      event.repository?.full_name !== repository || event.sender?.login !== owner ||
      String(comment?.id) !== inputId) {
    throw Error('Unauthorized command event');
  }
  let result = {exitCode: 1, status: 'failed', filename: null, commitSha: null, error: null};
  try {
    const id = parseCommand(comment.body);
    // A stale webhook must not execute after the prompt has been overwritten.
    const current = JSON.parse(runGhOrThrow(['api', `repos/${repository}/issues/comments/${inputId}`], runner));
    if (current.body !== comment.body) throw Error('Stale command: input comment has changed');

    const origin = JSON.parse(runGhOrThrow(['api', `repos/${repository}/issues/comments/${id}`], runner));
    const file = getFileObject(origin);
    const commit = commitFile(repository, event.repository.default_branch || 'main', id, file, runner);
    result = {...result, exitCode: 0, status: commit.status,
      filename: commit.filename, commitSha: commit.commitSha, error: null};
  } catch (e) {
    result.error = String(e.message || e);
    if (env.GH_TOKEN) result.error = result.error.replaceAll(env.GH_TOKEN, '[REDACTED]');
  }
  // Do not echo file content in public issue logs or output receipts.
  const responseId = publish(repository, runner, inputId, 7, JSON.stringify({
    type: 'gh-commit-result', sourceCommentId: Number(inputId),
    referencedCommentId: /^gh>\s+commit\s+(\d+)/.exec(comment.body)?.[1] || null,
    ...result
  }, null, 2));
  const referenceId = publish(repository, runner, inputId, 6, JSON.stringify({
    originatorCommentId: Number(inputId), command: comment.body, responseCommentId: responseId
  }, null, 2));
  runGhOrThrow(['api', `repos/${repository}/issues/comments/${inputId}`,
    '--method', 'PATCH', '-f', 'body=gh>'], runner);
  return {result, responseCommentId: responseId, referenceCommentId: referenceId};
}

if (require.main === module) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const outcome = handle(event);
  console.log(JSON.stringify(outcome));
  if (outcome.result.exitCode !== 0) process.exitCode = 1;
}

module.exports = {validateFilename, getFileObject, parseCommand, issueApiPath, commitFile, handle};
