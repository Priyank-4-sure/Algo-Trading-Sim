import { useState, useEffect } from 'react';
import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate, 
  Outlet 
} from 'react-router-dom';

// --- Imports stay the same ---
import { Layout } from './components/layouts';
import { TradePage } from './components/pages/TradePage';
import { MarketsPage } from './components/pages/MarketsPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { LandingPage } from './components/pages/LandingPage.tsx';
import { LoginPage } from './components/pages/LoginPage';
import { SignUpPage } from './components/pages/SignUpPage';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const { isAuthenticated, loading, logout } = useAuth();

  const toggleDarkMode = () => setDarkMode(!darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // ─── REACT ROUTER CONFIGURATION ────────────────────────────────
  const router = createBrowserRouter([
    {
      path: "/",
      element: <LandingPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    },
    {
      path: "/login",
      element: !isAuthenticated ? (
        <LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      ) : (
        <Navigate to="/app/trade" replace />
      )
    },
    {
      path: "/signup",
      element: !isAuthenticated ? (
        <SignUpPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      ) : (
        <Navigate to="/app/trade" replace />
      )
    },
    {
      // The Dashboard "Shell"
      path: "/app",
      element: isAuthenticated ? (
        <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={logout}>
          {/* The Outlet renders whatever child route is active */}
          <Outlet /> 
        </Layout>
      ) : (
        <Navigate to="/login" replace />
      ),
      children: [
        { index: true, element: <Navigate to="trade" replace /> },
        { path: "trade", element: <TradePage darkMode={darkMode} /> },
        { path: "markets", element: <MarketsPage /> },
        { path: "analytics", element: <AnalyticsPage /> },
        { path: "portfolio", element: <PortfolioPage /> },
        { path: "history", element: <HistoryPage /> },
      ]
    }
  ]);

  return <RouterProvider router={router} />;
}