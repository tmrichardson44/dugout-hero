import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, LogOut, ShieldAlert, Plus, X, Trophy, ChevronRight, Layers } from 'lucide-react';

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
  const [newLeagueProgram, setNewLeagueProgram] = useState('Hopkinton Little League');
  
  const [isCreatingDivision, setIsCreatingDivision] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newDivisionLeagueId, setNewDivisionLeagueId] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/pro');
      return;
    }

    async function fetchData() {
      try {
        let teamsPromise, leaguesPromise, divisionsPromise;

        if (isSuperAdmin()) {
          // Super Admin: fetch everything
          teamsPromise = getDocs(collection(db, 'saas_data', 'v1', 'teams'));
          leaguesPromise = getDocs(collection(db, 'saas_data', 'v1', 'leagues'));
          divisionsPromise = getDocs(collection(db, 'saas_data', 'v1', 'divisions'));
        } else {
          // Normal user / League Admin / Division Admin / Coach
          teamsPromise = getDocs(query(collection(db, 'saas_data', 'v1', 'teams'), where('managerUid', '==', currentUser.uid)));
          leaguesPromise = getDocs(query(collection(db, 'saas_data', 'v1', 'leagues'), where('adminUid', '==', currentUser.uid)));
          divisionsPromise = getDocs(query(collection(db, 'saas_data', 'v1', 'divisions'), where('adminUid', '==', currentUser.uid)));
        }

        const [teamsSnap, leaguesSnap, divisionsSnap] = await Promise.all([
          teamsPromise, leaguesPromise, divisionsPromise
        ]);

        setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLeagues(leaguesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setDivisions(divisionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  async function handleCreateTeam(e) {
    if (e) e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const newTeamRef = await addDoc(collection(db, 'saas_data', 'v1', 'teams'), {
        name: newTeamName.trim(),
        program: newTeamProgram,
        managerUid: currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setTeams([...teams, { id: newTeamRef.id, name: newTeamName.trim(), program: newTeamProgram, managerUid: currentUser.uid }]);
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
      const ref = await addDoc(collection(db, 'saas_data', 'v1', 'leagues'), {
        name: newLeagueName.trim(),
        program: newLeagueProgram,
        adminUid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setLeagues([...leagues, { id: ref.id, name: newLeagueName.trim(), program: newLeagueProgram, adminUid: currentUser.uid }]);
      setIsCreatingLeague(false);
      setNewLeagueName('');
    } catch (err) {
      alert('Failed to create league: ' + err.message);
    }
  }

  async function handleCreateDivision(e) {
    if (e) e.preventDefault();
    if (!newDivisionName.trim() || !newDivisionLeagueId) return;
    try {
      const parentLeague = leagues.find(l => l.id === newDivisionLeagueId);
      const ref = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), {
        name: newDivisionName.trim(),
        leagueId: newDivisionLeagueId,
        adminUid: currentUser.uid,
        adminEmail: currentUser.email,
        createdAt: serverTimestamp()
      });
      setDivisions([...divisions, { id: ref.id, name: newDivisionName.trim(), leagueId: newDivisionLeagueId, adminEmail: currentUser.email, adminUid: currentUser.uid }]);
      setIsCreatingDivision(false);
      setNewDivisionName('');
      setNewDivisionLeagueId('');
    } catch (err) {
      alert('Failed to create division: ' + err.message);
    }
  }

  if (loading) return <div className="min-h-screen bg-white/40 backdrop-blur-sm flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-violet-500 border-t-emerald-100 rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-white/40 backdrop-blur-sm relative">
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">New Team</h3>
              <button 
                onClick={() => { setIsCreatingTeam(false); setNewTeamName(''); }} 
                className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Team Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-violet-500 transition-all uppercase placeholder:normal-case"
                  placeholder="e.g. The Sandlot Legends"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Program</label>
                <select
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-violet-500 transition-all appearance-none cursor-pointer"
                  value={newTeamProgram}
                  onChange={e => setNewTeamProgram(e.target.value)}
                >
                  <option value="Hopkinton Little League">Hopkinton Little League</option>
                  <option disabled value="">More programs coming soon...</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!newTeamName.trim()}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:to-teal-300 shadow-md shadow-emerald-500/20 hover:-translate-y-0.5 hover:shadow-emerald-500/30 transition-all duration-300 font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 tracking-wide font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:shadow-none"
              >
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}

      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-lg relative z-10">
        <div className="font-black tracking-widest uppercase">Lineup Hero <span className="text-emerald-400">PRO</span></div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-300 hidden sm:inline-block mr-2">{currentUser?.email}</span>
          <Link to="/pro/profile" className="bg-blue-700 text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-blue-800 transition tracking-wide font-medium">
             Profile
          </Link>
          <button onClick={logout} title="Log Out" className="p-2 hover:bg-blue-700 rounded-xl transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8 space-y-8">
        {isSuperAdmin() && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-rose-700">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h3 className="font-bold tracking-wide">Super Admin Access</h3>
                <p className="text-sm font-bold opacity-80">You have system-wide privileges to see all data.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/admin" className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold tracking-wide text-xs hover:bg-rose-700 transition">Enter Admin Panel</Link>
            </div>
          </div>
        )}

        {/* ── My Leagues ── */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">My Leagues</h2>
              <p className="text-slate-400 font-bold text-sm">Manage leagues and delegate to coaches.</p>
            </div>
            <button onClick={() => setIsCreatingLeague(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-xs tracking-wide font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200">
              <Plus className="w-4 h-4" /> New League
            </button>
          </div>

          {leagues.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-10 text-center border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300">
              <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-700 mb-1">No Leagues Yet</h3>
              <p className="text-slate-400 font-bold text-sm mb-4">Create a league to manage multiple teams and coaches.</p>
              <button onClick={() => setIsCreatingLeague(true)} className="bg-blue-100 text-blue-700 px-6 py-3 rounded-2xl font-black text-sm tracking-wide font-medium hover:bg-blue-200 transition">
                Create League
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map(league => (
                <Link key={league.id} to={`/pro/league/${league.id}`} className="bg-white/60 backdrop-blur-xl border border-white/40  p-6 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300 hover:shadow-lg hover:border-blue-300 transition-all group block">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-1">{league.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wide font-medium leading-none mb-1">{league.program || 'Independent'}</p>
                  <div className="flex items-center gap-1 text-blue-500 mt-4 pt-4 border-t border-slate-50">
                    <ChevronRight className="w-3 h-3" />
                    <p className="text-[10px] font-bold tracking-wide">Open League Dashboard</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── My Divisions ── */}
        {(divisions.length > 0 || isSuperAdmin()) && (
          <div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">My Divisions</h2>
                <p className="text-slate-400 font-bold text-sm">Manage division settings and sub-teams.</p>
              </div>
              <button 
                onClick={() => setIsCreatingDivision(true)} 
                className="bg-slate-600 text-white px-5 py-3 rounded-2xl font-black text-xs tracking-wide font-medium hover:bg-slate-700 transition flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                <Plus className="w-4 h-4" /> New Division
              </button>
            </div>

            {divisions.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-10 text-center border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300">
                <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <h3 className="text-lg font-black text-slate-700 mb-1">No Divisions Yet</h3>
                <p className="text-slate-400 font-bold text-sm mb-4">You are not a division admin for any divisions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {divisions.map(division => (
                  <Link key={division.id} to={`/pro/division/${division.id}`} className="bg-white/60 backdrop-blur-xl border border-white/40  p-6 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300 hover:shadow-lg hover:border-slate-300 transition-all group block">
                    <div className="w-12 h-12 bg-white/40 backdrop-blur-sm text-slate-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-1">{division.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wide font-medium leading-none mb-1">Division Admin</p>
                    <div className="flex items-center gap-1 text-slate-500 mt-4 pt-4 border-t border-slate-50">
                      <ChevronRight className="w-3 h-3" />
                      <p className="text-[10px] font-bold tracking-wide">Open Division Dashboard</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── My Teams ── */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">My Teams</h2>
              <p className="text-slate-400 font-bold text-sm">Select a team to manage roster and games.</p>
            </div>
            <button onClick={() => setIsCreatingTeam(true)} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:to-teal-300 shadow-md shadow-emerald-500/20 hover:-translate-y-0.5 hover:shadow-emerald-500/30 transition-all duration-300 px-5 py-3 rounded-2xl font-black text-xs tracking-wide font-medium hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-200">
              <Plus className="w-4 h-4" /> New Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-12 text-center border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-700 mb-2">No Teams Yet</h3>
              <p className="text-slate-500 font-bold mb-6">Create your first team to start managing your season.</p>
              <button onClick={() => setIsCreatingTeam(true)} className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-2xl font-black text-sm tracking-wide font-medium hover:bg-emerald-200 transition">
                Create Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map(team => (
                <Link key={team.id} to={`/pro/team/${team.id}`} className="bg-white/60 backdrop-blur-xl border border-white/40  p-6 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300 hover:shadow-lg hover:border-violet-300 transition-all group block">
                  <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-1">{team.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wide font-medium leading-none mb-1">{team.program || 'Independent'}</p>
                  <p className="text-[10px] text-slate-300 font-bold tracking-wide mt-4 pt-4 border-t border-slate-50">Team ID: {team.id.slice(0,6)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create League Modal */}
      {isCreatingDivision && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">New Division</h3>
              <button 
                onClick={() => { setIsCreatingDivision(false); setNewDivisionName(''); setNewDivisionLeagueId(''); }} 
                className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDivision} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Division Name</label>
                <input
                  type="text" autoFocus
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-slate-500 transition-all uppercase placeholder:normal-case"
                  placeholder="e.g. Minors"
                  value={newDivisionName}
                  onChange={e => setNewDivisionName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Parent League</label>
                <select
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-slate-500 transition-all"
                  value={newDivisionLeagueId}
                  onChange={e => setNewDivisionLeagueId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a League...</option>
                  {leagues.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={!newDivisionName.trim() || !newDivisionLeagueId}
                className="w-full bg-slate-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-200 tracking-wide font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:shadow-none"
              >
                Create Division
              </button>
            </form>
          </div>
        </div>
      )}

      {isCreatingLeague && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">New League</h3>
              <button onClick={() => { setIsCreatingLeague(false); setNewLeagueName(''); }} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLeague} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">League Name</label>
                <input
                  type="text" autoFocus
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-blue-500 transition-all uppercase placeholder:normal-case"
                  placeholder="e.g. Hopkinton Spring League"
                  value={newLeagueName}
                  onChange={e => setNewLeagueName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Program</label>
                <select
                  className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  value={newLeagueProgram}
                  onChange={e => setNewLeagueProgram(e.target.value)}
                >
                  <option value="Hopkinton Little League">Hopkinton Little League</option>
                  <option disabled value="">More programs coming soon...</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!newLeagueName.trim()}
                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 tracking-wide font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:shadow-none"
              >
                Create League
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
