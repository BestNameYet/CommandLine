await fetch(
  'https://api.github.com/repos/BestNameYet/CommandLine/issues/comments/6353910739',
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
    }
  }
);
