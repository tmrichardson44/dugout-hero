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
  X, Mail, ShieldCheck, Trophy, TrendingUp, Settings, Trash2, Layers
} from 'lucide-react';

const SAAS_ROOT = 'saas_data';
const SAAS_VERSION = 'v1';

// ── Inline stat bars ────────────────────────────────────────────────────────
function AvgBar({ avg, target, low, high }) {
  if (!avg) return <span className="text-slate-300 text-xs font-bold">No data</span>;
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
      <span className={`text-[10px] font-bold w-8 text-right ${onTarget ? 'text-emerald-600' : 'text-rose-500'}`}>
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

// ── Team card in league view ─────────────────────────────────────────────────
function LeagueTeamCard({ team, players, games, divisions, divisionName, onOpenLineup, onAssignCoach, onDeleteTeam, isAdmin, usersMap }) {
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
  const low  = (rosterSize / 2) - 1;
  const high = (rosterSize / 2) + 0.75;

  // Compute per-player batting averages across all games for this team
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
                <div className="flex items-center gap-2">
                  <Link to={`/pro/team/${team.id}`} className="hover:text-emerald-600 transition-colors">
                    <h3 className="font-semibold text-slate-800 leading-tight text-sm">{team.name}</h3>
                  </Link>
                  {divisionName && divisionName !== 'No Division' && (
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${themeClass}`}>
                      {divisionName}
                    </span>
                  )}
                </div>
                <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                  {players.length} PLRS · {games.length} GMS
                </p>
              </div>
           </div>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setShowCoachModal(true)} className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center hover:bg-slate-50 hover:text-slate-500 transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDeleteTeam(team.id)} className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Coach badge */}
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

      {/* Player list (collapsed, show top 3) */}
      {playerStats.length > 0 && (
        <div className="border-t border-slate-50 px-6 py-3 space-y-2">
          {playerStats.slice(0, 3).map(p => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center">
                  {p.number}
                </div>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{p.name}</span>
              </div>
              <div className="w-32">
                <AvgBar avg={p.avg} target={target} low={low} high={high} />
              </div>
            </div>
          ))}
          {playerStats.length > 3 && (
            <p className="text-[10px] text-slate-300 font-bold tracking-wide text-center pt-1">
              +{playerStats.length - 3} more players
            </p>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="px-6 pb-6 pt-2">
        <button
          onClick={() => onOpenLineup(team.id)}
          className="w-full bg-slate-50 text-slate-500 font-bold text-[10px] tracking-wide py-3 rounded-lg border border-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex items-center justify-center gap-2 uppercase"
        >
          <BarChart3 className="w-4 h-4" /> View Full Stats
        </button>
      </div>

      {/* Team settings modal (Coach + Division) */}
      {showCoachModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-lg p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-widest">Team Settings</h3>
              <button onClick={() => setShowCoachModal(false)} className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-2 uppercase">Assign Coach</label>
                <select
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs mb-2"
                  value={assignCoachMode === 'new' ? 'NEW' : selectedCoachUid}
                  onChange={e => {
                    if (e.target.value === 'NEW') setAssignCoachMode('new');
                    else { setAssignCoachMode('existing'); setSelectedCoachUid(e.target.value); }
                  }}
                >
                  <option value="" disabled>-- Select a Coach --</option>
                  {Object.values(usersMap || {}).map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                  ))}
                  <option value="NEW">+ Invite New Coach</option>
                </select>

                {assignCoachMode === 'new' && (
                  <input
                    type="email"
                    autoFocus
                    className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs"
                    placeholder="coach@example.com"
                    value={coachEmail}
                    onChange={e => setCoachEmail(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 tracking-widest mb-2 uppercase">Move to Division</label>
                <select
                  className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs"
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

              {coachErr && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest">{coachErr}</p>}
              
              <button
                onClick={handleSaveCoach}
                disabled={saving || (assignCoachMode === 'new' && !coachEmail.trim()) || (assignCoachMode === 'existing' && !selectedCoachUid)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 transition-all text-white font-bold py-2.5 rounded-lg text-[10px] tracking-widest uppercase shadow-sm disabled:opacity-50 mt-2"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
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
    <div className="fixed inset-0 bg-slate-900/60  z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{team.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 tracking-wide mt-1">Batting Order Averages · Target: {low.toFixed(1)}–{high.toFixed(1)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-8 pt-4 space-y-4">
          {playerStats.length === 0 && (
            <p className="text-slate-400 font-bold text-sm text-center py-8">No lineup data yet for this team.</p>
          )}
          {playerStats.map(p => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center font-bold text-emerald-600 text-sm shrink-0">{p.number}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm leading-none mb-2">{p.name}</p>
                <AvgBar avg={p.avg} target={(low + high) / 2} low={low} high={high} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium">{p.gameCount} games</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main League Dashboard ────────────────────────────────────────────────────
export default function ProLeagueDashboard() {
  const { leagueId } = useParams();
  const { currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamData, setTeamData] = useState({}); // { teamId: { players: [], games: [] } }
  const [allUserTeams, setAllUserTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const [isCreatingDivision, setIsCreatingDivision] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addTeamSearch, setAddTeamSearch] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [usersMap, setUsersMap] = useState({});

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminTargetId, setAdminTargetId] = useState(null); // divisionId
  const [adminEmail, setAdminEmail] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  const [filterSeason, setFilterSeason] = useState('All Seasons');
  const [filterYear, setFilterYear] = useState('All Years');
  const [filterDivision, setFilterDivision] = useState('All Divisions');

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const map = {};
      snap.forEach(d => map[d.id] = d.data());
      setUsersMap(map);
    }).catch(console.error);
  }, []);

  // Load league doc
  useEffect(() => {
    if (!leagueId || !currentUser) return;
    const unsub = onSnapshot(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', leagueId), snap => {
      if (!snap.exists()) { navigate('/pro/dashboard'); return; }
      const data = snap.data();
      if (data.adminUid !== currentUser.uid && !isSuperAdmin()) {
        alert('Access denied.'); navigate('/pro/dashboard'); return;
      }
      setLeague({ id: snap.id, ...data });
    });
    return unsub;
  }, [leagueId, currentUser, navigate]);

  // Load divisions & teams in this league
  useEffect(() => {
    if (!leagueId) return;
    const unsubDivs = onSnapshot(
      query(collection(db, SAAS_ROOT, SAAS_VERSION, 'divisions'), where('leagueId', '==', leagueId)),
      snap => setDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubTeams = onSnapshot(
      query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('leagueId', '==', leagueId)),
      snap => {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => { unsubDivs(); unsubTeams(); };
  }, [leagueId]);

  // Load user's own teams for "add existing team" flow
  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('managerUid', '==', currentUser.uid || 'unknown')))
      .then(snap => setAllUserTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  // Subscribe to players + games for each team
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

  const handleAssignCoach = async (teamId, coachEmail, coachUid, coachName, divisionId) => {
    const update = { coachEmail, leagueId };
    if (coachUid !== undefined) update.managerUid = coachUid;
    if (coachName !== undefined) update.coachName = coachName;
    if (divisionId !== undefined) update.divisionId = divisionId;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), update);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('PERMANENTLY DELETE this team? This cannot be undone.')) return;
    await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId));
  };

  const handleDeleteLeague = async () => {
    if (!window.confirm('PERMANENTLY DELETE this league? This cannot be undone.')) return;
    await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', leagueId));
    navigate('/pro/dashboard');
  };

  const handleDeleteDivision = async (divId) => {
    if (!window.confirm('PERMANENTLY DELETE this division? Teams inside will remain but lose division assignment.')) return;
    await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', divId));
  };

  const handleAddExistingTeam = async (team) => {
    setAddingTeam(true);
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', team.id), { leagueId });
    setShowAddTeam(false);
    setAddingTeam(false);
  };

  const handleCreateDivision = async (e) => {
    e.preventDefault();
    if (!newDivisionName.trim()) return;
    await addDoc(collection(db, SAAS_ROOT, SAAS_VERSION, 'divisions'), {
      name: newDivisionName.trim(),
      leagueId,
      adminUid: null,
      adminEmail: null,
      createdAt: serverTimestamp()
    });
    setNewDivisionName('');
    setIsCreatingDivision(false);
  };

  const handleCreateTeam = async () => {
    const name = window.prompt('New team name:');
    if (!name?.trim()) return;
    await addDoc(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), {
      name: name.trim(),
      leagueId,
      managerUid: currentUser.uid,
      createdAt: serverTimestamp(),
      seasonSettings: {
        teamName: name.trim(), rosterSize: 12, innings: 6,
        battingTarget: 6.5, enableTrends: true,
        enabledPositions: ['P','C','1B','2B','3B','SS','LF','LC','CF','RC','RF']
      }
    });
  };

  const filteredUserTeams = allUserTeams.filter(t =>
    !teams.find(lt => lt.id === t.id) &&
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
     const matchDivision = filterDivision === 'All Divisions' 
        ? true 
        : filterDivision === 'No Division' 
           ? !t.divisionId 
           : t.divisionId === filterDivision;
     return matchSeason && matchYear && matchDivision;
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

  if (loading || !league) {
    return <div className="min-h-screen bg-white/40  flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="nav-header">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/pro/dashboard" className="p-1.5 hover:bg-slate-50 text-slate-300 hover:text-slate-500 rounded-lg transition-all">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div>
              <div className="text-sm font-semibold text-slate-800 leading-none">{league.name}</div>
              <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">League Admin</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddTeam(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-widest"
            >
              <Plus className="w-3 h-3" /> Add Team
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex justify-end gap-3 mt-4">
           <button onClick={handleDeleteLeague} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:underline flex items-center gap-1.5"><Trash2 className="w-3 h-3" /> Delete League</button>
        </div>

        {/* Summary stats */}
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-4 border-t border-slate-100 pt-8">
           <div>
             <h2 className="text-base font-semibold text-slate-800">Divisions</h2>
             <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Intermediate program groupings</p>
           </div>
           <button onClick={() => setIsCreatingDivision(true)} className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest hover:underline flex items-center gap-1.5"><Plus className="w-3 h-3"/> New Division</button>
        </div>
        
        {divisions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {divisions.map(div => (
              <div key={div.id} className="card-premium p-4 group relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center border border-slate-100"><Layers className="w-3.5 h-3.5" /></div>
                    <h3 className="font-semibold text-sm text-slate-800">{div.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setAdminTargetId(div.id); setAdminEmail(div.adminEmail || ''); setIsAdminModalOpen(true); }}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDivision(div.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-2 pl-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 truncate">
                    {usersMap[div.adminUid]?.displayName || div.adminName || div.adminEmail || 'Unassigned'}
                  </p>
                </div>
                <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest pl-1">
                  {teams.filter(t => t.divisionId === div.id).length} TEAMS TOTAL
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 border-t border-slate-100 pt-8">
           <div>
             <h2 className="text-base font-semibold text-slate-800">All Teams</h2>
             <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Rosters and performance metrics</p>
           </div>
          
          <div className="flex gap-2">
            <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:border-emerald-500 appearance-none cursor-pointer">
              <option value="All Divisions">All Divisions</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
              <option value="No Division">No Division</option>
            </select>
            <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className="bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:border-emerald-500 appearance-none cursor-pointer">
              <option value="All Seasons">Season</option>
              {['Spring', 'Summer', 'Fall', 'Winter'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest outline-none focus:border-emerald-500 appearance-none cursor-pointer">
              <option value="All Years">Year</option>
              {Array.from({length: 5}).map((_, i) => {
                 const y = (2025 + i).toString();
                 return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </div>

        {/* Teams grid */}
        {teams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition-all duration-300">
            <Users className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Teams Yet</h3>
            <p className="text-slate-400 font-bold mb-6">Add existing teams or create new ones for this league.</p>
            <button onClick={() => setShowAddTeam(true)} className="bg-green-100 text-green-800 px-6 py-3 rounded-lg font-bold text-sm tracking-wide hover:bg-green-200 transition flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Team
            </button>
          </div>
        ) : displayTeams.length === 0 ? (
          <div className="bg-white rounded-xl p-16 flex flex-col items-center justify-center border border-slate-200 border-dashed">
            <p className="text-slate-400 font-bold mb-2">No teams match `{filterSeason} {filterYear}`</p>
            <button onClick={() => { setFilterSeason('All Seasons'); setFilterYear('All Years'); }} className="text-blue-600 font-bold text-xs tracking-wide font-medium hover:underline">Clear Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayTeams.map(team => (
              <LeagueTeamCard
                key={team.id}
                team={team}
                divisions={divisions}
                divisionName={divisions.find(d => d.id === team.divisionId)?.name || 'No Division'}
                usersMap={usersMap}
                players={teamData[team.id]?.players || []}
                games={teamData[team.id]?.games || []}
                onOpenLineup={setSelectedTeamId}
                onAssignCoach={handleAssignCoach}
                onDeleteTeam={handleDeleteTeam}
                isAdmin={true}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Division Modal */}
      {isCreatingDivision && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4" onClick={() => setIsCreatingDivision(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">New Division</h3>
              <button onClick={() => { setIsCreatingDivision(false); setNewDivisionName(''); }} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreateDivision} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 tracking-wide font-medium ml-1 mb-2">Division Name</label>
                <input
                  type="text" autoFocus
                  className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white border border-slate-200 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  placeholder="e.g. American League"
                  value={newDivisionName}
                  onChange={e => setNewDivisionName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={!newDivisionName.trim()}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-sm shadow-green-100 tracking-wide hover:bg-green-700 transition-colors disabled:opacity-50 disabled:shadow-none"
              >
                Create Division
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add team modal */}
      {showAddTeam && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowAddTeam(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Add Team to League</h3>
              <button onClick={() => setShowAddTeam(false)} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <input
              className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all mb-4 text-sm"
              placeholder="Search your teams…"
              value={addTeamSearch}
              onChange={e => setAddTeamSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {filteredUserTeams.length === 0 && (
                <p className="text-slate-400 font-bold text-sm text-center py-3">No available teams found.</p>
              )}
              {filteredUserTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleAddExistingTeam(team)}
                  disabled={addingTeam}
                  className="w-full flex items-center justify-between bg-white/40  hover:bg-emerald-50 hover:border-green-300 border border-slate-200 p-4 rounded-lg transition-all text-left"
                >
                  <span className="font-bold text-slate-800 uppercase text-sm">{team.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={handleCreateTeam}
                className="w-full bg-green-600 hover:bg-green-700 transition-colors text-white font-bold py-3 rounded-lg text-xs tracking-wide flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Brand New Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Assign Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4" onClick={() => setIsAdminModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-sm shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Assign Division Admin</h3>
              <button onClick={() => setIsAdminModalOpen(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500 font-bold mb-4">Enter the email of the user who will manage this division.</p>
            <input
              type="email" autoFocus
              className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all mb-4"
              placeholder="admin@test.com"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
            />
            <button
              onClick={async () => {
                setAdminSaving(true);
                try {
                  let uid = null;
                  const q = query(collection(db, 'users'), where('email', '==', adminEmail.trim().toLowerCase()));
                  const snap = await getDocs(q);
                  if (!snap.empty) uid = snap.docs[0].id;
                  
                  await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', adminTargetId), {
                    adminEmail: adminEmail.trim().toLowerCase(),
                    adminUid: uid
                  });
                  setIsAdminModalOpen(false);
                } catch (e) {
                  alert(e.message);
                }
                setAdminSaving(false);
              }}
              disabled={adminSaving || !adminEmail.trim()}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-xs tracking-wide font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {adminSaving ? 'Assigning…' : 'Assign Admin'}
            </button>
          </div>
        </div>
      )}

      {/* Full stats modal */}
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
