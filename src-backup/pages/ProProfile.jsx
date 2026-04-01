import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { ArrowLeft, KeySquare, Trash2, Users, UserCircle } from 'lucide-react';

export default function ProProfile() {
  const { currentUser, changePassword, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState(currentUser?.displayName || '');
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/pro');
      return;
    }

    async function fetchTeams() {
      try {
        const q = query(
          collection(db, 'saas_data', 'v1', 'teams'), 
          where('managerUid', '==', currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const fetchedTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTeams(fetchedTeams);
      } catch (err) {
        console.error("Error fetching teams:", err);
      }
      setLoading(false);
    }

    fetchTeams();
  }, [currentUser, navigate]);

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword !== confirmPassword) {
      return setPwdError('Passwords do not match.');
    }

    if (newPassword.length < 6) {
      return setPwdError('Password must be at least 6 characters.');
    }

    setIsUpdatingPwd(true);
    try {
      await changePassword(newPassword);
      setPwdSuccess('Password successfully updated!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError('Failed to change password. ' + err.message);
    }
    setIsUpdatingPwd(false);
  }

  async function handleUpdateName(e) {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    
    if (!editName.trim()) return setNameError('Name cannot be empty.');

    setIsUpdatingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: editName.trim() });
      await setDoc(doc(db, 'users', currentUser.uid), { displayName: editName.trim() }, { merge: true });
      setNameSuccess('Profile name updated! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setNameError('Failed to update name: ' + err.message);
    }
    setIsUpdatingName(false);
  }

  async function handleDeleteAccount() {
    const confirmation = window.prompt("Type 'DELETE' to confirm account deletion. This action cannot be undone.");
    if (confirmation !== 'DELETE') return;

    setIsDeleting(true);
    try {
      // Note: Ideally cloud functions would delete the user's teams too.
      // For now, we just delete their user record and auth profile natively.
      await deleteDoc(doc(db, 'users', currentUser.uid));
      await deleteAccount();
      navigate('/');
    } catch (err) {
      alert("Failed to delete account. You may need to log out and log back in to perform this action. Error: " + err.message);
      setIsDeleting(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-white/40 backdrop-blur-sm flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-violet-500 border-t-emerald-100 rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-white/40 backdrop-blur-sm">
      <nav className="bg-blue-600 text-white p-4 flex items-center gap-4 shadow-lg sticky top-0 z-50">
        <Link to="/pro/dashboard" className="p-2 hover:bg-blue-700 rounded-xl transition-colors text-blue-200 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="font-black tracking-widest uppercase text-sm">Profile Settings</div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-8">
        
        {/* Core Profile Info */}
        <section className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
           <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 font-black text-3xl flex items-center justify-center uppercase shadow-inner">
                {currentUser?.displayName?.[0] || currentUser?.email?.[0] || '?'}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{currentUser?.displayName || 'Lineup Hero User'}</h1>
                <p className="text-slate-500 font-bold">{currentUser?.email}</p>
                {currentUser?.systemRole === 'super_admin' && <span className="inline-block mt-2 bg-rose-100 text-rose-700 text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md">Super Admin</span>}
                {currentUser?.systemRole === 'user' && <span className="inline-block mt-2 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md">Pro User</span>}
              </div>
           </div>
        </section>

        {/* My Teams List */}
        <section className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <Users className="text-slate-400 w-6 h-6" />
            <h2 className="text-lg font-black text-slate-800 tracking-wide font-medium">My Managed Teams</h2>
          </div>
          {teams.length === 0 ? (
            <div className="text-slate-400 text-sm font-bold bg-white/40 backdrop-blur-sm p-6 rounded-2xl text-center">
               You are not currently managing any teams.
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl justify-between flex items-center border border-slate-100">
                  <div>
                    <h3 className="font-black text-slate-800 uppercase">{team.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{team.program || 'Independent'}</p>
                  </div>
                  <Link to={`/pro/team/${team.id}`} className="text-xs bg-white/60 backdrop-blur-xl border border-white/40  text-violet-600 font-bold tracking-wide px-4 py-2 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 hover:border-violet-500 transition-colors">
                    Manage
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>


        {/* Change Name */}
        <section className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <UserCircle className="text-slate-400 w-6 h-6" />
            <h2 className="text-lg font-black text-slate-800 tracking-wide font-medium">Edit Profile Name</h2>
          </div>
          
          <form onSubmit={handleUpdateName} className="space-y-4">
            {nameError && <div className="bg-rose-50 text-rose-600 font-bold text-sm p-4 rounded-xl">{nameError}</div>}
            {nameSuccess && <div className="bg-violet-50 text-violet-600 font-bold text-sm p-4 rounded-xl">{nameSuccess}</div>}

            <div>
              <label className="block text-[10px] font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Display Name</label>
              <input 
                type="text" 
                required 
                className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-blue-500 transition-all uppercase placeholder:normal-case"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isUpdatingName || !editName.trim() || editName === currentUser?.displayName}
              className="mt-2 bg-blue-600 text-white font-black text-xs tracking-wide font-medium py-3 px-6 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              Update Name
            </button>
          </form>
        </section>

        {/* Change Password */}
        <section className="bg-white/60 backdrop-blur-xl border border-white/40  rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <KeySquare className="text-slate-400 w-6 h-6" />
            <h2 className="text-lg font-black text-slate-800 tracking-wide font-medium">Change Password</h2>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {pwdError && <div className="bg-rose-50 text-rose-600 font-bold text-sm p-4 rounded-xl">{pwdError}</div>}
            {pwdSuccess && <div className="bg-violet-50 text-violet-600 font-bold text-sm p-4 rounded-xl">{pwdSuccess}</div>}

            <div>
              <label className="block text-[10px] font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">New Password</label>
              <input 
                type="password" 
                required 
                className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-blue-500 transition-all"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 tracking-wide font-medium ml-1 mb-2">Confirm New Password</label>
              <input 
                type="password" 
                required 
                className="w-full bg-white/40 backdrop-blur-sm border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none focus:bg-white/60 backdrop-blur-xl border border-white/40  focus:border-blue-500 transition-all"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isUpdatingPwd || !newPassword}
              className="mt-2 bg-blue-600 text-white font-black text-xs tracking-wide font-medium py-3 px-6 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              Update Password
            </button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="bg-rose-50 rounded-3xl p-8 shadow-inner border-2 border-rose-100 space-y-6 mt-12">
           <div className="flex items-center gap-3 border-b border-rose-200 pb-4">
             <Trash2 className="text-rose-500 w-6 h-6" />
             <h2 className="text-lg font-black text-rose-800 tracking-wide font-medium">Danger Zone</h2>
           </div>
           <div>
             <p className="text-rose-600 font-bold text-sm mb-6">Once you delete your account, there is no going back. Please be certain.</p>
             <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-rose-600 text-white font-black text-xs tracking-wide font-medium py-4 px-6 rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
             >
                Delete Account
             </button>
           </div>
        </section>

      </main>
    </div>
  );
}
