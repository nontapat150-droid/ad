const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace 1: m.model_image_url
content = content.replace(
  /\`\<img src="\$\{\import\.meta\.env\.VITE_API_URL \|\| ''\}\$\{m\.model_image_url\}"/g,
  '`<img src="${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, \\\'\\\') : \\\'\\\'}${m.model_image_url}"'
);

// Replace 2: catMeta.image_url
content = content.replace(
  /\<img src=\{\`\$\{\import\.meta\.env\.VITE_API_URL \|\| ''\}\$\{catMeta\.image_url\}\`\}/g,
  '<img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, \\\'\\\') : \\\'\\\'}${catMeta.image_url}`}'
);

// Replace 3: item.image_url
content = content.replace(
  /\<img src=\{\`\$\{\import\.meta\.env\.VITE_API_URL \|\| ''\}\$\{item\.image_url\}\`\}/g,
  '<img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, \\\'\\\') : \\\'\\\'}${item.image_url}`}'
);

fs.writeFileSync(path, content, 'utf8');
