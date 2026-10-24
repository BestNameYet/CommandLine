#!/usr/bin/env node
'use strict';
// Usage: node workspaces/api-to-nodejs/workflow-sha-and.cjs [--json] [localDir githubDir]
// Defaults compare the workspace copies with the checkout's .github/workflows.
// SHA means Git's SHA-1 blob ID: SHA1("blob " + byteLength + "\\0" + bytes).
// No GitHub API calls are made; update the checkout before comparing remote changes.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function blobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes)
    .digest('hex');
}

function inventory(directory) {
  const files = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      files.set(entry.name, blobSha(fs.readFileSync(path.join(directory, entry.name))));
    }
  }
  return files;
}

function compare(localDir, githubDir) {
  const local = inventory(localDir);
  const github = inventory(githubDir);
  const names = [...new Set([...local.keys(), ...github.keys()])].sort();
  let and = true;
  const entries = names.map(workflow => {
    const localSha = local.get(workflow) ?? null;
    const githubSha = github.get(workflow) ?? null;
    const matches = localSha !== null && githubSha !== null && localSha === githubSha;
    and = and && matches;
    return { workflow, localSha, githubSha, matches, and };
  });
  // An empty comparison does not establish that workflows match.
  return { localDir, githubDir, entries, allMatch: entries.length > 0 && and };
}

function main(args = process.argv.slice(2)) {
  const json = args.includes('--json');
  const directories = args.filter(arg => arg !== '--json');
  if (directories.some(arg => arg.startsWith('--')) ||
      ![0, 2].includes(directories.length)) {
    throw new Error('Usage: node workflow-sha-and.cjs [--json] [localDir githubDir]');
  }
  const localDir = path.resolve(directories[0] || path.join(__dirname, 'workflows'));
  const githubDir = path.resolve(directories[1] || path.join(__dirname, '..', '..', '.github', 'workflows'));
  const result = compare(localDir, githubDir);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.table(result.entries.map(entry => ({
      Workflow: entry.workflow,
      'Local SHA': entry.localSha ?? '(missing)',
      'GitHub-dir SHA': entry.githubSha ?? '(missing)',
      Match: entry.matches,
      'Running AND': entry.and
    })));
    console.log('Overall AND: ' + result.allMatch);
  }
  process.exitCode = result.allMatch ? 0 : 1;
}

module.exports = { blobSha, compare, main };
if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
