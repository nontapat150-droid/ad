const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      content = content.replace(/ช่าง\s*Office/g, 'ช่างติดตั้ง');
      content = content.replace(/ช่าง\s*office/g, 'ช่างติดตั้ง');
      content = content.replace(/รับเหมา\s*Office/g, 'รับเหมาติดตั้ง');
      content = content.replace(/รับเหมา\s*office/g, 'รับเหมาติดตั้ง');
      content = content.replace(/งาน\s*Office/g, 'งานติดตั้ง');
      content = content.replace(/งาน\s*office/g, 'งานติดตั้ง');
      content = content.replace(/ทีม\s*Office/g, 'ทีมติดตั้ง');
      content = content.replace(/ทีม\s*office/g, 'ทีมติดตั้ง');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated ' + fullPath);
      }
    }
  }
}

processDir('frontend/src');
