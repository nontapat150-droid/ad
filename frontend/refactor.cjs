const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Since I already mapped `.glass-card` to `.glass` in index.css, 
  // replacing `glass-card` with `glass` is optional but good for cleanup.
  content = content.replace(/glass-card(-hover)?/g, 'glass');

  // Replace background solids on container divs
  content = content.replace(/\bbg-white\b/g, 'glass');
  content = content.replace(/\bbg-slate-50\b/g, 'glass');
  content = content.replace(/\bbg-slate-100\b/g, 'glass');
  
  // Clean up any stray background transparent utilities that were used as a hack earlier
  content = content.replace(/\bbg-transparent\b/g, '');

  // Add 'reveal' animation class to main wrapper elements if not present.
  // We can look for `<div className="min-h-screen` or `max-w-7xl` or `p-4 md:p-8`
  content = content.replace(/(<div[^>]*className="[^"]*)(p-4 md:p-8)([^"]*")/g, (m, p1, p2, p3) => {
    if (!m.includes('reveal')) return `${p1}${p2} reveal${p3}`;
    return m;
  });
  content = content.replace(/(<div[^>]*className="[^"]*)(max-w-7xl)([^"]*")/g, (m, p1, p2, p3) => {
    if (!m.includes('reveal')) return `${p1}${p2} reveal${p3}`;
    return m;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function traverseDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (file.endsWith('.jsx')) {
      // Exclude Login.jsx as we just beautifully crafted it
      if (file !== 'Login.jsx') {
        processFile(fullPath);
      }
    }
  }
}

targetDirs.forEach(dir => traverseDir(dir));
console.log('Done.');
