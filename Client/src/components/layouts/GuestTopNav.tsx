import { TrendingUp, Sun, Moon } from 'lucide-react';

interface GuestTopNavProps {
  darkMode: boolean;
  toggleDarkMode: () => void; // <-- Added new prop for the theme toggle
  onLogin: () => void;
  onSignUp: () => void;
  onGoHome: () => void;
}

export function GuestTopNav({ darkMode, toggleDarkMode, onLogin, onSignUp, onGoHome }: GuestTopNavProps) {
  return (
    <header className={`h-14 border-b flex items-center justify-between px-6 sticky top-0 z-50 transition-colors duration-300 backdrop-blur-md ${
      darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/80 shadow-sm'
    }`}>
      
      {/* Clickable Logo (Redirects Home) */}
      <button onClick={onGoHome} className="flex items-center gap-2 text-blue-500 hover:scale-105 transition-transform outline-none">
        <TrendingUp size={24} strokeWidth={3} />
        <span className={`font-black text-xl tracking-tighter uppercase ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          NEXTBULL
        </span>
      </button>

      {/* Auth & Theme Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Theme Toggle Button */}
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${
            darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Log In Button */}
        <button 
          onClick={onLogin}
          className={`px-3 sm:px-4 py-2 text-sm font-bold rounded-lg transition-all ${
            darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Log In
        </button>
        
        {/* Sign Up Button */}
        <button 
          onClick={onSignUp}
          className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95"
        >
          Sign Up
        </button>
        
      </div>
    </header>
  );
}