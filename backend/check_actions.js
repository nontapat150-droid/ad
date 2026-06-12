const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/nontapat150-droid/ad/actions/runs?per_page=5',
  method: 'GET',
  headers: {
    'User-Agent': 'node.js'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    json.workflow_runs.forEach(run => {
      console.log(`Branch: ${run.head_branch}, Status: ${run.status}, Conclusion: ${run.conclusion}, Updated: ${run.updated_at}`);
    });
  });
}).on('error', console.error);
