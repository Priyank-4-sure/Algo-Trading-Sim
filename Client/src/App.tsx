import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet
} from 'react-router-dom';

import { Layout } from './components/layouts';
import { TradePage } from './components/pages/TradePage';
import { MarketsPage } from './components/pages/MarketsPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { WatchlistPage } from './components/pages/WatchlistPage';
import { LandingPage } from './components/pages/LandingPage';
import { SignUpPage } from './components/pages/SignUpPage';
import { LoginPage } from './components/pages/LoginPage';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const { isAuthenticated, loading, logout } = useAuth();

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // ─── ROUTER CONFIGURATION ─────────────
  // - "/" (root): LandingPage with Sign In / Sign Up CTA - entry point for unauthenticated users
  // - "/app": Main app shell with Layout wrapper - works for both authenticated and unauthenticated (offline mode)
  // - "/app/*": All trading pages (trade, markets, portfolio, etc.) as children of Layout
  // - "/login" & "/signup": Auth pages with GuestTopNav
  const router = useMemo(() => createBrowserRouter([
    {
      path: "/",
      element: <LandingPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    },
    {
      path: "/app",
      element: (
        <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={logout} isOffline={!isAuthenticated} onToggleOffline={() => {}}>
          <Outlet />
        </Layout>
      ),
      children: [
        { index: true, element: <Navigate to="/app/trade" replace /> },
        { path: "trade", element: <TradePage darkMode={darkMode} /> },
        { path: "markets", element: <MarketsPage /> },
        { path: "watchlist", element: <WatchlistPage /> },
        { path: "analytics", element: <AnalyticsPage /> },
        { path: "portfolio", element: <PortfolioPage /> },
        { path: "history", element: <HistoryPage /> },
      ]
    },
    {
      path: "/login",
      element: <LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    },
    {
      path: "/signup",
      element: <SignUpPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    }
  ]), [darkMode, isAuthenticated, logout, toggleDarkMode]);

  // Loading state handled after the hook definition to avoid "Rules of Hooks" violations
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <RouterProvider router={router} />
    </>
  );
}