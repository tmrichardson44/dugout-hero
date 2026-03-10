import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import DugoutHeroCore from '../components/DugoutHeroCore';
import { ChevronDown } from 'lucide-react';

const SAAS_ROOT = 'saas_data';
const SAAS_VERSION = 'v1';

const INITIAL_CONFIG = {
  teamName: "New Team",
  totalGames: 12,
  rosterSize: 13,
  innings: 6,
  battingTarget: 6.5,
  enableTrends: true,
  enabledPositions: ["P", "C", "1B", "2B", "3B", "SS", "LF", "LC", "CF", "RC", "RF"]
};

export default function ProTeamDashboard() {
  const { teamId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [seasonConfig, setSeasonConfig] = useState(INITIAL_CONFIG);
  const [teamDoc, setTeamDoc] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);

  // 1. Verify Access & Load Team
  useEffect(() => {
    if (!currentUser || !teamId) return;

    const fetchTeam = async () => {
      try {
        const docRef = doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Extremely rudimentary security guard in the UI. 
          // Actual security will be handled by Firestore Rules later.
          if (data.managerUid !== currentUser.uid && !currentUser.isAdmin) {
             alert("You do not have permission to view this team.");
             navigate('/pro/dashboard');
             return;
          }
          setTeamDoc({ id: docSnap.id, ...data });
          if(data.seasonSettings) setSeasonConfig({...data.seasonSettings, program: data.program});
          else setSeasonConfig({ ...INITIAL_CONFIG, teamName: data.name, program: data.program });
        } else {
          alert("Team not found.");
          navigate('/pro/dashboard');
        }
      } catch(err) {
        console.error("Error fetching team", err);
      }
    };

    const fetchAllTeams = async () => {
      try {
        const q = query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), where('managerUid', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        setAllTeams(snapshot.docs.map(t => ({ id: t.id, ...t.data() })));
      } catch (err) {
        console.error("Error fetching all teams", err);
      }
    };

    fetchTeam();
    fetchAllTeams();
  }, [currentUser, teamId, navigate]);

  // 2. Data Listeners for this specific Team
  useEffect(() => {
    if (!currentUser || !teamId || !teamDoc) return;

    const playersRef = collection(db, SAAS_ROOT, SAAS_VERSION, 'players');
    const qPlayers = query(playersRef, where("teamId", "==", teamId));
    
    const gamesRef = collection(db, SAAS_ROOT, SAAS_VERSION, 'games');
    const qGames = query(gamesRef, where("teamId", "==", teamId));

    const unsubP = onSnapshot(qPlayers, (snap) => {
      setPlayers(snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })));
      setIsLoading(false); // Only set complete once players load
    }, (err) => {
       console.error("Players sync fail", err);
       setIsLoading(false);
    });

    const unsubG = onSnapshot(qGames, (snap) => {
      setGames(snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })));
    }, (err) => console.error("Games sync fail", err));

    return () => { unsubP(); unsubG(); };
  }, [currentUser, teamId, teamDoc]);

  // Define SaaS-specific updaters that inject the `teamId` constraint
  const handleAddPlayer = async (newPlayer) => {
    const p = { ...newPlayer, id: Date.now(), teamId };
    await addDoc(collection(db, SAAS_ROOT, SAAS_VERSION, 'players'), p);
  };

  const handleEditPlayer = async (updatedPlayer) => {
    if (updatedPlayer.firebaseId) {
      const { firebaseId, ...fieldsToUpdate } = updatedPlayer;
      await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'players', updatedPlayer.firebaseId), fieldsToUpdate);
    }
  };

  const handleDeletePlayer = async (firebaseId) => {
    if (firebaseId) await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'players', firebaseId));
  };

  const handleAddGame = async (newGame) => {
    await addDoc(collection(db, SAAS_ROOT, SAAS_VERSION, 'games'), { ...newGame, teamId });
  };

  const handleUpdateGame = async (firebaseId, fields) => {
    if (firebaseId) await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'games', firebaseId), fields);
  };

  const handleDeleteGame = async (firebaseId) => {
    if (firebaseId) await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'games', firebaseId));
  };

  const handleUpdateSeasonConfig = async (newConfig) => {
    const { program, ...restConfig } = newConfig;
    const newTeamName = restConfig.teamName || teamDoc.name;
    const updatePayload = { seasonSettings: restConfig };
    
    if (newTeamName !== teamDoc.name) {
      updatePayload.name = newTeamName;
    }
    
    if (program !== undefined && program !== teamDoc.program) {
      updatePayload.program = program;
    }

    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), updatePayload);
    setSeasonConfig(newConfig);
    setTeamDoc({ ...teamDoc, ...updatePayload });
  };

  const ProBadge = () => (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 relative">
      <Link to="/pro/dashboard" className="bg-blue-50 text-blue-700 text-[10px] font-black px-4 py-2 rounded-full border border-blue-100 flex items-center justify-center hover:bg-blue-100 transition whitespace-nowrap">
         DASHBOARD
      </Link>
      <Link to="/pro/profile" className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-4 py-2 rounded-full border border-emerald-100 flex items-center justify-center hover:bg-emerald-100 transition whitespace-nowrap hidden sm:flex">
         PROFILE
      </Link>
      <div className="relative">
        <button 
          onClick={() => setShowTeamSwitcher(!showTeamSwitcher)}
          className="bg-slate-50 text-slate-700 text-[10px] font-black px-4 py-2 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition whitespace-nowrap gap-2 uppercase tracking-widest"
        >
           {teamDoc?.name || 'Loading Team...'} <ChevronDown className="w-3 h-3" />
        </button>
        {showTeamSwitcher && allTeams.length > 0 && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 animate-in zoom-in duration-200 origin-top-right">
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2">Switch Team</div>
            {allTeams.map(t => (
              <Link
                key={t.id}
                to={`/pro/team/${t.id}`}
                onClick={() => setShowTeamSwitcher(false)}
                className={`block px-4 py-3 text-sm font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${t.id === teamId ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-700'}`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DugoutHeroCore
      players={players}
      games={games}
      seasonConfig={seasonConfig}
      isLoadingData={isLoading && !teamDoc} // Wait for team doc to exist
      onAddPlayer={handleAddPlayer}
      onEditPlayer={handleEditPlayer}
      onDeletePlayer={handleDeletePlayer}
      onAddGame={handleAddGame}
      onUpdateGame={handleUpdateGame}
      onDeleteGame={handleDeleteGame}
      onUpdateSeasonConfig={handleUpdateSeasonConfig}
      HeaderBadge={ProBadge}
    />
  );
}
