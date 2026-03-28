
import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate
import { GuestTopNav } from '../layouts/GuestTopNav';

interface LoginPageProps {
  onLogin: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  // Optional: keeping these for compatibility, but we'll use navigate() instead
  onGoToSignUp?: () => void;
  onGoToHome?: () => void;
}

export function LoginPage({ onLogin, darkMode, toggleDarkMode }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); // 2. Initialize navigate

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 3. Update Auth State via prop
    onLogin(); 
    // 4. Redirect to the actual app route
    navigate('/app/trade');
  };

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-500 ${
      darkMode ? 'bg-[#0f172a]' : 'bg-slate-50'
    }`}>
      
      {/* ─── SHARED TOP NAVIGATION ─── */}
      <GuestTopNav 
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogin={() => {}} 
        onSignUp={() => navigate('/signup')} // 5. Use navigate
        onGoHome={() => navigate('/')}       // 5. Use navigate
      />

      <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
        {/* ... (Background Grid and Glow - Keeping Existing JSX) ... */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${darkMode ? 'opacity-[0.15]' : 'opacity-[0.05]'}`} 
            style={{
              backgroundImage: `radial-gradient(${darkMode ? '#334155' : '#94a3b8'} 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }} 
          />
          <div className={`absolute inset-0 ${darkMode ? 'opacity-20' : 'opacity-10'}`} 
            style={{
              backgroundImage: `linear-gradient(${darkMode ? '#1e293b' : '#e2e8f0'} 1px, transparent 1px), 
                                linear-gradient(90deg, ${darkMode ? '#1e293b' : '#e2e8f0'} 1px, transparent 1px)`,
              backgroundSize: '100px 100px'
            }} 
          />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[120px] ${
            darkMode ? 'bg-blue-600/10' : 'bg-blue-400/5'
          }`} />
        </div>
        
        <div className="relative z-10 w-full max-w-[400px] mx-4 my-8">
          
          <div className={`backdrop-blur-2xl border rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-500 ${
            darkMode 
              ? 'bg-slate-900/60 border-white/10 shadow-black/40' 
              : 'bg-white/90 border-slate-200 shadow-slate-200/60'
          }`}>
            <div className="mb-8 text-center">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Welcome Back</h2>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Authenticate to access the terminal.</p>
            </div>

            <form className="space-y-5" onSubmit={handleFormSubmit}>
              {/* --- EMAIL & PASSWORD INPUTS (Keep Existing JSX) --- */}
              
              {/* EMAIL */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="email" 
                    placeholder="trader@nextbull.in" 
                    required
                    className={`w-full border rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-4 transition-all text-sm ${
                      darkMode 
                        ? 'bg-slate-950/40 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-400/10'
                    }`} 
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Password</label>
                  <button type="button" className={`text-[10px] font-bold hover:text-blue-500 transition-colors ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Forgot?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    required
                    className={`w-full border rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-4 transition-all text-sm ${
                      darkMode 
                        ? 'bg-slate-950/40 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-400/10'
                    }`} 
                  />
                </div>
              </div>

              {/* SHOW PASSWORD TOGGLE */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className={`text-[10px] font-bold uppercase tracking-widest ml-1 flex items-center gap-2 hover:text-blue-500 transition-colors ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />} 
                {showPassword ? 'Hide Secret Key' : 'Show Secret Key'}
              </button>

              {/* SECURITY WARNING */}
              <div className={`p-3 rounded-xl border flex items-start gap-3 mt-4 ${
                darkMode ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-100'
              }`}>
                <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-amber-500/80' : 'text-amber-700/80'}`}>
                  Ensure you are on the official <b>nextbull.in</b> domain before entering your credentials.
                </p>
              </div>
              {/* ... */}

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-600/25 mt-4 flex items-center justify-center gap-2 group transition-all active:scale-[0.97]">
                Access Terminal <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 text-center">
              {/* 6. Use navigate for the footer link */}
              <button 
                onClick={() => navigate('/signup')} 
                className="text-[10px] text-blue-600 hover:text-blue-500 font-black uppercase tracking-[0.15em] transition-colors"
              >
                New Operator? Request Access
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}