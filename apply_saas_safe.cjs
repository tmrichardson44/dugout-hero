const fs = require('fs');
const path = require('path');

function safeSaaS(content) {
  let text = content;

  // 1. Structural replacement: Layout Wrapper
  const oldShellStart = '<div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 no-print relative w-full h-full max-h-screen overflow-y-auto">';
  const newShellStart = `<div className="flex h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
        {/* SaaS Desktop Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shadow-sm z-10 no-print flex-shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2">
             <GreenDiamondLogo />
             <h1 className="text-xl font-bold tracking-tight text-slate-900">Lineup Hero</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button onClick={() => { setActiveTab('games'); setSelectedGameId(null); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors \${activeTab === 'games' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
              <ClipboardList className={\`w-5 h-5 \${activeTab === 'games' ? 'text-emerald-600' : 'text-slate-400'}\`} />
              <span className="text-sm">Schedule</span>
            </button>
            <button onClick={() => { setActiveTab('team'); setSelectedGameId(null); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors \${activeTab === 'team' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
              <Users className={\`w-5 h-5 \${activeTab === 'team' ? 'text-emerald-600' : 'text-slate-400'}\`} />
              <span className="text-sm">Roster</span>
            </button>
            {seasonConfig.enableTrends !== false && (
              <button onClick={() => { setActiveTab('home'); setSelectedGameId(null); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors \${activeTab === 'home' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
                <BarChart3 className={\`w-5 h-5 \${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400'}\`} />
                <span className="text-sm">Analytics</span>
              </button>
            )}
            <button onClick={() => { setActiveTab('settings'); setSelectedGameId(null); }} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors \${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
              <SettingsIcon className={\`w-5 h-5 \${activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400'}\`} />
              <span className="text-sm">Setup</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative pb-24 md:pb-0 h-full">`;
  
  text = text.replace(oldShellStart, newShellStart);

  // 2. Structural replacement: Top Header
  const oldHeader = `<header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-5 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-1">
              {selectedGameId ? (
                <button onClick={() => setSelectedGameId(null)} className="p-2 hover:bg-slate-100 rounded-2xl text-emerald-600"><ChevronLeft className="w-7 h-7" /></button>
              ) : (
                <div className="flex items-center">
                  <GreenDiamondLogo />
                  <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
                     {HeaderBadge ? 'Lineup Hero PRO' : 'Lineup Hero'}
                  </h1>
                </div>
              )}
            </div>
            {HeaderBadge && <HeaderBadge />}
          </div>
        </header>`;
        
  const newHeader = `<header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between w-full h-full max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              {selectedGameId ? (
                <>
                  <button onClick={() => setSelectedGameId(null)} className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors hidden md:block">Schedule</button>
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
              <div className="w-8 h-8 bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center overflow-hidden">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              {HeaderBadge && <div className="hidden sm:block"><HeaderBadge /></div>}
            </div>
          </div>
        </header>`;
  text = text.replace(oldHeader, newHeader);

  // 3. Modifying main wrapper to use full width in column
  text = text.replace('<main className="max-w-3xl mx-auto p-4">', '<main className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex-1">');

  // 4. Update the bottom nav to ONLY show on mobile (md:hidden)
  const oldBottomNavStart = '<nav className="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-200 py-4 px-6 flex justify-around items-center z-[60] shadow-lg no-print">';
  const newBottomNavStart = '<nav className="fixed bottom-0 left-0 right-0 w-full md:hidden bg-white/95 backdrop-blur-sm border-t border-slate-200 py-3 px-6 flex justify-around items-center z-[60] shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] no-print">';
  text = text.replace(oldBottomNavStart, newBottomNavStart);

  // 5. Aesthetic Replacements (Fonts, Radii, Shadows, Buttons)
  // Standardize the chunky fonts
  text = text.replace(/font-black uppercase tracking-tighter/g, 'font-semibold tracking-tight text-slate-800');
  text = text.replace(/font-black text-slate-900 text-xl tracking-tighter uppercase/g, 'font-semibold text-slate-900 text-base');
  text = text.replace(/font-black uppercase tracking-widest/g, 'font-medium text-slate-600');
  text = text.replace(/font-black text-slate-400 uppercase tracking-widest/g, 'font-medium text-slate-500 uppercase tracking-wider');
  text = text.replace(/font-black text-emerald-600 uppercase tracking-widest/g, 'font-semibold text-emerald-700 uppercase tracking-wider');
  text = text.replace(/text-2xl font-black text-slate-900 uppercase/g, 'text-lg font-semibold text-slate-900');
  text = text.replace(/font-black text-slate-900 uppercase/g, 'font-semibold text-slate-900');

  // Soften chunky Radii
  text = text.replace(/rounded-\[40px\]/g, 'rounded-xl');
  text = text.replace(/rounded-\[32px\]/g, 'rounded-xl');
  text = text.replace(/rounded-\[24px\]/g, 'rounded-lg');
  text = text.replace(/rounded-2xl/g, 'rounded-lg');
  text = text.replace(/w-12 h-12 rounded-lg/g, 'w-10 h-10 rounded-md'); // Fixed from 2xl swap
  text = text.replace(/w-10 h-10 rounded-xl/g, 'w-8 h-8 rounded-md');

  // Button Refinement
  text = text.replace(/bg-emerald-600 text-white font-black py-5 rounded-xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all/g, 'px-4 py-2 bg-emerald-600 text-white font-medium rounded-md shadow-sm flex flex-1 items-center justify-center gap-2 text-sm hover:bg-emerald-700 transition-colors w-full sm:w-auto');
  text = text.replace(/w-full bg-emerald-600 text-white font-black py-5 rounded-xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest/g, 'w-full px-4 py-2 bg-emerald-600 text-white font-medium rounded-md shadow-sm flex items-center justify-center gap-2 text-sm hover:bg-emerald-700 transition-colors');
  text = text.replace(/w-full bg-emerald-600 text-white font-black py-5 rounded-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all/g, 'inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-md shadow-sm gap-2 text-sm hover:bg-emerald-700 transition-colors');
  text = text.replace(/w-full bg-emerald-600 text-white font-medium py-2.5/g, 'inline-flex items-center justify-center px-4 py-2 bg-emerald-600');

  return text;
}

