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

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // ─── REACT ROUTER CONFIGURATION ────────────────────────────────
  const router = createBrowserRouter([
    {
      path: "/",
      element: <LandingPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    },
    {
      path: "/login",
      element: <LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogin={() => setIsAuthenticated(true)} />
    },
    {
      path: "/signup",
      element: <SignUpPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} onSignUp={() => setIsAuthenticated(true)} />
    },
    {
      // The Dashboard "Shell"
      path: "/app",
      element: isAuthenticated ? (
        <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={() => setIsAuthenticated(false)}>
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