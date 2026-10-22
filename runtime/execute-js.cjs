'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function integer(name, fallback, min, max) {
  const raw = process.env[name] || String(fallback);
  if (!/^\d+$/.test(raw)) throw Error(name + ' must be an integer');
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(name + ' must be between ' + min + ' and ' + max);
  return n;
}
function json(name, fallback) {
  try { return JSON.parse(process.env[name] || fallback); }
  catch { throw Error(name + ' must contain valid JSON'); }
}
function main() {
  const source = process.env.JS_SOURCE || '';
  if (!source.trim()) throw Error('JS_SOURCE must contain JavaScript');
  const args = json('JS_ARGUMENTS', '{}');
  const envVars = json('JS_ENV_JSON', '{}');
  const dependencies = json('JS_DEPENDENCIES', '[]');
  const timeout = integer('JS_TIMEOUT_MS', 60000, 1000, 1200000);
  const maxBuffer = integer('JS_OUTPUT_LIMIT_BYTES', 1048576, 1024, 10485760);
  if (!Array.isArray(dependencies) || dependencies.length > 20 ||
      dependencies.some(x => typeof x !== 'string' || !/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*@[0-9][0-9A-Za-z.+-]*$/.test(x))) {
    throw Error('JS_DEPENDENCIES must be a JSON array of up to 20 version-pinned npm packages');
  }
  if (!envVars || typeof envVars !== 'object' || Array.isArray(envVars) ||
      Object.entries(envVars).some(([k,v]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ||
        typeof v !== 'string' || ['PATH','HOME','NODE_PATH','JS_ARGUMENTS'].includes(k))) {
    throw Error('JS_ENV_JSON must be an object of string environment variables with safe names');
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commandline-js-'));
  try {
    const file = path.join(root, 'main.cjs');
    fs.writeFileSync(file, source, { mode: 0o600 });
    const baseEnv = { PATH: process.env.PATH || '', HOME: root };
    if (dependencies.length) {
      const install = spawnSync('npm', ['install','--ignore-scripts','--no-audit','--no-fund','--prefix',root,...dependencies], {
        cwd: root, encoding:'utf8',timeout:120000,maxBuffer,
        env:{...baseEnv,npm_config_cache:path.join(root,'.npm')}
      });
      if (install.status !== 0 || install.error) {
        if (install.stderr) process.stderr.write(install.stderr);
        throw Error('Dependency installation failed: '+(install.error?.message || install.status));
      }
    }
    const result = spawnSync(process.execPath, [file], {
      cwd: root, encoding:'utf8', timeout, maxBuffer,
      env: {...baseEnv, ...envVars, NODE_PATH:path.join(root,'node_modules'), JS_ARGUMENTS:JSON.stringify(args)}
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) console.error(result.error.message);
    if (result.signal) console.error('Process terminated by '+result.signal);
    process.exitCode = result.status === null ? 1 : result.status;
  } finally {
    fs.rmSync(root, { recursive:true,force:true });
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
