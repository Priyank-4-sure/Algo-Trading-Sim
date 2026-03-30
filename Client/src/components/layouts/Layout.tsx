import { useState, ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { MOCK_MARKETS, MOCK_POSITIONS, MarketPair, Position } from '../../data/mockData'; 

interface LayoutProps {
  children?: ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
}

export interface DashboardContextType {
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  markets: MarketPair[];
  positions: Position[];
  watchlist: string[];
  toggleWatchlist: (symbol: string) => void;
}

export function Layout({ darkMode, toggleDarkMode, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  
  // 1. Initialize global state using your mock data
  const [activeSymbol, setActiveSymbol] = useState(MOCK_MARKETS[0].symbol);
  const [markets, setMarkets] = useState<MarketPair[]>(MOCK_MARKETS);
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  // ... existing states ...
  const [watchlist, setWatchlist] = useState<string[]>(['BTC/INR', 'SOL/INR']); // default watched items

  // 2. Add the toggle function
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol) 
        : [...prev, symbol]
    );
  };

  
  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-main text-main font-sans">
      <SideNav onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Pass ONLY what TopNav needs */}
        <TopNav 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode} 
          onLogout={onLogout} 
          onProfileClick={() => navigate('/app/portfolio')}
          activeSymbol={activeSymbol}
          onSymbolChange={setActiveSymbol}
          markets={markets} // TopNav uses this for the search dropdown
        />
        
        <main className="flex-1 p-2 overflow-auto md:overflow-hidden flex gap-2 w-full max-w-[1600px] mx-auto">
          {/* 2. Pass everything down through the Outlet context */}
          <Outlet context={{ activeSymbol, setActiveSymbol, markets, positions,watchlist ,toggleWatchlist } satisfies DashboardContextType} />
        </main>
      </div>
    </div>
  );
}