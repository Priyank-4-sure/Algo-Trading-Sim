import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate
import { GuestTopNav } from '../layouts/GuestTopNav';

interface SignUpPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  // Optional: keeping for compatibility during the transition
  onGoToLogin?: () => void;
  onGoToHome?: () => void;
}

import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../config';

export function SignUpPage({ darkMode, toggleDarkMode }: SignUpPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); 
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = (formData.get('confirmPassword') as string || '').trim();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 8 characters, include a lowercase letter and a number.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          full_name: fullName, 
          email, 
          password 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Automatically login after registration
      login(data.access_token, data.refresh_token, {
        id: 0,
        email: email,
        fullName: fullName
      });

      navigate('/app/trade');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-500 ${
      darkMode ? 'bg-[#0f172a]' : 'bg-slate-50'
    }`}>
      
      {/* ─── SHARED TOP NAVIGATION ─── */}
      <GuestTopNav 
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogin={() => navigate('/login')} // 5. Use navigate
        onSignUp={() => {}} 
        onGoHome={() => navigate('/')}      // 5. Use navigate
      />

      <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
        {/* --- BACKGROUND ELEMENTS (Keeping Existing JSX) --- */}
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
        <div className="absolute inset-0 pointer-events-none">
          {/* ... grid and glow divs ... */}
        </div>

        <div className="relative z-10 w-full max-w-[440px] mx-4 my-8">
          
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

            <form className="space-y-4" onSubmit={handleFormSubmit}>
              {/* --- FORM FIELDS (Keep Existing JSX) --- */}
              {/* FULL NAME */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    name="fullName"
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
                    name="email"
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
                      name="password"
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
                      name="confirmPassword"
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
              {/* ... Name, Email, Passwords ... */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}
              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full ${isLoading ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-600/25 mt-2 flex items-center justify-center gap-2 group transition-all active:scale-[0.97]`}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'} 
                {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 text-center">
              {/* 6. Use navigate for the footer link */}
              <div className='flex justify-center gap-1'>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] transition-colors">Existing User?</p>
              <button 
                onClick={() => navigate('/login')} 
                className="text-[10px] text-blue-600 hover:text-blue-500 font-black uppercase tracking-[0.15em] transition-colors"
              >
                Sign In
              </button></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}