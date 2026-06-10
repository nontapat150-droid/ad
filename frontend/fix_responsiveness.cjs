const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const componentsDir = path.join(__dirname, 'src', 'components');

function makeTablesResponsive(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // We look for table declarations that are NOT preceded by overflow-x-auto wrappers closely
  // Actually, a simpler way is to just inject overflow-x-auto wrapper around the table.
  // But wait! Many tables might already have a wrapper.
  // Let's use a simpler Regex: replace `<table className="...` with an overflow wrapper if not already wrapped.
  // A safe way is to ensure any direct parent of table has overflow-x-auto.
  // Since it's hard to parse JSX with Regex, I'll manually fix the known files.
}

const filesToFixTables = [
  'UserManagementPage.jsx',
  'TechBagPage.jsx',
  'InventoryHistoryPage.jsx',
  'EntryFeePage.jsx',
  'DispatchDashboardPage.jsx'
];

filesToFixTables.forEach(file => {
  const fp = path.join(pagesDir, file);
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    
    // Most of these might already be wrapped because I wrote them with `overflow-x-auto` earlier.
    // Let's check if `overflow-x-auto` exists in the file.
    if (!content.includes('overflow-x-auto')) {
      // Very basic wrap: replace `<table` with `<div className="overflow-x-auto w-full"><table`
      // and `</table>` with `</table></div>`
      content = content.replace(/<table/g, '<div className="overflow-x-auto w-full pb-2"><table');
      content = content.replace(/<\/table>/g, '</table></div>');
      fs.writeFileSync(fp, content, 'utf8');
      console.log(`Wrapped tables in ${file}`);
    }
  }
});

// Fix Modals width
const modalsToFix = [
  'AutoDispatchModal.jsx',
  'JobDispatchModal.jsx'
];

modalsToFix.forEach(file => {
  const fp = path.join(componentsDir, file);
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    // Change things like `w-[500px]` or `w-[900px]` to `w-full max-w-4xl` etc.
    content = content.replace(/w-\[([0-px]+)\]/g, (match, p1) => {
      if (parseInt(p1) > 400) {
        return 'w-full max-w-3xl';
      }
      return match;
    });
    
    // Ensure padding on mobile is smaller for modals
    content = content.replace(/p-6/g, 'p-4 md:p-6');
    content = content.replace(/p-8/g, 'p-4 md:p-8');
    
    fs.writeFileSync(fp, content, 'utf8');
    console.log(`Made ${file} responsive`);
  }
});
