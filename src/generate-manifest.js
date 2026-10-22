#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const metadataPath = path.join(root, 'config/file-metadata.json');
const outputPath = path.join(root, 'manifest.json');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
if (metadata.version !== 1 || !metadata.files || typeof metadata.files !== 'object' || Array.isArray(metadata.files)) {
  throw new Error('Invalid file metadata registry');
}
const files = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root})
  .toString('utf8').split('\0').filter(Boolean)
  .filter(f => f !== 'manifest.json' && !f.endsWith('/.gitkeep') && f !== '.gitkeep')
  .sort();
const missing = files.filter(f => {
  const item = metadata.files[f];
  return !item || typeof item.description !== 'string' || !item.description.trim();
});
const stale = Object.keys(metadata.files).filter(f => !files.includes(f));
if (missing.length || stale.length) {
  if (missing.length) console.error('Missing required metadata:', missing.join(', '));
  if (stale.length) console.error('Stale metadata entries:', stale.join(', '));
  process.exit(1);
}
const entries = files.map(file => ({
  path: file,
  description: metadata.files[file].description.trim(),
  ...(metadata.files[file].category ? {category: metadata.files[file].category} : {})
}));
const directories = [...new Set(files.flatMap(f => {
  const parts = f.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/') + '/');
}))].sort();
const manifest = {version: 1, files: entries, directories};
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Manifest generated:', entries.length, 'files,', directories.length, 'directories');
