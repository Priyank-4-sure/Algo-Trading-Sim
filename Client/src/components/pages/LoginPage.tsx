import { useState } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Lock, User, ChevronRight, Activity, Chrome } from 'lucide-react';
import { auth, signInWithGoogle } from '../../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginWithFirebase } = useWebSocket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Both Email and Password are required');
      return;
    }

    if (!auth) {
      setError('Firebase Auth is not initialized in .env.local');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let userCredential;
      try {
        // Try to log in first
        userCredential = await signInWithEmailAndPassword(auth, username, password);
      } catch (loginErr: any) {
        // If user doesn't exist (invalid-credential usually covers non-existent or wrong pass now for security)
        // We will optimistically try to create an account for them
        if (loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/user-not-found') {
          try {
            userCredential = await createUserWithEmailAndPassword(auth, username, password);
          } catch (createErr: any) {
            throw createErr; // Password too weak, email invalid, etc.
          }
        } else {
          throw loginErr;
        }
      }

      const token = await userCredential.user.getIdToken();
      // Exchange Firebase Token for our High-Speed PostgreSQL-backed JWT
      await loginWithFirebase(token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check credentials.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      const token = await result.user.getIdToken();
      await loginWithFirebase(token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-white font-sans selection:bg-main/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-main/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10">
        
        {/* Logo and Brand */}
        <div className="flex flex-col items-center justify-center mb-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-main to-main/40 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-white/20">
            <Activity size={32} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Nexus Trading
          </h1>
          <p className="text-muted text-sm mt-3 font-medium">HFT Algorithmic Simulator</p>
        </div>

        {/* Glassmorphism Login Card */}
        <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-black/40">
          
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-5">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider font-bold text-muted ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted transition-colors group-focus-within:text-main">
                  <User size={18} />
                </div>
                <input
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 ring-main/50 focus:border-main/50 transition-all placeholder:text-muted/50"
                  placeholder="Enter your email"
                  autoComplete="username email"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider font-bold text-muted ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted transition-colors group-focus-within:text-main">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 ring-main/50 focus:border-main/50 transition-all placeholder:text-muted/50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-down text-sm bg-down/10 p-3 rounded-lg border border-down/20 font-medium">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-main hover:bg-main/90 text-black font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ChevronRight size={18} strokeWidth={3} />
                </>
              )}
            </button>
            
            <div className="relative flex items-center justify-center my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative bg-black/40 px-3 text-xs uppercase text-muted font-bold tracking-widest backdrop-blur-xl">
                Or
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full bg-white text-black font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.98]"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Chrome size={18} strokeWidth={2.5} />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>

          </form>

        </div>
        
        <div className="text-center mt-8">
          <p className="text-xs text-muted/60 font-mono">
            Demo Environment • v2.1.0 • JWT Secured
          </p>
        </div>

      </div>
    </div>
  );
}
