import { 
  Moon, Sun, Search, Bell, ChevronDown, LogOut, User, ChevronRight,
  BarChart2, PieChart, Star, History, LineChart, Activity // Added new icons for page titles
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // <-- NEW: Import useLocation
import { MarketPair } from '../../data/mockData'; 

interface TopNavProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  onProfileClick: () => void;
  activeSymbol: string; 
  onSymbolChange: (symbol: string) => void;
  markets: MarketPair[]; 
}

export function TopNav({ 
  darkMode, 
  toggleDarkMode, 
  onLogout, 
  onProfileClick, 
  activeSymbol, 
  onSymbolChange,
  markets 
}: TopNavProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  // --- NEW: Get current route to determine what to show ---
  const location = useLocation();
  const isTradePage = location.pathname.includes('/trade');

  const currentPair = markets.find(p => p.symbol === activeSymbol) || markets[0];
  const stored = localStorage.getItem('user');
  const data = stored ? JSON.parse(stored) : null;
  const name = data?.fullName;
  const filteredPairs = markets.filter(p =>
    p.displaySymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- NEW: Helper to render the correct title/icon for non-trade pages ---
  const getPageContext = () => {
    if (location.pathname.includes('/markets')) return { title: 'Markets Overview', icon: <BarChart2 size={18} /> };
    if (location.pathname.includes('/watchlist')) return { title: 'My Watchlist', icon: <Star size={18} /> };
    if (location.pathname.includes('/portfolio')) return { title: 'Portfolio', icon: <PieChart size={18} /> };
    if (location.pathname.includes('/analytics')) return { title: 'Analytics Dashboard', icon: <LineChart size={18} /> };
    if (location.pathname.includes('/history')) return { title: 'Trade History', icon: <History size={18} /> };
    return { title: 'Dashboard', icon: <Activity size={18} /> };
  };

  const pageContext = getPageContext();

  return (
    <header className="h-12 border-b border-main bg-panel flex items-center justify-between px-4 shrink-0 shadow-sm z-50 transition-colors font-sans">
      <div className="flex items-center gap-4">
        {/* NextBull Logo - Always visible */}
        <div className="flex items-center gap-2 pr-4 border-r border-main">
          <img src="/src/logo/logo.webp" alt="NextBull Logo" className="h-8 w-auto" />
          <span className="font-semibold text-xl tracking-wide text-white">NEXTBULL</span>
        </div>

        {/* --- CONDITIONAL RENDERING --- */}
        {isTradePage ? (
          <>
            {/* Premium Coin Picker (Trade Page Only) */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className={`flex items-center gap-3 w-56 px-3 py-1.5 rounded-md border transition-all duration-200 group
                  ${isPickerOpen
                    ? 'border-white bg-main'
                    : 'border-main bg-main/50 hover:border-white/50'}`}
              >
                <Search size={14} className={`${isPickerOpen ? 'text-main' : 'text-muted group-hover:text-main'}`} />
                <span className="flex-1 text-left text-sm font-bold text-main">{currentPair?.displaySymbol || activeSymbol}</span>
                <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${isPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPickerOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-main border border-main rounded-lg shadow-black/40 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 border-b border-main">
                    <div className="flex items-center gap-2 bg-panel rounded-md px-3 py-2 border border-main focus-within:border-white transition-colors">
                      <Search size={14} className="text-muted" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search symbols..."
                        className="bg-transparent outline-none flex-1 text-sm text-main"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto no-scrollbar">
                    <div className="p-2 flex gap-2 border-b border-trading-border">
                      {['All'].map(cat => (
                        <button key={cat} className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all ${cat === 'All' ? 'bg-panel border-white text-main' : 'border-main text-muted hover:text-main hover:border-white/50'}`}>{cat}</button>
                      ))}
                    </div>
                    {filteredPairs.map((pair) => (
                      <button
                        key={pair.symbol}
                        onClick={() => {
                          onSymbolChange(pair.symbol);
                          setIsPickerOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-panel transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 ${pair.iconColor || 'bg-main border border-main'} rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-110`}>
                            {pair.icon}
                          </div>
                          <div className="flex flex-col items-start leading-tight">
                            <span className="font-bold text-sm text-main">{pair.displaySymbol}</span>
                            <span className="text-xs text-muted">{pair.name}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-mono font-bold text-main">{pair.price}</span>
                          <span className={`text-[10px] font-bold ${pair.isPositive ? 'text-up' : 'text-down'}`}>{pair.change}</span>
                        </div>
                        {activeSymbol === pair.symbol && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>
                    ))}
                    {filteredPairs.length === 0 && (
                      <div className="p-8 text-center text-muted text-sm">No results found for "{searchQuery}"</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic header stats (Trade Page Only) */}
            <div className="flex items-center gap-8 border-l border-main pl-8 ml-2">
              {currentPair && (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold text-base tracking-tight font-mono ${currentPair.isPositive ? 'text-up' : 'text-down'}`}>
                      {currentPair.price}
                    </span>
                    <span className={`text-xs font-semibold ${currentPair.isPositive ? 'text-up' : 'text-down'}`}>
                      {currentPair.change}
                    </span>
                  </div>
                  <div className="hidden lg:flex items-baseline gap-2">
                    <span className="text-xs text-muted uppercase tracking-wider font-bold">High</span>
                    <span className="text-sm font-mono font-bold text-muted">{currentPair.high}</span>
                  </div>
                  <div className="hidden lg:flex items-baseline gap-2">
                    <span className="text-xs text-muted uppercase tracking-wider font-bold">Low</span>
                    <span className="text-sm font-mono font-bold text-muted">{currentPair.low}</span>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* --- ALTERNATIVE UI FOR NON-TRADE PAGES --- */
          <div className="flex items-center gap-2 px-2 text-muted animate-in fade-in slide-in-from-left-2 duration-300">
            {pageContext.icon}
            <span className="font-bold text-main tracking-tight">{pageContext.title}</span>
          </div>
        )}
      </div>

      {/* Right Side Settings (Always visible) */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-panel transition-colors text-muted hover:text-main"
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        {/* Account Dropdown Container */}
        <div className="relative ml-2" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-sm transition-colors ${
              isProfileOpen 
                ? 'bg-main border-white text-panel' 
                : 'bg-panel border-main text-main hover:border-white/50 shadow-white/5'
            }`}
            title="View Profile"
          >
            <User size={18} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-3 w-56 bg-main border border-main rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-main bg-panel/30 rounded-t-xl mb-1">
                 <p className="text-[10px] font-bold text-muted uppercase tracking-tighter leading-none mb-1">Username</p>
                 <p className="text-sm font-bold text-main truncate">{name}</p>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                <button 
                  onClick={() => {
                    onProfileClick();
                    setIsProfileOpen(false);
                  }} 
                  className="w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-xs font-medium text-muted hover:text-main hover:bg-panel"
                >
                  <div className="flex items-center gap-2"><User size={14} /> See full portfolio</div>
                  <ChevronRight size={14} className="opacity-50" />
                </button>
                <button 
                  onClick={() => {
                    onLogout();
                    setIsProfileOpen(false);
                  }} 
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg text-red-500 hover:bg-red-500/10 font-bold text-xs transition-colors"
                >
                  <LogOut size={14} /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}