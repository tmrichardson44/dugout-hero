import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, or } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, LogOut, ShieldAlert, Plus, X, Trophy, ChevronRight, Layers, Trash2, Settings } from 'lucide-react';
import LeagueSetupWizard from '../components/LeagueSetupWizard';
import DivisionSetupWizard from '../components/DivisionSetupWizard';

export default function ProDashboard() {
  const { currentUser, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamProgram, setNewTeamProgram] = useState('Hopkinton Little League');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueProgram, setNewLeagueProgram] = useState('Hopkinton Little League');
  
  const [isCreatingDivision, setIsCreatingDivision] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newDivisionLeagueId, setNewDivisionLeagueId] = useState('');

  const [ownedLeagues, setOwnedLeagues] = useState([]);
  const [contextLeagues, setContextLeagues] = useState([]); 
  const [ownedDivisions, setOwnedDivisions] = useState([]);
  const [contextDivisions, setContextDivisions] = useState([]); 

  const isLeagueOwner = ownedLeagues.length > 0;
  const isDivisionAdmin = !isLeagueOwner && ownedDivisions.length > 0;
  const isCoach = !isLeagueOwner && !isDivisionAdmin && teams.length > 0;
  const isNewUser = !isLeagueOwner && !isDivisionAdmin && !isCoach && !isSuperAdmin();

  useEffect(() => {
    if (!currentUser) {
      navigate('/pro');
      return;
    }

    async function fetchData() {
      try {
        let fetchedTeams = [], fetchedOwnedLeagues = [], fetchedOwnedDivisions = [];
        let fetchedContextLeagues = [], fetchedContextDivisions = [];

        if (isSuperAdmin()) {
          const [tSnap, lSnap, dSnap] = await Promise.all([
            getDocs(collection(db, 'saas_data', 'v1', 'teams')),
            getDocs(collection(db, 'saas_data', 'v1', 'leagues')),
            getDocs(collection(db, 'saas_data', 'v1', 'divisions')),
          ]);
          fetchedTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedLeagues = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedDivisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const userEmail = currentUser.email?.toLowerCase();
          const [tSnap, lSnap, dSnap] = await Promise.all([
            getDocs(query(collection(db, 'saas_data', 'v1', 'teams'), or(
              where('managerUid', '==', currentUser.uid),
              where('coachEmail', '==', userEmail || 'unknown'),
              where('managerEmail', '==', userEmail || 'unknown')
            ))),
            getDocs(query(collection(db, 'saas_data', 'v1', 'leagues'), where('adminUid', '==', currentUser.uid))),
            getDocs(query(collection(db, 'saas_data', 'v1', 'divisions'), where('adminUid', '==', currentUser.uid))),
          ]);
          
          const teamUpdates = tSnap.docs.filter(d => !d.data().managerUid).map(async d => {
            await updateDoc(d.ref, { managerUid: currentUser.uid });
          });
          if (teamUpdates.length > 0) await Promise.all(teamUpdates);
          
          fetchedTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedLeagues = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedDivisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          if (fetchedOwnedLeagues.length > 0) {
            const leagueIds = fetchedOwnedLeagues.map(l => l.id);
            const leagueDivSnap = await getDocs(
              query(collection(db, 'saas_data', 'v1', 'divisions'), where('leagueId', 'in', leagueIds))
            );
            const leagueDivisions = leagueDivSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const existingIds = new Set(fetchedOwnedDivisions.map(d => d.id));
            leagueDivisions.forEach(d => { if (!existingIds.has(d.id)) fetchedOwnedDivisions.push(d); });
          }

          if (fetchedOwnedLeagues.length === 0 && fetchedOwnedDivisions.length > 0) {
            const parentLeagueIds = [...new Set(fetchedOwnedDivisions.map(d => d.leagueId).filter(Boolean))];
            const allLeaguesSnap = await getDocs(collection(db, 'saas_data', 'v1', 'leagues'));
            const allLeaguesMap = {};
            allLeaguesSnap.forEach(d => allLeaguesMap[d.id] = { id: d.id, ...d.data() });
            fetchedContextLeagues = parentLeagueIds.map(id => allLeaguesMap[id]).filter(Boolean);
          }

          if (fetchedOwnedLeagues.length === 0 && fetchedOwnedDivisions.length === 0 && fetchedTeams.length > 0) {
            const parentLeagueIds = [...new Set(fetchedTeams.map(t => t.leagueId).filter(Boolean))];
            const parentDivisionIds = [...new Set(fetchedTeams.map(t => t.divisionId).filter(Boolean))];

            const [allLeaguesSnap, allDivisionsSnap] = await Promise.all([
              getDocs(collection(db, 'saas_data', 'v1', 'leagues')),
              getDocs(collection(db, 'saas_data', 'v1', 'divisions')),
            ]);
            const allLeaguesMap = {};
            allLeaguesSnap.forEach(d => allLeaguesMap[d.id] = { id: d.id, ...d.data() });
            const allDivisionsMap = {};
            allDivisionsSnap.forEach(d => allDivisionsMap[d.id] = { id: d.id, ...d.data() });

            fetchedContextLeagues = parentLeagueIds.map(id => allLeaguesMap[id]).filter(Boolean);
            fetchedContextDivisions = parentDivisionIds.map(id => allDivisionsMap[id]).filter(Boolean);
          }

          if (fetchedOwnedDivisions.length > 0) {
             const allTeamsSnap = await getDocs(collection(db, 'saas_data', 'v1', 'teams'));
             const myDivIds = new Set(fetchedOwnedDivisions.map(d => d.id));
             const existingIds = new Set(fetchedTeams.map(t => t.id));
             allTeamsSnap.forEach(d => {
                if (myDivIds.has(d.data().divisionId) && !existingIds.has(d.id)) {
                   fetchedTeams.push({ id: d.id, ...d.data() });
                }
             });
          }
        }

        setTeams(fetchedTeams);
        setOwnedLeagues(fetchedOwnedLeagues);
        setOwnedDivisions(fetchedOwnedDivisions);
        setContextLeagues(fetchedContextLeagues);
        setContextDivisions(fetchedContextDivisions);
        setLeagues(fetchedOwnedLeagues.length > 0 ? fetchedOwnedLeagues : fetchedContextLeagues);
        setDivisions(fetchedOwnedDivisions.length > 0 ? fetchedOwnedDivisions : fetchedContextDivisions);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setLoading(false);
    }

    async function ensureSuperAdmin() {
      if (currentUser.email === 'tmrichardson44@gmail.com' && currentUser.systemRole !== 'super_admin') {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { systemRole: 'super_admin' });
        } catch (e) {
          console.error('Failed to auto-upgrade to super admin', e);
        }
      }
    }

    ensureSuperAdmin();
    fetchData();
  }, [currentUser, navigate, isSuperAdmin]);

  const getDivisionTheme = (name) => {
    if (!name || name === 'No Division') return 'div-theme-slate';
    const lower = name.toLowerCase().trim();
    
    // Explicit mapping for predictable colors
    if (lower.includes('minor')) return 'div-theme-rose';    // Minors = Red/Rose
    if (lower.includes('farm'))  return 'div-theme-blue';    // Farm = Blue
    if (lower.includes('major')) return 'div-theme-emerald'; // Majors = Green
    if (lower.includes('ball') || lower.includes('tball')) return 'div-theme-amber';
    
    // Fallback hashing for anything else
    const themes = ['indigo', 'violet', 'rose', 'blue', 'amber', 'emerald'];
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
      hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return `div-theme-${themes[index]}`;
  };

  const [newTeamLeagueId, setNewTeamLeagueId] = useState('');
  const [newTeamDivisionId, setNewTeamDivisionId] = useState('');

  useEffect(() => {
    if (isCreatingTeam) {
      const myOnlyLeague = leagues.length === 1 ? leagues[0] : null;
      const myOnlyDivision = divisions.length === 1 ? divisions[0] : null;
      const myFirstTeam = teams.length > 0 ? teams[0] : null;

      if (myOnlyDivision) {
        setNewTeamLeagueId(myOnlyDivision.leagueId);
        setNewTeamDivisionId(myOnlyDivision.id);
      } else if (myOnlyLeague) {
        setNewTeamLeagueId(myOnlyLeague.id);
      } else if (myFirstTeam) {
        setNewTeamLeagueId(myFirstTeam.leagueId || '');
        setNewTeamDivisionId(myFirstTeam.divisionId || '');
      }
    }
  }, [isCreatingTeam, leagues, divisions, teams]);

  async function handleCreateTeam(e) {
    if (e) e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const payload = {
        name: newTeamName.trim(),
        program: newTeamProgram,
        managerUid: currentUser.uid,
        leagueId: newTeamLeagueId || null,
        divisionId: newTeamDivisionId || null,
        createdAt: new Date().toISOString()
      };
      const newTeamRef = await addDoc(collection(db, 'saas_data', 'v1', 'teams'), payload);
      setTeams([...teams, { id: newTeamRef.id, ...payload }]);
      setIsCreatingTeam(false);
      setNewTeamName('');
    } catch (err) {
      alert('Failed to create team: ' + err.message);
    }
  }

  async function handleCreateLeague(e) {
    if (e) e.preventDefault();
    if (!newLeagueName.trim()) return;
    try {
      const payload = {
        name: newLeagueName.trim(),
        program: newLeagueProgram,
        adminUid: currentUser.uid,
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'saas_data', 'v1', 'leagues'), payload);
      setLeagues([...leagues, { id: ref.id, ...payload }]);
      setIsCreatingLeague(false);
      setNewLeagueName('');
    } catch (err) {
      alert('Failed to create league: ' + err.message);
    }
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const allDivisions = [...ownedDivisions, ...contextDivisions];
    const divA = allDivisions.find(d => d.id === a.divisionId)?.name?.toLowerCase() || 'zzzz';
    const divB = allDivisions.find(d => d.id === b.divisionId)?.name?.toLowerCase() || 'zzzz';
    if (divA < divB) return -1;
    if (divA > divB) return 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-800 antialiased">
      {/* ── Overlays ── */}
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-lg p-6 w-full max-w-md shadow-xl animation-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-semibold text-gray-800">New Team</h3>
              <button
                onClick={() => { setIsCreatingTeam(false); setNewTeamName(''); setNewTeamLeagueId(''); setNewTeamDivisionId(''); }}
                className="w-7 h-7 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Team Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white border border-slate-100 rounded-lg px-4 py-2.5 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-sm"
                  placeholder="e.g. The Sandlot Legends"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">League</label>
                  <select
                    className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs"
                    value={newTeamLeagueId}
                    onChange={e => {
                      setNewTeamLeagueId(e.target.value);
                      setNewTeamDivisionId('');
                    }}
                  >
                    <option value="">— Select —</option>
                    {[...ownedLeagues, ...contextLeagues].map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Division</label>
                  <select
                    className="w-full bg-white border border-slate-100 rounded-lg px-3 py-2 font-medium text-slate-700 outline-none focus:border-emerald-500 transition-all text-xs"
                    value={newTeamDivisionId}
                    onChange={e => setNewTeamDivisionId(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {[...ownedDivisions, ...contextDivisions]
                      .filter(d => !newTeamLeagueId || d.leagueId === newTeamLeagueId)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!newTeamName.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 transition text-white font-semibold py-2.5 rounded-lg text-sm tracking-wide disabled:opacity-50 mt-2 shadow-sm"
              >
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}

      {isCreatingLeague && (
        <LeagueSetupWizard
          currentUser={currentUser}
          onClose={() => setIsCreatingLeague(false)}
          onComplete={() => { setIsCreatingLeague(false); window.location.reload(); }}
        />
      )}

      {/* ── Nav ── */}
      <nav className="nav-header">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-emerald-600 tracking-tight">LINEUP HERO <span className="text-slate-400 ml-0.5">PRO</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pro/profile" className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <Users className="w-4 h-4 text-slate-400" />
            </Link>
            <button
               onClick={() => setIsCreatingTeam(true)}
               className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button onClick={logout} title="Log Out" className="p-1 text-slate-300 hover:text-slate-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {isSuperAdmin() && (
          <div className="bg-rose-50/50 border border-rose-100 rounded-lg px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Super Admin Mode</p>
            </div>
            <Link to="/admin" className="text-rose-600 text-[10px] font-bold uppercase tracking-widest hover:underline">Open Panel</Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 leading-tight">
              {isLeagueOwner ? 'League Dashboard' : isDivisionAdmin ? 'Division Dashboard' : isCoach ? 'Coach View' : 'Welcome'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {isLeagueOwner && `${ownedLeagues.length} LEAGUES · ${ownedDivisions.length} DIVISIONS · ${teams.length} TEAMS`}
              {isDivisionAdmin && `${ownedDivisions.length} DIVISIONS · ${teams.length} TEAMS`}
              {isCoach && `${teams.length} TEAMS MANAGED`}
            </p>
          </div>
        </div>

        {/* Leagues */}
        {(isLeagueOwner || isNewUser || isSuperAdmin()) && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">Leagues</h2>
                <p className="section-subtitle">Manage high-level league programs</p>
              </div>
              <button onClick={() => setIsCreatingLeague(true)} className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all">
                <Plus className="w-3 h-3" /> Create League
              </button>
            </div>

            {ownedLeagues.length === 0 ? (
              <div className="card-premium p-12 text-center border-dashed border-2 border-slate-100 bg-slate-50/30">
                <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-600 mb-1">No Leagues Yet</h3>
                <p className="text-[10px] text-slate-400 font-medium mb-4">Start by creating your first program.</p>
                <button onClick={() => setIsCreatingLeague(true)} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-sm hover:bg-emerald-700 transition">Get Started</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ownedLeagues.map(league => (
                  <Link key={league.id} to={`/pro/league/${league.id}`}
                    className="card-premium group border-t-2 border-t-emerald-500 overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="p-6">
                       <div className="w-10 h-10 bg-emerald-700 text-white rounded-lg flex items-center justify-center mb-5 shadow-sm">
                          <Trophy className="w-5 h-5" />
                       </div>
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-1">{league.name}</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">{league.program || 'Lineup Hero'}</p>
                       <div className="flex items-center text-emerald-600 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                         Open Dashboard <ChevronRight className="w-3 h-3 ml-1" />
                       </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Divisions */}
        {(isLeagueOwner || isDivisionAdmin || isSuperAdmin()) && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">Divisions</h2>
                <p className="section-subtitle">Manage intermediate division layers</p>
              </div>
              <button onClick={() => setIsCreatingDivision(true)} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all">
                <Plus className="w-3 h-3" /> Add Division
              </button>
            </div>

            {ownedDivisions.length === 0 ? (
              <div className="card-premium p-12 text-center border-dashed border-2 border-slate-100 bg-slate-50/30">
                <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-600 mb-1">No Divisions</h3>
                <p className="text-[10px] text-slate-400 font-medium mb-4">Divisions help group teams within a league.</p>
                <button onClick={() => setIsCreatingDivision(true)} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-900 transition">Add Division</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ownedDivisions.map(division => {
                  const league = [...ownedLeagues, ...contextLeagues].find(l => l.id === division.leagueId);
                  return (
                    <Link key={division.id} to={`/pro/division/${division.id}`}
                      className="card-premium group hover:shadow-md transition-all"
                    >
                      <div className="p-6">
                         <div className="w-10 h-10 bg-slate-600 text-white rounded-lg flex items-center justify-center mb-5 shadow-sm">
                            <Layers className="w-5 h-5" />
                         </div>
                         <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-1">{division.name}</h3>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mb-6">{league?.name || 'League'}</p>
                         <div className="flex items-center text-emerald-600 font-bold text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                           Manage Division <ChevronRight className="w-3 h-3 ml-1" />
                         </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Teams */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-title">Teams</h2>
              <p className="section-subtitle">Manage rosters and lineups for active teams</p>
            </div>
            <button onClick={() => setIsCreatingTeam(true)} className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all">
              <Plus className="w-3 h-3" /> New team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="card-premium p-10 text-center border-dashed border-2 border-slate-100 bg-slate-50/30">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-600 mb-1">No Active Teams</h3>
              <p className="text-[10px] text-slate-400 font-medium mb-4">Start by creating your first team.</p>
              <button onClick={() => setIsCreatingTeam(true)} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-sm hover:bg-emerald-700 transition">Create Team</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedTeams.map(team => {
                    const div = [...ownedDivisions, ...contextDivisions].find(d => d.id === team.divisionId);
                    const league = [...ownedLeagues, ...contextLeagues].find(l => l.id === team.leagueId);
                    const themeClass = getDivisionTheme(div?.name);

                    return (
                      <Link key={team.id} to={`/pro/team/${team.id}`}
                        className={`card-premium card-premium-hover p-4 flex items-center gap-4 border-l-4 ${themeClass}`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border ${themeClass}`}>
                          <Trophy className="w-5 h-5" />
                        </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight truncate mb-0.5">{team.name}</h3>
                      <div className="flex flex-wrap items-center gap-1">
                        {league && <span className="badge-breadcrumb">{league.name}</span>}
                        {league && div && <ChevronRight className="w-2 h-2 text-slate-300" />}
                        {div && <span className="badge-breadcrumb">{div.name}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-200 shrink-0 group-hover:text-emerald-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* wizards */}
      {isCreatingDivision && (() => {
         const allAvailLeagues = [...new Map([...ownedLeagues, ...contextLeagues].map(l => [l.id, l])).values()];
         if (allAvailLeagues.length === 0) return null;
         
         if (!newDivisionLeagueId && allAvailLeagues.length > 1) {
            return (
              <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-lg w-full max-w-sm shadow-2xl overflow-hidden animation-in zoom-in-95 duration-200 border border-slate-100">
                  <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-[10px] font-bold text-white uppercase tracking-widest">Select Parent League</h2>
                    <button onClick={() => setIsCreatingDivision(false)} className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-5 space-y-2">
                     {allAvailLeagues.map(l => (
                      <button key={l.id} onClick={() => setNewDivisionLeagueId(l.id)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all text-left">
                        <Trophy className="w-4 h-4 text-slate-300" />
                        <span className="font-semibold text-slate-700 text-xs">{l.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
         }

         const selectedLeague = allAvailLeagues.find(l => l.id === newDivisionLeagueId) || allAvailLeagues[0];
         return (
            <DivisionSetupWizard
              currentUser={currentUser}
              leagueId={selectedLeague.id}
              leagueName={selectedLeague.name}
              onClose={() => { setIsCreatingDivision(false); setNewDivisionLeagueId(''); }}
              onComplete={() => { setIsCreatingDivision(false); setNewDivisionLeagueId(''); window.location.reload(); }}
            />
         );
      })()}
    </div>
  );
}
