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
function describe(body) {
  try {
    const entry = JSON.parse(body);
    const summary = entry.description ?? entry.fileName ?? entry.path ?? entry.command ?? entry.type;
    if (typeof summary === 'string' && summary.trim()) return summary.trim();
  } catch {}
  return body.trim().split(/\r?\n/).find(Boolean)?.slice(0, 160) || '(empty)';
}
function fence(body) {
  const runs = body.match(/`+/g) ?? [];
  const longest = Math.max(2, ...runs.map(s => s.length));
  const mark = '`'.repeat(longest + 1);
  return `${mark}text\n${body}\n${mark}`;
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
  const original = (issue.body || '').split('<!-- comment-manifest:start -->')[0].trimEnd();
  const lines = [
    '<!-- comment-manifest:start -->',
    '## Comment manifest',
    `Issue #${number} · ${comments.length} comments · regenerated automatically on comment creation or edit.`,
    ''
  ];
  for (const comment of comments) {
    lines.push(`### [Comment ${comment.id}](${comment.html_url})`);
    lines.push(`**Description:** ${describe(comment.body).replace(/\r?\n/g,' ')}`);
    lines.push('**Content:**');
    lines.push(fence(comment.body));
    lines.push('');
  }
  lines.push('<!-- comment-manifest:end -->');
  const body = [original, lines.join('\n')].filter(Boolean).join('\n\n');
  if (Buffer.byteLength(body, 'utf8') > 60000) throw new Error('Issue body exceeds safe manifest size; no update performed');
  await api(`/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } });
  console.log(`Updated Issue #${number} manifest with ${comments.length} comments`);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
