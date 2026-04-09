import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  collection, doc, onSnapshot, query, where,
  getDocs, addDoc, updateDoc, getDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Plus, Users, BarChart3, ChevronRight,
  X, Mail, ShieldCheck, Trophy, TrendingUp, Trash2, Layers, Settings, Clock, Check, CheckCircle2, Scale, Layout
} from 'lucide-react';

const SAAS_ROOT = 'saas_data';
const SAAS_VERSION = 'v1';

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

// ── Inline stat bars ────────────────────────────────────────────────────────
function AvgBar({ avg, target, low, high }) {
  if (!avg) return <span className="text-slate-300 text-[10px] font-bold uppercase tracking-wider">No data</span>;
  const pct = Math.min(100, Math.max(0, ((avg - low) / (high - low)) * 100));
  const onTarget = avg >= low && avg <= high;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-full h-1.5 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${onTarget ? 'bg-emerald-500' : 'bg-rose-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold w-8 text-right tabular-nums ${onTarget ? 'text-emerald-600' : 'text-rose-500'}`}>
        {avg.toFixed(1)}
      </span>
    </div>
  );
}

function PctBar({ pct }) {
  if (pct === null) return <span className="text-slate-300 text-[10px] font-bold uppercase tracking-wider">No data</span>;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-full h-1.5 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold w-8 text-right tabular-nums ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ── Team card in division view ─────────────────────────────────────────────────
function DivisionTeamCard({ team, players, games, onOpenLineup, onAssignCoach, onDeleteTeam, isAdmin, usersMap, divisionName, divisions }) {
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [assignCoachMode, setAssignCoachMode] = useState('existing');
  const [selectedCoachUid, setSelectedCoachUid] = useState(team.managerUid || '');
  const [coachEmail, setCoachEmail] = useState(team.coachEmail || '');
  const [saving, setSaving] = useState(false);
  const [coachErr, setCoachErr] = useState('');

  const coachUser = usersMap?.[team.managerUid] || Object.values(usersMap || {}).find(u => u.email === team.coachEmail);
  const displayCoachName = coachUser?.displayName || team.coachName || team.coachEmail || coachUser?.email || (team.managerUid ? 'Coach' : null);
  const hasCoach = !!displayCoachName;

  const target = team.seasonSettings?.battingTarget || 6.5;
  const rosterSize = team.seasonSettings?.rosterSize || 12;

  const playerStats = useMemo(() => {
    return players.map(player => {
      let total = 0, count = 0;
      games.forEach(game => {
        if (game.absentPlayerIds?.includes(player.id)) return;
        const entry = Object.entries(game.battingOrder || {}).find(([, id]) => parseInt(id) === player.id);
        if (entry) { total += parseInt(entry[0]); count++; }
      });
      return { ...player, avg: count > 0 ? total / count : null, gameCount: count };
    });
  }, [players, games]);

  const teamAlignmentPct = useMemo(() => {
    const valid = playerStats.filter(p => p.avg !== null && p.gameCount > 0);
    if (!valid.length) return null;
    
    // Average games played by the roster
    const avgGames = valid.reduce((sum, p) => sum + p.gameCount, 0) / valid.length;
    if (avgGames < 0.5) return null;
    
    // Calculate average absolute deviation from target
    const maxDeviation = rosterSize / 4; 
    const totalDeviation = valid.reduce((sum, p) => sum + Math.abs(p.avg - target), 0);
    const avgDeviation = totalDeviation / valid.length;
    
    // Base score: 100% if 0 deviation, 0% if worst-case deviation
    const rawScore = 100 * Math.max(0, 1 - (avgDeviation / maxDeviation));
    
    // Leniency factor adds normalized buffer based on games played
    // 1 game = +100% buffer (since 1 game deviation mathematically is huge)
    // 5 games = +20% buffer
    const leniency = 100 / avgGames;
    
    return Math.min(100, rawScore + leniency);
  }, [playerStats, target, rosterSize]);

  const handleSaveCoach = async () => {
    setSaving(true);
    setCoachErr('');
    try {
      let finalUid = null;
      let finalEmail = '';
      let finalName = null;

      if (assignCoachMode === 'existing') {
        const u = usersMap[selectedCoachUid];
        if (!u) throw new Error("Please select a coach.");
        finalUid = u.uid;
        finalEmail = u.email;
        finalName = u.displayName || null;
      } else {
        if (!coachEmail.trim()) throw new Error("Please enter an email address.");
        finalEmail = coachEmail.trim().toLowerCase();
        const q = query(collection(db, 'users'), where('email', '==', finalEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
           finalUid = snap.docs[0].data().uid;
           finalName = snap.docs[0].data().displayName || null;
        }
      }

      await onAssignCoach(team.id, finalEmail, finalUid, finalName);
      setShowCoachModal(false);
    } catch (err) {
      setCoachErr('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const getDivisionTheme = (name) => {
    if (!name || name === 'No Division') return 'div-theme-slate';
    const lower = name.toLowerCase().trim();
    
    // Explicit mapping for predictable colors
    if (lower.includes('minor')) return 'div-theme-rose';    // Minors = Red/Rose
    if (lower.includes('farm'))  return 'div-theme-blue';    // Farm = Blue
    if (lower.includes('major')) return 'div-theme-emerald'; // Majors = Green
    if (lower.includes('ball') || lower.includes('tball')) return 'div-theme-amber';
    
    const themes = ['indigo', 'violet', 'rose', 'blue', 'amber', 'emerald'];
    // Deterministic hash based on name
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
      hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return `div-theme-${themes[index]}`;
  };

  const themeClass = getDivisionTheme(divisionName);

  return (
    <div className={`card-premium group overflow-hidden transition-all duration-300 border-l-[6px] ${themeClass}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
           <div className="flex items-center gap-3">
               <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm border ${themeClass}`}>
                  <Trophy className="w-4.5 h-4.5" />
               </div>
              <div>
                <h3 className="font-semibold text-slate-800 leading-tight text-sm">{team.name}</h3>
                <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5 uppercase">
                  {players.length} PLRS · {games.length} GMS
                </p>
              </div>
           </div>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setShowCoachModal(true)} title="Assign Coach" className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center hover:bg-slate-50 hover:text-slate-500 transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDeleteTeam(team.id)} title="Delete Team" className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {hasCoach ? (
          <div className={`flex items-center gap-2 px-2 py-1 rounded border mb-4 inline-flex ${themeClass}`}>
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[9px] font-bold tracking-widest uppercase truncate max-w-[120px]">{displayCoachName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 text-slate-400 px-2 py-1 rounded border border-slate-100 mb-4 inline-flex">
            <Mail className="w-3 h-3" />
            <span className="text-[9px] font-bold tracking-widest uppercase">Unassigned</span>
          </div>
        )}

        <div className="space-y-1.5 border-t border-slate-50 pt-4">
          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">Lineup Alignment</span>
            <span className="text-slate-300">Target: 100%</span>
          </div>
          <PctBar pct={teamAlignmentPct} />
        </div>
      </div>

      <div className="px-6 pb-6 pt-2">
        <button
          onClick={() => onOpenLineup(team.id)}
          className="w-full bg-slate-50 text-slate-500 font-bold text-[10px] tracking-wide py-3 rounded-lg border border-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center justify-center gap-2 uppercase"
        >
          <BarChart3 className="w-4 h-4" /> View Full Stats
        </button>
      </div>

      {showCoachModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-lg p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-widest">Team Settings</h3>
              <button onClick={() => setShowCoachModal(false)} className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-5">
              <button onClick={() => setAssignCoachMode('existing')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${assignCoachMode === 'existing' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Existing User</button>
              <button onClick={() => setAssignCoachMode('invite')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${assignCoachMode === 'invite' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Invite via Email</button>
            </div>

            {assignCoachMode === 'existing' ? (
              <div className="mb-5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Manager</label>
                <select 
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs appearance-none cursor-pointer"
                  value={selectedCoachUid}
                  onChange={e => setSelectedCoachUid(e.target.value)}
                >
                  <option value="">— Choose a User —</option>
                  {Object.values(usersMap || {}).map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName || u.email} ({u.email})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Manager Email</label>
                <input
                  type="email"
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs"
                  placeholder="manager@example.com"
                  value={coachEmail}
                  onChange={e => setCoachEmail(e.target.value)}
                />
              </div>
            )}

            <div className="mb-5 border-t border-slate-100 pt-5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Move to Division</label>
              <select
                className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs cursor-pointer"
                value={team.divisionId || ''}
                onChange={(e) => {
                  onAssignCoach(team.id, team.coachEmail, team.managerUid, team.coachName, e.target.value);
                }}
              >
                <option value="">No Division</option>
                <option disabled>Select division...</option>
                {(divisions || []).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {coachErr && <p className="text-rose-500 text-[10px] font-bold mb-4 uppercase tracking-widest">{coachErr}</p>}

            <button
              onClick={handleSaveCoach}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-[10px] tracking-widest uppercase transition-all shadow-sm disabled:opacity-50 mt-2"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Full team stats modal ───────────────────────────────────────────────────
function TeamStatsModal({ team, players, games, onClose }) {
  if (!team) return null;
  const rosterSize = team.seasonSettings?.rosterSize || 12;
  const low  = (rosterSize / 2) - 1;
  const high = (rosterSize / 2) + 0.75;

  const playerStats = players.map(player => {
    let total = 0, count = 0;
    games.forEach(game => {
      if (game.absentPlayerIds?.includes(player.id)) return;
      const entry = Object.entries(game.battingOrder || {}).find(([, id]) => parseInt(id) === player.id);
      if (entry) { total += parseInt(entry[0]); count++; }
    });
    return { ...player, avg: count > 0 ? total / count : null, gameCount: count };
  }).sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{team.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 tracking-wide mt-1">TARGET: {low.toFixed(1)}–{high.toFixed(1)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-8 pt-4 space-y-4">
          {playerStats.length === 0 && (
            <p className="text-slate-400 font-bold text-sm text-center py-8">No lineup data yet.</p>
          )}
          {playerStats.map(p => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center font-bold text-emerald-600 text-sm shrink-0">{p.number}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm leading-none mb-2">{p.name}</p>
                <AvgBar avg={p.avg} target={(low + high) / 2} low={low} high={high} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{p.gameCount} games</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Division Dashboard ────────────────────────────────────────────────────
export default function ProDivisionDashboard() {
  const { divisionId } = useParams();
  const { currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [division, setDivision] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamData, setTeamData] = useState({});
  const [allLeagueTeams, setAllLeagueTeams] = useState([]);
  const [allDivisions, setAllDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addTeamSearch, setAddTeamSearch] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [usersMap, setUsersMap] = useState({});

  const [filterSeason, setFilterSeason] = useState('All Seasons');
  const [filterYear, setFilterYear] = useState('All Years');
  
  const [isEditingControls, setIsEditingControls] = useState(false);
  const [controlsDraft, setControlsDraft] = useState({});

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const map = {};
      snap.forEach(d => map[d.id] = d.data());
      setUsersMap(map);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!divisionId || !currentUser) return;
    const unsub = onSnapshot(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', divisionId), async snap => {
      if (!snap.exists()) { navigate('/pro/dashboard'); return; }
      const data = snap.data();
      
      let hasAccess = false;
      if (isSuperAdmin() || data.adminUid === currentUser.uid) {
        hasAccess = true;
      } else if (data.leagueId) {
        const leagueSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', data.leagueId));
        if (leagueSnap.exists() && leagueSnap.data().adminUid === currentUser.uid) hasAccess = true;
      }

      if (!hasAccess) {
        alert('Access denied.'); navigate('/pro/dashboard'); return;
      }
      
      let dData = { id: snap.id, ...data };
      if (data.leagueId) {
        try {
          const lSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', data.leagueId));
          if (lSnap.exists()) dData.leagueName = lSnap.data().name;
        } catch (e) {
          console.error('Failed to fetch parent league', e);
        }
      }
      setDivision(dData);
    });
    return unsub;
  }, [divisionId, currentUser, navigate, isSuperAdmin]);

  useEffect(() => {
    if (!divisionId) return;
    const unsub = onSnapshot(
      query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('divisionId', '==', divisionId)),
      snap => {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, [divisionId]);

  useEffect(() => {
    if (!division?.leagueId) return;
    getDocs(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('leagueId', '==', division.leagueId || 'unknown')))
      .then(snap => setAllLeagueTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    getDocs(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'divisions'), where('leagueId', '==', division.leagueId || 'unknown')))
      .then(snap => setAllDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [division?.leagueId]);

  useEffect(() => {
    if (!teams.length) return;
    const unsubs = teams.map(team => {
      const pUnsub = onSnapshot(
        query(collection(db, SAAS_ROOT, SAAS_VERSION, 'players'), where('teamId', '==', team.id)),
        snap => setTeamData(prev => ({ ...prev, [team.id]: { ...prev[team.id], players: snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })) } }))
      );
      const gUnsub = onSnapshot(
        query(collection(db, SAAS_ROOT, SAAS_VERSION, 'games'), where('teamId', '==', team.id)),
        snap => setTeamData(prev => ({ ...prev, [team.id]: { ...prev[team.id], games: snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })) } }))
      );
      return () => { pUnsub(); gUnsub(); };
    });
    return () => unsubs.forEach(u => u());
  }, [teams]);

  const handleAssignCoach = async (teamId, coachEmail, coachUid, coachName, divId) => {
    const update = { coachEmail };
    if (coachUid !== undefined && coachUid !== null) update.managerUid = coachUid;
    if (coachName !== undefined && coachName !== null) update.coachName = coachName;
    if (divId !== undefined) update.divisionId = divId;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), update);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('PERMANENTLY DELETE this team? This cannot be undone.')) return;
    await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId));
  };

  const handleDeleteDivision = async () => {
    if (!window.confirm('PERMANENTLY DELETE this division? Teams inside will remain but lose division assignment.')) return;
    await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', divisionId));
    navigate('/pro/dashboard');
  };

  const handleUpdateControls = async () => {
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', divisionId), controlsDraft);
    setIsEditingControls(false);
  };

  const handleAddExistingTeam = async (team) => {
    setAddingTeam(true);
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', team.id), { divisionId });
    setShowAddTeam(false);
    setAddingTeam(false);
  };

  const handleCreateTeam = async () => {
    const name = window.prompt('New team name:');
    if (!name?.trim()) return;
    try {
      await addDoc(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), {
        name: name.trim(),
        leagueId: division.leagueId,
        divisionId: divisionId,
        managerUid: currentUser.uid,
        createdAt: serverTimestamp(),
        seasonSettings: {
          teamName: name.trim(), rosterSize: 12, innings: 6,
          battingTarget: 6.5, enableTrends: true,
          enabledPositions: ['P','C','1B','2B','3B','SS','LF','LC','CF','RC','RF']
        }
      });
      alert(`Team "${name}" created successfully in this division.`);
    } catch (e) {
      alert('Failed to create team: ' + e.message);
    }
  };

  const filteredTeams = allLeagueTeams.filter(t =>
    t.divisionId !== divisionId &&
    t.name.toLowerCase().includes(addTeamSearch.toLowerCase())
  );

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedTeamPlayers = teamData[selectedTeamId]?.players || [];
  const selectedTeamGames   = teamData[selectedTeamId]?.games   || [];

  const displayTeams = teams.filter(t => {
     const tSeason = t.season || 'Spring';
     const tYear = t.year || '2026';
     const matchSeason = filterSeason === 'All Seasons' || tSeason === filterSeason;
     const matchYear = filterYear === 'All Years' || tYear === filterYear;
     return matchSeason && matchYear;
  });

  const { totalPlayers, totalGames, optimalPct } = useMemo(() => {
    let pCount = 0;
    let gCount = 0;
    let validCount = 0;
    let optimalCount = 0;

    teams.forEach(team => {
      const rosterSize = team.seasonSettings?.rosterSize || 12;
      const low = (rosterSize / 2) - 1;
      const high = (rosterSize / 2) + 0.75;
      
      const tPlayers = teamData[team.id]?.players || [];
      const tGames = teamData[team.id]?.games || [];
      
      pCount += tPlayers.length;
      gCount += tGames.length;

      tPlayers.forEach(player => {
        let _total = 0, _gamesPlayed = 0;
        tGames.forEach(game => {
          if (game.absentPlayerIds?.includes(player.id)) return;
          const entry = Object.entries(game.battingOrder || {}).find(([, id]) => parseInt(id) === player.id);
          if (entry) { _total += parseInt(entry[0]); _gamesPlayed++; }
        });
        
        if (_gamesPlayed > 0) {
           const avg = _total / _gamesPlayed;
           validCount++;
           if (avg >= low && avg <= high) optimalCount++;
        }
      });
    });

    return { 
      totalPlayers: pCount, 
      totalGames: gCount, 
      optimalPct: validCount > 0 ? Math.round((optimalCount / validCount) * 100) : null 
    };
  }, [teams, teamData]);

  if (loading || !division) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <nav className="nav-header">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/pro/dashboard" className="p-1.5 hover:bg-slate-50 text-slate-300 hover:text-slate-500 rounded-lg transition-all">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div>
              <div className="text-sm font-semibold text-slate-800 leading-none">{division.name}</div>
              <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                {division.leagueName ? `${division.leagueName} · ` : ''}Division Dashboard
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
               onClick={handleDeleteDivision}
               className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-widest"
            >
              <Trash2 className="w-3 h-3" /> Delete Division
            </button>
            <button
              onClick={() => setShowAddTeam(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-widest"
            >
              <Plus className="w-3 h-3" /> Add Team
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { icon: Users,     label: 'TEAMS',   value: teams.length },
            { icon: Trophy,    label: 'PLAYERS',  value: totalPlayers },
            { icon: TrendingUp,label: 'GAMES',    value: totalGames   },
            { icon: BarChart3, label: 'OPTIMAL ALIGNMENT', value: optimalPct !== null ? `${optimalPct}%` : '--', highlight: true }
          ].map(({ icon: Icon, label, value, highlight }) => (
            <div key={label} className="card-premium p-6 flex items-center gap-4 hover:shadow-md transition-all">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${highlight ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-lg font-bold leading-none ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Division Controls */}
        <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-8 border-b border-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">Rules & Constraints</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global policies for all teams in {division.name}</p>
              </div>
            </div>
            {!isEditingControls ? (
              <button 
                onClick={() => {
                  setControlsDraft({
                    enableTrends: division.enableTrends ?? true,
                    infieldMin: division.infieldMin ?? 1,
                    infieldMax: division.infieldMax ?? 4,
                    outfieldMin: division.outfieldMin ?? 1,
                    outfieldMax: division.outfieldMax ?? 4,
                    benchMin: division.benchMin ?? 0,
                    benchMax: division.benchMax ?? 2,
                    enforceDeadline: division.enforceDeadline ?? false,
                    deadlineInning: division.deadlineInning ?? 5,
                    enabledPositions: division.enabledPositions || ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
                  });
                  setIsEditingControls(true);
                }}
                className="bg-slate-900 text-white font-bold text-[10px] tracking-widest uppercase px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95"
              >
                Configure Policies
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditingControls(false)} className="text-slate-400 font-bold text-[10px] tracking-widest uppercase px-4 py-2 hover:text-slate-600 transition-colors">Discard</button>
                <button onClick={handleUpdateControls} className="bg-emerald-600 text-white font-bold text-[10px] tracking-widest uppercase px-6 py-2.5 rounded-lg shadow-md hover:bg-emerald-700 transition-all">Publish Sync</button>
              </div>
            )}
          </div>

          <div className="p-8">
            {!isEditingControls ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Policy Card: Fairness */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Scale className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Fair Play Rules</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="w-3 h-3 text-emerald-500 mt-0.5" />
                      <p className="text-[11px] text-slate-600 font-medium">Pitchers must pitch consecutive innings.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3 h-3 text-emerald-500 mt-0.5" />
                      <p className="text-[11px] text-slate-600 font-medium">Bench: Max {division.benchMax ?? 2} innings per player.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3 h-3 text-emerald-500 mt-0.5" />
                      <p className="text-[11px] text-slate-600 font-medium">Infield: {division.infieldMin || 1}-{division.infieldMax || 4} innings per player.</p>
                    </div>
                  </div>
                </div>

                {/* Policy Card: Deadlines */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Time Constraints</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      {division.enforceDeadline ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500 mt-0.5" />
                          <p className="text-[11px] text-slate-600 font-medium">Deadline Active: Requirements must be met by Inning {division.deadlineInning || 5}.</p>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 text-slate-300 mt-0.5" />
                          <p className="text-[11px] text-slate-400 italic">No completion deadline enforced.</p>
                        </>
                      )}
                    </div>
                    <div className="pt-2">
                       <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">The Defensive Wizard uses these values to prioritize player safety and fairness.</p>
                    </div>
                  </div>
                </div>

                {/* Policy Card: Visibility */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Trend Analytics</h3>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Batting Averages</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${division.enableTrends !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {division.enableTrends !== false ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">Controls if coaches can see season-long trends and batting position averages for their teams.</p>
                </div>

                {/* Policy Card: Field Configuration */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Layout className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Field Configuration</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(division.enabledPositions || ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]).map(posId => (
                      <span key={posId} className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded font-black text-[10px] shadow-sm">
                        {posId}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Standard defensive positions applied to all lineups.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-300">
                <div className="space-y-8">
                   {/* Column 1: Rotation Logic */}
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/50 space-y-6">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                         <Layers className="w-3.5 h-3.5 text-emerald-600" /> Positional Constraints
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         {[
                           { label: 'Infield', key: 'infield' },
                           { label: 'Outfield', key: 'outfield' },
                           { label: 'Bench', key: 'bench' }
                         ].map(pos => (
                           <div key={pos.key} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pos.label}</p>
                              <div className="grid grid-cols-2 gap-2">
                                 <div>
                                    <label className="text-[8px] font-bold text-slate-300 uppercase block mb-1 tracking-tighter">Min</label>
                                    <input 
                                       type="number" 
                                       className="w-full bg-slate-50 border border-slate-100 rounded px-2 py-1 text-xs font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                       value={controlsDraft[pos.key + 'Min'] ?? 0}
                                       onChange={e => setControlsDraft({ ...controlsDraft, [pos.key + 'Min']: parseInt(e.target.value) || 0 })}
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[8px] font-bold text-slate-300 uppercase block mb-1 tracking-tighter">Max</label>
                                    <input 
                                       type="number" 
                                       className="w-full bg-slate-50 border border-slate-100 rounded px-2 py-1 text-xs font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                       value={controlsDraft[pos.key + 'Max'] ?? 0}
                                       onChange={e => setControlsDraft({ ...controlsDraft, [pos.key + 'Max']: parseInt(e.target.value) || 0 })}
                                    />
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                         <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-slate-700 uppercase">Requirement Deadline</p>
                            <div className="flex items-center gap-2">
                               <button 
                                  onClick={() => setControlsDraft({ ...controlsDraft, enforceDeadline: !controlsDraft.enforceDeadline })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${controlsDraft.enforceDeadline ? 'bg-amber-500' : 'bg-slate-300'}`}
                               >
                                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${controlsDraft.enforceDeadline ? 'left-6' : 'left-1'}`} />
                               </button>
                               {controlsDraft.enforceDeadline && (
                                  <div className="flex items-center gap-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                                     <span className="text-[8px] font-bold text-slate-400">INN</span>
                                     <input 
                                         type="number" 
                                         className="w-8 bg-transparent text-[10px] font-bold text-slate-700 text-center outline-none"
                                         value={controlsDraft.deadlineInning ?? 5}
                                         onChange={e => setControlsDraft({ ...controlsDraft, deadlineInning: parseInt(e.target.value) || 1 })}
                                     />
                                  </div>
                               )}
                            </div>
                         </div>
                         <p className="text-[9px] text-slate-400 italic">Force positional minimums to be satisfied early in the game.</p>
                      </div>
                   </div>

                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Team Lineup Analytics</p>
                        <p className="text-[10px] text-slate-400">Coaches can see batting trend metrics.</p>
                      </div>
                      <button 
                         onClick={() => setControlsDraft({ ...controlsDraft, enableTrends: !controlsDraft.enableTrends })}
                         className={`w-12 h-6 rounded-full transition-all relative ${controlsDraft.enableTrends ? 'bg-blue-500' : 'bg-slate-300'}`}
                      >
                         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${controlsDraft.enableTrends ? 'left-7' : 'left-1'}`} />
                      </button>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="p-6 bg-slate-900 rounded-2xl shadow-xl space-y-6">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                         <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                             <CheckCircle2 className="w-4 h-4" />
                         </div>
                         <h3 className="text-xs font-bold text-white uppercase tracking-widest">Division Active Positions</h3>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                         {MASTER_POSITIONS.map(pos => {
                            const active = (controlsDraft.enabledPositions || []).includes(pos.id);
                            return (
                               <button 
                                  key={pos.id}
                                  onClick={() => {
                                     const next = active 
                                        ? (controlsDraft.enabledPositions || []).filter(id => id !== pos.id) 
                                        : [...(controlsDraft.enabledPositions || []), pos.id];
                                     setControlsDraft({ ...controlsDraft, enabledPositions: next });
                                  }}
                                  className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${active ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 hover:opacity-100'}`}
                               >
                                  <span className="font-black text-[10px]">{pos.id}</span>
                               </button>
                            );
                         })}
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                         <p className="text-[10px] text-slate-400 leading-relaxed italic">
                            Select the standard defensive positions for this division. 
                            These will be enforced across all lineup rotation sheets.
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 border-t border-slate-100 pt-8">
           <div>
             <h2 className="text-base font-semibold text-slate-800">Division Teams</h2>
             <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Manage rosters for {division.name}</p>
           </div>
          
          <div className="flex gap-2">
            <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className="bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:border-emerald-500 appearance-none cursor-pointer shadow-sm">
              <option value="All Seasons">Season</option>
              {['Spring', 'Summer', 'Fall', 'Winter'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:border-emerald-500 appearance-none cursor-pointer shadow-sm">
              <option value="All Years">Year</option>
              {Array.from({length: 5}).map((_, i) => {
                 const y = (2025 + i).toString();
                 return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </div>

          {teams.length === 0 ? (
            <div className="card-premium p-16 text-center border-dashed border-2">
              <Users className="w-14 h-14 text-slate-200 mx-auto mb-4" />
              <h3 className="section-title mb-1">No Teams Yet</h3>
              <p className="section-subtitle mb-6">Assign teams from the league into this division.</p>
              <button onClick={() => setShowAddTeam(true)} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-700 transition">Add Team</button>
            </div>
          ) : displayTeams.length === 0 ? (
            <div className="card-premium p-16 text-center border-dashed border-2">
              <p className="section-subtitle mb-4">No teams match `{filterSeason} {filterYear}`</p>
              <button onClick={() => { setFilterSeason('All Seasons'); setFilterYear('All Years'); }} className="text-emerald-600 font-bold text-xs tracking-wide hover:underline">Clear Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayTeams.map(team => (
                <DivisionTeamCard
                  key={team.id}
                  team={team}
                  usersMap={usersMap}
                  players={teamData[team.id]?.players || []}
                  games={teamData[team.id]?.games || []}
                  onOpenLineup={setSelectedTeamId}
                  onAssignCoach={handleAssignCoach}
                  onDeleteTeam={handleDeleteTeam}
                  isAdmin={true}
                  divisionName={division?.name}
                  divisions={allDivisions}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add team modal */}
      {showAddTeam && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowAddTeam(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Assign Team to Division</h3>
              <button onClick={() => setShowAddTeam(false)} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <input
              className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all mb-4 text-sm"
              placeholder="Search league teams…"
              value={addTeamSearch}
              onChange={e => setAddTeamSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-52 overflow-y-auto mb-6">
              {filteredTeams.length === 0 && (
                <p className="text-slate-400 font-bold text-sm text-center py-3">No available teams found.</p>
              )}
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleAddExistingTeam(team)}
                  disabled={addingTeam}
                  className="w-full flex items-center justify-between bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl transition-all text-left"
                >
                  <span className="font-bold text-slate-800 uppercase text-sm">{team.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-6">
              <button
                onClick={handleCreateTeam}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Create Brand New Team
              </button>
              <p className="text-[10px] text-slate-400 text-center font-bold mt-4 uppercase tracking-wider">Teams must belong to the parent league.</p>
            </div>
          </div>
        </div>
      )}

      {selectedTeamId && (
        <TeamStatsModal
          team={selectedTeam}
          players={selectedTeamPlayers}
          games={selectedTeamGames}
          onClose={() => setSelectedTeamId(null)}
        />
      )}
    </div>
  );
}
