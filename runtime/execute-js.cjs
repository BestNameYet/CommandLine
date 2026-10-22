'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = process.env.JS_SOURCE || '';
if (!source.trim()) {
  console.error('JS_SOURCE must contain JavaScript.');
  process.exit(2);
}
const args = process.env.JS_ARGUMENTS || '{}';
try { JSON.parse(args); } catch { console.error('JS_ARGUMENTS must be valid JSON.'); process.exit(2); }
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commandline-js-'));
const file = path.join(root, 'main.cjs');
try {
  fs.writeFileSync(file, source, { mode: 0o600 });
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH || '',
      HOME: root,
      JS_ARGUMENTS: args
    }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(result.error.message);
  if (result.signal) console.error('Process terminated by ' + result.signal);
  process.exitCode = result.status === null ? 1 : result.status;
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
