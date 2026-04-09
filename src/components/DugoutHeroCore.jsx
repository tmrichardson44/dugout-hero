import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, ClipboardList, BarChart3, ChevronRight, ChevronLeft, 
  Settings as SettingsIcon, Plus, X, Wand2, 
  Trash2, MapPin, Clock, Printer, Check, CheckCircle2, Save, Edit2, CalendarDays, GripVertical
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// --- MASTER DATA ---
const MASTER_POSITIONS = [
  { id: "P", name: "Pitcher", type: "infield" },
  { id: "C", name: "Catcher", type: "infield" },
  { id: "1B", name: "First Base", type: "infield" },
  { id: "2B", name: "Second Base", type: "infield" },
  { id: "3B", name: "Third Base", type: "infield" },
  { id: "SS", name: "Shortstop", type: "infield" },
  { id: "LF", name: "Left Field", type: "outfield" },
  { id: "LC", name: "Left Center", type: "outfield" },
  { id: "CF", name: "Center Field", type: "outfield" },
  { id: "RC", name: "Right Center", type: "outfield" },
  { id: "RF", name: "Right Field", type: "outfield" }
];

// --- LOGO COMPONENT ---
export function GreenDiamondLogo() {
  return (
    <div className="relative flex items-center justify-center mr-2">
      <div className="animate-float">
        <svg viewBox="0 0 24 24" className="w-10 h-10 fill-emerald-500 drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
          <circle cx="12" cy="12" r="2" className="fill-white/80" />
        </svg>
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); filter: drop-shadow(0 5px 15px rgba(16, 185, 129, 0.2)); }
          50% { transform: translateY(-8px); filter: drop-shadow(0 20px 25px rgba(16, 185, 129, 0.4)); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function PrintView({ selectedGame, players, seasonConfig, inline = false }) {
  if (!selectedGame || !seasonConfig) return null;
  const presentPlayers = players.filter(p => !selectedGame.absentPlayerIds?.includes(p.id));
  const headerTitle = selectedGame.isHome ? `vs ${selectedGame.opponent}` : `@ ${selectedGame.opponent}`;
  
  const containerClass = inline 
    ? "bg-white border border-slate-200  p-4 sm:p-8 w-full border-2 border-slate-200 rounded-xl shadow-inner overflow-x-auto mt-4" 
    : "hidden print:block bg-white border border-slate-200  p-8 w-full h-full text-slate-900 font-sans";

  return (
    <div id={inline ? "inline-preview" : "printable-area"} className={containerClass}>
      <div className="min-w-[800px]">
        <div className="flex justify-between items-end border-b-[10px] border-black pb-2 print:border-b-[6px] mb-6 print:mb-3">
          <div>
            <h1 className="text-4xl print:text-3xl font-bold tracking-tight leading-none text-slate-800">{seasonConfig.teamName}</h1>
            <p className="text-xl print:text-lg font-semibold text-slate-400 uppercase mt-1 print:mt-0.5 tracking-wider leading-none">{headerTitle} • {selectedGame.date}</p>
          </div>
          <div className="text-right border-l border-slate-200 pl-4 print:pl-3">
            <p className="text-lg print:text-base font-bold tracking-wide mb-1 leading-none text-slate-700">{selectedGame.time}</p>
            <p className="text-base print:text-sm font-semibold text-slate-400 uppercase leading-none">{selectedGame.location}</p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="bg-slate-800 text-white text-center py-1.5 print:py-1 font-semibold text-[10px] tracking-widest mb-3 rounded-lg">Lineup & Defensive Rotation</h2>
          <table className="w-full border border-slate-200 text-center border-collapse rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 print:p-1 border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-10">#</th>
                <th className="p-2 print:p-1 border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Player</th>
                {Array.from({ length: seasonConfig.innings || 6 }).map((_, i) => <th key={i} className="p-2 print:p-1 border border-slate-100 text-[10px] font-bold text-slate-400">INN {i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const orderedPlayers = [];
                const numSlots = Math.max(presentPlayers.length, seasonConfig.rosterSize || 12);
                for (let i = 1; i <= numSlots; i++) {
                  const pId = selectedGame.battingOrder?.[i];
                  const player = pId ? players.find(p => p.id.toString() === pId.toString()) : null;
                  orderedPlayers.push({ slot: i, player });
                }
                const playersInOrder = new Set(Object.values(selectedGame.battingOrder || {}).map(String));
                const extras = presentPlayers.filter(p => !playersInOrder.has(p.id.toString()));
                extras.forEach(player => {
                  orderedPlayers.push({ slot: '-', player });
                });

                return orderedPlayers.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="p-2 print:p-1 border border-slate-100 text-center font-bold text-slate-300">{item.slot}</td>
                    <td className="p-2 print:p-1 border border-slate-100 text-left font-semibold text-slate-700 whitespace-nowrap uppercase tracking-tight">{item.player ? item.player.name : '—'}</td>
                    {Array.from({ length: seasonConfig.innings || 6 }).map((_, inn) => {
                      if (!item.player) return <td key={inn} className="p-2 print:p-1 border border-slate-100 bg-slate-50/30"></td>;
                      const pos = selectedGame.field?.[inn]?.[item.player.id] || '-';
                      const isBench = pos === 'Bench' || pos === 'B';
                      return (
                        <td key={inn} className={`p-2 print:p-1 border border-slate-100 text-[10px] font-bold text-center ${isBench ? 'text-slate-300' : 'text-emerald-600 bg-emerald-50/20'}`}>
                          {pos}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SeasonSettingsView({ seasonConfig, onSave, availableLeagues = [], availableDivisions = [], coachName, divisionName, canDeleteTeam, onDeleteTeam, divisionConfig }) {
  const [draft, setDraft] = useState(seasonConfig);
  const [isSaved, setIsSaved] = useState(false);
  const [localDivs, setLocalDivs] = useState([]);

  const getDivisionTheme = (name) => {
    if (!name || name === 'No Division') return 'div-theme-slate';
    const themes = ['emerald', 'rose', 'blue', 'violet', 'amber', 'indigo'];
    const lower = name.toLowerCase();
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
      hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return `div-theme-${themes[index]}`;
  };

  const currentDivName = localDivs.find(d => d.id === draft.divisionId)?.name || divisionName;
  const themeClass = getDivisionTheme(currentDivName);

  useEffect(() => {
    if (!draft.leagueId) {
      setLocalDivs([]);
      return;
    }
    const q = query(collection(db, 'saas_data', 'v1', 'divisions'), where('leagueId', '==', draft.leagueId));
    const unsub = onSnapshot(q, snap => {
       setLocalDivs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [draft.leagueId]);
  
  const handleSave = async () => {
    let finalDraft = { ...draft };

    // If user typed a manual division, create it first
    if (draft.newDivisionName?.trim()) {
      try {
        const divRef = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), {
          name: draft.newDivisionName.trim(),
          leagueId: draft.leagueId || null,
          createdAt: new Date().toISOString()
        });
        finalDraft.divisionId = divRef.id;
        delete finalDraft.newDivisionName;
        delete finalDraft.isCreatingNewDiv;
      } catch (err) {
        console.error("Failed to create division", err);
      }
    }

    onSave(finalDraft); 
    setIsSaved(true); 
    setTimeout(() => setIsSaved(false), 2000); 
  };

  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-l-4 ${themeClass}`}>
              <SettingsIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Team Configuration</h2>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium leading-none uppercase">Configure Team Framework</p>
                 {currentDivName && currentDivName !== 'Unassigned' && (
                   <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${themeClass}`}>{currentDivName}</span>
                 )}
              </div>
            </div>
          </div>
          {isSaved && (<div className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-4 py-2 rounded-full border border-emerald-100 animate-bounce">SAVED</div>)}
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Team Name</label>
              <input className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all uppercase placeholder:normal-case text-sm shadow-sm" placeholder="Enter Team Name" value={draft.teamName || ''} onChange={(e) => setDraft({...draft, teamName: e.target.value})} />
            </div>
            

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Season</label>
              <select className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer text-sm shadow-sm" value={draft.season || 'Spring'} onChange={(e) => setDraft({...draft, season: e.target.value})}>
                 <option value="Spring">Spring</option>
                 <option value="Summer">Summer</option>
                 <option value="Fall">Fall</option>
                 <option value="Winter">Winter</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Year</label>
              <select className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer text-sm shadow-sm" value={draft.year || '2026'} onChange={(e) => setDraft({...draft, year: e.target.value})}>
                 {Array.from({length: 5}).map((_, i) => {
                    const y = (2025 + i).toString();
                    return <option key={y} value={y}>{y}</option>;
                 })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Coach Email</label>
              <input 
                 className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs shadow-sm"
                 placeholder="coach@example.com"
                 value={draft.coachEmail || ''}
                 onChange={e => setDraft({...draft, coachEmail: e.target.value})}
              />
            </div>

            {localDivs.length > 0 || draft.leagueId ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Division</label>
                {draft.isCreatingNewDiv ? (
                   <div className="flex gap-2">
                     <input 
                       className="flex-1 bg-white border border-emerald-200 rounded-lg px-4 py-2.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs shadow-sm"
                       placeholder="Enter Division Name"
                       autoFocus
                       value={draft.newDivisionName || ''}
                       onChange={e => setDraft({...draft, newDivisionName: e.target.value})}
                     />
                     <button 
                        onClick={() => setDraft({...draft, isCreatingNewDiv: false, newDivisionName: ''})}
                        className="p-2.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                   </div>
                ) : (
                  <select
                    className={`w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer text-xs shadow-sm border-l-4 ${themeClass}`}
                    value={draft.divisionId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') setDraft({...draft, isCreatingNewDiv: true});
                      else setDraft({...draft, divisionId: e.target.value});
                    }}
                  >
                    <option value="">— Not in a Division —</option>
                    {localDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    <option value="NEW" className="text-emerald-600 font-bold">+ Create New Division</option>
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Division</label>
                <input className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 font-semibold text-slate-400 outline-none uppercase text-xs" disabled value={divisionName || 'Unassigned'} readOnly />
              </div>
            )}

            {availableLeagues.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide font-medium ml-1">League</label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-[20px] px-6 py-3 font-bold text-slate-700 outline-none focus:bg-white border border-slate-200 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  value={draft.leagueId || ''}
                  onChange={(e) => setDraft({...draft, leagueId: e.target.value})}
                >
                  <option value="">— Not in a League —</option>
                  {availableLeagues.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 p-5 rounded-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Roster Size</label>
                <input type="number" className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2 font-semibold text-sm outline-none shadow-sm" value={draft.rosterSize || 12} onChange={(e) => setDraft({...draft, rosterSize: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Innings</label>
                <input type="number" className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2 font-semibold text-sm outline-none shadow-sm" value={draft.innings || 6} onChange={(e) => setDraft({...draft, innings: parseInt(e.target.value) || 6})} />
              </div>
            </div>
            <div className="bg-emerald-600/5 p-5 rounded-lg border border-emerald-100 flex flex-col gap-3">
              <div className="flex justify-between items-center w-full">
                <div className="flex gap-4 items-center">
                  <BarChart3 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-900 leading-relaxed uppercase">
                    Lineup Trends & Optimal Batting Average
                  </p>
                </div>
                {/* Toggle removed from team level as it now resides at division level */}
                <div className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest ${(divisionConfig?.enableTrends ?? seasonConfig.enableTrends) !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                   {(divisionConfig?.enableTrends ?? seasonConfig.enableTrends) !== false ? 'Division Enabled' : 'Division Disabled'}
                </div>
              </div>
              {((divisionConfig?.enableTrends ?? seasonConfig.enableTrends) !== false) && (
                <div className="pl-10 text-[10px] font-bold text-emerald-800 leading-relaxed uppercase">
                  Target Range: <span className="text-emerald-600 font-bold tracking-widest bg-emerald-100 px-2 py-1 rounded-lg ml-1">{(((draft.rosterSize || 12) / 2) - 1).toFixed(2)} - {(((draft.rosterSize || 12) / 2) + 0.75).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rotation Positions moved to Division level */}
        
        <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors hover:from-emerald-400  text-white font-bold py-3 rounded-md shadow-lg shadow-sm hover:-translate-y-1 hover:shadow-emerald-500/40 transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm tracking-wide font-medium">
          <Save className="w-6 h-6" /> Save Team Settings
        </button>
        
        {canDeleteTeam && (
          <div className="mt-8 pt-8 border-t border-rose-100 flex justify-center">
            <button onClick={onDeleteTeam} className="bg-white border border-slate-200  border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all">
              <Trash2 className="w-4 h-4" /> Permanently Delete Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamView({ players, onAddPlayer, onEditPlayer, onDeletePlayer }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", throws: "R", bats: "R", restrictedPositions: [] });

  const startAdd = () => {
    setEditingId(null);
    setNewPlayer({ name: "", number: "", throws: "R", bats: "R", restrictedPositions: [] });
    setIsAdding(true);
  };

  const startEdit = (player) => {
    setEditingId(player.id);
    setNewPlayer({ ...player });
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!newPlayer.name || !newPlayer.number) return;
    if (editingId) {
      onEditPlayer(newPlayer);
    } else {
      onAddPlayer(newPlayer);
    }
    setNewPlayer({ name: "", number: "", throws: "R", bats: "R", restrictedPositions: [] });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-center bg-white border border-slate-100 p-5 rounded-lg shadow-sm">
         <div>
            <h2 className="text-base font-semibold text-slate-800">Roster Management</h2>
            <p className="text-[9px] font-bold text-emerald-600 tracking-widest uppercase mt-0.5">{players.length} Active Players</p>
         </div>
         <button onClick={startAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-all active:scale-95">
           <Plus className="w-5 h-5" />
         </button>
       </div>

       {isAdding && (
          <div className="bg-white border border-emerald-100 p-5 rounded-lg shadow-md space-y-4 animate-in slide-in-from-top-2 duration-300">
             <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4">{editingId ? 'Edit Player' : 'Add Strategic Resource'}</h3>
             <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase ml-1">Player Name</label>
                  <input className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2 font-semibold text-slate-700 outline-none focus:border-emerald-500 uppercase text-sm shadow-sm" placeholder="FULL NAME" value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase ml-1">NUM</label>
                  <input type="number" className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2 font-semibold text-slate-700 outline-none focus:border-emerald-500 text-center text-sm shadow-sm" placeholder="00" value={newPlayer.number} onChange={(e) => setNewPlayer({...newPlayer, number: e.target.value})} />
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-3 pt-1">
               <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase ml-1">Throws</label>
                  <select className="w-full bg-white border border-slate-100 rounded-lg px-3 py-1.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 appearance-none text-xs shadow-sm" value={newPlayer.throws} onChange={(e) => setNewPlayer({...newPlayer, throws: e.target.value})}>
                     <option value="R">Right Handed</option>
                     <option value="L">Left Handed</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase ml-1">Bats</label>
                  <select className="w-full bg-white border border-slate-100 rounded-lg px-3 py-1.5 font-semibold text-slate-700 outline-none focus:border-emerald-500 appearance-none text-xs shadow-sm" value={newPlayer.bats} onChange={(e) => setNewPlayer({...newPlayer, bats: e.target.value})}>
                     <option value="R">Right Handed</option>
                     <option value="L">Left Handed</option>
                     <option value="S">Switch Hitter</option>
                  </select>
               </div>
             </div>

             <div className="space-y-2 pt-2">
                <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase ml-1">Restricted Positions (Skip Assignments)</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                   {MASTER_POSITIONS.map(pos => {
                      const isRestricted = (newPlayer.restrictedPositions || []).includes(pos.id);
                      return (
                        <button 
                          key={pos.id}
                          onClick={() => {
                            const next = isRestricted 
                              ? newPlayer.restrictedPositions.filter(id => id !== pos.id) 
                              : [...(newPlayer.restrictedPositions || []), pos.id];
                            setNewPlayer({...newPlayer, restrictedPositions: next});
                          }}
                          className={`py-2 rounded-lg font-bold text-[10px] uppercase transition-all border ${isRestricted ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-50 text-slate-300'}`}
                        >
                          {pos.id}
                        </button>
                      );
                   })}
                </div>
             </div>

             <div className="flex gap-3 pt-3">
               <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="flex-1 bg-slate-50 text-slate-400 font-bold py-2.5 rounded-lg uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
               <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-[10px] tracking-widest shadow-sm transition-all">Save Player</button>
             </div>
          </div>
        )}

       <div className="space-y-2">
         {players.map(p => (
           <div key={p.id} className="card-premium p-3 group flex items-center justify-between border-slate-50">
             <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center font-bold text-emerald-600 border border-emerald-100/50 text-sm shadow-sm">{p.number}</div>
               <div>
                  <p className="font-semibold text-slate-800 text-sm uppercase tracking-tight leading-none mb-1.5">{p.name}</p>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">B: {p.bats}</span>
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">T: {p.throws}</span>
                    {Array.isArray(p.restrictedPositions) && p.restrictedPositions.length > 0 && (
                      <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                        AVOID: {p.restrictedPositions.join(', ')}
                      </span>
                    )}
                  </div>
               </div>
             </div>
             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
               <button onClick={() => startEdit(p)} className="w-8 h-8 rounded-lg text-slate-300 flex items-center justify-center hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                  <Edit2 className="w-4 h-4" />
               </button>
               <button onClick={() => onDeletePlayer(p.firebaseId, p.id)} className="w-8 h-8 rounded-lg text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
               </button>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
}

// --- MAIN EXPORTED COMPONENT ---
export default function DugoutHeroCore({
  players = [],
  games = [],
  seasonConfig = {},
  isLoadingData = false,
  availableLeagues = [],
  availableDivisions = [],
  coachName = "",
  divisionName = "",
  canDeleteTeam = false,
  onDeleteTeam,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  onAddGame,
  onUpdateGame,
  onDeleteGame,
  onUpdateSeasonConfig,
  divisionConfig,
  HeaderBadge,
  onBackToDashboard
}) {
  const [activeTab, setActiveTab] = useState('games'); 
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [gameSubTab, setGameSubTab] = useState('matrix');

  useEffect(() => {
    if (selectedGameId) {
      window.scrollTo(0, 0);
    }
  }, [selectedGameId]);

  // Derived Helpers
  const selectedGame = useMemo(() => games.find(g => g.id === selectedGameId), [games, selectedGameId]);
  const activePositions = useMemo(() => {
    const list = divisionConfig?.enabledPositions || seasonConfig?.enabledPositions || ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
    return MASTER_POSITIONS.filter(pos => list.includes(pos.id));
  }, [divisionConfig, seasonConfig]);
  const playersPresent = useMemo(() => players.filter(p => !(selectedGame?.absentPlayerIds || []).includes(p.id)), [players, selectedGame]);

  const seasonStats = useMemo(() => {
    return players.map(player => {
      let totalPos = 0, gameCount = 0;
      games.forEach(game => {
        if (!game || (game.absentPlayerIds || []).includes(player.id)) return;
        const entry = Object.entries(game.battingOrder || {}).find(([pos, id]) => parseInt(id) === player.id);
        if (entry) { totalPos += parseInt(entry[0]); gameCount++; }
      });
      return { ...player, avg: gameCount > 0 ? (totalPos / gameCount) : 0, gameCount };
    });
  }, [games, players]);

  // Generators
  const autoGenerateField = async () => {
    console.log("Auto-Generating Field Rotation", { selectedGame, presentCount: playersPresent.length, activePositions: activePositions.length });
    if (!selectedGame || playersPresent.length === 0) {
       console.warn("Cannot generate field: No game selected or no players present.");
       return;
    }
    let nF = {};
    // Tracker now includes 'everPitched' and category counts to enforce consecutive innings and div rules
    const tracker = playersPresent.map(p => ({ 
      id: p.id, 
      sat: 0, 
      last: null, 
      everPitched: false,
      restrictedPositions: p.restrictedPositions || [],
      counts: { infield: 0, outfield: 0, bench: 0 }
    }));

    const fIds = activePositions.map(p => p.id);
    const rules = divisionConfig || {};
    const hasBenchRules = playersPresent.length > 9;

    for (let inn = 0; inn < (seasonConfig.innings || 6); inn++) {
      let cur = {}; let asgIds = new Set(); let pool = [...fIds];
      
      const isInf = (pid) => ["P","C","1B","2B","3B","SS"].includes(pid);
      const isOut = (pid) => ["LF","LC","CF","RC","RF"].includes(pid);

      // Urgency logic for completion deadline
      const isUrgent = (p, cat) => {
         if (!rules.enforceDeadline) return false;
         const deadline = rules.deadlineInning || 5;
         if (inn + 1 > deadline) return false;
         
         const minReq = cat === 'infield' ? (rules.infieldMin || 0) : (rules.outfieldMin || 0);
         if (minReq <= 0) return false;
         
         const curCount = cat === 'infield' ? p.counts.infield : p.counts.outfield;
         const remainingNeeded = minReq - curCount;
         const remainingInningsBeforeDeadline = deadline - inn;
         
         return remainingNeeded >= remainingInningsBeforeDeadline;
      };

      // 1. Mandatory Core Positions (P, C) - Prioritized but restricted-aware
      if (fIds.includes("P")) {
        pool = pool.filter(x => x !== "P");
        const pCand = tracker
          .filter(p => !p.restrictedPositions.includes("P") && !asgIds.has(p.id))
          .filter(p => {
             // Consecutive innings rule
             if (p.everPitched && p.last !== 'P') return false;
             // Division Max Infield rule
             if (rules.infieldMax !== undefined && p.counts.infield >= rules.infieldMax) return false;
             return true;
          })
          .sort((a, b) => {
            // Priority: Someone urgent for Infield
            const aUrgent = isUrgent(a, 'infield');
            const bUrgent = isUrgent(b, 'infield');
            if (aUrgent && !bUrgent) return -1;
            if (!aUrgent && bUrgent) return 1;

            // Priority: Someone below their MIN Infield if available
            if (rules.infieldMin !== undefined) {
               const aNeeded = a.counts.infield < rules.infieldMin;
               const bNeeded = b.counts.infield < rules.infieldMin;
               if (aNeeded && !bNeeded) return -1;
               if (!aNeeded && bNeeded) return 1;
            }
            if (a.last === 'P' && b.last !== 'P') return 1;
            if (a.last !== 'P' && b.last === 'P') return -1;
            return Math.random() - 0.5;
          })[0];
        if (pCand) { 
          cur[pCand.id] = "P"; 
          pCand.last = "P"; 
          pCand.everPitched = true; 
          pCand.counts.infield++;
          asgIds.add(pCand.id); 
        }
      }

      if (fIds.includes("C")) {
        pool = pool.filter(x => x !== "C");
        const cCand = tracker
          .filter(p => !p.restrictedPositions.includes("C") && !asgIds.has(p.id))
          .filter(p => {
             if (rules.infieldMax !== undefined && p.counts.infield >= rules.infieldMax) return false;
             return true;
          })
          .sort((a, b) => {
            const aUrgent = isUrgent(a, 'infield');
            const bUrgent = isUrgent(b, 'infield');
            if (aUrgent && !bUrgent) return -1;
            if (!aUrgent && bUrgent) return 1;

            if (rules.infieldMin !== undefined) {
               const aNeeded = a.counts.infield < rules.infieldMin;
               const bNeeded = b.counts.infield < rules.infieldMin;
               if (aNeeded && !bNeeded) return -1;
               if (!aNeeded && bNeeded) return 1;
            }
            if (a.last === 'C' && b.last !== 'C') return 1;
            if (a.last !== 'C' && b.last === 'C') return -1;
            return Math.random() - 0.5;
          })[0];
        if (cCand) { 
           cur[cCand.id] = "C"; 
           cCand.last = "C"; 
           cCand.counts.infield++;
           asgIds.add(cCand.id); 
        }
      }
      
      // 2. Assign Bench Slots
      const bLimit = Math.max(0, playersPresent.length - activePositions.length);
      tracker.filter(p => !asgIds.has(p.id))
        .filter(p => {
           if (!hasBenchRules) return true;
           // If urgent for ANY requirement before deadline, try not to bench them
           if (isUrgent(p, 'infield') || isUrgent(p, 'outfield')) return false;

           if (rules.benchMax !== undefined && p.counts.bench >= rules.benchMax) return false;
           return true;
        })
        .sort((a,b) => {
           if (hasBenchRules && rules.benchMin !== undefined) {
              const aNeeded = a.counts.bench < rules.benchMin;
              const bNeeded = b.counts.bench < rules.benchMin;
              if (aNeeded && !bNeeded) return -1;
              if (!aNeeded && bNeeded) return 1;
           }
           return a.sat - b.sat || Math.random() - 0.5;
        })
        .slice(0, bLimit)
        .forEach(p => { 
           cur[p.id] = "Bench"; 
           p.sat++; 
           p.last = "Bench"; 
           p.counts.bench++;
           asgIds.add(p.id); 
        });
      
      // 3. Assign Remaining positions with restriction check
      tracker.filter(p => !asgIds.has(p.id))
        .sort((a, b) => {
           const aInfU = isUrgent(a, 'infield');
           const bInfU = isUrgent(b, 'infield');
           if (aInfU && !bInfU) return -1;
           if (!aInfU && bInfU) return 1;

           const aOutU = isUrgent(a, 'outfield');
           const bOutU = isUrgent(b, 'outfield');
           if (aOutU && !bOutU) return -1;
           if (!aOutU && bOutU) return 1;

           const aInfieldNeeded = (rules.infieldMin !== undefined && a.counts.infield < rules.infieldMin);
           const bInfieldNeeded = (rules.infieldMin !== undefined && b.counts.infield < rules.infieldMin);
           const aOutfieldNeeded = (rules.outfieldMin !== undefined && a.counts.outfield < rules.outfieldMin);
           const bOutfieldNeeded = (rules.outfieldMin !== undefined && b.counts.outfield < rules.outfieldMin);
           
           if ((aInfieldNeeded || aOutfieldNeeded) && !(bInfieldNeeded || bOutfieldNeeded)) return -1;
           if (!(aInfieldNeeded || aOutfieldNeeded) && (bInfieldNeeded || bOutfieldNeeded)) return 1;

           return Math.random() - 0.5;
        })
        .forEach(p => { 
          // Find first available position in pool that is NOT restricted AND respects max rules
          const posIndex = pool.findIndex(posId => {
             const pUrgentInf = isUrgent(p, 'infield');
             const pUrgentOut = isUrgent(p, 'outfield');

             // If urgent for infield, ONLY accept infield slots if possible
             if (pUrgentInf && !isInf(posId)) return false;
             // If urgent for outfield, ONLY accept outfield slots if possible
             if (pUrgentOut && !isOut(posId)) return false;

             if (p.restrictedPositions.includes(posId)) return false;
             if (isInf(posId) && rules.infieldMax !== undefined && p.counts.infield >= rules.infieldMax) return false;
             if (isOut(posId) && rules.outfieldMax !== undefined && p.counts.outfield >= rules.outfieldMax) return false;
             return true;
          });

          if (posIndex !== -1) {
            const pos = pool.splice(posIndex, 1)[0];
            cur[p.id] = pos; 
            p.last = pos; 
            if (isInf(pos)) p.counts.infield++;
            if (isOut(pos)) p.counts.outfield++;
          } else { 
            // fallback to anything left if really stuck, but try to find a valid slot
            const hardPosIdx = pool.findIndex(posId => !p.restrictedPositions.includes(posId));
            if (hardPosIdx !== -1) {
              const pos = pool.splice(hardPosIdx, 1)[0];
              cur[p.id] = pos; 
              p.last = pos; 
              if (isInf(pos)) p.counts.infield++;
              if (isOut(pos)) p.counts.outfield++;
            } else {
              cur[p.id] = "Bench"; 
              p.sat++; 
              p.counts.bench++;
            }
          } 
        });
      nF[inn] = cur;
    }
    await onUpdateGame(selectedGame.firebaseId, { field: nF });
  };

  const autoGenerateOrder = async () => {
    console.log("Auto-Generating Batting Order", { selectedGame, presentCount: playersPresent.length });
    if (!selectedGame || playersPresent.length === 0) {
       console.warn("Cannot generate order: No game selected or no players present.");
       return;
    }

    const target = seasonConfig.battingTarget || 6.5;

    // Mean-reverting sort: each player's deviation from target determines their slot.
    //   - avg > target (batting too late on average)  → give a LOW slot (bat earlier) to pull avg DOWN
    //   - avg < target (batting too early on average) → give a HIGH slot (bat later)  to pull avg UP
    // Over time this converges everyone toward the target batting range.
    //
    // IMPORTANT: Math.random() must be called BEFORE sort (not inside the comparator),
    // because JS sort calls the comparator multiple times per element, producing
    // inconsistent results and effectively neutralizing the shuffle.
    const withKeys = playersPresent.map(p => {
      const stat = seasonStats.find(s => s.id === p.id);
      const avg = stat?.gameCount > 0 ? stat.avg : target;
      const dev = avg - target; // positive = too late, negative = too early
      const noise = (Math.random() - 0.5) * 0.5; // jitter so near-target players still rotate
      return { player: p, sortKey: dev + noise };
    });

    // Sort descending: highest sortKey (avg too late) → slot 1; lowest (avg too early) → slot N
    const sortedPlayers = withKeys.sort((a, b) => b.sortKey - a.sortKey).map(x => x.player);

    const newOrder = {};
    sortedPlayers.forEach((p, idx) => {
      newOrder[idx + 1] = p.id.toString();
    });

    await onUpdateGame(selectedGame.firebaseId, { battingOrder: newOrder });
  };

  if (isLoadingData) return (
    <div className="min-h-screen bg-white/40  flex flex-col items-center justify-center p-8">
      <GreenDiamondLogo />
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mt-6"></div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-white/40  font-sans text-slate-900 pb-24 no-print relative w-full h-full max-h-screen overflow-y-auto">
        <header className="nav-header">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedGameId ? (
                <button onClick={() => setSelectedGameId(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              ) : onBackToDashboard ? (
                <button onClick={onBackToDashboard} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all flex items-center gap-2 pr-4">
                  <ChevronLeft className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Back</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <GreenDiamondLogo />
                  <div>
                    <h1 className="section-title text-base leading-none">
                       {HeaderBadge ? 'Lineup Hero Pro' : 'Lineup Hero'}
                    </h1>
                    <p className="section-subtitle text-[10px] uppercase tracking-widest mt-0.5">Manager Suite</p>
                  </div>
                </div>
              )}
            </div>
            {HeaderBadge && <HeaderBadge />}
          </div>
        </header>

        <main className="max-w-3xl mx-auto p-4">
          {activeTab === 'home' && (
             <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-base font-semibold text-slate-800">Batting Order Average</h2>
                 <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase">Target: {((seasonConfig.rosterSize || 12) / 2) - 1} - {((seasonConfig.rosterSize || 12) / 2) + 0.75}</div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {seasonStats.map(p => {
                   const targetMin = ((seasonConfig.rosterSize || 12) / 2) - 1;
                   const targetMax = ((seasonConfig.rosterSize || 12) / 2) + 0.75;
                   const isOptimal = p.gameCount > 0 ? (p.avg >= targetMin && p.avg <= targetMax) : true;
                   return (
                     <div key={p.id} className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <div className="flex items-center gap-3 text-left">
                           <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-slate-300 border border-slate-100/50 text-[10px]">{p.number}</div>
                           <div>
                             <p className="font-semibold text-slate-700 leading-none mb-1 text-xs truncate max-w-[100px]">{p.name}</p>
                             <p className="text-[8px] text-slate-400 font-bold tracking-widest uppercase">{p.gameCount} GMS</p>
                           </div>
                        </div>
                        <p className={`text-base font-bold tabular-nums ${isOptimal ? 'text-emerald-600' : 'text-rose-500'}`}>{p.avg.toFixed(1)}</p>
                     </div>
                   );
                 })}
               </div>
             </div>
          )}

          {activeTab === 'games' && !selectedGameId && (
            <div className="space-y-4">
              <button onClick={() => {
                const formattedDate = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());
                const newGame = { id: Date.now(), opponent: "New Opponent", date: formattedDate, time: "6:00 PM", location: "Field 1", isHome: true, absentPlayerIds: [], battingOrder: {}, field: {} };
                onAddGame(newGame);
              }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest active:scale-95 mb-2">
                <Plus className="w-3.5 h-3.5" /> Initialize New Game
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((g, index) => (
                  <button key={g.id} onClick={() => setSelectedGameId(g.id)} className="bg-white border-2 border-slate-300 hover:border-emerald-600 rounded-xl p-4 flex flex-col text-left group transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent -mr-8 -mt-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-[9px] font-bold text-emerald-600 tracking-widest uppercase flex items-center gap-2 relative z-10">
                         <span>GAME {index + 1}</span>
                         <span className="w-1 h-1 rounded-full bg-emerald-200"></span>
                         <span className={g.isHome ? 'text-blue-500' : 'text-slate-400'}>{g.isHome ? 'HOME' : 'AWAY'}</span>
                       </p>
                       <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0 relative z-10">
                         <ChevronRight className="text-slate-400 w-3.5 h-3.5 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                       </div>
                    </div>
                    
                    <p className="font-bold text-slate-800 text-base uppercase tracking-tight line-clamp-2 mt-1 mb-4 relative z-10">{g.opponent}</p>
                    
                    <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-slate-100 relative z-10">
                       <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                         <CalendarDays className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" /> {g.date || 'TBD'}
                       </div>
                       <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                         <Clock className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" /> {g.time || 'TBD'}
                       </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedGameId && (
             <div className="space-y-4">
                <div className="card-premium p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3 flex-1">
                       <button onClick={() => onUpdateGame(selectedGame.firebaseId, { isHome: !selectedGame.isHome })} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-all border ${selectedGame.isHome ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                         {selectedGame.isHome ? 'HOME' : 'AWAY'}
                       </button>
                       <input className="font-semibold text-lg text-slate-800 uppercase tracking-tight w-full outline-none placeholder:text-slate-200 bg-transparent" placeholder="OPPONENT NAME" value={selectedGame.opponent} onChange={(e) => onUpdateGame(selectedGame.firebaseId, { opponent: e.target.value })} />
                    </div>
                    <button onClick={() => {
                       if(window.confirm('Delete this game?')) {
                          onDeleteGame(selectedGame.firebaseId);
                          setSelectedGameId(null);
                       }
                    }} className="w-8 h-8 rounded-lg text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus-within:bg-white focus-within:border-emerald-500 transition-all relative">
                       <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer" />
                       <input type="date" className="absolute left-2.5 w-3.5 h-3.5 opacity-0 cursor-pointer" onChange={(e) => {
                         if (e.target.value) {
                           const d = new Date(e.target.value + 'T00:00:00');
                           if (!isNaN(d)) onUpdateGame(selectedGame.firebaseId, { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
                         }
                       }} />
                       <input className="bg-transparent font-semibold text-slate-700 outline-none w-full text-xs placeholder:text-slate-300" placeholder="DATE" value={selectedGame.date || ''} onChange={(e) => onUpdateGame(selectedGame.firebaseId, { date: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus-within:bg-white focus-within:border-emerald-500 transition-all">
                       <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                       <input className="bg-transparent font-semibold text-slate-700 outline-none w-full text-xs placeholder:text-slate-300" placeholder="TIME" value={selectedGame.time || ''} onChange={(e) => onUpdateGame(selectedGame.firebaseId, { time: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus-within:bg-white focus-within:border-emerald-500 transition-all">
                       <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                       <input className="bg-transparent font-semibold text-slate-700 outline-none w-full text-xs placeholder:text-slate-300" placeholder="LOCATION" value={selectedGame.location || ''} onChange={(e) => onUpdateGame(selectedGame.firebaseId, { location: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-lg shadow-sm">
                   {[
                     { id: 'matrix', label: 'Rotation' },
                     { id: 'order', label: 'Batting' },
                     { id: 'preview', label: 'Sheet' }
                   ].map(t => (
                     <button 
                        key={t.id} 
                        onClick={() => setGameSubTab(t.id)} 
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[9px] tracking-widest uppercase transition-all ${gameSubTab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        {t.label}
                      </button>
                   ))}
                </div>

                {gameSubTab === 'matrix' && (
                   <div className="card-premium p-5 space-y-6 animate-in slide-in-from-left-2 duration-300">
                     <div className="flex items-center justify-between">
                        <div>
                           <h3 className="text-base font-semibold text-slate-800">Defensive Rotation</h3>
                           <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Automated positional fairness</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setSelectedGameId(null)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 shadow-sm transition-all">
                             <CheckCircle2 className="w-3.5 h-3.5" /> Save
                           </button>
                           <button onClick={autoGenerateField} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100 shadow-sm">
                             <Wand2 className="w-3.5 h-3.5" /> Optimize
                           </button>
                        </div>
                     </div>
                    <div className="overflow-x-auto -mx-6 px-6 pb-4">
                      <table className="w-full min-w-[600px] border-separate border-spacing-y-2">
                         <thead>
                           <tr>
                             <th className="text-left py-2 px-4 text-[10px] font-bold text-slate-400 tracking-wide font-medium">Player</th>
                             {Array.from({ length: seasonConfig.innings || 6 }).map((_, inn) => {
                               const assignmentsThisInning = Object.values(selectedGame.field?.[inn] || {});
                               const missingPositions = activePositions.filter(pos => !assignmentsThisInning.includes(pos.id)).map(p => p.id);
                               const isMissing = missingPositions.length > 0;
                               const tooltipText = isMissing ? `Missing: ${missingPositions.join(', ')}` : '';
                               return (
                                 <th key={inn} title={tooltipText} className={`py-2 text-[10px] font-bold tracking-wide transition-colors ${isMissing ? 'text-rose-500 animate-pulse cursor-help' : 'text-slate-400'}`}>Inn {inn + 1}</th>
                               );
                             })}
                           </tr>
                         </thead>
                         <tbody>
                           {players.map(p => {
                             const isAbsent = selectedGame.absentPlayerIds?.includes(p.id);
                             return (
                               <tr key={p.id} className={`${isAbsent ? 'opacity-40' : ''}`}>
                                 <td className="py-2 pr-4">
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => {
                                        const nextAbsent = isAbsent 
                                          ? (selectedGame.absentPlayerIds || []).filter(id => id !== p.id)
                                          : [...(selectedGame.absentPlayerIds || []), p.id];
                                        onUpdateGame(selectedGame.firebaseId, { absentPlayerIds: nextAbsent });
                                      }} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isAbsent ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {isAbsent ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                      </button>
                                      <div>
                                        <p className="font-bold text-sm text-slate-900 uppercase leading-none">{p.name}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                          <p className="text-[10px] font-bold text-slate-400 leading-none">#{p.number}</p>
                                          {Array.isArray(p.restrictedPositions) && p.restrictedPositions.length > 0 && (
                                            <span className="text-[8px] bg-rose-50 text-rose-600 px-1 py-0.5 rounded-sm font-bold tracking-wide leading-none" title={`Restricted: ${p.restrictedPositions.join(', ')}`}>
                                              🚫 {p.restrictedPositions.join('')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                 </td>
                                 {Array.from({ length: seasonConfig.innings || 6 }).map((_, inn) => {
                                   const currentPos = selectedGame.field?.[inn]?.[p.id];
                                   
                                   let isConflict = false;
                                   if (currentPos && currentPos !== 'Bench') {
                                     const assignmentsThisInning = Object.values(selectedGame.field?.[inn] || {});
                                     isConflict = assignmentsThisInning.filter(pos => pos === currentPos).length > 1;
                                   }

                                   let dropdownStyle = 'bg-white border border-slate-200  border-slate-100 text-slate-300';
                                   if (currentPos === 'Bench') {
                                      dropdownStyle = 'bg-slate-100 border-slate-200 text-slate-400';
                                   } else if (isConflict) {
                                      dropdownStyle = 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm animate-pulse';
                                   } else if (currentPos) {
                                      dropdownStyle = 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm';
                                   }

                                   return (
                                     <td key={inn} className="py-2 px-1">
                                       <select 
                                          disabled={isAbsent}
                                          value={currentPos || ''}
                                          onChange={(e) => {
                                            const newField = JSON.parse(JSON.stringify(selectedGame.field || {}));
                                            if(!newField[inn]) newField[inn] = {};
                                            newField[inn][p.id] = e.target.value;
                                            onUpdateGame(selectedGame.firebaseId, { field: newField });
                                          }}
                                          className={`w-full appearance-none text-center py-3 rounded-lg font-bold text-xs outline-none transition-colors border-2 ${dropdownStyle}`}
                                       >
                                          <option value="">--</option>
                                          {activePositions.map(pos => <option key={pos.id} value={pos.id}>{pos.id}</option>)}
                                          <option value="Bench">Bench</option>
                                       </select>
                                     </td>
                                   );
                                 })}
                               </tr>
                             );
                           })}
                         </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {gameSubTab === 'order' && (
                  <div className="card-premium p-5 space-y-6 animate-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                           <h3 className="text-base font-semibold text-slate-800">Batting Lineup</h3>
                           <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Mean-reverting performance sort</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setSelectedGameId(null)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 shadow-sm transition-all">
                             <CheckCircle2 className="w-3.5 h-3.5" /> Save
                           </button>
                           <button onClick={autoGenerateOrder} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100 shadow-sm">
                             <Wand2 className="w-3.5 h-3.5" /> Rebalance
                           </button>
                        </div>
                     </div>
                    <div className="space-y-1.5">
                      {Array.from({ length: Math.max(playersPresent.length, seasonConfig.rosterSize || 15) }).map((_, idx) => {
                         const pId = selectedGame.battingOrder?.[idx + 1];
                         const pObj = pId ? players.find(p => p.id === parseInt(pId)) : null;
                         const statObj = pObj ? seasonStats.find(s => s.id === pObj.id) : null;
                         const diff = statObj ? (statObj.avg - (seasonConfig.battingTarget || 6.5)) : 0;
                         
                         return (
                           <div 
                             key={idx} 
                             draggable
                             onDragStart={(e) => e.dataTransfer.setData('text/plain', idx + 1)}
                             onDragOver={(e) => e.preventDefault()}
                             onDrop={(e) => {
                               e.preventDefault();
                               const draggedSlot = parseInt(e.dataTransfer.getData('text/plain'));
                               const dropSlot = idx + 1;
                               if (draggedSlot === dropSlot || !draggedSlot) return;
                               
                               const newOrder = JSON.parse(JSON.stringify(selectedGame.battingOrder || {}));
                               const temp = newOrder[dropSlot];
                               
                               if (newOrder[draggedSlot]) newOrder[dropSlot] = newOrder[draggedSlot];
                               else delete newOrder[dropSlot];
                               
                               if (temp) newOrder[draggedSlot] = temp;
                               else delete newOrder[draggedSlot];
                               
                               onUpdateGame(selectedGame.firebaseId, { battingOrder: newOrder });
                             }}
                             className="flex gap-3 items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100 cursor-move hover:bg-white hover:border-emerald-200 transition-all group"
                           >
                              <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors shrink-0" />
                              <div className="w-5 text-center font-bold text-slate-300 text-base">{idx + 1}</div>
                              <select 
                                 value={pId || ''}
                                 onChange={(e) => {
                                   const newOrder = JSON.parse(JSON.stringify(selectedGame.battingOrder || {}));
                                   const newPlayerId = e.target.value;
                                   
                                   if(!newPlayerId) {
                                     delete newOrder[idx + 1];
                                   } else {
                                     // Remove the player from any existing slot
                                     Object.keys(newOrder).forEach(slotNum => {
                                        if (newOrder[slotNum] === newPlayerId) {
                                           delete newOrder[slotNum];
                                        }
                                     });
                                     newOrder[idx + 1] = newPlayerId;
                                   }
                                   
                                   onUpdateGame(selectedGame.firebaseId, { battingOrder: newOrder });
                                 }}
                                 className="flex-1 bg-white border border-slate-100 rounded-lg px-3 py-1.5 font-semibold text-xs uppercase text-slate-700 outline-none focus:border-emerald-500 appearance-none shadow-sm"
                              >
                                 <option value="">-- UNASSIGNED --</option>
                                 {playersPresent.map(p => {
                                   const isUsed = Object.values(selectedGame.battingOrder || {}).includes(p.id.toString()) && pId !== p.id.toString();
                                   return <option key={p.id} value={p.id}>{p.name} {isUsed ? '🔁' : ''}</option>;
                                 })}
                              </select>
                              {statObj && (
                                 <div className="w-14 text-right pr-2 hidden sm:block shrink-0">
                                    <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase">AVG</p>
                                    <p className={`font-bold text-xs ${Math.abs(diff) < 1.2 ? 'text-emerald-500' : 'text-rose-400'}`}>{statObj.avg.toFixed(1)}</p>
                                 </div>
                              )}
                           </div>
                         );
                      })}
                    </div>
                  </div>
                )}

                {gameSubTab === 'preview' && (
                  <div className="animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center bg-blue-600 p-6 rounded-xl shadow-md mb-4">
                      <div><p className="text-white font-semibold text-sm leading-none">Lineup Sheet</p><p className="text-blue-200 text-[10px] font-bold uppercase mt-1">Ready for Print</p></div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedGameId(null)} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-lg font-bold text-xs flex items-center gap-2 transition-all">
                          <CheckCircle2 className="w-4 h-4" /> SAVE GAME
                        </button>
                        <button onClick={() => window.print()} className="bg-white border border-slate-200  text-blue-600 px-6 py-3 rounded-lg font-bold text-xs shadow-lg active:scale-90 transition-all flex items-center gap-2"><Printer className="w-4 h-4" /> EXPORT PDF</button>
                      </div>
                    </div>
                    <PrintView selectedGame={selectedGame} players={players} seasonConfig={seasonConfig} inline={true} />
                  </div>
                )}
             </div>
          )}

          {activeTab === 'settings' && (
            <SeasonSettingsView 
              seasonConfig={seasonConfig} 
              onSave={onUpdateSeasonConfig} 
              availableLeagues={availableLeagues}
              availableDivisions={availableDivisions}
              coachName={coachName}
              divisionName={divisionName}
              canDeleteTeam={canDeleteTeam}
              onDeleteTeam={onDeleteTeam}
              divisionConfig={divisionConfig}
            />
          )}

          {activeTab === 'team' && <TeamView players={players} onAddPlayer={onAddPlayer} onEditPlayer={onEditPlayer} onDeletePlayer={onDeletePlayer} />}
          
          <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-xl shadow-sm max-w-sm mx-auto mb-8">
                   {[
                     { id: 'games', label: 'Games' },
                     ...((divisionConfig?.enableTrends ?? seasonConfig.enableTrends) !== false ? [{ id: 'home', label: 'Trends' }] : []),
                     { id: 'settings', label: 'Config' }
                   ].map(t => (
                     <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`flex-1 py-2.5 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all ${activeTab === t.id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t.label}
                      </button>
                   ))}
                </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto bg-white border-t border-slate-200 py-3 px-6 flex justify-around items-center z-[60] shadow-lg no-print">
          {[
            {t:'games', i:ClipboardList, l:'Games'}, 
            {t:'team', i:Users, l:'Team'}, 
            ...((divisionConfig?.enableTrends ?? seasonConfig.enableTrends) !== false ? [{t:'home', i:BarChart3, l:'Lineup Trends'}] : []), 
            {t:'settings', i:SettingsIcon, l:'Config'}
          ].map(tab => (
            <button key={tab.t} onClick={() => { setActiveTab(tab.t); setSelectedGameId(null); }} className={`flex flex-col items-center gap-2 transition-all ${activeTab === tab.t ? 'text-emerald-600 scale-110' : 'text-slate-300'}`}>
              <tab.i className="w-8 h-8" />
              <span className="text-[10px] font-bold tracking-wide leading-none">{tab.l}</span>
            </button>
          ))}
        </nav>
      </div>
      <PrintView selectedGame={selectedGame} players={players} seasonConfig={seasonConfig} />
    </>
  );
}
