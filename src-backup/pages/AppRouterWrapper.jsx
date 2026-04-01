import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function AppRouterWrapper() {
  return (
    <div className="bg-transparent min-h-screen">
      <div className="bg-blue-600 text-white text-xs font-black p-2 text-center tracking-wide font-medium relative z-[100]">
        <Link to="/" className="absolute left-4 top-2 flex items-center hover:text-blue-200 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Exit
        </Link>
        Legacy Guest Mode
      </div>
      <div>
        {/* The legacy App.jsx code will go here once refactored, but to prevent git diff errors we'll just inject it safely in the next steps */}
      </div>
    </div>
  );
}
