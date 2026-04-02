import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate
import { GuestTopNav } from '../layouts/GuestTopNav';

interface LandingPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  // 2. These are now optional to satisfy TypeScript while you transition
  onLoginClick?: () => void;
  onSignUpClick?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  darkMode, 
  toggleDarkMode,
}) => {
  const navigate = useNavigate(); // 3. Initialize the navigate function

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-500 relative bg-main text-main">
      
      {/* --- BACKGROUND ELEMENTS (Keep your existing JSX here) --- */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* ... your grid and glow divs ... */}
      </div>

      {/* ─── GUEST NAV ─── */}
      <GuestTopNav 
        darkMode={darkMode}
        // 4. Use navigate instead of props
        onLogin={() => navigate('/login')}
        onSignUp={() => navigate('/signup')}
        toggleDarkMode={toggleDarkMode}
        onGoHome={() => navigate('/')} 
      />

      {/* ─── HERO SECTION ─── */}
      <main className="flex-1 flex flex-col items-center pt-24 pb-12 px-6 text-center relative z-10">
        
        {/* ... your v2.0 badge ... */}
        
        <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tighter leading-[0.9]">
          Trade with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Precision.</span>
        </h1>
        
        <p className={`max-w-xl mx-auto mb-10 text-lg font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Experience real-time execution, advanced analytics, and complete portfolio control with NEXUS professional gateway.
        </p>

        <button 
          // 5. Direct navigation on click
          onClick={() => navigate('/signup')}
          className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl shadow-blue-600/20 transition-all active:scale-95 mb-16"
        >
          Start Trading Now
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>

        {/* ─── DASHBOARD PREVIEW MOCKUP ─── */}
        {/* Enhanced depth and contrast for light mode */}
        <div className="w-full max-w-[1200px] h-[500px] rounded-t-3xl border-[6px] border-b-0 relative overflow-hidden transition-all duration-500 border-subtle bg-panel shadow-2xl">
           
           {/* Mockup Header */}
           <div className="h-12 border-b flex items-center px-4 gap-2 transition-colors duration-500 border-subtle bg-panel">
             <div className="flex gap-1.5">
               <div className="w-3 h-3 rounded-full bg-red-400/80 shadow-sm" />
               <div className="w-3 h-3 rounded-full bg-amber-400/80 shadow-sm" />
               <div className="w-3 h-3 rounded-full bg-green-400/80 shadow-sm" />
             </div>
           </div>
           
           {/* Fade-out Gradient Overlay */}
           <div className="absolute inset-0 top-12 bg-gradient-to-t via-transparent to-transparent z-10 pointer-events-none from-[var(--trading-panel)]" />
           
           {/* Mockup Content Blocks */}
           <div className="w-full h-full p-6 flex gap-4 opacity-60 blur-[2px]">
             <div className="w-1/4 h-full rounded-xl border border-subtle bg-panel" />
             <div className="w-1/2 h-full rounded-xl border border-subtle bg-panel" />
             <div className="w-1/4 h-full rounded-xl border border-subtle bg-panel" />
           </div>
        </div>
      </main>
    </div>
  );
};