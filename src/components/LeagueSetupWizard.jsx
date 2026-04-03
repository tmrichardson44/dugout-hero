import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  X, ChevronRight, ChevronLeft, Trophy, Layers, Users, Settings, CheckCircle2
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'League',    icon: Trophy },
  { id: 2, label: 'Divisions', icon: Layers },
  { id: 3, label: 'Teams',     icon: Users },
  { id: 4, label: 'Settings',  icon: Settings },
  { id: 5, label: 'Review',    icon: CheckCircle2 },
];

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const YEARS   = Array.from({ length: 20 }, (_, i) => String(2026 + i));

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg leading-none select-none"
      >–</button>
      <span className="font-bold text-slate-800 text-2xl w-8 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition text-slate-700 font-bold text-lg leading-none select-none"
      >+</button>
    </div>
  );
}

export default function LeagueSetupWizard({ currentUser, onClose, onComplete }) {
  const [step, setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const [leagueName, setLeagueName] = useState('');

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  const [divisionCount, setDivisionCount] = useState(2);
  const [divisionNames, setDivisionNames] = useState(['Majors', 'Minors']);

  // ── Step 3 ──────────────────────────────────────────────────────────────────
  const [teamCounts, setTeamCounts] = useState([4, 4]);
  const [teamNames,  setTeamNames]  = useState([['','','',''],['','','','']]);

  // ── Step 4 ──────────────────────────────────────────────────────────────────
  const [rosterSize,    setRosterSize]    = useState(12);
  const [innings,       setInnings]       = useState(6);
  const [battingTarget, setBattingTarget] = useState(6.5);
  const [season,        setSeason]        = useState('Spring');
  const [year,          setYear]          = useState(String(new Date().getFullYear()));

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const handleDivisionCountChange = (n) => {
    const c = Math.max(1, Math.min(8, n));
    setDivisionCount(c);
    setDivisionNames(prev => {
      const arr = [...prev];
      while (arr.length < c) arr.push(`Division ${arr.length + 1}`);
      return arr.slice(0, c);
    });
    setTeamCounts(prev => {
      const arr = [...prev];
      while (arr.length < c) arr.push(4);
      return arr.slice(0, c);
    });
    setTeamNames(prev => {
      const arr = [...prev];
      while (arr.length < c) arr.push(['','','','']);
      return arr.slice(0, c);
    });
  };

  const handleTeamCountChange = (di, n) => {
    const c = Math.max(0, Math.min(12, n));
    setTeamCounts(prev => prev.map((v, i) => i === di ? c : v));
    setTeamNames(prev => prev.map((teams, i) => {
      if (i !== di) return teams;
      const arr = [...teams];
      while (arr.length < c) arr.push('');
      return arr.slice(0, c);
    }));
  };

  const canNext = () => {
    if (step === 1) return leagueName.trim().length >= 2;
    if (step === 2) return divisionNames.every(n => n.trim().length >= 1);
    return true;
  };

  const totalTeams = teamCounts.reduce((a, b) => a + b, 0);

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const leagueRef = await addDoc(collection(db, 'saas_data', 'v1', 'leagues'), {
        name: leagueName.trim(),
        adminUid: currentUser.uid,
        season,
        year,
        createdAt: serverTimestamp(),
      });

      for (let di = 0; di < divisionCount; di++) {
        const divRef = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), {
          name: divisionNames[di]?.trim() || `Division ${di + 1}`,
          leagueId: leagueRef.id,
          adminUid: null,
          adminEmail: null,
          season,
          year,
          createdAt: serverTimestamp(),
        });

        const tCount = teamCounts[di] || 0;
        for (let ti = 0; ti < tCount; ti++) {
          const tName = teamNames[di]?.[ti]?.trim() || `${divisionNames[di]} Team ${ti + 1}`;
          await addDoc(collection(db, 'saas_data', 'v1', 'teams'), {
            name: tName,
            leagueId: leagueRef.id,
            divisionId: divRef.id,
            managerUid: currentUser.uid,
            season,
            year,
            createdAt: serverTimestamp(),
            seasonSettings: {
              teamName: tName,
              rosterSize,
              innings,
              battingTarget,
              season,
              year,
              enableTrends: true,
              enabledPositions: ['P','C','1B','2B','3B','SS','LF','LC','CF','RC','RF'],
            },
          });
        }
      }

      onComplete?.();
    } catch (e) {
      setError('Failed: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="bg-green-800 px-8 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">New League Setup</h2>
            <p className="text-green-300 text-[11px] font-bold mt-0.5">
              Step {step} of {STEPS.length} — {STEPS[step - 1].label}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-green-700/60 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div className="h-1 bg-green-100 shrink-0">
          <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>

        {/* ── Step tabs ── */}
        <div className="flex border-b border-slate-100 px-8 gap-6 shrink-0">
          {STEPS.map(s => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 py-3 border-b-2 transition-all text-[10px] font-bold uppercase tracking-wide
                  ${active ? 'border-green-600 text-green-700' : done ? 'border-emerald-400 text-emerald-500' : 'border-transparent text-slate-300'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:block">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="p-8 overflow-y-auto flex-1">

          {/* Step 1 – League Name */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">What's the league called?</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">This is how it'll appear across the platform.</p>
              </div>
              <input
                type="text"
                autoFocus
                className="w-full border-2 border-slate-200 rounded-xl px-5 py-4 font-bold text-slate-800 text-xl outline-none focus:border-green-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300 placeholder:text-base"
                placeholder="e.g. Hopkinton Little League"
                value={leagueName}
                onChange={e => setLeagueName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canNext() && setStep(2)}
              />
            </div>
          )}

          {/* Step 2 – Divisions */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">How many divisions?</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Name each division (e.g. Majors, Minors, T-Ball).</p>
              </div>
              <Stepper value={divisionCount} min={1} max={8} onChange={handleDivisionCountChange} />
              <div className="grid grid-cols-2 gap-3">
                {divisionNames.map((name, i) => (
                  <div key={i}>
                    <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1.5">Division {i + 1}</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-sm outline-none focus:border-green-500 focus:bg-green-50/30 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300"
                      placeholder={`Division ${i + 1}`}
                      value={name}
                      onChange={e => setDivisionNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 – Teams */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Teams per Division</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Set team counts. Team names are optional — you can rename later.</p>
              </div>
              <div className="space-y-6">
                {divisionNames.map((divName, di) => (
                  <div key={di} className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-700 text-sm uppercase tracking-tight">{divName}</span>
                      </div>
                      <Stepper value={teamCounts[di]} min={0} max={12} onChange={n => handleTeamCountChange(di, n)} />
                    </div>
                    {teamCounts[di] > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: teamCounts[di] }).map((_, ti) => (
                          <input
                            key={ti}
                            type="text"
                            className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 font-bold text-slate-700 text-xs outline-none focus:border-green-400 focus:bg-green-50/30 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300"
                            placeholder={`${divName} Team ${ti + 1}`}
                            value={teamNames[di]?.[ti] || ''}
                            onChange={e => setTeamNames(prev => prev.map((teams, j) =>
                              j === di ? teams.map((n, k) => k === ti ? e.target.value : n) : teams
                            ))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 – Settings */}
          {step === 4 && (
            <div className="space-y-7">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Season & Team Settings</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Applied to all {totalTeams} teams. Coaches can adjust later.</p>
              </div>

              {/* Season + Year */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Season</label>
                  <div className="flex flex-wrap gap-2">
                    {SEASONS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeason(s)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm border transition-all ${
                          season === s
                            ? 'bg-green-600 text-white border-green-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-green-500 transition-all bg-white"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Roster / Innings / Batting */}
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

              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-xs font-bold text-green-700 leading-relaxed">
                  {season} {year} · {rosterSize} players · {innings} innings · batting target <strong>{battingTarget}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Step 5 – Review */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Ready to create!</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">Here's what will be created in one click.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 max-h-64 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 uppercase tracking-tight">{leagueName}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{season} {year} · {divisionCount} divisions · {totalTeams} teams total</p>
                  </div>
                </div>

                {divisionNames.map((divName, di) => (
                  <div key={di} className="pl-11 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 text-blue-500 rounded-md flex items-center justify-center shrink-0">
                        <Layers className="w-3 h-3" />
                      </div>
                      <p className="font-bold text-slate-600 text-sm uppercase tracking-tight">{divName}</p>
                      <span className="text-[10px] text-slate-400 font-bold ml-auto">{teamCounts[di]} teams</span>
                    </div>
                    <div className="pl-8 grid grid-cols-2 gap-x-4 gap-y-1">
                      {Array.from({ length: teamCounts[di] }).map((_, ti) => (
                        <div key={ti} className="flex items-center gap-1.5">
                          <Users className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                          <span className="text-[10px] text-slate-500 font-bold uppercase truncate">
                            {teamNames[di]?.[ti]?.trim() || `${divName} Team ${ti + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Season', val: `${season} ${year}` },
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
              className="bg-green-600 text-white px-7 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-green-100"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50 shadow-md shadow-green-100"
            >
              {saving ? 'Creating…' : '🎉 Create League'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
