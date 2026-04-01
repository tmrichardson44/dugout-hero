const fs = require('fs');
const path = require('path');

function boldVibrant(content) {
  let text = content;

  // Enhance the buttons to be wildly vibrant (pink to orange or purple to pink)
  text = text.replace(/bg-gradient-to-r from-emerald-500 to-teal-400/g, 'bg-gradient-to-r from-violet-500 to-fuchsia-500');
  text = text.replace(/hover:from-emerald-400 hover:to-teal-300/g, 'hover:from-violet-400 hover:to-fuchsia-400');
  text = text.replace(/text-emerald-600/g, 'text-violet-600');
  text = text.replace(/bg-emerald-50/g, 'bg-violet-50');
  text = text.replace(/border-emerald-500/g, 'border-violet-500');
  text = text.replace(/border-emerald-/g, 'border-violet-');
  
  // Make cards actually glass
  text = text.replace(/bg-white([^/])/g, 'bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl $1');
  
  // Clean up Double spaces from previous script
  text = text.replace(/bg-transparent min-h-screen min-h-screen/g, 'bg-transparent min-h-screen');
  text = text.replace(/bg-white\/90 backdrop-blur-md/g, 'bg-white/60 backdrop-blur-xl border border-white/40');

  return text;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.jsx')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const updated = boldVibrant(original);
      if (original !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
