import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, LogOut, ShieldAlert, Plus, X, Trophy, ChevronRight } from 'lucide-react';

export default function ProDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamProgram, setNewTeamProgram] = useState('Hopkinton Little League');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueProgram, setNewLeagueProgram] = useState('Hopkinton Little League');

  useEffect(() => {
    if (!currentUser) {
      navigate('/pro');
      return;
    }

    async function fetchData() {
      try {
        const [teamsSnap, leaguesSnap] = await Promise.all([
          getDocs(query(collection(db, 'saas_data', 'v1', 'teams'), where('managerUid', '==', currentUser.uid))),
          getDocs(query(collection(db, 'saas_data', 'v1', 'leagues'), where('adminUid', '==', currentUser.uid)))
        ]);
        setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLeagues(leaguesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setLoading(false);
    }

    fetchData();
  }, [currentUser, navigate]);

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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-emerald-500 border-t-emerald-100 rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
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
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Team Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all uppercase placeholder:normal-case"
                  placeholder="e.g. The Sandlot Legends"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Program</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer"
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
                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:shadow-none"
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
          <Link to="/pro/profile" className="bg-blue-700 text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-blue-800 transition uppercase tracking-widest">
             Profile
          </Link>
          <button onClick={logout} title="Log Out" className="p-2 hover:bg-blue-700 rounded-xl transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8 space-y-8">
        {currentUser?.isAdmin && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-4 text-rose-700">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h3 className="font-black uppercase tracking-widest">Super Admin Access</h3>
                <p className="text-sm font-bold opacity-80">You have system-wide privileges.</p>
              </div>
            </div>
            <Link to="/admin" className="bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-rose-700 transition">Enter Admin Panel</Link>
          </div>
        )}

        {/* ── My Leagues ── */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">My Leagues</h2>
              <p className="text-slate-400 font-bold text-sm">Manage leagues and delegate to coaches.</p>
            </div>
            <button onClick={() => setIsCreatingLeague(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200">
              <Plus className="w-4 h-4" /> New League
            </button>
          </div>

          {leagues.length === 0 ? (
            <div className="bg-white rounded-[32px] p-10 text-center border border-slate-200 shadow-sm">
              <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-700 mb-1">No Leagues Yet</h3>
              <p className="text-slate-400 font-bold text-sm mb-4">Create a league to manage multiple teams and coaches.</p>
              <button onClick={() => setIsCreatingLeague(true)} className="bg-blue-100 text-blue-700 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-200 transition">
                Create League
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagues.map(league => (
                <Link key={league.id} to={`/pro/league/${league.id}`} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all group block">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-1">{league.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">{league.program || 'Independent'}</p>
                  <div className="flex items-center gap-1 text-blue-500 mt-4 pt-4 border-t border-slate-50">
                    <ChevronRight className="w-3 h-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Open League Dashboard</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── My Teams ── */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">My Teams</h2>
              <p className="text-slate-400 font-bold text-sm">Select a team to manage roster and games.</p>
            </div>
            <button onClick={() => setIsCreatingTeam(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-200">
              <Plus className="w-4 h-4" /> New Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center border border-slate-200 shadow-sm">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-700 mb-2">No Teams Yet</h3>
              <p className="text-slate-500 font-bold mb-6">Create your first team to start managing your season.</p>
              <button onClick={() => setIsCreatingTeam(true)} className="bg-emerald-100 text-emerald-700 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-200 transition">
                Create Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map(team => (
                <Link key={team.id} to={`/pro/team/${team.id}`} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all group block">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-1">{team.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">{team.program || 'Independent'}</p>
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-4 pt-4 border-t border-slate-50">Team ID: {team.id.slice(0,6)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create League Modal */}
      {isCreatingLeague && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">New League</h3>
              <button onClick={() => { setIsCreatingLeague(false); setNewLeagueName(''); }} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLeague} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">League Name</label>
                <input
                  type="text" autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all uppercase placeholder:normal-case"
                  placeholder="e.g. Hopkinton Spring League"
                  value={newLeagueName}
                  onChange={e => setNewLeagueName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Program</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none cursor-pointer"
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
                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:shadow-none"
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
