const fs = require('fs');
const path = require('path');

function replaceClasses(content) {
  let newContent = content;

  // 1. Backgrounds
  // Replace the slate-50 background wrappers with transparent, because index.css gradients them
  newContent = newContent.replace(/bg-slate-50 min-h-screen/g, 'bg-transparent min-h-screen');
  newContent = newContent.replace(/bg-slate-50/g, 'bg-white/40 backdrop-blur-sm'); // Inner subtle backgrounds

  // 2. High-Chunky Radii -> Elegant Radii
  newContent = newContent.replace(/rounded-\[32px\]/g, 'rounded-3xl');
  newContent = newContent.replace(/rounded-\[40px\]/g, 'rounded-3xl');
  newContent = newContent.replace(/rounded-\[24px\]/g, 'rounded-2xl');

  // 3. Borders & Shadows on Cards
  newContent = newContent.replace(/border-slate-200 shadow-sm/g, 'border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300');
  newContent = newContent.replace(/shadow-sm border border-slate-200/g, 'shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300');

  // 4. Primary Emerald Buttons -> Rich Gradients with Hover FX
  newContent = newContent.replace(/bg-emerald-600 text-white[^"]*shadow-xl shadow-emerald-[a-z0-9]+/g, (match) => {
    // Keep internal padding/rounding, but swap the raw colors and shadows
    let result = match.replace('bg-emerald-600', 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300');
    result = result.replace(/shadow-xl shadow-emerald-[0-9]+/, 'shadow-lg shadow-emerald-500/30 hover:-translate-y-1 hover:shadow-emerald-500/40 transition-all duration-300');
    return result;
  });
  
  // A catch-all for remaining emerald-600 buttons (that didn't match the shadow regex)
  newContent = newContent.replace(/bg-emerald-600 text-white/g, 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:to-teal-300 shadow-md shadow-emerald-500/20 hover:-translate-y-0.5 hover:shadow-emerald-500/30 transition-all duration-300');

  // 5. Typography "font-black uppercase tracking-widest" -> Clean & Modern
  newContent = newContent.replace(/font-black text-slate-900 uppercase tracking-tighter/g, 'font-extrabold text-slate-800 tracking-tight');
  newContent = newContent.replace(/font-black uppercase tracking-tighter/g, 'font-extrabold tracking-tight');
  newContent = newContent.replace(/font-black uppercase tracking-widest/g, 'font-bold tracking-wide');
  newContent = newContent.replace(/uppercase tracking-widest/g, 'tracking-wide font-medium');
  newContent = newContent.replace(/text-\[10px\] font-black text-slate-400 uppercase tracking-widest/g, 'text-xs font-semibold text-slate-500 tracking-wide');
  newContent = newContent.replace(/text-\[10px\] font-black text-emerald-600 uppercase tracking-widest/g, 'text-xs font-bold text-teal-600 tracking-wide');

  // Specific landing page adjustments
  newContent = newContent.replace(/text-4xl font-black tracking-tighter uppercase leading-none/g, 'text-5xl font-extrabold tracking-tight text-slate-800');
  newContent = newContent.replace(/text-5xl font-black uppercase tracking-tighter/g, 'text-6xl font-extrabold tracking-tight');

  // Clean cards base explicitly since we replaced slate-50
  newContent = newContent.replace(/bg-white([^/])/g, 'bg-white/90 backdrop-blur-md $1');

  // Special case: fix the printed sheet background
  newContent = newContent.replace(/bg-white\/90 backdrop-blur-md p-8 w-full h-full text-slate-900 font-sans/g, 'bg-white p-8 w-full h-full text-slate-900 font-sans');

  return newContent;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.jsx')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const updated = replaceClasses(original);
      if (original !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
