const fs = require('fs');

// Add CSS var
let css = fs.readFileSync('frontend/src/index.css', 'utf8');
if (!css.includes('--sidebar-width')) {
  css = css.replace(':root {', ':root {\n  --sidebar-width: 272px;');
  fs.writeFileSync('frontend/src/index.css', css, 'utf8');
}

// Replace margins
const files = [
  'frontend/src/pages/TechBagPage.jsx',
  'frontend/src/pages/EntryFeePage.jsx',
  'frontend/src/pages/DispatchDashboardPage.jsx',
  'frontend/src/pages/CustomersPage.jsx',
  'frontend/src/components/Layout.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/md:ml-\[272px\]/g, 'md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out');
  content = content.replace(/md:ml-\[280px\]/g, 'md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out');
  fs.writeFileSync(file, content, 'utf8');
}
console.log('Margins updated');
