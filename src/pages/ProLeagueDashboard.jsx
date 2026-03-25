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
  X, Mail, ShieldCheck, Trophy, TrendingUp, Settings, Trash2
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
        {/* target zone markers */}
        <div className="absolute top-0 bottom-0 bg-emerald-200/60 rounded-sm"
          style={{
            left: `${((low - low) / (high - low)) * 100}%`,
            width: `${((high - low) / (high - low)) * 100}%`
          }}
        />
      </div>
      <span className={`text-sm font-black w-10 text-right ${onTarget ? 'text-emerald-600' : 'text-rose-500'}`}>
        {avg.toFixed(1)}
      </span>
    </div>
  );
}

// ── Team card in league view ─────────────────────────────────────────────────
function LeagueTeamCard({ team, players, games, onOpenLineup, onAssignCoach, onRemoveTeam, isAdmin }) {
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachEmail, setCoachEmail] = useState(team.coachEmail || '');
  const [saving, setSaving] = useState(false);
  const [coachErr, setCoachErr] = useState('');

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

  const teamAvg = useMemo(() => {
    const valid = playerStats.filter(p => p.avg !== null);
    if (!valid.length) return null;
    return valid.reduce((s, p) => s + p.avg, 0) / valid.length;
  }, [playerStats]);

  const handleSaveCoach = async () => {
    setSaving(true);
    setCoachErr('');
    try {
      // Look up user by email
      let coachUid = null;
      const q = query(collection(db, 'users'), where('email', '==', coachEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) coachUid = snap.docs[0].data().uid;
      await onAssignCoach(team.id, coachEmail.trim().toLowerCase(), coachUid);
      setShowCoachModal(false);
    } catch (err) {
      setCoachErr('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-lg hover:border-emerald-200 transition-all">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-black text-lg text-slate-900 uppercase tracking-tighter leading-none">{team.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {players.length} Players · {games.length} Games
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowCoachModal(true)}
                title="Assign Coach"
                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemoveTeam(team.id)}
                title="Remove from League"
                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Coach badge */}
        {team.coachEmail ? (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl mb-3">
            <ShieldCheck className="w-3 h-3 text-blue-500 shrink-0" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate">{team.coachEmail}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl mb-3">
            <Mail className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">No coach assigned</span>
          </div>
        )}

        {/* Team avg bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Avg Batting Pos.</span>
            <span className="text-[10px] font-black text-slate-300 uppercase">Target: {low.toFixed(1)}–{high.toFixed(1)}</span>
          </div>
          <AvgBar avg={teamAvg} target={target} low={low} high={high} />
        </div>
      </div>

      {/* Player list (collapsed, show top 3) */}
      {playerStats.length > 0 && (
        <div className="border-t border-slate-50 px-6 py-3 space-y-2">
          {playerStats.slice(0, 3).map(p => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center justify-center">
                  {p.number}
                </div>
                <span className="text-xs font-black text-slate-700 uppercase tracking-tight truncate max-w-[100px]">{p.name}</span>
              </div>
              <div className="w-32">
                <AvgBar avg={p.avg} target={target} low={low} high={high} />
              </div>
            </div>
          ))}
          {playerStats.length > 3 && (
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center pt-1">
              +{playerStats.length - 3} more players
            </p>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="px-6 pb-5 pt-3">
        <button
          onClick={() => onOpenLineup(team.id)}
          className="w-full bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4" /> View Full Stats
        </button>
      </div>

      {/* Assign coach modal */}
      {showCoachModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowCoachModal(false)}>
          <div className="bg-white rounded-[28px] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Assign Coach</h3>
              <button onClick={() => setShowCoachModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-bold mb-4">Enter the coach's email. They must already have a Lineup Hero account. They'll be able to manage this team when they log in.</p>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Coach Email</label>
            <input
              type="email"
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all mb-2"
              placeholder="coach@example.com"
              value={coachEmail}
              onChange={e => setCoachEmail(e.target.value)}
            />
            {coachErr && <p className="text-rose-500 text-xs font-bold mb-2">{coachErr}</p>}
            <button
              onClick={handleSaveCoach}
              disabled={saving || !coachEmail.trim()}
              className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest mt-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{team.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Batting Order Averages · Target: {low.toFixed(1)}–{high.toFixed(1)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-8 pt-4 space-y-4">
          {playerStats.length === 0 && (
            <p className="text-slate-400 font-bold text-sm text-center py-8">No lineup data yet for this team.</p>
          )}
          {playerStats.map(p => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center font-black text-emerald-600 text-sm shrink-0">{p.number}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 text-sm uppercase tracking-tight leading-none mb-2">{p.name}</p>
                <AvgBar avg={p.avg} target={(low + high) / 2} low={low} high={high} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.gameCount} games</p>
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
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamData, setTeamData] = useState({}); // { teamId: { players: [], games: [] } }
  const [allUserTeams, setAllUserTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addTeamSearch, setAddTeamSearch] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  // Load league doc
  useEffect(() => {
    if (!leagueId || !currentUser) return;
    const unsub = onSnapshot(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', leagueId), snap => {
      if (!snap.exists()) { navigate('/pro/dashboard'); return; }
      const data = snap.data();
      if (data.adminUid !== currentUser.uid && !currentUser.isAdmin) {
        alert('Access denied.'); navigate('/pro/dashboard'); return;
      }
      setLeague({ id: snap.id, ...data });
    });
    return unsub;
  }, [leagueId, currentUser, navigate]);

  // Load teams in this league
  useEffect(() => {
    if (!leagueId) return;
    const unsub = onSnapshot(
      query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('leagueId', '==', leagueId)),
      snap => {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, [leagueId]);

  // Load user's own teams for "add existing team" flow
  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('managerUid', '==', currentUser.uid)))
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

  const handleAssignCoach = async (teamId, coachEmail, coachUid) => {
    const update = { coachEmail, leagueId };
    if (coachUid) update.managerUid = coachUid;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), update);
  };

  const handleRemoveTeam = async (teamId) => {
    if (!window.confirm('Remove this team from the league? The team and its data will not be deleted.')) return;
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), { leagueId: null, coachEmail: null });
  };

  const handleAddExistingTeam = async (team) => {
    setAddingTeam(true);
    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', team.id), { leagueId });
    setShowAddTeam(false);
    setAddingTeam(false);
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

  if (loading || !league) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalTeams   = teams.length;
  const totalPlayers = Object.values(teamData).reduce((s, d) => s + (d.players?.length || 0), 0);
  const totalGames   = Object.values(teamData).reduce((s, d) => s + (d.games?.length   || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/pro/dashboard" className="p-2 hover:bg-blue-700 rounded-xl transition-colors text-blue-200 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-black tracking-widest uppercase text-sm leading-none">{league.name}</div>
            <div className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">League Admin Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTeam(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-colors flex items-center gap-2 uppercase tracking-widest"
          >
            <Plus className="w-3 h-3" /> Add Team
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 space-y-8">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users,     label: 'Teams',   value: totalTeams   },
            { icon: Trophy,    label: 'Players',  value: totalPlayers },
            { icon: TrendingUp,label: 'Games',    value: totalGames   },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Icon className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 leading-none">{value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Teams grid */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-[32px] p-16 flex flex-col items-center justify-center border border-slate-200 shadow-sm">
            <Users className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-xl font-black text-slate-700 mb-2">No Teams Yet</h3>
            <p className="text-slate-400 font-bold mb-6">Add existing teams or create new ones for this league.</p>
            <button onClick={() => setShowAddTeam(true)} className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-200 transition flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map(team => (
              <LeagueTeamCard
                key={team.id}
                team={team}
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowAddTeam(false)}>
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Add Team to League</h3>
              <button onClick={() => setShowAddTeam(false)} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all mb-4 text-sm"
              placeholder="Search your teams…"
              value={addTeamSearch}
              onChange={e => setAddTeamSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {filteredUserTeams.length === 0 && (
                <p className="text-slate-400 font-bold text-sm text-center py-4">No available teams found.</p>
              )}
              {filteredUserTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleAddExistingTeam(team)}
                  disabled={addingTeam}
                  className="w-full flex items-center justify-between bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 p-4 rounded-2xl transition-all text-left"
                >
                  <span className="font-black text-slate-800 uppercase text-sm">{team.name}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={handleCreateTeam}
                className="w-full bg-emerald-600 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Brand New Team
              </button>
            </div>
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
