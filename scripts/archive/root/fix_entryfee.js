const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/EntryFeePage.jsx', 'utf8');
content = content.replace(/'Office' : 'MA'/g, "'ติดตั้ง' : 'MA'");
fs.writeFileSync('frontend/src/pages/EntryFeePage.jsx', content, 'utf8');
console.log('Fixed EntryFeePage.jsx');
