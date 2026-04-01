const fs = require('fs');
const path = require('path');

// Recursive function to get all JSX files
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.jsx')) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });

  return arrayOfFiles;
}

function convertToSaaSTokens(content) {
  let text = content;

  // 1. Typography - Soften "font-black tracking-widest uppercase"
  text = text.replace(/font-black tracking-tighter uppercase/g, 'font-semibold tracking-tight');
  text = text.replace(/font-black uppercase tracking-tighter/g, 'font-semibold tracking-tight');
  text = text.replace(/font-black uppercase tracking-widest text-\[10px\]/g, 'font-medium uppercase tracking-wider text-xs');
  text = text.replace(/font-black uppercase tracking-widest/g, 'font-semibold tracking-wide');
  text = text.replace(/font-black text-slate-400 uppercase tracking-widest/g, 'font-medium text-slate-500 uppercase tracking-wider');
  text = text.replace(/font-black text-emerald-600 uppercase tracking-widest/g, 'font-semibold text-emerald-600 uppercase tracking-wider');
  text = text.replace(/font-black uppercase text-sm/g, 'font-semibold text-sm');
  text = text.replace(/font-black uppercase/g, 'font-semibold');
  text = text.replace(/text-2xl font-black text-slate-900 uppercase/g, 'text-xl font-bold text-slate-900');
  text = text.replace(/font-black text-slate-900 uppercase/g, 'font-bold text-slate-900');
  text = text.replace(/font-black text-slate-900/g, 'font-bold text-slate-900');
  text = text.replace(/font-black/g, 'font-bold');

  // 2. Gradients & Neon Colors
  text = text.replace(/bg-gradient-to-br from-emerald-500 to-teal-400/g, 'bg-emerald-600');
  text = text.replace(/bg-gradient-to-r from-emerald-500 to-teal-400/g, 'bg-emerald-600 hover:bg-emerald-700 transition-colors');
  text = text.replace(/bg-gradient-to-br from-violet-500 to-fuchsia-500/g, 'bg-indigo-600');
  text = text.replace(/bg-gradient-to-r from-violet-500 to-fuchsia-500/g, 'bg-indigo-600 hover:bg-indigo-700 transition-colors');
  text = text.replace(/hover:to-teal-300/g, '');
  text = text.replace(/hover:to-fuchsia-400/g, '');
  
  // Clean up extreme shadow colors
  text = text.replace(/shadow-emerald-500\/30/g, 'shadow-sm');
  text = text.replace(/shadow-emerald-500\/20/g, 'shadow-sm');
  text = text.replace(/shadow-[a-z]+-500\/20/g, 'shadow-sm');
  text = text.replace(/shadow-[a-z]+-500\/30/g, 'shadow-sm');
  text = text.replace(/shadow-emerald-200/g, 'shadow-sm');
  text = text.replace(/shadow-emerald-100/g, 'shadow-sm text-emerald-700');
  text = text.replace(/shadow-xl/g, 'shadow-md');
  text = text.replace(/shadow-2xl/g, 'shadow-lg');

  text = text.replace(/border-emerald-200/g, 'border-slate-200');

  // 3. Shape Flatness (remove pill shape rounded-[32px])
  text = text.replace(/rounded-\[32px\]/g, 'rounded-xl');
  text = text.replace(/rounded-\[40px\]/g, 'rounded-2xl');
  text = text.replace(/rounded-\[24px\]/g, 'rounded-xl');
  text = text.replace(/rounded-3xl/g, 'rounded-xl');
  text = text.replace(/rounded-2xl/g, 'rounded-lg');
  
  // Specific chunky buttons
  text = text.replace(/py-5 px-10 rounded-xl/g, 'py-3 px-6 rounded-md'); // was py-5 px-10 rounded-[32px]
  text = text.replace(/py-5 rounded-xl/g, 'py-3 rounded-md'); // Generic huge block buttons
  text = text.replace(/py-5/g, 'py-3');
  text = text.replace(/py-4/g, 'py-3');

  // Glassmorphism solidifications
  text = text.replace(/bg-white\/80 backdrop-blur-xl/g, 'bg-white');
  text = text.replace(/bg-white\/90 backdrop-blur-xl/g, 'bg-white');
  text = text.replace(/bg-white\/60 backdrop-blur-xl/g, 'bg-white');
  text = text.replace(/bg-white\/80/g, 'bg-white');
  text = text.replace(/bg-white\/90/g, 'bg-white');
  text = text.replace(/backdrop-blur-md/g, '');
  text = text.replace(/backdrop-blur-sm/g, '');
  text = text.replace(/border-white\/40/g, 'border-slate-200');
  text = text.replace(/border-white\/50/g, 'border-slate-200');

  return text;
}

function processDirectory() {
  const scrPath = path.join(__dirname, 'src');
  const allFiles = getAllFiles(scrPath);

  let updatedCount = 0;

  allFiles.forEach(target => {
    const original = fs.readFileSync(target, 'utf8');
    const updated = convertToSaaSTokens(original);
    
    if (original !== updated) {
      fs.writeFileSync(target, updated, 'utf8');
      console.log(`Updated aesthetic tokens for: ${path.relative(__dirname, target)}`);
      updatedCount++;
    }
  });

  console.log(`Aesthetic processing complete! Updated ${updatedCount} files.`);
}

processDirectory();
