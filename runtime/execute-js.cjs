'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseJson(value, name) {
  try { return JSON.parse(value); }
  catch { throw Error(name + ' must be valid JSON'); }
}
function setting(config, key, envName, parse = x => x) {
  return process.env[envName] === undefined || process.env[envName] === ''
    ? config[key] : parse(process.env[envName]);
}
function optionalDuration(value, name) {
  if (value === null || value === undefined || value === 0 || value === '0') return undefined;
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw Error(name + ' must be a positive integer or null');
  return Number(value);
}
function main() {
  const configFile = process.env.JS_CONFIG_FILE || path.resolve('config/js-executor.json');
  const config = parseJson(fs.readFileSync(configFile, 'utf8'), 'JS_CONFIG_FILE');
  const source = process.env.JS_SOURCE || '';
  if (!source.trim()) throw Error('JS_SOURCE must contain JavaScript');
  const args = setting(config, 'arguments', 'JS_ARGUMENTS', x => parseJson(x, 'JS_ARGUMENTS')) ?? {};
  const envVars = setting(config, 'environment', 'JS_ENV_JSON', x => parseJson(x, 'JS_ENV_JSON')) ?? {};
  const dependencies = setting(config, 'dependencies', 'JS_DEPENDENCIES', x => parseJson(x, 'JS_DEPENDENCIES')) ?? [];
  const timeout = optionalDuration(setting(config, 'timeoutMs', 'JS_TIMEOUT_MS'), 'timeoutMs');
  const installTimeout = optionalDuration(setting(config, 'dependencyInstallTimeoutMs', 'JS_INSTALL_TIMEOUT_MS'), 'dependencyInstallTimeoutMs');
  const outputLimit = optionalDuration(setting(config, 'outputLimitBytes', 'JS_OUTPUT_LIMIT_BYTES'), 'outputLimitBytes');
  if (!Array.isArray(dependencies) || dependencies.some(x => typeof x !== 'string' || !x.trim())) throw Error('dependencies must be an array of package specifiers');
  if (!envVars || typeof envVars !== 'object' || Array.isArray(envVars) ||
      Object.entries(envVars).some(([k,v]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || typeof v !== 'string')) throw Error('environment must map valid names to strings');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commandline-js-'));
  const commonEnv = { PATH:process.env.PATH || '', HOME:root };
  try {
    fs.writeFileSync(path.join(root, 'main.cjs'), source, { mode:0o600 });
    if (dependencies.length) {
      const install = spawnSync('npm', ['install','--ignore-scripts','--no-audit','--no-fund','--prefix',root,...dependencies], {
        cwd:root, encoding:'utf8', ...(installTimeout === undefined ? {} : {timeout:installTimeout}),
        ...(outputLimit === undefined ? {} : {maxBuffer:outputLimit}),
        env:{...commonEnv,npm_config_cache:path.join(root,'.npm')}
      });
      if (install.stdout) process.stdout.write(install.stdout);
      if (install.stderr) process.stderr.write(install.stderr);
      if (install.status !== 0 || install.error) throw Error('Dependency installation failed: '+(install.error?.message || install.status));
    }
    const result = spawnSync(process.execPath, [path.join(root,'main.cjs')], {
      cwd:root, encoding:'utf8', ...(timeout === undefined ? {} : {timeout}),
      ...(outputLimit === undefined ? {} : {maxBuffer:outputLimit}),
      env:{...commonEnv,...envVars,NODE_PATH:path.join(root,'node_modules'),JS_ARGUMENTS:JSON.stringify(args)}
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status === null ? 1 : result.status;
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
try { main(); } catch (e) { console.error(e.message); process.exitCode=2; }
