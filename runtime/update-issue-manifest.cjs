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
async function main() {
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
    comments: comments.map(comment => ({
      commentId: comment.id,
      content: comment.body
    }))
  };
  if (number === 4) {
    manifest.rule = 'Issue #4 comments shall consist only of JSON objects containing executable JavaScript source code.';
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
