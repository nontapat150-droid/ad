const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

function updateColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Text Colors
  content = content.replace(/\btext-slate-800\b/g, 'text-[#042C53]');
  content = content.replace(/\btext-slate-700\b/g, 'text-[#042C53]');
  content = content.replace(/\btext-slate-600\b/g, 'text-[#185FA5]');
  content = content.replace(/\btext-slate-500\b/g, 'text-[#378ADD]');
  content = content.replace(/\btext-slate-400\b/g, 'text-[#378ADD] opacity-80');
  
  content = content.replace(/\btext-brand-600\b/g, 'text-[#185FA5]');
  content = content.replace(/\btext-brand-700\b/g, 'text-[#0C447C]');
  content = content.replace(/\btext-brand-500\b/g, 'text-[#378ADD]');

  // Background Colors
  content = content.replace(/\bbg-slate-200\b/g, 'bg-[#E6F1FB]');
  content = content.replace(/\bbg-slate-100\b/g, 'bg-[#E6F1FB]');
  content = content.replace(/\bbg-slate-50\b/g, 'bg-white/40');
  
  content = content.replace(/\bbg-brand-50\b/g, 'bg-[#E6F1FB]');
  content = content.replace(/\bbg-brand-100\b/g, 'bg-[#B5D4F4]');

  // Border Colors
  content = content.replace(/\bborder-slate-200\b/g, 'border-white/50');
  content = content.replace(/\bborder-slate-100\b/g, 'border-white/30');
  content = content.replace(/\bborder-brand-200\b/g, 'border-[#185FA5]/20');

  // Some specific cases like shadow
  content = content.replace(/\bshadow-brand-500\/30\b/g, 'shadow-[#185FA5]/30');
  content = content.replace(/\bshadow-brand-500\/20\b/g, 'shadow-[#185FA5]/20');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated colors in ${path.basename(filePath)}`);
  }
}

function traverseDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (file.endsWith('.jsx')) {
      // Exclude Login and OilDashboardPage as they are already perfect
      if (file !== 'Login.jsx' && file !== 'OilDashboardPage.jsx') {
        updateColors(fullPath);
      }
    }
  }
}

targetDirs.forEach(dir => traverseDir(dir));
console.log('Color tone sync complete.');
