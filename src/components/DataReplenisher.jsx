import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Play, CheckCircle2, Loader2, Users } from 'lucide-react';

const PLAYER_NAMES = [
  "Ace Ventura", "Babe Ruthless", "Cal Ripken Jr.", "Derek Jitter", 
  "Shohei Ohtani", "Mookie Betts", "Mike Trout", "Aaron Judge", 
  "Trea Turner", "Freddie Freeman", "Ronald Acuna", "Juan Soto",
  "Nolan Arenado", "Bryce Harper", "Justin Verlander", "Max Scherzer"
];

export default function DataReplenisher({ onComplete }) {
  const [status, setStatus] = useState('idle'); // idle, checking, replenishing, complete
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState('');

  const replenish = async () => {
    setStatus('checking');
    setLog('Scanning teams...');
    try {
      const teamsSnap = await getDocs(collection(db, 'saas_data', 'v1', 'teams'));
      const teams = teamsSnap.docs;
      setProgress({ current: 0, total: teams.length });
      setStatus('replenishing');

      for (let i = 0; i < teams.length; i++) {
        const teamDoc = teams[i];
        const teamId = teamDoc.id;
        const teamName = teamDoc.data().name;
        
        setLog(`Checking ${teamName}...`);
        const playersSnap = await getDocs(query(collection(db, 'saas_data', 'v1', 'players'), where("teamId", "==", teamId)));
        const currentCount = playersSnap.size;

        if (currentCount < 10) {
          const needed = 10 - currentCount;
          setLog(`Adding ${needed} players to ${teamName}...`);
          
          for (let j = 0; j < needed; j++) {
            const pId = Date.now() + Math.floor(Math.random() * 1000000);
            const name = PLAYER_NAMES[(currentCount + j) % PLAYER_NAMES.length];
            const number = (20 + currentCount + j).toString();
            
            await addDoc(collection(db, 'saas_data', 'v1', 'players'), {
              id: pId,
              teamId: teamId,
              name: `${name} ${currentCount + j + 1}`,
              number: number,
              bats: j % 2 === 0 ? "R" : "L",
              throws: j % 2 === 0 ? "R" : "L",
              willPitch: j % 3 === 0,
              willCatch: j % 4 === 0,
              avg: parseFloat((5.5 + Math.random() * 2).toFixed(2))
            });
          }
        }
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }
      
      setStatus('complete');
      setLog('Success! All teams have 10+ players.');
      if (onComplete) onComplete();
    } catch (err) {
      console.error(err);
      setLog(`Error: ${err.message}`);
      setStatus('idle');
    }
  };

  if (status === 'complete') {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-xs font-bold uppercase tracking-widest leading-none">{log}</p>
        </div>
        <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-emerald-600 underline">Refresh View</button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest leading-none">Roster Health Check</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{log || 'Ensure every team has a full 10-player roster'}</p>
          </div>
        </div>
        {status === 'idle' ? (
          <button 
            onClick={replenish}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-emerald-200"
          >
            <Play className="w-3 h-3 fill-current" /> Run Replenisher
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-700 leading-none">{progress.current} / {progress.total}</p>
              <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
