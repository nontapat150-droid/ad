const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /category: item\.category \|\| null,\n\s*total_quantity: 0,\n\s*item_count: 0,\n\s*models: \[\]/;
const replacement1 = `category: item.category || null,
          image_url: item.image_url || null,
          total_quantity: 0,
          item_count: 0,
          models: []`;
content = content.replace(regex1, replacement1);

const regex2 = /models\.push\(\{\n\s*model_id: item\.model_id,\n\s*model_name: item\.model_name,\n\s*total_quantity: item\.total_quantity,\n\s*item_count: item\.item_count\n\s*\}\)/;
const replacement2 = `models.push({
        model_id: item.model_id,
        model_name: item.model_name,
        total_quantity: item.total_quantity,
        item_count: item.item_count,
        model_image_url: item.model_image_url || null
      })`;
content = content.replace(regex2, replacement2);

fs.writeFileSync(path, content, 'utf8');
