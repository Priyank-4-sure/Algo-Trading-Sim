import { useState, useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  Outlet 
} from 'react-router-dom';

import { Layout } from './components/layouts';
import { TradePage } from './components/pages/TradePage';
import { MarketsPage } from './components/pages/MarketsPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { LandingPage } from './components/pages/LandingPage'; 
import { LoginPage } from './components/pages/LoginPage';
import { SignUpPage } from './components/pages/SignUpPage';
import { WatchlistPage } from './components/pages/WatchlistPage';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  
  // Using the real auth hook from the develop branch
  const { isAuthenticated, loading, logout } = useAuth();

  const toggleDarkMode = () => setDarkMode(!darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // The loading spinner from the develop branch
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // The stable BrowserRouter structure from your branch
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={<LandingPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} 
        />
        
        {/* Smart Auth Routes - Redirects to app if they are already logged in! */}
        <Route 
          path="/login" 
          element={!isAuthenticated ? (
            <LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          ) : (
            <Navigate to="/app/trade" replace />
          )} 
        />
        <Route 
          path="/signup" 
          element={!isAuthenticated ? (
            <SignUpPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          ) : (
            <Navigate to="/app/trade" replace />
          )} 
        />

        {/* Protected Dashboard Routes */}
        <Route 
          path="/app" 
          element={
            isAuthenticated ? (
              // Uses the real 'logout' function from useAuth
              <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={logout}>
                <Outlet />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Default redirect to /app/trade */}
          <Route index element={<Navigate to="trade" replace />} />
          
          {/* Child Routes rendered inside Layout's Outlet */}
          <Route path="trade" element={<TradePage darkMode={darkMode} />} />
          <Route path="markets" element={<MarketsPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}