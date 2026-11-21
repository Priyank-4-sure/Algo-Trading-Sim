import { useState, useEffect, useCallback, ReactNode, useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { MOCK_POSITIONS, MarketPair, Position, MOCK_MARKETS } from "../../data/mockData";
import { API_BASE_URL } from "../../config";
import { SYMBOL_META } from "../../data/symbolMeta";
import { useMarketPrices, MarketPriceData } from "../../hooks/useMarketPrices";
import { usePortfolio, Holding } from "../../hooks/usePortfolio";
import { AuthContext } from "../../context/AuthContext";

interface LayoutProps {
  children?: ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  isOffline?: boolean;
  onToggleOffline?: (offline: boolean) => void;
}

export interface DashboardContextType {
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  markets: MarketPair[];
  positions: Position[];
  holdings: Holding[];
  updatePrice: (id: string, newPrice: number, change24h: number) => void;
  watchlist: string[];
  toggleWatchlist: (symbol: string) => Promise<void>;
  isOffline: boolean;
  setIsOffline: (value: boolean) => void;
}

function getOfflineWatchlist(): string[] {
  try {
    const stored = localStorage.getItem('offline_watchlist');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setOfflineWatchlist(symbols: string[]): void {
  try {
    localStorage.setItem('offline_watchlist', JSON.stringify(symbols));
  } catch (e) {
    console.error('Failed to store offline watchlist:', e);
  }
}

export function Layout({ darkMode, toggleDarkMode, onLogout }: LayoutProps) {
  const navigate = useNavigate();

  // Get the access token directly from AuthContext
  const authContext = useContext(AuthContext);
  const accessToken = authContext?.accessToken;
  const toggleOfflineMode = authContext?.toggleOfflineMode;

  // Handle logout - just clear auth and redirect to landing
  const handleLogout = useCallback(() => {
    onLogout();
    navigate("/");
  }, [onLogout, navigate]);

  // 1. Initialize global state
  const [activeSymbol, setActiveSymbol] = useState("");
  const [markets, setMarkets] = useState<MarketPair[]>([]);
  const [positions] = useState<Position[]>(MOCK_POSITIONS);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isOffline, setIsOfflineState] = useState(false);

  // Initialize watchlist from localStorage in offline mode
  useEffect(() => {
    if (!accessToken) {
      const storedWatchlist = getOfflineWatchlist();
      if (storedWatchlist.length > 0) {
        setWatchlist(storedWatchlist);
      }
    }
  }, [accessToken]);

  // Persist watchlist to localStorage when it changes (offline mode)
  useEffect(() => {
    if (!accessToken) {
      setOfflineWatchlist(watchlist);
    }
  }, [watchlist, accessToken]);

  // Portfolio holdings streamed via WebSocket (single shared connection)
  const { holdings, updatePrice, isOffline: offlineState } = usePortfolio();

  // Use handleLogout instead of onLogout to properly reset offline state
  const logoutHandler = () => handleLogout();

  // Update offline state from portfolio hook
  useEffect(() => {
    setIsOfflineState(offlineState);
  }, [offlineState]);

  // Fetch assets and watchlist from the backend API
  useEffect(() => {
    // Skip API fetch if no auth token (offline mode)
    // Markets are initialized by useMarketPrices hook below
    if (!accessToken) {
      // Set initial markets from MOCK_MARKETS - prices will be updated by useMarketPrices
      setMarkets(MOCK_MARKETS);
      if (MOCK_MARKETS.length > 0 && !activeSymbol) {
        setActiveSymbol(MOCK_MARKETS[0].symbol);
      }
      return;
    }

    // Fetch Assets (Public/No Auth Needed usually)
    fetch(`${API_BASE_URL}/assets`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK" && Array.isArray(data.data)) {
          const fetched: MarketPair[] = data.data.map((asset: any) => {
            const meta = SYMBOL_META[asset.ticker] || {
              displaySymbol: asset.ticker,
              name: asset.class,
              icon: asset.ticker[0],
              iconColor: "bg-main border border-main",
            };
            return {
              symbol: asset.ticker,
              displaySymbol: meta.displaySymbol,
              name: meta.name,
              price: `₹${Number(asset.start_price).toFixed(2)}`,
              change: "+0.00%",
              high: "-",
              low: "-",
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
      .catch((err) => console.error("Failed to fetch assets:", err));

    // Fetch Watchlist ONLY if we have an accessToken
    if (accessToken) {
      fetch(`${API_BASE_URL}/watchlist`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((res) => {
          if (res.status === 401) {
            console.warn("Session expired (401), logging out...");
            onLogout();
            return;
          }
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const payload = data.data || data;
          if (Array.isArray(payload)) {
            const watchlistSymbols = payload.map((item: any) =>
              typeof item === "string" ? item : item.symbol,
            );
            setWatchlist(watchlistSymbols);
          }
        })
        .catch((err) => console.error("Failed to fetch watchlist:", err));
    } else {
      // Clear watchlist if the user logs out / token is null
      setWatchlist([]);
    }
  }, [accessToken]); // Dependency added so it re-fetches automatically when the token changes

  // 2. Updated toggle function to handle backend synchronization
  const toggleWatchlist = async (symbol: string) => {
    const isWatched = watchlist.includes(symbol);

    // Optimistic UI update (feels instant to the user)
    setWatchlist((prev) =>
      isWatched ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );

    // Offline mode: persist to localStorage
    if (!accessToken) {
      // Already handled by the useEffect that watches watchlist changes
      return;
    }

    // Online mode: sync with backend
    try {
      const method = isWatched ? "DELETE" : "POST";
      const response = await fetch(`${API_BASE_URL}/watchlist/${symbol}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Session expired (401), logging out...");
          onLogout();
          return;
        }
        throw new Error(`HTTP Error: ${response.status}`);
      }
    } catch (err) {
      console.error(
        `Failed to ${isWatched ? "remove from" : "add to"} watchlist:`,
        err,
      );
      // Revert state if the API call fails
      setWatchlist((prev) =>
        isWatched ? [...prev, symbol] : prev.filter((s) => s !== symbol),
      );
    }
  };

  // Live price updates via WebSocket
  const handlePriceUpdate = useCallback((prices: MarketPriceData[]) => {
    setMarkets((prev) =>
      prev.map((m) => {
        const update = prices.find((p) => p.symbol === m.symbol);
        if (!update) return m;
        const change = update.change_24h;
        return {
          ...m,
          price: `₹${update.price.toFixed(2)}`,
          change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
          high: update.high_24h > 0 ? `₹${update.high_24h.toFixed(2)}` : "-",
          low: update.low_24h > 0 ? `₹${update.low_24h.toFixed(2)}` : "-",
          isPositive: change >= 0,
        };
      }),
    );
  }, []);

  useMarketPrices(handlePriceUpdate);

  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-main text-main font-sans">
      <SideNav onLogout={logoutHandler} isMobileOpen={isMobileNavOpen} closeMobileNav={() => setIsMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <TopNav
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          toggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          onLogout={logoutHandler}
          onProfileClick={() => navigate("/app/portfolio")}
          activeSymbol={activeSymbol}
          onSymbolChange={setActiveSymbol}
          markets={markets}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          isOffline={isOffline ?? false}
          onToggleOffline={toggleOfflineMode}
        />

        <main className="flex-1 flex flex-col h-screen overflow-auto md:overflow-hidden flex gap-2 w-full">
          {/* 2. Pass everything down through the Outlet context */}
          <Outlet context={{ activeSymbol, setActiveSymbol, markets, positions, holdings, updatePrice, watchlist, toggleWatchlist, isOffline, setIsOffline: setIsOfflineState } satisfies DashboardContextType} />
        </main>
      </div>
    </div>
  );
}