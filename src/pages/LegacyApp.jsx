import React, { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import DugoutHeroCore from '../components/DugoutHeroCore';

const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'dugout-hero-v18';

const INITIAL_PLAYERS = [
  { id: 1, name: "Collin Marchand", number: "10", throws: "R", bats: "R", willPitch: true, willCatch: false },
  { id: 2, name: "Finn Panciera", number: "12", throws: "R", bats: "L", willPitch: true, willCatch: true },
  { id: 3, name: "Jake Gibbs", number: "5", throws: "R", bats: "R", willPitch: false, willCatch: true }
];

const INITIAL_CONFIG = {
  teamName: "Padres",
  totalGames: 12,
  rosterSize: 13,
  innings: 6,
  battingTarget: 6.5,
  enableTrends: true,
  enabledPositions: ["P", "C", "1B", "2B", "3B", "SS", "LF", "LC", "CF", "RC", "RF"]
};

export default function LegacyApp() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [seasonConfig, setSeasonConfig] = useState(INITIAL_CONFIG);

  // 1. Firebase Auth with Exponential Backoff Retries
  useEffect(() => {
    let timeoutId;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth fail", err);
        // If auth completely fails, still let the app load
        setIsLoading(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Fallback to stop loading if listeners don't fire quickly
      if (!user) timeoutId = setTimeout(() => setIsLoading(false), 3000);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // 2. Data Listeners using the old `artifacts` path
  useEffect(() => {
    if (!user) return;
    const base = (col) => collection(db, 'artifacts', appId, 'public', 'data', col);
    const configDoc = doc(db, 'artifacts', appId, 'public', 'data', 'seasonConfig', 'current');

    const unsubP = onSnapshot(base('players'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
      setPlayers(data);
      if (snap.empty && isLoading) {
         INITIAL_PLAYERS.forEach(p => addDoc(base('players'), p).catch(console.error));
      }
      setIsLoading(false);
    }, (err) => {
       console.error("Players sync fail", err);
       setIsLoading(false);
    });

    const unsubG = onSnapshot(base('games'), (snap) => {
      setGames(snap.docs.map(d => ({ ...d.data(), firebaseId: d.id })));
    }, (err) => console.error("Games sync fail", err));

    const unsubC = onSnapshot(configDoc, (snap) => {
      if (snap.exists()) {
        setSeasonConfig(snap.data());
      } else {
        setDoc(configDoc, INITIAL_CONFIG).catch(console.error);
      }
    }, (err) => console.error("Config sync fail", err));

    return () => { unsubP(); unsubG(); unsubC(); };
  }, [user, isLoading]);

  // Define the updater functions that use the Legacy Firebase paths
  const handleAddPlayer = async (newPlayer) => {
    const p = { ...newPlayer, id: Date.now() };
    if (user) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'players'), p);
  };

  const handleEditPlayer = async (updatedPlayer) => {
    if (user && updatedPlayer.firebaseId) {
      const { firebaseId, ...fieldsToUpdate } = updatedPlayer;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', updatedPlayer.firebaseId), fieldsToUpdate);
    }
  };

  const handleDeletePlayer = async (firebaseId) => {
    if (user && firebaseId) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', firebaseId));
  };

  const handleAddGame = async (newGame) => {
    if (user) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'games'), newGame);
  };

  const handleUpdateGame = async (firebaseId, fields) => {
    if (user && firebaseId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', firebaseId), fields);
  };

  const handleDeleteGame = async (firebaseId) => {
    if (user && firebaseId) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', firebaseId));
  };

  const handleUpdateSeasonConfig = async (newConfig) => {
    if (user) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'seasonConfig', 'current'), newConfig);
  };

  return (
    <DugoutHeroCore
      players={players}
      games={games}
      seasonConfig={seasonConfig}
      isLoadingData={isLoading}
      onAddPlayer={handleAddPlayer}
      onEditPlayer={handleEditPlayer}
      onDeletePlayer={handleDeletePlayer}
      onAddGame={handleAddGame}
      onUpdateGame={handleUpdateGame}
      onDeleteGame={handleDeleteGame}
      onUpdateSeasonConfig={handleUpdateSeasonConfig}
    />
  );
}
