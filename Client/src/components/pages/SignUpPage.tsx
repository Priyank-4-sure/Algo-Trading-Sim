import { useState } from 'react';
import { Eye, EyeOff, TrendingUp, ArrowRight, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { GuestTopNav } from '../layouts/GuestTopNav'; // <-- 1. Import the Nav Component

interface SignUpPageProps {
  onSignUp: () => void;
  onGoToLogin: () => void;
  onGoToHome: () => void;
  darkMode: boolean;
  toggleDarkMode: ()=>void;
}

export function SignUpPage({ onSignUp, onGoToLogin, onGoToHome, darkMode,toggleDarkMode,}: SignUpPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    // 2. Wrap everything in a main container that handles the background color
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-500 ${
      darkMode ? 'bg-[#0f172a]' : 'bg-slate-50'
    }`}>
      
      {/* 3. Add the GuestTopNav at the very top */}
      <GuestTopNav 
        darkMode={darkMode}
        onLogin={onGoToLogin}
        onSignUp={() => {}} // Already on Sign Up, so do nothing
        onGoHome={onGoToHome}
        toggleDarkMode={toggleDarkMode}
      />

      {/* 4. Make this inner div take up the rest of the screen height (flex-1) */}
      <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
        
        {/* ─── SHARED GRID PATTERN BACKGROUND ─── */}
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

        <div className="relative z-10 w-full max-w-[440px] mx-4 my-8">
          
          {/* I REMOVED the redundant logo block that was here, since the Logo is now in the TopNav! */}

          {/* AUTH CARD */}
          <div className={`backdrop-blur-2xl border rounded-[2.5rem] p-8 md:p-10 shadow-2xl transition-all duration-500 ${
            darkMode 
              ? 'bg-slate-900/60 border-white/10 shadow-black/40' 
              : 'bg-white/90 border-slate-200 shadow-slate-200/60'
          }`}>
            <div className="mb-6 text-center">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Create Account</h2>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Join the high-frequency trading network.</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSignUp(); }}>
              {/* FULL NAME */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Alex Morgan" 
                    required
                    className={`w-full border rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-4 transition-all text-sm ${
                      darkMode 
                        ? 'bg-slate-950/40 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-400/10'
                    }`} 
                  />
                </div>
              </div>

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

              {/* PASSWORDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required
                      className={`w-full border rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-4 transition-all text-sm ${
                        darkMode 
                          ? 'bg-slate-950/40 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-400/10'
                      }`} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Confirm</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required
                      className={`w-full border rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-4 transition-all text-sm ${
                        darkMode 
                          ? 'bg-slate-950/40 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-400/10'
                      }`} 
                    />
                  </div>
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

              {/* TERMS FOOTER */}
              <div className={`p-3 rounded-xl border flex items-start gap-3 mt-4 ${
                darkMode ? 'bg-blue-500/5 border-blue-500/10' : 'bg-slate-50 border-slate-100'
              }`}>
                <ShieldCheck className="text-blue-500 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] leading-relaxed text-slate-500">
                  By initializing this account, you agree to our <b>Institutional Protocol</b> and automated execution risk terms.
                </p>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-600/25 mt-2 flex items-center justify-center gap-2 group transition-all active:scale-[0.97]">
                Open Portfolio <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 text-center">
              <button onClick={onGoToLogin} className="text-[10px] text-blue-600 hover:text-blue-500 font-black uppercase tracking-[0.15em] transition-colors">
                Existing Operator? Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}