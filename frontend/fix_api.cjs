const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.jsx') || dirFile.endsWith('.js')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const files = walkSync('C:/xampp/htdocs/BO/frontend/src');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  
  // Replace: axios.get('/api/ -> axios.get('/
  content = content.replace(/(axios|api)\.(get|post|put|delete)\(['"]\/api\//g, '$1.$2(\'/');
  // Replace: axios.get(`/api/ -> axios.get(`/
  content = content.replace(/(axios|api)\.(get|post|put|delete)\([`]\/api\//g, '$1.$2(`/');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log('Fixed', file);
  }
});

console.log('Total files fixed:', count);
