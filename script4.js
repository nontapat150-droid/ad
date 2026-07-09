const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\\\'\\\'/g, "''");

fs.writeFileSync(path, content, 'utf8');
