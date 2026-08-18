const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

function fixImports() {
  const files = walk(srcDir);
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("require('../../db/index').db")) {
      console.log('Fixing require in', file);
      
      // Replace require with this.db = db;
      content = content.replace(/this\.db = require\('\.\.\/\.\.\/db\/index'\)\.db;/g, "this.db = db;");
      
      // Add import { db } from '../../db/index'; to the top after other imports
      if (!content.includes("import { db }")) {
        content = "import { db } from '../../db/index';\n" + content;
      }
      
      fs.writeFileSync(file, content, 'utf8');
    }
  }
}

fixImports();
