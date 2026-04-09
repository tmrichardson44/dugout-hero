import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc, getDocs, or } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import DugoutHeroCore from '../components/DugoutHeroCore';
import { ChevronDown, Users } from 'lucide-react';

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
  const { currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [seasonConfig, setSeasonConfig] = useState(INITIAL_CONFIG);
  const [divisionConfig, setDivisionConfig] = useState(null);
  const [teamDoc, setTeamDoc] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [availableLeagues, setAvailableLeagues] = useState([]);
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
          
          let hasAccess = false;
          const userEmail = currentUser.email?.toLowerCase();
          if (isSuperAdmin() || data.managerUid === currentUser.uid || data.coachEmail === userEmail || data.managerEmail === userEmail) {
            hasAccess = true;
            // Auto-claim UID if missing
            if (!data.managerUid) {
               updateDoc(docRef, { managerUid: currentUser.uid });
            }
          } else {

            // Check if user is admin of the team's league
            if (data.leagueId) {
              const leagueSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', data.leagueId));
              if (leagueSnap.exists() && leagueSnap.data().adminUid === currentUser.uid) hasAccess = true;
            }
            // Check if user is admin of the team's division
            if (!hasAccess && data.divisionId) {
              const divSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', data.divisionId));
              if (divSnap.exists() && divSnap.data().adminUid === currentUser.uid) hasAccess = true;
            }
          }

          if (!hasAccess) {
             alert("You do not have permission to view this team.");
             navigate('/pro/dashboard');
             return;
          }

          let isLeagueAdminLocal = false;
          if (data.leagueId) {
            const leagueSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'leagues', data.leagueId));
            if (leagueSnap.exists() && leagueSnap.data().adminUid === currentUser.uid) isLeagueAdminLocal = true;
          }

          let divisionName = "Unassigned";
          if (data.divisionId) {
            const divSnap = await getDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', data.divisionId));
            if (divSnap.exists()) divisionName = divSnap.data().name;
          }

          let resolvedCoachName = "Unassigned";
          if (data.managerUid) {
            try {
              const userSnap = await getDoc(doc(db, 'users', data.managerUid));
              if (userSnap.exists()) {
                resolvedCoachName = userSnap.data().displayName || data.coachName || data.coachEmail || userSnap.data().email || "Unassigned";
              }
            } catch (err) {
              console.warn("Could not fetch user doc for manager:", err.message);
            }
          }
          if (resolvedCoachName === "Unassigned" && (data.coachName || data.coachEmail)) {
            resolvedCoachName = data.coachName || data.coachEmail;
          }

          setTeamDoc({ 
             id: docSnap.id, 
             ...data, 
             _isLeagueAdminTrue: isSuperAdmin() || isLeagueAdminLocal,
             _divisionName: divisionName,
             _resolvedCoachName: resolvedCoachName
          });
          
          // Safeguard: Ensure config always has default values (like enabledPositions) by merging with INITIAL_CONFIG
          const baseConfig = { 
            ...INITIAL_CONFIG, 
            teamName: data.name, 
            leagueId: data.leagueId || '', 
            divisionId: data.divisionId || '',
            coachEmail: data.coachEmail || data.managerEmail || '',
            season: data.season || 'Spring', 
            year: data.year || '2026' 
          };
          
          if (data.seasonSettings) {
            setSeasonConfig({ ...baseConfig, ...data.seasonSettings });
          } else {
            setSeasonConfig(baseConfig);
          }
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
        const userEmail = currentUser.email?.toLowerCase();
        const q = query(collection(db, SAAS_ROOT, SAAS_VERSION, 'teams'), or(
          where('managerUid', '==', currentUser.uid),
          where('coachEmail', '==', userEmail || 'unknown'),
          where('managerEmail', '==', userEmail || 'unknown')
        ));
        const snapshot = await getDocs(q);
        setAllTeams(snapshot.docs.map(t => ({ id: t.id, ...t.data() })));
      } catch (err) {
        console.error("Error fetching all teams", err);
      }
    };

    fetchTeam();
    fetchAllTeams();

    // Fetch leagues this user admins so the settings can offer a league picker
    const unsubL = onSnapshot(query(collection(db, SAAS_ROOT, SAAS_VERSION, 'leagues'), where('adminUid', '==', currentUser.uid)), 
      snap => setAvailableLeagues(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("Leagues sync fail", err)
    );

    return () => unsubL();
  }, [currentUser, teamId, navigate]);



  // 2. Data Listeners for this specific Team
  useEffect(() => {
    if (!currentUser || !teamId || !teamDoc) return;

    const playersRef = collection(db, SAAS_ROOT, SAAS_VERSION, 'players');
    const qPlayers = query(playersRef, where("teamId", "==", teamId));
    
    const gamesRef = collection(db, SAAS_ROOT, SAAS_VERSION, 'games');
    const qGames = query(gamesRef, where("teamId", "==", teamId));
    
    let unsubDiv = () => {};
    if (teamDoc.divisionId) {
      unsubDiv = onSnapshot(doc(db, SAAS_ROOT, SAAS_VERSION, 'divisions', teamDoc.divisionId), snap => {
        if (snap.exists()) setDivisionConfig({ id: snap.id, ...snap.data() });
      });
    }

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

    return () => { unsubP(); unsubG(); unsubDiv(); };
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

  const handleDeleteTeamPermanent = async () => {
    if (!window.confirm("Are you SURE you want to permanently delete this team and all its data? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId));
      navigate('/pro/dashboard');
    } catch (err) {
      alert("Failed to delete team: " + err.message);
    }
  };

  const handleUpdateSeasonConfig = async (newConfig) => {
    const { program, leagueId, divisionId, coachEmail, season, year, ...restConfig } = newConfig;
    const newTeamName = restConfig.teamName || teamDoc.name;
    const updatePayload = { seasonSettings: restConfig };
    
    if (newTeamName !== teamDoc.name) {
      updatePayload.name = newTeamName;
    }

    if (leagueId !== undefined && leagueId !== (teamDoc.leagueId || '')) {
      updatePayload.leagueId = leagueId || null;
      if (!leagueId) updatePayload.divisionId = null; // Clear division if they unassign league
    }

    if (divisionId !== undefined && divisionId !== (teamDoc.divisionId || '')) {
      updatePayload.divisionId = divisionId || null;
    }

    if (coachEmail !== undefined && coachEmail !== (teamDoc.coachEmail || teamDoc.managerEmail || '')) {
      const formattedEmail = coachEmail.trim().toLowerCase();
      updatePayload.coachEmail = formattedEmail || null;
      
      if (formattedEmail) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', formattedEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            updatePayload.managerUid = snap.docs[0].data().uid;
            updatePayload.coachName = snap.docs[0].data().displayName || null;
          } else {
             updatePayload.managerUid = null;
             updatePayload.coachName = null;
          }
        } catch(e) {}
      } else {
        updatePayload.managerUid = null;
        updatePayload.coachName = null;
      }
    }

    if (leagueId !== undefined && leagueId !== (teamDoc.leagueId || '')) {
      updatePayload.leagueId = leagueId || null;
    }

    if (season !== undefined && season !== (teamDoc.season || 'Spring')) {
      updatePayload.season = season;
    }

    if (year !== undefined && year !== (teamDoc.year || '2026')) {
      updatePayload.year = year;
    }

    await updateDoc(doc(db, SAAS_ROOT, SAAS_VERSION, 'teams', teamId), updatePayload);
    setSeasonConfig(newConfig);
    setTeamDoc({ ...teamDoc, ...updatePayload });
  };

  const getDivisionTheme = (name) => {
    if (!name || name === 'No Division') return 'div-theme-slate';
    const themes = ['emerald', 'rose', 'blue', 'violet', 'amber', 'indigo'];
    const lower = name.toLowerCase();
    let hash = 0;
    for (let i = 0; i < lower.length; i++) {
      hash = lower.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % themes.length;
    return `div-theme-${themes[index]}`;
  };

  const ProBadge = () => {
    const themeClass = getDivisionTheme(teamDoc?._divisionName);
    return (
    <div className="flex items-center gap-3">
      <Link to="/pro/profile" className="w-10 h-10 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-all">
         <Users className="w-5 h-5" />
      </Link>
      <div className="relative">
        <button 
          onClick={() => setShowTeamSwitcher(!showTeamSwitcher)}
          className={`bg-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all gap-1.5 shadow-sm border-l-4 ${themeClass}`}
        >
           {teamDoc?.name || 'Loading Team...'} <ChevronDown className="w-3 h-3" />
        </button>
        {showTeamSwitcher && allTeams.length > 0 && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in zoom-in-95 duration-200 origin-top-right">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 tracking-widest uppercase border-b border-slate-50 mb-2">My Teams</div>
            {allTeams.map(t => (
              <Link
                key={t.id}
                to={`/pro/team/${t.id}`}
                onClick={() => setShowTeamSwitcher(false)}
                className={`block px-4 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${t.id === teamId ? 'text-emerald-600 bg-emerald-50/30' : 'text-slate-600'}`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    );
  };

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
      availableLeagues={availableLeagues}
      divisionConfig={divisionConfig}
      HeaderBadge={ProBadge}
      onBackToDashboard={() => navigate(-1)}
      
      // New props for Season Setup
      coachName={teamDoc?._resolvedCoachName || "Coach"}
      divisionName={teamDoc?._divisionName || "Unassigned"}
      canDeleteTeam={true}
      onDeleteTeam={handleDeleteTeamPermanent}
    />
  );
}
