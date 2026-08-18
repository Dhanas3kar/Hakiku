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

function fixServices() {
  const files = walk(srcDir);
  let count = 0;
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('postgres(connectionString')) {
      console.log('Fixing', file);
      
      // We also need to remove the "import { drizzle } from 'drizzle-orm/postgres-js';"
      // and "import postgres from 'postgres';"
      content = content.replace(/import \{ drizzle \} from 'drizzle-orm\/postgres-js';\r?\n/g, '');
      content = content.replace(/import postgres from 'postgres';\r?\n/g, '');

      // Replace the standard pattern
      content = content.replace(
        /const queryClient = postgres\(connectionString,[^)]+\);\s*this\.db = drizzle\(queryClient, \{ schema \}\);/g,
        "this.db = require('../../db/index').db;"
      );
      
      // Replace worker pattern
      content = content.replace(
        /this\.queryClient = postgres\(connectionString,[^)]+\);\s*this\.db = drizzle\(this\.queryClient, \{ schema \}\);/g,
        "this.db = require('../../db/index').db;"
      );

      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  }
  console.log(`Fixed ${count} files.`);
}

fixServices();
