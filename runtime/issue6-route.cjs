'use strict';
const fs = require('node:fs');

const INPUT_ID = '6358997143';

function selectRoute(event, repository, inputId = INPUT_ID) {
  if (!['edited', 'created'].includes(event?.action) ||
      event?.issue?.number !== 6 || event?.repository?.full_name !== repository ||
      event?.sender?.type === 'Bot') return 'ignore';

  const comment = event.comment || {};
  const isInput = String(comment.id) === String(inputId);
  const owner = event.repository?.owner?.login;
  const actor = event.sender?.login;

  if (!isInput) return comment.user?.type === 'Bot' ? 'ignore' : 'normalize';
  if (event.action !== 'edited' || actor !== owner) return 'ignore';

  const body = String(comment.body || '').trim();
  if (!/^gh>(?:\s|$)/.test(body) || body === 'gh>') return 'normalize';
  const argumentsText = body.slice(3).trim();
  if (/^commit(?:\s|$)/.test(argumentsText)) return 'commit';
  if (/^meta(?:\s|$)/.test(argumentsText)) return 'meta';
  return 'gh';
}

function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const route = selectRoute(event, process.env.GITHUB_REPOSITORY,
    process.env.ISSUE6_INPUT_COMMENT_ID || INPUT_ID);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'route=' + route + '\n');
  console.log('Issue #6 route: ' + route);
}

if (require.main === module) main();
module.exports = {selectRoute};
