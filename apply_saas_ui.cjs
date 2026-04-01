const fs = require('fs');
const path = require('path');

function applySaaS(content) {
  let text = content;

  // Global Structural Fix: Desktop Sidebar + Top Bar instead of bottom mobile nav
  // Replace the massive bottom `<nav>` and wrapping div
  const oldShellStart = /<div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 no-print relative w-full h-full max-h-screen overflow-y-auto">/;
  const newShellStart = `<div className="flex h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
        {/* SaaS Desktop Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm z-10 no-print">
          <div className="p-6 border-b border-slate-100 flex items-center justify-center">
             <GreenDiamondLogo />
             <h1 className="text-xl font-bold tracking-tight">Lineup Hero</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {[
              {t:'games', i:ClipboardList, l:'Schedule'}, 
              {t:'team', i:Users, l:'Roster'}, 
              ...(seasonConfig.enableTrends !== false ? [{t:'home', i:BarChart3, l:'Analytics'}] : []), 
              {t:'settings', i:SettingsIcon, l:'Settings'}
            ].map(tab => (
              <button key={tab.t} onClick={() => { setActiveTab(tab.t); setSelectedGameId(null); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors \${activeTab === tab.t ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
                <tab.i className={\`w-5 h-5 \${activeTab === tab.t ? 'text-emerald-600' : 'text-slate-400'}\`} />
                <span className="text-sm">{tab.l}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto relative pb-24 md:pb-0 h-full">`;
  
  text = text.replace(oldShellStart, newShellStart);

  // Replace Bottom Nav (make it visible only on mobile via md:hidden)
  text = text.replace(/<nav className="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto bg-white\/90 backdrop-blur-xl border-t border-slate-200 py-4 px-6 flex justify-around items-center z-\[60\] shadow-lg no-print">/, '<nav className="fixed bottom-0 left-0 right-0 w-full md:hidden bg-white/95 backdrop-blur-sm border-t border-slate-200 py-3 px-6 flex justify-around items-center z-[60] shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] no-print">');

  // Replace Header
  const oldHeader = /<header className="bg-white\/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-5 shadow-sm">[\s\S]*?<\/header>/;
  const newHeader = `<header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm h-16 flex-shrink-0">
          <div className="flex items-center justify-between w-full h-full">
            <div className="flex items-center gap-2">
              {selectedGameId ? (
                <>
                  <button onClick={() => setSelectedGameId(null)} className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors hidden md:block">Games</button>
                  <span className="text-slate-300 hidden md:block">/</span>
                  <button onClick={() => setSelectedGameId(null)} className="p-1 hover:bg-slate-100 rounded-md text-emerald-600 md:hidden"><ChevronLeft className="w-5 h-5" /></button>
                  <h1 className="text-lg font-semibold text-slate-800 tracking-tight">Game Details</h1>
                </>
              ) : (
                <div className="flex items-center md:hidden">
                  <GreenDiamondLogo />
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">
                     Lineup Hero {HeaderBadge ? 'PRO' : ''}
                  </h1>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center overflow-hidden">
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              {HeaderBadge && <div className="hidden sm:block"><HeaderBadge /></div>}
            </div>
          </div>
        </header>`;
  text = text.replace(oldHeader, newHeader);

  // Layout Width inside main
  text = text.replace(/<main className="max-w-3xl mx-auto p-4">/g, '<main className="w-full max-w-5xl mx-auto p-6 flex-1">');
  
  // High-Chunky Radii -> SaaS Modern Radii
  text = text.replace(/rounded-\[40px\]/g, 'rounded-xl');
  text = text.replace(/rounded-\[32px\]/g, 'rounded-xl');
  text = text.replace(/rounded-\[24px\]/g, 'rounded-lg');
  text = text.replace(/rounded-2xl/g, 'rounded-lg');
  text = text.replace(/w-12 h-12 rounded-2xl/g, 'w-10 h-10 rounded-md');
  text = text.replace(/w-8 h-8 rounded-xl/g, 'w-8 h-8 rounded-md');

  // Borders & Shadows on Cards
  text = text.replace(/border-slate-200 shadow-sm/g, 'border-slate-200 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),_0_1px_2px_-1px_rgb(0,0,0,0.1)]');
  text = text.replace(/border-2/g, 'border');

  // Basic Button Flat Styling
  text = text.replace(/bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest/g, 'bg-emerald-600 text-white font-medium py-2.5 px-4 rounded-md shadow-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors text-sm');
  text = text.replace(/bg-emerald-600 text-white font-black py-4 rounded-[24px] shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all/g, 'bg-slate-900 text-white font-medium py-2 px-4 rounded-md shadow-sm flex items-center justify-center gap-2 text-sm hover:bg-slate-800 transition-all');
  text = text.replace(/className="w-full bg-emerald-600 text-white font-black py-5 rounded-\[24px\] shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all"/g, 'className="lg:w-auto ml-auto block px-4 py-2 bg-emerald-600 text-white font-medium rounded-md text-sm shadow-sm hover:bg-emerald-700 transition-colors"');
  text = text.replace(/w-full bg-emerald-600 text-white font-black py-5 rounded-xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all/g, 'w-full sm:w-auto sm:ml-auto block px-6 py-2 bg-emerald-600 text-white font-medium rounded-md text-sm shadow-sm hover:bg-emerald-700 transition-colors mt-4 sm:mt-0');

  // Typography -> Clean Standard SaaS
  text = text.replace(/font-black uppercase tracking-tighter/g, 'font-semibold tracking-tight text-slate-800');
  text = text.replace(/font-black uppercase tracking-widest/g, 'font-medium text-slate-700');
  text = text.replace(/uppercase tracking-widest/g, 'text-xs font-semibold tracking-wider');
  text = text.replace(/text-\[10px\] font-black text-slate-400 uppercase tracking-widest/g, 'text-xs font-medium text-slate-500');
  text = text.replace(/text-\[10px\] font-black text-emerald-600 uppercase tracking-widest/g, 'text-xs font-semibold text-emerald-700');
  text = text.replace(/font-black text-slate-900 text-xl tracking-tighter uppercase mb-1/g, 'font-semibold text-slate-900 text-base mb-1');
  text = text.replace(/text-2xl font-black text-slate-900 uppercase/g, 'text-lg font-semibold text-slate-900');
  text = text.replace(/font-black text-slate-900 uppercase/g, 'font-semibold text-slate-900');

  // Table Structure
  text = text.replace(/p-6 rounded-xl border border-slate-200 shadow-\[0_1px_3px_0_rgb\(0,0,0,0.1\),_0_1px_2px_-1px_rgb\(0,0,0,0.1\)\] flex items-center justify-between hover:border-emerald-400 transition-all text-left group/g, 'p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex items-center justify-between transition-colors w-full text-left group');
  
  // Game list wrap cleanup
  text = text.replace(/<div className="space-y-4">.*?New Game.*?<\/button>/s, (match) => {
     let head = `<div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                 <h2 className="text-xl font-semibold text-slate-900">Season Schedule</h2>
                 <button onClick={() => {
                   const formattedDate = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());
                   const newGame = { id: Date.now(), opponent: "New Opponent", date: formattedDate, time: "6:00 PM", location: "Field 1", isHome: true, absentPlayerIds: [], battingOrder: {}, field: {} };
                   onAddGame(newGame);
                 }} className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-md text-sm shadow-sm hover:bg-emerald-700 flex items-center gap-2"><Plus className="w-4 h-4"/> Add Game</button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">`;
     return head;
  });
  text = text.replace(/<\/button>\s*<\/div>\s*<\/div>\s*\)\}/s, '</button>\n              </div>\n            </div>\n          )}');

  // Field Gen Grids Cleanup
  text = text.replace(/bg-blue-50 text-blue-600 px-4 py-3/g, 'bg-slate-100 text-slate-700 px-3 py-1.5 border border-slate-200 hover:bg-slate-200');

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
      
      let updated = applySaaS(original);
      
      // Additional simple cleanup routines for other pages
      updated = updated.replace(/bg-slate-50 min-h-screen/g, 'bg-slate-50 min-h-screen');
      updated = updated.replace(/text-5xl font-black uppercase tracking-tighter/g, 'text-4xl font-bold tracking-tight');
      updated = updated.replace(/bg-emerald-600 text-white font-black py-5 px-10 rounded-\[32px\] shadow-xl/g, 'bg-emerald-600 text-white font-medium py-3 px-6 rounded-md shadow-sm');
      
      if (original !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
