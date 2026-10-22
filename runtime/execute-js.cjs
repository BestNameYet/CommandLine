'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

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
async function main() {
  async function run(cmd, argv, options, timeoutMs) {
    return await new Promise((resolve, reject) => {
      const child = spawn(cmd, argv, { ...options, stdio:['ignore','pipe','pipe'] });
      let timer;
      child.stdout.pipe(process.stdout,{end:false});
      child.stderr.pipe(process.stderr,{end:false});
      if(timeoutMs !== undefined) timer=setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.once('error',reject);
      child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});
    });
  }
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
  if(outputLimit !== undefined) throw Error('outputLimitBytes is not supported in streaming mode; use null');
  if (!Array.isArray(dependencies) || dependencies.some(x => typeof x !== 'string' || !x.trim())) throw Error('dependencies must be an array of package specifiers');
  if (!envVars || typeof envVars !== 'object' || Array.isArray(envVars) ||
      Object.entries(envVars).some(([k,v]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || typeof v !== 'string')) throw Error('environment must map valid names to strings');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commandline-js-'));
  const commonEnv = { PATH:process.env.PATH || '', HOME:root };
  try {
    fs.writeFileSync(path.join(root, 'main.cjs'), source, { mode:0o600 });
    if (dependencies.length) {
      const install = await run('npm', ['install','--ignore-scripts','--no-audit','--no-fund','--prefix',root,...dependencies], {
        cwd:root,env:{...commonEnv,npm_config_cache:path.join(root,'.npm')}
      },installTimeout);
      if (install.code !== 0) throw Error('Dependency installation failed: '+(install.signal||install.code));
    }
    const result = await run(process.execPath, [path.join(root,'main.cjs')], {
      cwd:root,env:{...commonEnv,...envVars,NODE_PATH:path.join(root,'node_modules'),JS_ARGUMENTS:JSON.stringify(args)}
    }, timeout);
    process.exitCode = result.code === null ? 1 : result.code;
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
main().catch(e=>{ console.error(e.message); process.exitCode=2; });
