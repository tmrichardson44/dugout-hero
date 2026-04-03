import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  collection, doc, onSnapshot, query, where,
  getDocs, addDoc, updateDoc, getDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Plus, Users, BarChart3, ChevronRight,
  X, Mail, ShieldCheck, Trophy, TrendingUp, Trash2, Layers
} from 'lucide-react';

const SAAS_ROOT = 'saas_data';
const SAAS_VERSION = 'v1';

// ── Inline stat bar ──────────────────────────────────────────────────────────
function AvgBar({ avg, target, low, high }) {
  if (!avg) return <span className="text-slate-300 text-xs font-bold">No data</span>;
  const pct = Math.min(100, Math.max(0, ((avg - low) / (high - low)) * 100));
  const onTarget = avg >= low && avg <= high;
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 bg-slate-100 rounded-full h-2 relative overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${onTarget ? 'bg-emerald-500' : 'bg-rose-400'}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute top-0 bottom-0 bg-emerald-200/60 rounded-sm"
          style={{
            left: `${((low - low) / (high - low)) * 100}%`,
            width: `${((high - low) / (high - low)) * 100}%`
          }}
        />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${onTarget ? 'text-emerald-600' : 'text-rose-500'}`}>
        {avg.toFixed(1)}
      </span>
    </div>
  );
}

// ── Team card in division view ─────────────────────────────────────────────────
function DivisionTeamCard({ team, players, games, onOpenLineup, onAssignCoach, onRemoveTeam, isAdmin, usersMap }) {
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

  const teamAvg = useMemo(() => {
    const valid = playerStats.filter(p => p.avg !== null);
    if (!valid.length) return null;
    return valid.reduce((s, p) => s + p.avg, 0) / valid.length;
  }, [playerStats]);

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition-all duration-300 overflow-hidden group hover:shadow-lg hover:border-green-300 transition-all">
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900 leading-none">{team.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium mt-1">
              {players.length} Players · {games.length} Games · {team.season || 'Spring'} {team.year || '2026'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowCoachModal(true)}
                title="Assign Coach"
                className="w-8 h-8 rounded-xl bg-white/40  text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemoveTeam(team.id)}
                title="Remove from Division"
                className="w-8 h-8 rounded-xl bg-white/40  text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {hasCoach ? (
          <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-xl mb-3">
            <ShieldCheck className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-600 tracking-wide font-medium truncate">{displayCoachName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-xl mb-3 opacity-60">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 tracking-wide font-medium">No coach assigned</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-wide font-medium">Team Avg</span>
            <span className="text-[10px] font-bold text-slate-300 uppercase">Target: {low.toFixed(1)}–{high.toFixed(1)}</span>
          </div>
          <AvgBar avg={teamAvg} target={target} low={low} high={high} />
        </div>
      </div>

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
              +{playerStats.length - 3} more
            </p>
          )}
        </div>
      )}

      <div className="px-6 pb-5 pt-3">
        <button
          onClick={() => onOpenLineup(team.id)}
          className="w-full bg-white/40  hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 font-bold text-[10px] tracking-wide font-medium py-3 rounded-lg border border-slate-100 hover:border-green-300 transition-all flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4" /> View Full Stats
        </button>
      </div>

      {showCoachModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4" onClick={() => setShowCoachModal(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-sm shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Assign Coach</h3>
              <button onClick={() => setShowCoachModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-bold mb-4">Select an existing user from the platform, or enter a new email.</p>
            
            <label className="block text-[10px] font-bold text-slate-400 tracking-wide font-medium mb-2">Select Coach</label>
            <select
              className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-slate-500 transition-all mb-4"
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
              <option value="NEW">+ Invite New Coach via Email</option>
            </select>

            {assignCoachMode === 'new' && (
              <>
                <label className="block text-[10px] font-bold text-slate-400 tracking-wide font-medium mb-2">Coach Email</label>
                <input
                  type="email" autoFocus
                  className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-slate-500 transition-all mb-2"
                  placeholder="coach@example.com"
                  value={coachEmail}
                  onChange={e => setCoachEmail(e.target.value)}
                />
              </>
            )}

            {coachErr && <p className="text-rose-500 text-xs font-bold mb-2">{coachErr}</p>}
            <button
              onClick={handleSaveCoach}
              disabled={saving || (assignCoachMode === 'new' && !coachEmail.trim()) || (assignCoachMode === 'existing' && !selectedCoachUid)}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-xs tracking-wide font-medium mt-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Coach'}
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
    <div className="fixed inset-0 bg-slate-900/60  z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{team.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium mt-1">Target: {low.toFixed(1)}–{high.toFixed(1)}</p>
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
                <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium">{p.gameCount} games</p>
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
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addTeamSearch, setAddTeamSearch] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [usersMap, setUsersMap] = useState({});

  const [filterSeason, setFilterSeason] = useState('All Seasons');
  const [filterYear, setFilterYear] = useState('All Years');

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const map = {};
      snap.forEach(d => map[d.id] = d.data());
      setUsersMap(map);
    }).catch(console.error);
  }, []);

  // Load division doc with access control
  useEffect(() => {
    if (!divisionId || !currentUser) return;
    const unsub = onSnapshot(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', divisionId), async snap => {
      if (!snap.exists()) { navigate('/pro/dashboard'); return; }
      const data = snap.data();
      
      let hasAccess = false;
      if (isSuperAdmin() || data.adminUid === currentUser.uid) {
        hasAccess = true;
      } else if (data.leagueId) {
        // Also allow the League Admin to view the division
        const leagueSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', data.leagueId));
        if (leagueSnap.exists() && leagueSnap.data().adminUid === currentUser.uid) hasAccess = true;
      }

      if (!hasAccess) {
        alert('Access denied.'); navigate('/pro/dashboard'); return;
      }
      setDivision({ id: snap.id, ...data });
    });
    return unsub;
  }, [divisionId, currentUser, navigate, isSuperAdmin]);

  // Load teams in this division
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

  // Load all teams in the same league (for adding a team to division)
  useEffect(() => {
    if (!division?.leagueId) return;
    getDocs(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('leagueId', '==', division.leagueId)))
      .then(snap => setAllLeagueTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [division?.leagueId]);

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

  const handleAssignCoach = async (teamId, coachEmail, coachUid, coachName) => {
    const update = { coachEmail };
    if (coachUid) update.managerUid = coachUid;
    if (coachName) update.coachName = coachName;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), update);
  };

  const handleRemoveTeam = async (teamId) => {
    if (!window.confirm('Remove this team from the division?')) return;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), { divisionId: null });
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

  if (loading || !division) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalTeams   = teams.length;
  const totalPlayers = Object.values(teamData).reduce((s, d) => s + (d.players?.length || 0), 0);
  const totalGames   = Object.values(teamData).reduce((s, d) => s + (d.games?.length   || 0), 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-green-800 text-white px-6 py-4 flex items-center justify-between shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/pro/dashboard" className="p-2 hover:bg-green-700 rounded-lg transition-colors text-green-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-bold tracking-widest uppercase text-sm leading-none">{division.name}</div>
            <div className="text-green-300 text-[10px] font-bold tracking-wide mt-0.5">Division Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTeam(true)}
            className="bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 tracking-wide"
          >
            <Plus className="w-3 h-3" /> Add Team
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users,     label: 'Total Teams',   value: teams.length },
            { icon: Trophy,    label: 'Total Players',  value: totalPlayers },
            { icon: TrendingUp,label: 'Total Games',    value: totalGames   },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
                <p className="text-[10px] font-bold text-slate-400 tracking-wide font-medium mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {teams.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-800">Division Teams</h2>
            
            <div className="flex gap-2">
              <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className="bg-white border border-slate-200  border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 tracking-wide font-medium outline-none focus:border-slate-500 appearance-none cursor-pointer">
                <option value="All Seasons">All Seasons</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
                <option value="Winter">Winter</option>
              </select>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border border-slate-200  border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 tracking-wide font-medium outline-none focus:border-slate-500 appearance-none cursor-pointer">
                <option value="All Years">All Years</option>
                {Array.from({length: 20}).map((_, i) => {
                   const y = (2026 + i).toString();
                   return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
        )}

        {teams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition-all duration-300 mt-8">
            <Users className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Teams Yet</h3>
            <p className="text-slate-400 font-bold mb-6">Assign teams from the league into this division.</p>
            <button onClick={() => setShowAddTeam(true)} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-lg font-bold text-sm tracking-wide font-medium hover:bg-slate-200 transition flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Team
            </button>
          </div>
        ) : displayTeams.length === 0 ? (
          <div className="bg-white rounded-xl p-16 flex flex-col items-center justify-center border border-slate-200 border-dashed">
            <p className="text-slate-400 font-bold mb-2">No teams match `{filterSeason} {filterYear}`</p>
            <button onClick={() => { setFilterSeason('All Seasons'); setFilterYear('All Years'); }} className="text-slate-600 font-bold text-xs tracking-wide font-medium hover:underline">Clear Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayTeams.map(team => (
              <DivisionTeamCard
                key={team.id}
                team={team}
                usersMap={usersMap}
                players={teamData[team.id]?.players || []}
                games={teamData[team.id]?.games || []}
                onOpenLineup={setSelectedTeamId}
                onAssignCoach={handleAssignCoach}
                onRemoveTeam={handleRemoveTeam}
                isAdmin={true}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add team modal */}
      {showAddTeam && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowAddTeam(false)}>
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md shadow-lg animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Add Team to Division</h3>
              <button onClick={() => setShowAddTeam(false)} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <input
              className="w-full bg-white border border-slate-200 rounded-lg px-5 py-3 font-bold text-slate-700 outline-none focus:border-slate-500 transition-all mb-4 text-sm"
              placeholder="Search league teams…"
              value={addTeamSearch}
              onChange={e => setAddTeamSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {filteredTeams.length === 0 && (
                <p className="text-slate-400 font-bold text-sm text-center py-3">No available teams found in this league.</p>
              )}
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleAddExistingTeam(team)}
                  disabled={addingTeam}
                  className="w-full flex items-center justify-between bg-white/40  hover:bg-white/40  hover:border-slate-300 border border-slate-200 p-4 rounded-lg transition-all text-left"
                >
                  <span className="font-bold text-slate-800 uppercase text-sm">{team.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 mb-2">
              <button
                onClick={handleCreateTeam}
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white  shadow-md shadow-sm hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300 font-bold py-3 rounded-lg text-xs tracking-wide font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Brand New Team
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center font-bold">Only teams already in this division's parent league can be added existing. New teams inherit league/division context.</p>
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
