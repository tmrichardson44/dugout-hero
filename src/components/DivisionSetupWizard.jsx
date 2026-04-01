import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { X, ChevronRight, ChevronLeft, Layers, Users, Settings, CheckCircle2, Trophy } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Division', icon: Layers },
  { id: 2, label: 'Teams',    icon: Users },
  { id: 3, label: 'Settings', icon: Settings },
  { id: 4, label: 'Review',   icon: CheckCircle2 },
];

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg select-none">–</button>
      <span className="font-bold text-slate-800 text-2xl w-8 text-center tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg select-none">+</button>
    </div>
  );
}

export default function DivisionSetupWizard({ currentUser, leagueId, leagueName, onClose, onComplete }) {
  const [step, setStep]     = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  const [divisionName, setDivisionName] = useState('');

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  const [teamCount, setTeamCount] = useState(4);
  const [teamNames,  setTeamNames]  = useState(['','','','']);

  const handleTeamCountChange = (n) => {
    const c = Math.max(0, Math.min(12, n));
    setTeamCount(c);
    setTeamNames(prev => {
      const arr = [...prev];
      while (arr.length < c) arr.push('');
      return arr.slice(0, c);
    });
  };

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  const [rosterSize,    setRosterSize]    = useState(12);
  const [innings,       setInnings]       = useState(6);
  const [battingTarget, setBattingTarget] = useState(6.5);

  const canNext = () => {
    if (step === 1) return divisionName.trim().length >= 1;
    return true;
  };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const divRef = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), {
        name: divisionName.trim(),
        leagueId,
        adminUid: currentUser.uid,
        adminEmail: currentUser.email,
        createdAt: serverTimestamp(),
      });

      for (let ti = 0; ti < teamCount; ti++) {
        const tName = teamNames[ti]?.trim() || `${divisionName} Team ${ti + 1}`;
        await addDoc(collection(db, 'saas_data', 'v1', 'teams'), {
          name: tName,
          leagueId,
          divisionId: divRef.id,
          managerUid: currentUser.uid,
          createdAt: serverTimestamp(),
          seasonSettings: {
            teamName: tName,
            rosterSize,
            innings,
            battingTarget,
            enableTrends: true,
            enabledPositions: ['P','C','1B','2B','3B','SS','LF','LC','CF','RC','RF'],
          },
        });
      }

      onComplete?.();
    } catch (e) {
      setError('Failed: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="bg-slate-700 px-8 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">New Division Setup</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Trophy className="w-3 h-3 text-blue-300" />
              <p className="text-slate-300 text-[11px] font-bold">{leagueName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-500 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div className="h-1 bg-slate-100 shrink-0">
          <div className="h-full bg-slate-700 transition-all duration-500" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>

        {/* ── Step tabs ── */}
        <div className="flex border-b border-slate-100 px-8 gap-6 shrink-0">
          {STEPS.map(s => {
            const Icon = s.icon;
            const done   = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className={`flex items-center gap-1.5 py-3 border-b-2 transition-all text-[10px] font-bold uppercase tracking-wide
                ${active ? 'border-slate-700 text-slate-700' : done ? 'border-emerald-400 text-emerald-500' : 'border-transparent text-slate-300'}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:block">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="p-8 overflow-y-auto flex-1">

          {/* Step 1 – Division Name */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Name this division</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">e.g. Majors, Minors, T-Ball, AAA…</p>
              </div>
              <input
                type="text"
                autoFocus
                className="w-full border-2 border-slate-200 rounded-xl px-5 py-4 font-bold text-slate-800 text-xl outline-none focus:border-slate-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300 placeholder:text-base"
                placeholder="e.g. Majors"
                value={divisionName}
                onChange={e => setDivisionName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canNext() && setStep(2)}
              />
            </div>
          )}

          {/* Step 2 – Teams */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">How many teams?</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Names are optional — you can rename later.</p>
              </div>
              <Stepper value={teamCount} min={0} max={12} onChange={handleTeamCountChange} />
              {teamCount > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {Array.from({ length: teamCount }).map((_, ti) => (
                    <div key={ti}>
                      <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1.5">Team {ti + 1}</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-sm outline-none focus:border-slate-500 focus:bg-slate-50 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300"
                        placeholder={`${divisionName || 'Division'} Team ${ti + 1}`}
                        value={teamNames[ti] || ''}
                        onChange={e => setTeamNames(prev => prev.map((n, k) => k === ti ? e.target.value : n))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 – Settings */}
          {step === 3 && (
            <div className="space-y-7">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Default Team Settings</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Applied to all {teamCount} teams. Adjustable per-team later.</p>
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Roster Size</label>
                  <Stepper value={rosterSize} min={6} max={20} onChange={setRosterSize} />
                  <p className="text-[10px] text-slate-400 font-bold mt-2">players</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Innings</label>
                  <Stepper value={innings} min={3} max={9} onChange={setInnings} />
                  <p className="text-[10px] text-slate-400 font-bold mt-2">per game</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Batting Target</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setBattingTarget(t => Math.max(1, parseFloat((t - 0.5).toFixed(1))))} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg select-none">–</button>
                    <span className="font-bold text-slate-800 text-2xl w-10 text-center tabular-nums">{battingTarget}</span>
                    <button type="button" onClick={() => setBattingTarget(t => Math.min(15, parseFloat((t + 0.5).toFixed(1))))} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg select-none">+</button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-2">avg batting pos.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 – Review */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Ready to create!</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Here's a summary of what will be created.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <Trophy className="w-3 h-3 text-blue-400" /> {leagueName}
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 uppercase tracking-tight">{divisionName}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{teamCount} teams</p>
                  </div>
                </div>
                {teamCount > 0 && (
                  <div className="pl-16 grid grid-cols-2 gap-x-4 gap-y-1">
                    {Array.from({ length: teamCount }).map((_, ti) => (
                      <div key={ti} className="flex items-center gap-1.5">
                        <Users className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase truncate">
                          {teamNames[ti]?.trim() || `${divisionName} Team ${ti + 1}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Roster', val: `${rosterSize} players` },
                  { label: 'Innings', val: innings },
                  { label: 'Batting target', val: battingTarget },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-slate-100 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}: </span>
                    <span className="text-xs font-bold text-slate-700">{val}</span>
                  </div>
                ))}
              </div>

              {error && <p className="text-rose-500 text-sm font-bold">{error}</p>}
            </div>
          )}
        </div>

        {/* ── Footer nav ── */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-700 transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < STEPS.length ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="bg-slate-700 text-white px-7 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-200"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-100"
            >
              {saving ? 'Creating…' : '🎉 Create Division'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
