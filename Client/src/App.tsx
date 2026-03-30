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
// Removed the .tsx extension here for cleaner imports
import { LandingPage } from './components/pages/LandingPage'; 
import { LoginPage } from './components/pages/LoginPage';
import { SignUpPage } from './components/pages/SignUpPage';
import { WatchlistPage } from './components/pages/WatchlistPage';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={<LandingPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} 
        />
        <Route 
          path="/login" 
          element={<LoginPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogin={() => setIsAuthenticated(true)} />} 
        />
        <Route 
          path="/signup" 
          element={<SignUpPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} onSignUp={() => setIsAuthenticated(true)} />} 
        />

        {/* Protected Dashboard Routes */}
        <Route 
          path="/app" 
          element={
            isAuthenticated ? (
              <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={() => setIsAuthenticated(false)}>
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
          <Route path="trade" element={<TradePage darkMode={darkMode}/>}/>
          <Route path="markets" element={<MarketsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="watchlist" element={<WatchlistPage />}/>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}