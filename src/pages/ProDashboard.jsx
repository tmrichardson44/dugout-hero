import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, LogOut, ShieldAlert, Plus, X, Trophy, ChevronRight, Layers, Trash2 } from 'lucide-react';
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

  // Derive role: based on what the user *owns* in the DB
  // leagueOwner  = has leagues where adminUid === uid
  // divisionAdmin = has divisions where adminUid === uid (but no owned leagues)
  // coach        = has teams where managerUid === uid (but no owned leagues/divisions)
  const [ownedLeagues, setOwnedLeagues] = useState([]);
  const [contextLeagues, setContextLeagues] = useState([]); // read-only leagues (for division admin / coach)
  const [ownedDivisions, setOwnedDivisions] = useState([]);
  const [contextDivisions, setContextDivisions] = useState([]); // read-only divisions (for coach)

  const isLeagueOwner = ownedLeagues.length > 0;
  const isDivisionAdmin = !isLeagueOwner && ownedDivisions.length > 0;
  const isCoach = !isLeagueOwner && !isDivisionAdmin && teams.length > 0;

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
          // Super Admin: fetch everything
          const [tSnap, lSnap, dSnap] = await Promise.all([
            getDocs(collection(db, 'saas_data', 'v1', 'teams')),
            getDocs(collection(db, 'saas_data', 'v1', 'leagues')),
            getDocs(collection(db, 'saas_data', 'v1', 'divisions')),
          ]);
          fetchedTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedLeagues = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedDivisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          // Step 1: Fetch what the user directly owns
          const [tSnap, lSnap, dSnap] = await Promise.all([
            getDocs(query(collection(db, 'saas_data', 'v1', 'teams'), where('managerUid', '==', currentUser.uid))),
            getDocs(query(collection(db, 'saas_data', 'v1', 'leagues'), where('adminUid', '==', currentUser.uid))),
            getDocs(query(collection(db, 'saas_data', 'v1', 'divisions'), where('adminUid', '==', currentUser.uid))),
          ]);
          fetchedTeams = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedLeagues = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          fetchedOwnedDivisions = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Step 1.5: For League Owners — also fetch ALL divisions in their leagues.
          // Divisions store adminUid = the division admin's uid (not the league owner's), so the
          // initial query by adminUid returns nothing for league owners. Fix: query by leagueId.
          if (fetchedOwnedLeagues.length > 0) {
            const leagueIds = fetchedOwnedLeagues.map(l => l.id);
            const leagueDivSnap = await getDocs(
              query(collection(db, 'saas_data', 'v1', 'divisions'), where('leagueId', 'in', leagueIds))
            );
            const leagueDivisions = leagueDivSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Merge, deduplicating any that already came back from the adminUid query
            const existingIds = new Set(fetchedOwnedDivisions.map(d => d.id));
            leagueDivisions.forEach(d => { if (!existingIds.has(d.id)) fetchedOwnedDivisions.push(d); });
          }

          // Step 2: For Division Admins — fetch their parent league (read-only context)
          if (fetchedOwnedLeagues.length === 0 && fetchedOwnedDivisions.length > 0) {
            const parentLeagueIds = [...new Set(fetchedOwnedDivisions.map(d => d.leagueId).filter(Boolean))];
            const allLeaguesSnap = await getDocs(collection(db, 'saas_data', 'v1', 'leagues'));
            const allLeaguesMap = {};
            allLeaguesSnap.forEach(d => allLeaguesMap[d.id] = { id: d.id, ...d.data() });
            fetchedContextLeagues = parentLeagueIds.map(id => allLeaguesMap[id]).filter(Boolean);
          }

          // Step 3: For Coaches — fetch their parent league AND division (read-only context)
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
        }

        setTeams(fetchedTeams);
        setOwnedLeagues(fetchedOwnedLeagues);
        setOwnedDivisions(fetchedOwnedDivisions);
        setContextLeagues(fetchedContextLeagues);
        setContextDivisions(fetchedContextDivisions);
        // For backward compat with existing modal logic
        setLeagues(fetchedOwnedLeagues.length > 0 ? fetchedOwnedLeagues : fetchedContextLeagues);
        setDivisions(fetchedOwnedDivisions.length > 0 ? fetchedOwnedDivisions : fetchedContextDivisions);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setLoading(false);
    }

    async function ensureSuperAdmin() {
      // Auto-upgrade the owner email to super_admin if not already
      if (currentUser.email === 'tmrichardson44@gmail.com' && currentUser.systemRole !== 'super_admin') {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            systemRole: 'super_admin'
          });
          // Note: The context will update soon from the listener
        } catch (e) {
          console.error('Failed to auto-upgrade to super admin', e);
        }
      }
    }

    ensureSuperAdmin();
    fetchData();
  }, [currentUser, navigate, isSuperAdmin]);

  // Derived state to help creation modals
  const myOnlyLeague = leagues.length === 1 ? leagues[0] : null;
  const myOnlyDivision = divisions.length === 1 ? divisions[0] : null;
  const myFirstTeam = teams.length > 0 ? teams[0] : null;

  const [newTeamLeagueId, setNewTeamLeagueId] = useState('');
  const [newTeamDivisionId, setNewTeamDivisionId] = useState('');

  useEffect(() => {
    if (isCreatingTeam) {
      if (myOnlyDivision) {
        setNewTeamLeagueId(myOnlyDivision.leagueId);
        setNewTeamDivisionId(myOnlyDivision.id);
      } else if (myOnlyLeague) {
        setNewTeamLeagueId(myOnlyLeague.id);
      } else if (myFirstTeam) {
        // Coach context inheritance
        setNewTeamLeagueId(myFirstTeam.leagueId || '');
        setNewTeamDivisionId(myFirstTeam.divisionId || '');
      }
    }
  }, [isCreatingTeam, myOnlyLeague, myOnlyDivision, myFirstTeam]);

  useEffect(() => {
    if (isCreatingDivision) {
      if (myOnlyLeague) {
        setNewDivisionLeagueId(myOnlyLeague.id);
      } else if (myOnlyDivision) {
        setNewDivisionLeagueId(myOnlyDivision.leagueId);
      }
    }
  }, [isCreatingDivision, myOnlyLeague, myOnlyDivision]);

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

  async function handleDeleteLeague(leagueId, leagueName) {
    if (!window.confirm(`Are you sure you want to delete the league "${leagueName}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'saas_data', 'v1', 'leagues', leagueId));
      setLeagues(leagues.filter(l => l.id !== leagueId));
      setOwnedLeagues(ownedLeagues.filter(l => l.id !== leagueId));
    } catch (err) {
      alert('Failed to delete league: ' + err.message);
    }
  }

  async function handleDeleteDivision(divisionId, divisionName) {
    if (!window.confirm(`Delete division "${divisionName}"? All associated data will remain but division context will be lost.`)) return;
    try {
      await deleteDoc(doc(db, 'saas_data', 'v1', 'divisions', divisionId));
      setOwnedDivisions(ownedDivisions.filter(d => d.id !== divisionId));
      setDivisions(divisions.filter(d => d.id !== divisionId));
    } catch (err) {
      alert('Failed to delete division: ' + err.message);
    }
  }

  async function handleCreateDivision(e) {
    if (e) e.preventDefault();
    const finalLeagueId = newDivisionLeagueId || (divisions.length > 0 ? divisions[0].leagueId : null);
    if (!newDivisionName.trim() || !finalLeagueId) {
      alert('League context required for new division.');
      return;
    }
    try {
      const payload = {
        name: newDivisionName.trim(),
        leagueId: finalLeagueId,
        adminUid: currentUser.uid,
        adminEmail: currentUser.email,
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), payload);
      setDivisions([...divisions, { id: ref.id, ...payload }]);
      setIsCreatingDivision(false);
      setNewDivisionName('');
      setNewDivisionLeagueId('');
    } catch (err) {
      alert('Failed to create division: ' + err.message);
    }
  }

  if (loading) return <div className="min-h-screen bg-white/40  flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-emerald-100 rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-white/40  relative">
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">New Team</h3>
              <button
                onClick={() => { setIsCreatingTeam(false); setNewTeamName(''); setNewTeamLeagueId(''); setNewTeamDivisionId(''); }}
                className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Team Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 font-semibold text-slate-700 outline-none focus:border-green-500 transition-all"
                  placeholder="e.g. The Sandlot Legends"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>

              {/* League + Division context */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">League</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-semibold text-slate-700 outline-none focus:border-green-500 transition-all text-sm"
                    value={newTeamLeagueId}
                    onChange={e => {
                      setNewTeamLeagueId(e.target.value);
                      setNewTeamDivisionId('');
                    }}
                  >
                    <option value="">— Select League —</option>
                    {[...ownedLeagues, ...contextLeagues].map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Division</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-semibold text-slate-700 outline-none focus:border-green-500 transition-all text-sm"
                    value={newTeamDivisionId}
                    onChange={e => setNewTeamDivisionId(e.target.value)}
                  >
                    <option value="">— Select Division —</option>
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
                className="w-full bg-green-600 hover:bg-green-700 transition text-white font-bold py-3 rounded-lg tracking-wide disabled:opacity-50"
              >
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}
        <div className="font-bold tracking-widest uppercase text-white">Dugout Hero <span className="text-green-300">PRO</span></div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-green-300 hidden sm:inline-block">{currentUser?.email}</span>
          <Link to="/pro/profile" className="bg-green-700 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-green-600 transition tracking-wide">
            Profile
          </Link>
          <button onClick={logout} title="Log Out" className="p-2 hover:bg-green-700 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── Super Admin Banner ── */}
        {isSuperAdmin() && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-rose-700">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Super Admin Access</h3>
                <p className="text-xs text-rose-500 mt-0.5">System-wide privileges — all data visible.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!window.confirm('Run Dev Setup for Test Users? (Clear existing and rebuild)')) return;
                  try {
                    const LEAGUE_ADMIN_EMAIL = 'league_admin@test.com';
                    const DIVISION_ADMIN_EMAIL = 'division_admin@test.com';
                    const COACH_USER_EMAIL = 'coach_user@test.com';
                    let LU = 'vUiDeCB44MXIVNRt7SqQV32r1Fz1', DU = 'SbEilYxapSeT8v5DiwhbWjLhSS33', CU = 'PXuoGaGnQugDms8ZaoYl1C0Ge673';
                    const usersSnap = await getDocs(collection(db, 'users'));
                    usersSnap.forEach(d => {
                      const data = d.data();
                      if (data.email === LEAGUE_ADMIN_EMAIL) LU = d.id;
                      if (data.email === DIVISION_ADMIN_EMAIL) DU = d.id;
                      if (data.email === COACH_USER_EMAIL) CU = d.id;
                    });
                    const leagueRef = await addDoc(collection(db, 'saas_data', 'v1', 'leagues'), { name: 'Test Alpha League', program: 'Hopkinton Little League', adminUid: LU, createdAt: serverTimestamp() });
                    const divisionRef = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), { name: 'Majors Division', leagueId: leagueRef.id, adminUid: DU, adminEmail: DIVISION_ADMIN_EMAIL, createdAt: serverTimestamp() });
                    await addDoc(collection(db, 'saas_data', 'v1', 'teams'), { name: 'Test Gamma Team', leagueId: leagueRef.id, divisionId: divisionRef.id, managerUid: CU, coachEmail: COACH_USER_EMAIL, program: 'Hopkinton Little League', createdAt: serverTimestamp(), seasonSettings: { teamName: 'Test Gamma Team', rosterSize: 12, innings: 6, battingTarget: 6.5 } });
                    alert('Dev Setup Complete!');
                    window.location.reload();
                  } catch (e) { alert('Dev Setup Failed: ' + e.message); }
                }}
                className="bg-rose-100 text-rose-700 px-3 py-2 rounded-lg font-mono text-[10px] hover:bg-rose-200 transition"
              >REBUILD_TEST_DATA</button>
              <Link to="/admin" className="bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold text-xs hover:bg-rose-700 transition">Admin Panel</Link>
            </div>
          </div>
        )}

        {/* ── Welcome / Role strip ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isLeagueOwner ? 'League Dashboard' : isDivisionAdmin ? 'Division Dashboard' : 'My Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isLeagueOwner && `${ownedLeagues.length} league${ownedLeagues.length !== 1 ? 's' : ''} · ${ownedDivisions.length} division${ownedDivisions.length !== 1 ? 's' : ''} · ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
              {isDivisionAdmin && `Managing ${ownedDivisions.length} division${ownedDivisions.length !== 1 ? 's' : ''} · ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
              {isCoach && `Managing ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
              {isSuperAdmin() && !isLeagueOwner && !isDivisionAdmin && !isCoach && 'Super Admin — full data access'}
            </p>
          </div>
        </div>

        {/* ── My Leagues ── */}
        {(isLeagueOwner || isSuperAdmin()) && (
          <section>
            {/* Section header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h2 className="text-base font-semibold text-gray-900">My Leagues</h2>
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{ownedLeagues.length}</span>
              </div>
              {(isLeagueOwner || isSuperAdmin()) && (
                <button onClick={() => setIsCreatingLeague(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-xs hover:bg-green-700 transition flex items-center gap-1.5 shadow-sm">
                  <Plus className="w-3.5 h-3.5" /> New League
                </button>
              )}
            </div>

            {ownedLeagues.length === 0 && isSuperAdmin() ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
                <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-600 mb-1">No Leagues Yet</h3>
                <p className="text-xs text-gray-400 mb-4">Create a league to manage divisions and teams.</p>
                <button onClick={() => setIsCreatingLeague(true)} className="bg-green-100 text-green-800 px-5 py-2 rounded-lg font-semibold text-sm hover:bg-green-200 transition">Create Your First League</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedLeagues.map(league => (
                  <Link key={league.id} to={`/pro/league/${league.id}`}
                    className="group bg-white border-l-4 border-l-amber-400 border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-amber-300 transition-all duration-200 block"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
                            <Trophy className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{league.name}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">League</p>
                          </div>
                        </div>
                        {(league.adminUid === currentUser?.uid || isSuperAdmin()) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLeague(league.id, league.name); }}
                            className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-700">Open League Dashboard</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── League Context banner (read-only for Division Admins / Coaches) ── */}
        {!isLeagueOwner && !isSuperAdmin() && contextLeagues.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
              <Trophy className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Your League</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{contextLeagues[0]?.name}</p>
            </div>
            <span className="text-[10px] font-semibold text-amber-500 bg-amber-100 px-2 py-1 rounded-full uppercase tracking-wide shrink-0">View Only</span>
          </div>
        )}

        {/* ── My Divisions ── */}
        {(isLeagueOwner || isDivisionAdmin || isSuperAdmin()) && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">My Divisions</h2>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{ownedDivisions.length}</span>
              </div>
              {(isLeagueOwner || isDivisionAdmin || isSuperAdmin()) && (
                <button onClick={() => setIsCreatingDivision(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm">
                  <Plus className="w-3.5 h-3.5" /> New Division
                </button>
              )}
            </div>

            {ownedDivisions.length === 0 && !isSuperAdmin() ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
                <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-600 mb-1">No Divisions Yet</h3>
                <p className="text-xs text-gray-400 mb-4">Create a division within your league to get started.</p>
                <button onClick={() => setIsCreatingDivision(true)} className="bg-blue-100 text-blue-800 px-5 py-2 rounded-lg font-semibold text-sm hover:bg-blue-200 transition">Create Division</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedDivisions.map(division => {
                  const league = [...ownedLeagues, ...contextLeagues].find(l => l.id === division.leagueId);
                  return (
                    <Link key={division.id} to={`/pro/division/${division.id}`}
                      className="group bg-white border-l-4 border-l-blue-400 border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-blue-300 transition-all duration-200 block"
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center shrink-0">
                              <Layers className="w-[18px] h-[18px]" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{division.name}</h3>
                              {league && <p className="text-xs text-gray-400 mt-0.5 truncate">{league.name}</p>}
                            </div>
                          </div>
                          {(isLeagueOwner || isSuperAdmin()) && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteDivision(division.id, division.name); }}
                              className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                            ><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                      <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-700">Open Division Dashboard</span>
                        <ChevronRight className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Division Context banner (read-only for Coaches) ── */}
        {isCoach && contextDivisions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Your Division</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{contextDivisions[0]?.name}</p>
            </div>
            <span className="text-[10px] font-semibold text-blue-500 bg-blue-100 px-2 py-1 rounded-full uppercase tracking-wide shrink-0">View Only</span>
          </div>
        )}

        {/* ── My Teams ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h2 className="text-base font-semibold text-gray-900">My Teams</h2>
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{teams.length}</span>
            </div>
            <button onClick={() => setIsCreatingTeam(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-xs hover:bg-green-700 transition flex items-center gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" /> New Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-gray-600 mb-1">No Teams Yet</h3>
              <p className="text-xs text-gray-400 mb-5">Create your first team to start managing your season.</p>
              <button onClick={() => setIsCreatingTeam(true)} className="bg-green-100 text-green-800 px-5 py-2 rounded-lg font-semibold text-sm hover:bg-green-200 transition">Create Team</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => {
                const allDivisions = [...ownedDivisions, ...contextDivisions];
                const allLeagues = [...ownedLeagues, ...contextLeagues];
                const div = allDivisions.find(d => d.id === team.divisionId);
                const league = allLeagues.find(l => l.id === team.leagueId);
                return (
                  <Link key={team.id} to={`/pro/team/${team.id}`}
                    className="group bg-white border-l-4 border-l-green-400 border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-green-300 transition-all duration-200 block"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-9 h-9 bg-green-100 text-green-700 rounded-lg flex items-center justify-center shrink-0">
                          <Users className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{team.name}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {league && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{league.name}</span>}
                            {div && <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{div.name}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-green-700">Open Team Dashboard</span>
                      <ChevronRight className="w-3.5 h-3.5 text-green-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── League Setup Wizard ── */}
      {isCreatingLeague && (
        <LeagueSetupWizard
          currentUser={currentUser}
          onClose={() => setIsCreatingLeague(false)}
          onComplete={() => { setIsCreatingLeague(false); window.location.reload(); }}
        />
      )}

      {/* ── Division Setup Wizard ── */}
      {isCreatingDivision && (() => {
        // Resolve which league to use for the wizard
        const allAvailLeagues = [...new Map([...ownedLeagues, ...contextLeagues].map(l => [l.id, l])).values()];
        // If only one league available, go straight to wizard
        if (allAvailLeagues.length === 1) {
          return (
            <DivisionSetupWizard
              currentUser={currentUser}
              leagueId={allAvailLeagues[0].id}
              leagueName={allAvailLeagues[0].name}
              onClose={() => setIsCreatingDivision(false)}
              onComplete={() => { setIsCreatingDivision(false); window.location.reload(); }}
            />
          );
        }
        // Multiple leagues — show a quick league picker modal first
        return (
          <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="bg-slate-700 px-7 py-5 flex items-center justify-between">
                <h2 className="text-base font-bold text-white uppercase tracking-wide">Which League?</h2>
                <button onClick={() => setIsCreatingDivision(false)} className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-500 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-slate-400 text-sm font-bold mb-4">Select the league this division belongs to.</p>
                {allAvailLeagues.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setNewDivisionLeagueId(l.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                      ${newDivisionLeagueId === l.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Trophy className={`w-5 h-5 shrink-0 ${newDivisionLeagueId === l.id ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className="font-bold text-slate-800 text-sm">{l.name}</span>
                  </button>
                ))}
                <button
                  disabled={!newDivisionLeagueId}
                  onClick={() => { /* sets selected, will re-render to wizard below */ }}
                  className="w-full mt-2 bg-slate-700 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* If league was selected from picker, show the division wizard */}
      {isCreatingDivision && newDivisionLeagueId && (() => {
        const allAvailLeagues = [...new Map([...ownedLeagues, ...contextLeagues].map(l => [l.id, l])).values()];
        if (allAvailLeagues.length <= 1) return null; // already handled above
        const selectedLeague = allAvailLeagues.find(l => l.id === newDivisionLeagueId);
        if (!selectedLeague) return null;
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
