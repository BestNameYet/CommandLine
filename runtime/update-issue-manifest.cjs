'use strict';
const repo = process.env.GITHUB_REPOSITORY;
const number = Number(process.env.ISSUE_NUMBER);
const token = process.env.GITHUB_TOKEN;
if (!repo || !token || ![3, 4, 5].includes(number)) {
  throw new Error('Expected repository, token and issue #3, #4 or #5');
}
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};
const base = `https://api.github.com/repos/${repo}`;
async function api(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function valid(value, number) {
  if (!object(value)) return false;
  if (number === 3) {
    const entries = value.commands;
    const contract = {
      create: { path: 'string', contentCommentId: 'integer' },
      read: { path: 'string' },
      update: { path: 'string', contentCommentId: 'integer' },
      delete: { path: 'string' },
      commit: { commentId: 'integer', message: 'string' },
      execute: { JavaScript: 'string', dependencies: 'stringArray', arguments: 'object' }
    };
    return Array.isArray(entries) && entries.length > 0 && entries.every(item => {
      if (!object(item) || typeof item.description !== 'string' || !object(item.command)) return false;
      const { action, arguments: args } = item.command;
      if (!Object.prototype.hasOwnProperty.call(contract, action) || !object(args)) return false;
      return Object.entries(contract[action]).every(([key, type]) => {
        const v = args[key];
        return type === 'integer' ? Number.isSafeInteger(v) :
          type === 'string' ? typeof v === 'string' :
          type === 'stringArray' ? Array.isArray(v) && v.every(x => typeof x === 'string') :
          object(v);
      });
    });
  }
  if (number === 4) return Object.keys(value).length === 2 &&
    typeof value.fileName === 'string' && value.fileName.trim().length > 0 &&
    typeof value.JavaScript === 'string' && value.JavaScript.trim().length > 0;
  if (number === 5) return typeof value.path === 'string' && value.path.length > 0;
  return false;
}
async function validateComment(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const comment = await api(`/issues/comments/${id}`);
  if (comment.issue_url !== `${base}/issues/${number}`) throw new Error('Comment is not from expected issue');
  let value, error;
  try { value = JSON.parse(comment.body); } catch { error = 'invalid JSON object'; }
  if (!error && object(value) &&
      (Object.prototype.hasOwnProperty.call(value, 'invalid JSON object') ||
       Object.prototype.hasOwnProperty.call(value, 'invalid schema'))) return;
  if (!error && !valid(value, number)) error = 'invalid schema';
  if (error) {
    const original = error === 'invalid JSON object' ? comment.body : value;
    const replacement = JSON.stringify({ [error]: original }, null, 2);
    await api(`/issues/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replacement })
    });
    console.log(`Comment ${id}: ${error}`);
  }
}
async function main() {
  await validateComment(Number(process.env.COMMENT_ID));
  const issue = await api(`/issues/${number}`);
  let comments = [];
  for (let page = 1; ; page++) {
    const chunk = await api(`/issues/${number}/comments?per_page=100&page=${page}`);
    comments.push(...chunk);
    if (chunk.length < 100) break;
  }
  comments.sort((a, b) => a.id - b.id);
  const manifest = {
    type: 'Manifest',
    issue: number,
    comments: comments.filter(comment => {
      try {
        const entry = JSON.parse(comment.body);
        return !object(entry) ||
          (!Object.prototype.hasOwnProperty.call(entry, 'invalid JSON object') &&
           !Object.prototype.hasOwnProperty.call(entry, 'invalid schema'));
      } catch {
        return false;
      }
    }).map(comment => ({
      commentId: comment.id,
      content: comment.body
    }))
  };
  if (number === 4) {
    manifest.returnSchema = {\n      fileName: 'Non-empty JavaScript file name',\n      JavaScript: 'Non-empty executable JavaScript source code'\n    };
    manifest.rule = 'Issue #4 comments shall be JSON objects with exactly two keys: fileName and JavaScript.';
  }
  if (number === 3) {
    manifest.definitions = [
      {
        action: 'create',
        arguments: {
          path: { type: 'string', description: 'Proposed repository-relative destination path; no file is created until commit. Do not use JavaScript-file examples.', example: 'docs/example.txt' },
          contentCommentId: { type: 'integer', description: 'Issue comment ID containing file content.' }
        }
      },
      {
        action: 'read',
        arguments: {
          path: { type: 'string', description: 'Repository-relative file or directory path to read.', example: 'docs/example.txt' }
        }
      },
      {
        action: 'update',
        arguments: {
          path: { type: 'string', description: 'Proposed update target path; changes are not persisted until commit. Do not use JavaScript-file examples.', example: 'docs/example.txt' },
          contentCommentId: { type: 'integer', description: 'Issue comment ID containing replacement content.' }
        }
      },
      {
        action: 'delete',
        arguments: {
          path: { type: 'string', description: 'Repository-relative file or directory path to delete.', example: 'docs/example.txt' }
        }
      },
      {
        action: 'commit',
        arguments: {
          commentId: { type: 'integer', description: 'Issue comment ID containing the file operation to commit.' },
          message: { type: 'string', description: 'Git commit message.' }
        }
      },
      {
        action: 'execute',
        arguments: {
          JavaScript: { type: 'string', description: 'JavaScript source code to execute.' },
          dependencies: { type: 'array', items: { type: 'string' }, description: 'Paths to other files required to execute the JavaScript; an empty array means no file dependencies.' },
          arguments: { type: 'object', description: 'Named runtime arguments supplied to the JavaScript; may be empty.' }
        }
      }
    ];
    manifest.returnSchema = {
      commands: [
        {
          command: { action: 'read', arguments: {} },
          description: 'Description of the command'
        }
      ]
    };
  }
  const body = JSON.stringify(manifest, null, 2);
  if (Buffer.byteLength(body, 'utf8') > 60000) throw new Error('Issue body exceeds safe manifest size; no update performed');
  await api(`/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } });
  console.log(`Updated Issue #${number} manifest with ${comments.length} comments`);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
