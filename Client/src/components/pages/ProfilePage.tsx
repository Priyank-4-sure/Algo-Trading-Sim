import { useState } from 'react';
import { User, Mail, Shield, Key, Zap, CheckCircle2, Clock, Copy, RefreshCw, AlertTriangle } from 'lucide-react';

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'security'>('general');
  const [apiKey, setApiKey] = useState('NEXUS_LIVE_98A2B4C7D6E5...');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const username = localStorage.getItem('username') || 'Trader';

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setApiKey(`NEXUS_LIVE_${Math.random().toString(36).substring(2, 14).toUpperCase()}...`);
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div className="flex flex-col w-full h-full p-6 animate-in fade-in zoom-in-95 duration-300 max-w-5xl mx-auto relative">
      
      {/* Header Profile Section */}
      <div className="glass-panel p-8 rounded-2xl border border-main mb-6 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-main/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="shrink-0 w-24 h-24 rounded-full bg-gradient-to-br from-main to-main/30 border-2 border-white/10 flex items-center justify-center text-4xl font-black font-display text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] relative z-10">
          {username.substring(0, 2).toUpperCase()}
        </div>
        
        <div className="flex-1 relative z-10 text-center md:text-left">
          <h1 className="text-3xl font-black font-display tracking-tight text-white mb-1 truncate">{username}</h1>
          <div className="flex items-center gap-4 text-sm font-medium text-muted">
            <span className="flex items-center gap-1.5"><Mail size={14} /> {username.includes('@') ? username : `${username}@nexus.trade`}</span>
            <span className="flex items-center gap-1.5 text-up"><CheckCircle2 size={14} /> Verified Account</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> Joined March 2024</span>
          </div>
        </div>
        
        <div className="relative z-10 grid grid-cols-2 gap-4 mt-6 md:mt-0 w-full md:w-auto">
          <div className="bg-panel border border-main rounded-xl p-3 px-6 text-center">
            <div className="text-[10px] uppercase text-muted font-bold tracking-widest mb-1">Fee Tier</div>
            <div className="font-mono font-bold text-lg text-white">VIP 1</div>
          </div>
          <div className="bg-panel border border-main rounded-xl p-3 px-6 text-center">
            <div className="text-[10px] uppercase text-muted font-bold tracking-widest mb-1">Status</div>
            <div className="font-bold text-lg text-up flex items-center gap-2 justify-center">
              <span className="w-2 h-2 rounded-full bg-up animate-pulse" /> Active
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-main pb-4">
        <button 
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'general' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-muted hover:bg-panel hover:text-white'}`}
        >
          <User size={16} /> General
        </button>
        <button 
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'api' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-muted hover:bg-panel hover:text-white'}`}
        >
          <Zap size={16} /> Algorithmic API Keys
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'security' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-muted hover:bg-panel hover:text-white'}`}
        >
          <Shield size={16} /> Security
        </button>
      </div>

      {/* Multi-Pane Content */}
      <div className="flex-1 w-full flex flex-col min-h-0 relative">
        
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="glass-panel rounded-2xl p-6 border border-main">
              <h2 className="text-lg font-bold font-display mb-6 border-b border-main pb-4">Personal Information</h2>
              <div className="space-y-5">
                <div>
                  <label className="text-xs uppercase font-bold text-muted ml-1 mb-1 block">Display Name</label>
                  <input type="text" readOnly value={username} className="w-full bg-panel border border-main rounded-xl p-3 text-sm font-medium text-white/70 focus:outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs uppercase font-bold text-muted ml-1 mb-1 block">Registered Email</label>
                  <input type="email" readOnly value={username.includes('@') ? username : `${username}@nexus.trade`} className="w-full bg-panel border border-main rounded-xl p-3 text-sm font-medium text-white/70 focus:outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs uppercase font-bold text-muted ml-1 mb-1 block">Timezone</label>
                  <select className="w-full bg-main border border-white/20 rounded-xl p-3 text-sm font-medium text-white focus:outline-none focus:border-white transition-colors cursor-pointer appearance-none">
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="EST">EST (Eastern Standard Time)</option>
                    <option value="PST">PST (Pacific Standard Time)</option>
                  </select>
                </div>
                <button className="mt-4 w-full bg-white text-black font-bold py-3 rounded-xl transition-transform active:scale-[0.98]">
                  Save Changes
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-main">
              <h2 className="text-lg font-bold font-display mb-6 border-b border-main pb-4">Trading Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-panel border border-main rounded-xl">
                  <div>
                    <div className="font-bold text-sm">One-Click Trading</div>
                    <div className="text-xs text-muted">Bypass confirmation modals for ultra-fast executions</div>
                  </div>
                  <div className="w-10 h-6 bg-up/20 rounded-full border border-up/50 p-1 cursor-pointer flex justify-end">
                    <div className="w-4 h-4 rounded-full bg-up shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-panel border border-main rounded-xl">
                  <div>
                    <div className="font-bold text-sm">Dark Pool Routing</div>
                    <div className="text-xs text-muted">Route massive block trades through institutional pools</div>
                  </div>
                  <div className="w-10 h-6 bg-main rounded-full border border-white/10 p-1 cursor-pointer flex justify-start">
                    <div className="w-4 h-4 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-panel border border-main rounded-xl">
                  <div>
                    <div className="font-bold text-sm">Audio Alerts</div>
                    <div className="text-xs text-muted">Play sound on order execution and margin calls</div>
                  </div>
                  <div className="w-10 h-6 bg-up/20 rounded-full border border-up/50 p-1 cursor-pointer flex justify-end">
                    <div className="w-4 h-4 rounded-full bg-up shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api' && (
          <div className="glass-panel rounded-2xl p-8 border border-main min-h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold font-display text-white mb-2 flex items-center gap-3">
                  High-Frequency Trading Endpoints <div className="px-2 py-0.5 rounded text-[10px] bg-up/20 text-up border border-up/30">LIVE</div>
                </h2>
                <p className="text-sm text-muted max-w-2xl">
                  Generate secure High-Frequency Trading API Keys to connect your custom Python/C++ algorithmic bots directly to the Nexus Matching Engine via WebSocket or REST.
                </p>
              </div>
              <button 
                onClick={handleRegenerate}
                className="flex items-center gap-2 bg-main hover:bg-main/80 border border-white/20 hover:border-white/50 px-4 py-2 rounded-xl text-sm font-bold transition-all relative overflow-hidden group"
              >
                {isGenerating ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Zap size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                )}
                <span>Generate New Key</span>
              </button>
            </div>

            <div className="bg-panel border border-main rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs uppercase font-bold text-muted ml-1">Live Trading Key</label>
                    <span className="text-[10px] text-up font-mono bg-up/10 px-2 py-0.5 rounded border border-up/20">Read / Write Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={apiKey} 
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm font-mono text-white focus:outline-none focus:border-white/30 transition-colors" 
                    />
                    <button 
                      onClick={handleCopy}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 p-3.5 rounded-xl transition-all flex items-center justify-center w-12"
                    >
                      {copied ? <CheckCircle2 size={18} className="text-up" /> : <Copy size={18} className="text-muted" />}
                    </button>
                  </div>
                  {copied && <div className="text-[10px] text-up font-bold mt-2 ml-1 animate-in fade-in">API Key copied to clipboard!</div>}
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-4">
                  <AlertTriangle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-yellow-500 mb-1">Security Warning</h4>
                    <p className="text-xs text-yellow-500/80 leading-relaxed">
                      Your Secret API Key is only displayed once upon generation. Treat it like a password. If your algorithmic bot's code is compromised, malicious actors can liquidate your entire portfolio. Consider IP-restricting your keys.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 border-b border-main pb-2">Active Keys</h3>
              <div className="flex items-center justify-between p-4 bg-panel border border-main rounded-xl hover:bg-main/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                    <Key size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Default Trading Bot - Python</div>
                    <div className="text-xs text-muted font-mono mt-1">Created: Mar 26, 2024 • Last Used: 2 minutes ago</div>
                  </div>
                </div>
                <button className="text-xs font-bold text-down hover:bg-down/20 border border-transparent hover:border-down/30 px-3 py-1.5 rounded-lg transition-colors">
                  Revoke
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="glass-panel rounded-2xl p-6 border border-main lg:w-2/3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-bold font-display mb-6 border-b border-main pb-4">Security Settings</h2>
            
            <div className="space-y-6">
              <div className="flex items-start justify-between p-4 bg-panel border-l-2 border-up rounded-r-xl border-y border-r border border-main">
                <div>
                  <h4 className="font-bold text-sm mb-1 text-white flex items-center gap-2">Two-Factor Authentication (2FA) <div className="px-1.5 py-0.5 rounded text-[10px] bg-up/20 text-up border border-up/30">Enabled</div></h4>
                  <p className="text-xs text-muted">Protect your account and withdrawals with Google Authenticator.</p>
                </div>
                <button className="text-xs font-bold text-muted hover:text-white border border-main hover:border-white/20 px-4 py-2 rounded-xl transition-all">
                  Manage
                </button>
              </div>

              <div className="flex items-start justify-between p-4 bg-panel rounded-xl border border-main">
                <div>
                  <h4 className="font-bold text-sm mb-1 text-white">Password</h4>
                  <p className="text-xs text-muted">Last changed 3 months ago</p>
                </div>
                <button className="text-xs font-bold bg-white text-black px-4 py-2 rounded-xl transition-transform active:scale-[0.98]">
                  Update Password
                </button>
              </div>
              
              <div className="flex items-start justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl mt-8">
                <div>
                  <h4 className="font-bold text-sm mb-1 text-down">Danger Zone</h4>
                  <p className="text-xs text-red-400/80">Permanently delete your account, trading history, and algorithms.</p>
                </div>
                <button className="text-xs font-bold bg-down/20 hover:bg-down/40 text-down border border-down/30 px-4 py-2 rounded-xl transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
