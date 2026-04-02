import { useState, useEffect, useCallback, ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { MOCK_POSITIONS, MarketPair, Position } from '../../data/mockData';
import { API_BASE_URL } from '../../config';
import { useMarketPrices, MarketPriceData } from '../../hooks/useMarketPrices';

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
  
  // 1. Initialize global state
  const [activeSymbol, setActiveSymbol] = useState('');
  const [markets, setMarkets] = useState<MarketPair[]>([]);
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Map backend symbols to user-friendly display names
  const SYMBOL_META: Record<string, { displaySymbol: string; name: string; icon: string; iconColor: string }> = {
    TECH: { displaySymbol: 'BTC/INR',  name: 'Bitcoin',  icon: '₿', iconColor: 'bg-up' },
    MEME: { displaySymbol: 'ETH/INR',  name: 'Ethereum', icon: 'Ξ', iconColor: 'bg-main border border-main' },
    BANK: { displaySymbol: 'SOL/INR',  name: 'Solana',   icon: 'S', iconColor: 'bg-main border border-main' },
  };

  // Fetch assets from the backend API
  useEffect(() => {
    fetch(`${API_BASE_URL}/assets`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK' && Array.isArray(data.data)) {
          const fetched: MarketPair[] = data.data.map((asset: any) => {
            const meta = SYMBOL_META[asset.ticker] || { displaySymbol: asset.ticker, name: asset.class, icon: asset.ticker[0], iconColor: 'bg-main border border-main' };
            return {
              symbol: asset.ticker,
              displaySymbol: meta.displaySymbol,
              name: meta.name,
              price: `₹${Number(asset.start_price).toFixed(2)}`,
              change: '+0.00%',
              high: '-',
              low: '-',
              isPositive: true,
              icon: meta.icon,
              iconColor: meta.iconColor,
            };
          });
          setMarkets(fetched);
          if (fetched.length > 0 && !activeSymbol) {
            setActiveSymbol(fetched[0].symbol);
          }
        }
      })
      .catch(err => console.error('Failed to fetch assets:', err));
  }, []);

  // 2. Add the toggle function
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  // 3. Live price updates via WebSocket
  const handlePriceUpdate = useCallback((prices: MarketPriceData[]) => {
    setMarkets(prev => prev.map(m => {
      const update = prices.find(p => p.symbol === m.symbol);
      if (!update) return m;
      const change = update.change_24h;
      return {
        ...m,
        price: `₹${update.price.toFixed(2)}`,
        change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
        high: update.high_24h > 0 ? `₹${update.high_24h.toFixed(2)}` : '-',
        low: update.low_24h > 0 ? `₹${update.low_24h.toFixed(2)}` : '-',
        isPositive: change >= 0,
      };
    }));
  }, []);

  useMarketPrices(handlePriceUpdate);


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
        
        <main className="flex-1 p-2 overflow-auto md:overflow-hidden flex gap-2 w-full">
          {/* 2. Pass everything down through the Outlet context */}
          <Outlet context={{ activeSymbol, setActiveSymbol, markets, positions,watchlist ,toggleWatchlist } satisfies DashboardContextType} />
        </main>
      </div>
    </div>
  );
}