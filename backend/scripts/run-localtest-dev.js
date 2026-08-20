process.env.BOU_ENV = 'localtest';
require('nodemon')({
  script: 'server.js',
  ext: 'js,json',
  ignore: ['uploads-localtest/*', 'uploads/*', '*.log'],
});
