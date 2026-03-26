import React from 'react';
import { ArrowRight } from 'lucide-react';
import { GuestTopNav } from '../layouts/GuestTopNav';

interface LandingPageProps {
  darkMode: boolean;
  onLoginClick: () => void;
  onSignUpClick: () => void;
  toggleDarkMode: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  darkMode, 
  onLoginClick, 
  onSignUpClick,
  toggleDarkMode,
}) => {
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 relative ${
      darkMode ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* ─── SHARED GRID PATTERN BACKGROUND (From Auth Pages) ─── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={`absolute inset-0 transition-opacity duration-500 ${darkMode ? 'opacity-[0.15]' : 'opacity-[0.08]'}`} 
          style={{
            backgroundImage: `radial-gradient(${darkMode ? '#334155' : '#64748b'} 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} 
        />
        <div className={`absolute inset-0 transition-opacity duration-500 ${darkMode ? 'opacity-20' : 'opacity-[0.04]'}`} 
          style={{
            backgroundImage: `linear-gradient(${darkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px), 
                              linear-gradient(90deg, ${darkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }} 
        />
        {/* Adjusted Glow: Softer and more vibrant in light mode */}
        <div className={`absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] rounded-full blur-[120px] transition-colors duration-500 ${
          darkMode ? 'bg-blue-600/20' : 'bg-blue-500/10'
        }`} />
      </div>

      {/* ─── NEW REUSABLE GUEST NAV ─── */}
      <GuestTopNav 
        darkMode={darkMode}
        onLogin={onLoginClick}
        onSignUp={onSignUpClick}
        toggleDarkMode={toggleDarkMode}
        onGoHome={() => {}} 
      />

      {/* ─── HERO SECTION ─── */}
      <main className="flex-1 flex flex-col items-center pt-24 pb-12 px-6 text-center relative z-10">
        
        {/* Crisper Badge for Light Mode */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest mb-8 animate-pulse shadow-sm ${
          darkMode 
            ? 'bg-blue-600/10 border-blue-600/20 text-blue-400' 
            : 'bg-white border-blue-200 text-blue-600 shadow-blue-500/10'
        }`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          v2.0 Terminal Live
        </div>
        
        <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tighter leading-[0.9]">
          Trade with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Precision.</span>
        </h1>
        
        <p className={`max-w-xl mx-auto mb-10 text-lg font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Experience real-time execution, advanced analytics, and complete portfolio control with NEXUS professional gateway.
        </p>

        <button 
          onClick={onSignUpClick}
          className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl shadow-blue-600/20 transition-all active:scale-95 mb-16"
        >
          Start Trading Now
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>

        {/* ─── DASHBOARD PREVIEW MOCKUP ─── */}
        {/* Enhanced depth and contrast for light mode */}
        <div className={`w-full max-w-[1200px] h-[500px] rounded-t-3xl border-[6px] border-b-0 relative overflow-hidden transition-all duration-500 ${
          darkMode 
            ? 'border-slate-800 bg-slate-900 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]' 
            : 'border-slate-200/80 bg-white shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)]'
        }`}>
           
           {/* Mockup Header */}
           <div className={`h-12 border-b flex items-center px-4 gap-2 transition-colors duration-500 ${
             darkMode ? 'border-slate-800 bg-[#020617]' : 'border-slate-100 bg-slate-50'
           }`}>
             <div className="flex gap-1.5">
               <div className="w-3 h-3 rounded-full bg-red-400/80 shadow-sm" />
               <div className="w-3 h-3 rounded-full bg-amber-400/80 shadow-sm" />
               <div className="w-3 h-3 rounded-full bg-green-400/80 shadow-sm" />
             </div>
           </div>
           
           {/* Fade-out Gradient Overlay */}
           <div className={`absolute inset-0 top-12 bg-gradient-to-t via-transparent to-transparent z-10 pointer-events-none ${
             darkMode ? 'from-[#020617]' : 'from-slate-50'
           }`} />
           
           {/* Mockup Content Blocks */}
           <div className="w-full h-full p-6 flex gap-4 opacity-60 blur-[2px]">
             <div className={`w-1/4 h-full rounded-xl border ${
               darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'
             }`} />
             <div className={`w-1/2 h-full rounded-xl border ${
               darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'
             }`} />
             <div className={`w-1/4 h-full rounded-xl border ${
               darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'
             }`} />
           </div>
        </div>
      </main>
    </div>
  );
};