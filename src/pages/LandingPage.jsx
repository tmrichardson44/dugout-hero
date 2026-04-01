import React from 'react';
import { Link } from 'react-router-dom';

function GreenDiamondLogo() {
  return (
    <div className="relative flex items-center justify-center mr-2">
      <div className="animate-float">
        <svg viewBox="0 0 24 24" className="w-10 h-10 fill-emerald-500 drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
          <circle cx="12" cy="12" r="2" className="fill-white/80" />
        </svg>
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); filter: drop-shadow(0 5px 15px rgba(16, 185, 129, 0.2)); }
          50% { transform: translateY(-8px); filter: drop-shadow(0 20px 25px rgba(16, 185, 129, 0.4)); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white/40  font-sans text-slate-900 flex flex-col items-center p-8">
      <div className="flex items-center mb-16 mt-16">
        <GreenDiamondLogo />
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-800">Lineup Hero <span className="text-emerald-600">PRO</span></h1>
      </div>

      <div className="max-w-2xl text-center space-y-8">
        <h2 className="text-5xl font-extrabold tracking-tight leading-tight text-slate-800">
          The ultimate management tool for baseball and softball.
        </h2>
        <p className="text-xl text-slate-500 font-bold mb-8">
          Manage your roster, automate fielding rotations, and track optimized batting averages. Built for individual coaches and entire leagues.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Link to="/pro" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 transition-colors hover:from-emerald-400  text-white font-bold py-3 px-6 rounded-md shadow-lg shadow-sm hover:-translate-y-1 hover:shadow-emerald-500/40 transition-all duration-300 tracking-wide font-medium hover:bg-emerald-700 transition-colors">
            Sign In to Pro Suite
          </Link>
          <Link to="/app" className="w-full sm:w-auto bg-white border border-slate-200  text-emerald-600 border-2 border-emerald-100 font-bold py-3 px-6 rounded-md shadow-sm tracking-wide font-medium hover:border-green-300 transition-colors">
            Try the Classic App
          </Link>
        </div>
      </div>
    </div>
  );
}
