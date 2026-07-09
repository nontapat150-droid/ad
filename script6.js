const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace 1: m.model_image_url (HTML)
content = content.replace(
  /\`\<img src="\$\{import\.meta\.env\.VITE_API_URL \? import\.meta\.env\.VITE_API_URL\.replace\(\/\\\/api\\\/\?\$\/, ''\) : ''\}\$\{m\.model_image_url\}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #ddd;" \/>\`/g,
  '`<img class="viewable-image" src="${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, \'\') : \'\'}${m.model_image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #ddd; cursor:pointer;" />`'
);

// Add event listener in didOpen
const regexDidOpen = /didOpen: \(\) => \{\n\s*const popup = Swal\.getPopup\(\);\n\s*const btns = popup\.querySelectorAll\('\.select-model-card'\);/;
const replacementDidOpen = `didOpen: () => {
          const popup = Swal.getPopup();
          const viewableImgs = popup.querySelectorAll('.viewable-image');
          viewableImgs.forEach(img => {
            img.addEventListener('click', (e) => {
              e.stopPropagation();
              Swal.fire({ imageUrl: img.src, imageAlt: 'Model Image', showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
            });
          });
          const btns = popup.querySelectorAll('.select-model-card');`;
content = content.replace(regexDidOpen, replacementDidOpen);

// Replace 2: catMeta.image_url (React)
const regexCatImg = /<img src=\{`\$\{import\.meta\.env\.VITE_API_URL \? import\.meta\.env\.VITE_API_URL\.replace\(\/\\\/api\\\/\?\$\/, ''\) : ''\}\$\{catMeta\.image_url\}`\} alt=\{cat\} className="w-full h-full object-cover" \/>/g;
const replacementCatImg = `<img src={\`\${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, '') : ''}\${catMeta.image_url}\`} alt={cat} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); Swal.fire({ imageUrl: e.target.src, imageAlt: cat, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); }} />`;
content = content.replace(regexCatImg, replacementCatImg);

// Replace 3: item.image_url (React)
const regexItemImg = /<img src=\{`\$\{import\.meta\.env\.VITE_API_URL \? import\.meta\.env\.VITE_API_URL\.replace\(\/\\\/api\\\/\?\$\/, ''\) : ''\}\$\{item\.image_url\}`\} alt=\{item\.product_name\} className="w-full h-full object-cover" \/>/g;
const replacementItemImg = `<img src={\`\${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\\/api\\/?$/, '') : ''}\${item.image_url}\`} alt={item.product_name} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); Swal.fire({ imageUrl: e.target.src, imageAlt: item.product_name, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); }} />`;
content = content.replace(regexItemImg, replacementItemImg);

fs.writeFileSync(path, content, 'utf8');
