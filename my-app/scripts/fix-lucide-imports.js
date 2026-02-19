const fs = require('fs');
const path = require('path');

// Icons needed by files but possibly not in their lucide import
const neededIcons = ['RotateCcw', 'CheckCircle', 'AlertCircle', 'Edit', 'FileText', 'Edit2', 'CheckCircle2'];

function getAllTsxFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...getAllTsxFiles(full));
    else if (item.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const appDir = path.join(__dirname, '..', 'app');
const tsxFiles = getAllTsxFiles(appDir);
let changed = 0;

for (const file of tsxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Only process files that import from lucide-react
  const lucideMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/);
  if (!lucideMatch) continue;

  let currentImports = lucideMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  let toAdd = [];
  
  for (const icon of neededIcons) {
    // Check if icon is used in JSX (as component) but not imported
    const usedInJsx = new RegExp('<' + icon + '[ /]').test(content);
    const alreadyImported = currentImports.includes(icon);
    if (usedInJsx && !alreadyImported) {
      toAdd.push(icon);
    }
  }
  
  if (toAdd.length > 0) {
    const newImports = [...currentImports, ...toAdd].join(', ');
    const newImportStatement = "import { " + newImports + " } from 'lucide-react'";
    content = content.replace(lucideMatch[0], newImportStatement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated: ' + path.relative(appDir, file) + ' (+' + toAdd.join(', ') + ')');
    changed++;
  }
}
console.log('Total updated:', changed);
