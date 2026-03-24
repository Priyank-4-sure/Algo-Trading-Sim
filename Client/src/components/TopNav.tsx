import { Moon, Sun, Search, Bell, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface TopNavProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function TopNav({ darkMode, toggleDarkMode }: TopNavProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState('BTC/USD');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const pairs = [
    { symbol: 'BTC/USD', name: 'Bitcoin', price: '$64,230.50', change: '+2.45%', icon: '₿', iconColor: 'bg-up' },
    { symbol: 'ETH/USD', name: 'Ethereum', price: '$3,380.20', change: '-1.12%', icon: 'Ξ', iconColor: 'bg-main border border-main' },
    { symbol: 'SOL/USD', name: 'Solana', price: '$148.45', change: '+5.20%', icon: 'S', iconColor: 'bg-main border border-main' },
    { symbol: 'AAPL', name: 'Apple Inc.', price: '$189.45', change: '+0.45%', icon: '', iconColor: 'bg-main border border-main' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: '$175.22', change: '-2.30%', icon: 'T', iconColor: 'bg-down' },
  ];

  const filteredPairs = pairs.filter(p =>
    p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 border-b border-main bg-panel flex items-center justify-between px-4 shrink-0 shadow-sm z-50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Premium Coin Picker */}
        <div className="relative" ref={pickerRef}>
              <button
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className={`flex items-center gap-3 w-56 px-3 py-1.5 rounded-md border transition-all duration-200 group
              ${isPickerOpen
                ? 'border-white bg-main'
                : 'border-main bg-main/50 hover:border-white/50'}`}
          >
            <Search size={14} className={`${isPickerOpen ? 'text-main' : 'text-muted group-hover:text-main'}`} />
            <span className="flex-1 text-left text-sm font-bold text-main">{selectedPair}</span>
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
                  {['All', 'Crypto', 'Stocks'].map(cat => (
                    <button key={cat} className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all ${cat === 'All' ? 'bg-panel border-white text-main' : 'border-main text-muted hover:text-main hover:border-white/50'}`}>{cat}</button>
                  ))}
                </div>
                {filteredPairs.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => {
                      setSelectedPair(pair.symbol);
                      setIsPickerOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-panel transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${pair.iconColor} rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-110`}>
                        {pair.icon}
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <span className="font-bold text-sm text-main">{pair.symbol}</span>
                        <span className="text-xs text-muted">{pair.name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-mono font-bold text-main">{pair.price}</span>
                      <span className={`text-[10px] font-bold ${pair.change.startsWith('+') ? 'text-up' : 'text-down'}`}>{pair.change}</span>
                    </div>
                    {selectedPair === pair.symbol && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-white" />}
                  </button>
                ))}
                {filteredPairs.length === 0 && (
                  <div className="p-8 text-center text-muted text-sm">No results found for "{searchQuery}"</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-8 border-l border-main pl-8 ml-2">
          <div className="flex items-baseline gap-2">
            <span className="text-up font-bold text-base tracking-tight">$64,230.50</span>
            <span className="text-xs text-up font-semibold">+2.45%</span>
          </div>
          <div className="hidden lg:flex items-baseline gap-2">
            <span className="text-xs text-muted uppercase tracking-wider font-bold">High</span>
            <span className="text-sm font-mono font-bold text-muted">$65,100.00</span>
          </div>
          <div className="hidden lg:flex items-baseline gap-2">
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Low</span>
            <span className="text-sm font-mono font-bold text-muted">$62,400.00</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-full hover:bg-panel transition-colors text-muted hover:text-main">
          <Bell size={18} />
        </button>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-panel transition-colors text-muted hover:text-main"
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="w-8 h-8 rounded-full bg-panel border border-main flex items-center justify-center text-main font-bold text-sm ml-2 shadow-sm shadow-white/5 hover:border-white/50 cursor-pointer transition-colors">
          US
        </div>
      </div>
    </header>
  );
}
