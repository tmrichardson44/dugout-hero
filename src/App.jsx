import React, { useState, useMemo, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { 
  Users, ClipboardList, BarChart3, ChevronRight, ChevronLeft, 
  Settings as SettingsIcon, Plus, X, Wand2, RotateCcw, 
  Trash2, MapPin, Clock, Home, Navigation, Target, 
  FileText, Printer, Check, UserMinus, CheckCircle2, Info, Save, Edit2, CalendarDays
} from 'lucide-react';

// --- FIREBASE INFRASTRUCTURE ---
import { db, auth } from './firebase';
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'dugout-hero-v18';

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

const INITIAL_PLAYERS = [
  { id: 1, name: "Collin Marchand", number: "10", throws: "R", bats: "R", willPitch: true, willCatch: false },
  { id: 2, name: "Finn Panciera", number: "12", throws: "R", bats: "L", willPitch: true, willCatch: true },
  { id: 3, name: "Jake Gibbs", number: "5", throws: "R", bats: "R", willPitch: false, willCatch: true }
];

const INITIAL_CONFIG = {
  teamName: "Padres",
  totalGames: 12,
  rosterSize: 13,
  innings: 6,
  battingTarget: 6.5,
  enabledPositions: ["P", "C", "1B", "2B", "3B", "SS", "LF", "LC", "CF", "RC", "RF"]
};

// --- LOGO COMPONENT (ANTI-GRAVITY) ---
function GreenDiamondLogo() {
  return (
    <div className="relative flex items-center justify-center mr-2">
      <div className="animate-float">
        <svg viewBox="0 0 24 24" className="w-10 h-10 fill-emerald-500 drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
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
    ? "bg-white p-4 sm:p-8 w-full border-2 border-slate-200 rounded-[40px] shadow-inner overflow-x-auto mt-4" 
    : "hidden print:block bg-white p-8 w-full h-full text-slate-900 font-sans";

  return (
    <div id={inline ? "inline-preview" : "printable-area"} className={containerClass}>
      <div className="min-w-[800px]">
        <div className="flex justify-between items-end border-b-[10px] border-black pb-2 print:border-b-[6px] mb-6 print:mb-3">
          <div>
            <h1 className="text-6xl print:text-5xl font-black uppercase tracking-tighter leading-none">{seasonConfig.teamName}</h1>
            <p className="text-2xl print:text-xl font-bold text-slate-500 uppercase mt-2 print:mt-1 tracking-widest leading-none">{headerTitle} • {selectedGame.date}</p>
          </div>
          <div className="text-right border-l-4 border-black pl-6 print:pl-4 print:border-l-2">
            <p className="text-xl print:text-lg font-black uppercase tracking-widest mb-2 print:mb-1 leading-none">{selectedGame.time}</p>
            <p className="text-lg print:text-base font-bold text-slate-400 uppercase leading-none">{selectedGame.location}</p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="bg-black text-white text-center py-2 print:py-1 font-black uppercase text-sm print:text-xs tracking-widest mb-4 print:mb-2 border-2 border-black">Lineup & Defensive Rotation</h2>
          <table className="w-full border-[6px] print:border-[4px] border-black text-center border-collapse">
            <thead className="bg-slate-200">
              <tr>
                <th className="p-3 print:p-1.5 border-2 border-black text-xs font-black uppercase text-center w-12 print:w-8">#</th>
                <th className="p-3 print:p-1.5 border-2 border-black text-xs font-black uppercase text-left w-64 print:w-48">Player</th>
                {Array.from({ length: seasonConfig.innings || 6 }).map((_, i) => <th key={i} className="p-3 print:p-1.5 border-2 border-black text-xs font-black uppercase text-[10px]">Inn {i + 1}</th>)}
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
                  <tr key={idx} className="border-b-2 border-black">
                    <td className="p-3 print:p-1.5 border-2 border-black text-center font-black text-xl print:text-base text-slate-400">{item.slot}</td>
                    <td className="p-3 print:p-1.5 border-2 border-black text-left font-black text-xl print:text-base bg-slate-50 whitespace-nowrap uppercase tracking-tighter leading-none">{item.player ? item.player.name : '—'}</td>
                    {Array.from({ length: seasonConfig.innings || 6 }).map((_, inn) => {
                      if (!item.player) return <td key={inn} className="p-3 print:p-1.5 border-2 border-black bg-slate-50"></td>;
                      const pos = selectedGame.field?.[inn]?.[item.player.id] || '-';
                      const isBench = pos === 'Bench' || pos === 'B';
                      return <td key={inn} className={`p-3 print:p-1.5 border-2 border-black font-black text-2xl print:text-lg ${isBench ? 'text-slate-300' : ''}`}>{isBench ? 'B' : pos}</td>;
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
      {!inline && (
        <style>{`
          @media print {
            @page { size: landscape; margin: 0.5cm; }
            body { visibility: hidden !important; background: white !important; }
            nav, header, button, .no-print { display: none !important; }
            #printable-area { visibility: visible !important; display: block !important; position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
            #printable-area * { visibility: visible !important; }
          }
        `}</style>
      )}
    </div>
  );
}

function SeasonSettingsView({ seasonConfig, onSave }) {
  const [draft, setDraft] = useState(seasonConfig);
  const [isSaved, setIsSaved] = useState(false);
  
  const handleSave = () => { 
    onSave(draft); 
    setIsSaved(true); 
    setTimeout(() => setIsSaved(false), 2000); 
  };

  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-200 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center"><SettingsIcon className="w-6 h-6 text-emerald-600" /></div>
            <div><h2 className="text-xl font-black text-slate-900 uppercase">Season Setup</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Configure Team Framework</p></div>
          </div>
          {isSaved && (<div className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-4 py-2 rounded-full border border-emerald-100 animate-bounce">SAVED</div>)}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Name</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4 font-black text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all" value={draft.teamName} onChange={(e) => setDraft({...draft, teamName: e.target.value})} />
          </div>

          <div className="bg-slate-50 p-6 rounded-[32px] space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Roster Size</label>
                <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-black outline-none" value={draft.rosterSize} onChange={(e) => setDraft({...draft, rosterSize: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Innings</label>
                <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-black outline-none" value={draft.innings || 6} onChange={(e) => setDraft({...draft, innings: parseInt(e.target.value) || 6})} />
              </div>
            </div>
            <div className="bg-emerald-600/5 p-5 rounded-2xl border border-emerald-100 flex gap-4">
              <Target className="w-6 h-6 text-emerald-600 shrink-0" />
              <p className="text-[10px] font-bold text-emerald-900 leading-relaxed uppercase">Optimal batting averages are calculated automatically based on your roster size.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Rotation Positions</h3>
          <div className="grid grid-cols-3 gap-2">
            {MASTER_POSITIONS.map(pos => {
              const active = draft.enabledPositions.includes(pos.id);
              return (
                <button key={pos.id} onClick={() => {
                  const next = active ? draft.enabledPositions.filter(id => id !== pos.id) : [...draft.enabledPositions, pos.id];
                  setDraft({...draft, enabledPositions: next});
                }} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${active ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-300 opacity-60'}`}>
                  <div className="font-black text-xs">{pos.id}</div>
                  {active ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                </button>
              );
            })}
          </div>
        </div>
        
        <button onClick={handleSave} className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest">
          <Save className="w-6 h-6" /> Save Seasonal Framework
        </button>
      </div>
    </div>
  );
}

function TeamView({ players, onAddPlayer, onEditPlayer, onDeletePlayer }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", throws: "R", bats: "R", willPitch: false, willCatch: false });

  const startAdd = () => {
    setEditingId(null);
    setNewPlayer({ name: "", number: "", throws: "R", bats: "R", willPitch: false, willCatch: false });
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
    setNewPlayer({ name: "", number: "", throws: "R", bats: "R", willPitch: false, willCatch: false });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
         <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase">Roster</h2>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mt-1">{players.length} Active Players</p>
         </div>
         <button onClick={startAdd} className="bg-emerald-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-95 transition-all">
           <Plus className="w-6 h-6" />
         </button>
       </div>

       {isAdding && (
         <div className="bg-white p-6 rounded-[32px] border-2 border-emerald-500 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">{editingId ? 'Edit Player' : 'New Player'}</h3>
            <div className="grid grid-cols-4 gap-4">
               <div className="col-span-3 space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Name</label>
                 <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-black text-slate-700 outline-none focus:border-emerald-500 uppercase" placeholder="Player Name" value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} />
               </div>
               <div className="col-span-1 space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">#</label>
                 <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-black text-slate-700 outline-none focus:border-emerald-500 text-center" placeholder="00" value={newPlayer.number} onChange={(e) => setNewPlayer({...newPlayer, number: e.target.value})} />
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Throws</label>
                 <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-black text-slate-700 outline-none focus:border-emerald-500 appearance-none" value={newPlayer.throws} onChange={(e) => setNewPlayer({...newPlayer, throws: e.target.value})}>
                    <option value="R">Right</option>
                    <option value="L">Left</option>
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Bats</label>
                 <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-black text-slate-700 outline-none focus:border-emerald-500 appearance-none" value={newPlayer.bats} onChange={(e) => setNewPlayer({...newPlayer, bats: e.target.value})}>
                    <option value="R">Right</option>
                    <option value="L">Left</option>
                    <option value="S">Switch</option>
                 </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
               <button onClick={() => setNewPlayer({...newPlayer, willPitch: !newPlayer.willPitch})} className={`py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${newPlayer.willPitch ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Pitcher</button>
               <button onClick={() => setNewPlayer({...newPlayer, willCatch: !newPlayer.willCatch})} className={`py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${newPlayer.willCatch ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Catcher</button>
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl uppercase text-xs tracking-widest">Cancel</button>
              <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-emerald-200">Save</button>
            </div>
         </div>
       )}

       <div className="space-y-3">
         {players.map(p => (
           <div key={p.id} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center justify-between group">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center font-black text-emerald-600 border border-emerald-100 text-lg shadow-inner">{p.number}</div>
               <div>
                  <p className="font-black text-slate-900 text-lg uppercase tracking-tighter leading-none mb-1">{p.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex gap-2">
                    <span>T: {p.throws}</span> • <span>B: {p.bats}</span>
                    {(p.willPitch || p.willCatch) && <span>•</span>}
                    {p.willPitch && <span className="text-indigo-500">P</span>}
                    {p.willCatch && <span className="text-rose-500">C</span>}
                  </p>
               </div>
             </div>
             <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
               <button onClick={() => startEdit(p)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                  <Edit2 className="w-5 h-5" />
               </button>
               <button onClick={() => onDeletePlayer(p.firebaseId, p.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
               </button>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [activeTab, setActiveTab] = useState('games'); 
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [gameSubTab, setGameSubTab] = useState('matrix'); 
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [seasonConfig, setSeasonConfig] = useState(INITIAL_CONFIG);

  // 1. Firebase Auth with Exponential Backoff Retries
  useEffect(() => {
    let timeoutId;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth fail", err);
        // If auth completely fails (e.g. they didn't enable Anonymous auth), still let the app load
        setIsLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Give it a fallback to stop loading if listeners don't fire quickly
      if (!user) timeoutId = setTimeout(() => setIsLoading(false), 3000);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user) return;
    const base = (col) => collection(db, 'artifacts', appId, 'public', 'data', col);
    const configDoc = doc(db, 'artifacts', appId, 'public', 'data', 'seasonConfig', 'current');

    const unsubP = onSnapshot(base('players'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
      setPlayers(data);
      if (snap.empty && isLoading) {
         INITIAL_PLAYERS.forEach(p => addDoc(base('players'), p).catch(console.error));
      }
      setIsLoading(false);
    }, (err) => {
       console.error("Players sync fail", err);
       setIsLoading(false);
    });

    const unsubG = onSnapshot(base('games'), (snap) => {
      setGames(snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })));
    }, (err) => console.error("Games sync fail", err));

    const unsubC = onSnapshot(configDoc, (snap) => {
      if (snap.exists()) {
        setSeasonConfig(snap.data());
      } else {
        setDoc(configDoc, INITIAL_CONFIG).catch(console.error);
      }
    }, (err) => console.error("Config sync fail", err));

    return () => { unsubP(); unsubG(); unsubC(); };
  }, [user]);


  // Derived Helpers
  const selectedGame = useMemo(() => games.find(g => g.id === selectedGameId), [games, selectedGameId]);
  const activePositions = useMemo(() => MASTER_POSITIONS.filter(pos => seasonConfig.enabledPositions?.includes(pos.id)), [seasonConfig]);
  const playersPresent = useMemo(() => players.filter(p => !selectedGame?.absentPlayerIds?.includes(p.id)), [players, selectedGame]);

  const seasonStats = useMemo(() => {
    return players.map(player => {
      let totalPos = 0, gameCount = 0;
      games.forEach(game => {
        if (game.absentPlayerIds?.includes(player.id)) return;
        const entry = Object.entries(game.battingOrder || {}).find(([pos, id]) => parseInt(id) === player.id);
        if (entry) { totalPos += parseInt(entry[0]); gameCount++; }
      });
      return { ...player, avg: gameCount > 0 ? (totalPos / gameCount) : 0, gameCount };
    });
  }, [games, players]);

  // Handlers
  const handleUpdateGame = async (fields) => {
    if (!selectedGame || !user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', selectedGame.firebaseId), fields);
  };

  const autoGenerateField = async () => {
    if (!selectedGame || playersPresent.length === 0 || !user) return;
    let nF = {};
    const tracker = playersPresent.map(p => ({ id: p.id, sat: 0, last: null, willPitch: p.willPitch, willCatch: p.willCatch }));
    const fIds = activePositions.map(p => p.id);
    for (let inn = 0; inn < (seasonConfig.innings || 6); inn++) {
      let cur = {}; let asgIds = new Set(); let pool = [...fIds];
      if (fIds.includes("P")) {
        const pCand = tracker.filter(p => p.willPitch && p.last !== 'P' && !asgIds.has(p.id)).sort(() => Math.random() - 0.5)[0];
        if (pCand) { cur[pCand.id] = "P"; pCand.last = "P"; asgIds.add(pCand.id); pool = pool.filter(x => x !== "P"); }
      }
      if (fIds.includes("C")) {
        const cCand = tracker.filter(p => p.willCatch && p.last !== 'C' && !asgIds.has(p.id)).sort(() => Math.random() - 0.5)[0];
        if (cCand) { cur[cCand.id] = "C"; cCand.last = "C"; asgIds.add(cCand.id); pool = pool.filter(x => x !== "C"); }
      }
      const bLimit = Math.max(0, playersPresent.length - activePositions.length);
      tracker.filter(p => !asgIds.has(p.id)).sort((a,b) => a.sat - b.sat || Math.random() - 0.5).slice(0, bLimit).forEach(p => { cur[p.id] = "Bench"; p.sat++; p.last = "Bench"; asgIds.add(p.id); });
      tracker.filter(p => !asgIds.has(p.id)).sort(() => Math.random() - 0.5).forEach(p => { const pos = pool.shift(); if (pos) { cur[p.id] = pos; p.last = pos; } else { cur[p.id] = "Bench"; p.sat++; } });
      nF[inn] = cur;
    }
    await handleUpdateGame({ field: nF });
  };

  const autoGenerateOrder = async () => {
    if (!selectedGame || playersPresent.length === 0 || !user) return;
    
    // Sort players by their season average (lowest first, meaning they get the first spots in the order).
    const sortedPlayers = [...playersPresent].sort((a, b) => {
      const statA = seasonStats.find(s => s.id === a.id);
      const statB = seasonStats.find(s => s.id === b.id);
      const avgA = statA?.gameCount > 0 ? statA.avg : seasonConfig.battingTarget;
      const avgB = statB?.gameCount > 0 ? statB.avg : seasonConfig.battingTarget;
      
      // Randomize if exactly the same average (like first game of the season)
      if (avgA === avgB) return Math.random() - 0.5;
      return avgA - avgB;
    });

    const newOrder = {};
    sortedPlayers.forEach((p, idx) => {
      newOrder[idx + 1] = p.id.toString();
    });

    await handleUpdateGame({ battingOrder: newOrder });
  };

  const handleAddPlayer = async (newPlayer) => {
    const p = { ...newPlayer, id: Date.now() };
    if (user) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'players'), p);
  };

  const handleEditPlayer = async (updatedPlayer) => {
    if (user && updatedPlayer.firebaseId) {
      const { firebaseId, ...fieldsToUpdate } = updatedPlayer;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', updatedPlayer.firebaseId), fieldsToUpdate);
    }
  };

  const handleDeletePlayer = async (firebaseId, id) => {
    if (user && firebaseId) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', firebaseId));
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      <GreenDiamondLogo />
      <div className="w-16 h-16 border-[6px] border-emerald-600 border-t-transparent rounded-full animate-spin mt-4"></div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 no-print">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-4 py-5 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            {selectedGameId ? (
              <button onClick={() => setSelectedGameId(null)} className="p-2 hover:bg-slate-100 rounded-2xl text-emerald-600"><ChevronLeft className="w-7 h-7" /></button>
            ) : (
              <div className="flex items-center">
                <GreenDiamondLogo />
                <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Dugout Hero <span className="text-emerald-600">PRO</span></h1>
              </div>
            )}
          </div>
          <div className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-4 py-2 rounded-full border border-emerald-100 flex items-center gap-2">
             <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div> CLOUD SYNCED
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {activeTab === 'home' && (
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 uppercase">Batting Order Average</h2>
              <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">Target: {((seasonConfig.rosterSize || 12) / 2) - 1} - {((seasonConfig.rosterSize || 12) / 2) + 0.75}</div>
            </div>
            <div className="space-y-4">
              {seasonStats.map(p => {
                const targetMin = ((seasonConfig.rosterSize || 12) / 2) - 1;
                const targetMax = ((seasonConfig.rosterSize || 12) / 2) + 0.75;
                const isOptimal = p.gameCount > 0 ? (p.avg >= targetMin && p.avg <= targetMax) : true;
                return (
                  <div key={p.id} className="flex items-center justify-between border-b border-slate-50 pb-4">
                     <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 border border-slate-100">{p.number}</div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none mb-1">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.gameCount} Games Active</p>
                        </div>
                     </div>
                     <p className={`text-2xl font-black ${isOptimal ? 'text-emerald-600' : 'text-rose-500'}`}>{p.avg.toFixed(1)}</p>
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
              addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'games'), newGame);
            }} className="w-full bg-emerald-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all"><Plus /> New Game</button>
            {games.map((g, index) => (
              <button key={g.id} onClick={() => setSelectedGameId(g.id)} className="w-full bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-400 transition-all text-left group">
                <div>
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                     <span>Game {index + 1}</span>
                     <span className="text-slate-300">•</span>
                     <span className={`${g.isHome ? 'text-indigo-500' : 'text-slate-400'}`}>{g.isHome ? 'Home' : 'Away'}</span>
                   </p>
                   <p className="font-black text-slate-900 text-xl tracking-tighter uppercase mb-1">{g.opponent}</p>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span>{g.date || 'TBD Date'}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                      <span>{g.time || 'TBD Time'}</span>
                   </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  <ChevronRight className="text-slate-300 w-5 h-5 group-hover:text-emerald-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedGameId && (
           <div className="space-y-4">
              {/* Game Settings Header */}
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-4">
                     <button onClick={() => handleUpdateGame({ isHome: !selectedGame.isHome })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedGame.isHome ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                       {selectedGame.isHome ? 'Home' : 'Away'}
                     </button>
                     <input className="font-black text-2xl text-slate-900 uppercase tracking-tighter w-full outline-none placeholder:text-slate-300" placeholder="Opponent Name" value={selectedGame.opponent} onChange={(e) => handleUpdateGame({ opponent: e.target.value })} />
                  </div>
                  <button onClick={() => {
                     if(window.confirm('Delete this game?')) {
                        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', selectedGame.firebaseId));
                        setSelectedGameId(null);
                     }
                  }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                     <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                     <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                     <input className="bg-transparent font-bold text-slate-700 outline-none w-full text-sm placeholder:text-slate-300" placeholder="Date (e.g. Oct 12)" value={selectedGame.date || ''} onChange={(e) => handleUpdateGame({ date: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                     <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                     <input className="bg-transparent font-bold text-slate-700 outline-none w-full text-sm placeholder:text-slate-300" placeholder="Time (e.g. 6:00 PM)" value={selectedGame.time || ''} onChange={(e) => handleUpdateGame({ time: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                     <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                     <input className="bg-transparent font-bold text-slate-700 outline-none w-full text-sm placeholder:text-slate-300" placeholder="Location" value={selectedGame.location || ''} onChange={(e) => handleUpdateGame({ location: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 p-2 bg-white rounded-3xl border border-slate-100 shadow-sm">
                 {['matrix', 'order', 'preview'].map(t => (
                   <button key={t} onClick={() => setGameSubTab(t)} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${gameSubTab === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 bg-slate-50'}`}>{t === 'matrix' ? 'Fielding' : t === 'order' ? 'Batting' : 'Sheet'}</button>
                 ))}
              </div>

              {gameSubTab === 'matrix' && (
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-left-4 duration-300">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Fielding Rotation</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assign defensive positions</p>
                     </div>
                     <button onClick={autoGenerateField} className="bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-colors active:scale-95">
                       <Wand2 className="w-4 h-4" /> Auto-Balance
                     </button>
                  </div>
                  <div className="overflow-x-auto -mx-6 px-6 pb-4">
                    <table className="w-full min-w-[600px] border-separate border-spacing-y-2">
                       <thead>
                         <tr>
                           <th className="text-left py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Player</th>
                           {Array.from({ length: seasonConfig.innings || 6 }).map((_, inn) => {
                             const assignmentsThisInning = Object.values(selectedGame.field?.[inn] || {});
                             const missingPositions = activePositions.filter(pos => !assignmentsThisInning.includes(pos.id)).map(p => p.id);
                             const isMissing = missingPositions.length > 0;
                             const tooltipText = isMissing ? `Missing: ${missingPositions.join(', ')}` : '';
                             return (
                               <th key={inn} title={tooltipText} className={`py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isMissing ? 'text-rose-500 animate-pulse cursor-help' : 'text-slate-400'}`}>Inn {inn + 1}</th>
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
                                      handleUpdateGame({ absentPlayerIds: nextAbsent });
                                    }} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isAbsent ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'}`}>
                                      {isAbsent ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <div>
                                      <p className="font-black text-sm text-slate-900 uppercase leading-none">{p.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 leading-none mt-1">#{p.number}</p>
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

                                 let dropdownStyle = 'bg-white border-slate-100 text-slate-300';
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
                                          handleUpdateGame({ field: newField });
                                        }}
                                        className={`w-full appearance-none text-center py-3 rounded-2xl font-black text-xs outline-none transition-colors border-2 ${dropdownStyle}`}
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
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Batting Order</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set your lineup (1-{Math.max(playersPresent.length, seasonConfig.rosterSize || 15)})</p>
                     </div>
                     <button onClick={autoGenerateOrder} className="bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-colors active:scale-95">
                       <Wand2 className="w-4 h-4" /> Auto-Balance
                     </button>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: Math.max(playersPresent.length, seasonConfig.rosterSize || 15) }).map((_, idx) => {
                       const pId = selectedGame.battingOrder?.[idx + 1];
                       const pObj = pId ? players.find(p => p.id === parseInt(pId)) : null;
                       const statObj = pObj ? seasonStats.find(s => s.id === pObj.id) : null;
                       const diff = statObj ? (statObj.avg - seasonConfig.battingTarget) : 0;
                       
                       return (
                         <div key={idx} className="flex gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div className="w-10 text-center font-black text-slate-300 text-xl">{idx + 1}</div>
                            <select 
                               value={pId || ''}
                               onChange={(e) => {
                                 const newOrder = JSON.parse(JSON.stringify(selectedGame.battingOrder || {}));
                                 if(!e.target.value) delete newOrder[idx + 1];
                                 else newOrder[idx + 1] = e.target.value;
                                 handleUpdateGame({ battingOrder: newOrder });
                               }}
                               className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-black text-sm uppercase text-slate-700 outline-none focus:border-emerald-500 appearance-none shadow-sm"
                            >
                               <option value="">-- Empty Slot --</option>
                               {playersPresent.map(p => {
                                 const isUsed = Object.values(selectedGame.battingOrder || {}).includes(p.id.toString()) && pId !== p.id.toString();
                                 return <option key={p.id} value={p.id} disabled={isUsed}>{p.name} {isUsed ? '(Selected)' : ''}</option>;
                               })}
                            </select>
                            {statObj && (
                               <div className="w-20 text-right pr-2 hidden sm:block">
                                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Avg</p>
                                  <p className={`font-black text-sm ${Math.abs(diff) < 1.2 ? 'text-emerald-500' : 'text-rose-400'}`}>{statObj.avg.toFixed(1)}</p>
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
                  <div className="flex justify-between items-center bg-indigo-600 p-6 rounded-[32px] shadow-xl mb-4">
                    <div><p className="text-white font-black uppercase text-sm leading-none">Lineup Sheet</p><p className="text-indigo-200 text-[10px] font-bold uppercase mt-1">Ready for Print</p></div>
                    <button onClick={() => window.print()} className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-black text-xs shadow-lg active:scale-90 transition-all flex items-center gap-2"><Printer className="w-4 h-4" /> EXPORT PDF</button>
                  </div>
                  <PrintView selectedGame={selectedGame} players={players} seasonConfig={seasonConfig} inline={true} />
                </div>
              )}

              <div className="pt-4 pb-2">
                <button onClick={() => setSelectedGameId(null)} className="w-full bg-emerald-600 text-white font-black py-5 rounded-[32px] shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 uppercase text-sm tracking-widest active:scale-95 transition-all">
                  <CheckCircle2 className="w-6 h-6" /> Save Game
                </button>
              </div>
           </div>
        )}

        {activeTab === 'settings' && <SeasonSettingsView seasonConfig={seasonConfig} onSave={c => {
          setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'seasonConfig', 'current'), c);
        }} />}

        {activeTab === 'team' && <TeamView players={players} onAddPlayer={handleAddPlayer} onEditPlayer={handleEditPlayer} onDeletePlayer={handleDeletePlayer} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 py-4 px-6 flex justify-around items-center z-[60] shadow-lg no-print">
        {[{t:'games', i:ClipboardList, l:'Games'}, {t:'team', i:Users, l:'Team'}, {t:'home', i:BarChart3, l:'Lineup Trends'}, {t:'settings', i:SettingsIcon, l:'Setup'}].map(tab => (
          <button key={tab.t} onClick={() => { setActiveTab(tab.t); setSelectedGameId(null); }} className={`flex flex-col items-center gap-2 transition-all ${activeTab === tab.t ? 'text-emerald-600 scale-110' : 'text-slate-300'}`}>
            <tab.i className="w-8 h-8" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">{tab.l}</span>
          </button>
        ))}
        </nav>
      </div>
      <PrintView selectedGame={selectedGame} players={players} seasonConfig={seasonConfig} />
    </>
  );
}