function processDirectory() {
  const target = path.join(__dirname, 'src', 'components', 'DugoutHeroCore.jsx');
  const original = fs.readFileSync(target, 'utf8');
  const updated = safeSaaS(original);
  if (original !== updated) {
    fs.writeFileSync(target, updated, 'utf8');
    console.log(`Updated core layout ${target}`);
  }

  // Also update index.css global bg
  const cssTarget = path.join(__dirname, 'src', 'index.css');
  let css = fs.readFileSync(cssTarget, 'utf8');
  css = css.replace(/body \{[^}]*\}/s, 'body {\n  @apply bg-slate-50 min-h-screen text-slate-800 antialiased selection:bg-emerald-200;\n}');
  fs.writeFileSync(cssTarget, css, 'utf8');
  
  // Update Landing Page to match SaaS theme
  const lpTarget = path.join(__dirname, 'src', 'pages', 'LandingPage.jsx');
  let lp = fs.readFileSync(lpTarget, 'utf8');
  lp = lp.replace(/bg-slate-50 min-h-screen/, 'bg-slate-50 min-h-screen');
  lp = lp.replace(/font-black tracking-tighter uppercase/g, 'font-bold tracking-tight');
  lp = lp.replace(/font-black uppercase tracking-tighter/g, 'font-bold tracking-tight');
  lp = lp.replace(/bg-emerald-600 text-white font-black py-5 px-10 rounded-\[32px\] shadow-xl shadow-emerald-200 uppercase tracking-widest/g, 'bg-emerald-600 text-white font-semibold py-3 px-6 rounded-md shadow-sm text-sm');
  lp = lp.replace(/bg-white text-emerald-600 border-2 border-emerald-100 font-black py-5 px-10 rounded-\[32px\] shadow-sm uppercase tracking-widest/g, 'bg-white text-slate-700 border border-slate-200 font-semibold py-3 px-6 rounded-md shadow-sm text-sm');
  fs.writeFileSync(lpTarget, lp, 'utf8');
}

processDirectory();
