import { useState, useEffect } from 'react';

// --- V1 Layout & Main Pages ---
import { Layout } from './components/layouts';
import { TradePage } from './components/pages/TradePage';
import { MarketsPage } from './components/pages/MarketsPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { HistoryPage } from './components/pages/HistoryPage';

// --- Auth & Guest Pages ---
import { LandingPage } from './components/pages/LandingPage.tsx'; // <-- Your new file
import { LoginPage } from './components/pages/LoginPage';
import { SignUpPage } from './components/pages/SignUpPage';

// --- Types ---
export type PageId = 'trade' | 'markets' | 'analytics' | 'portfolio' | 'history';
type AppView = 'landing' | 'login' | 'signup' | 'app';

export default function App() {
  // ─── TOP-LEVEL VIEW STATE ───────────────────────────────────────
  const [appView, setAppView] = useState<AppView>('landing');
  
  // ─── THEME & INNER ROUTING STATE (V1) ───────────────────────────
  const [darkMode, setDarkMode] = useState(true);
  const [activePage, setActivePage] = useState<PageId>('trade');
  const toggleDarkMode = () => setDarkMode(!darkMode);

  // ─── EFFECTS ────────────────────────────────────────────────────
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ─── AUTH HANDLERS ──────────────────────────────────────────────
  const handleLoginSuccess = () => {
    setAppView('app');
    setActivePage('trade'); // Default page after logging in
  };

  const handleLogout = () => {
    setAppView('landing');
  };

  // ─── MAIN APP PAGE RENDERER (V1) ────────────────────────────────
  const renderAppPage = () => {
    switch (activePage) {
      case 'trade': return <TradePage darkMode={darkMode} />;
      case 'markets': return <MarketsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'portfolio': return <PortfolioPage />;
      case 'history': return <HistoryPage />;
      default: return <TradePage darkMode={darkMode} />;
    }
  };

  // ─── MASTER ROUTER ──────────────────────────────────────────────

  // 1. GUEST HOME (Landing Page)
  if (appView === 'landing') {
    return (
      <LandingPage 
        darkMode={darkMode}
        onLoginClick={() => setAppView('login')}
        toggleDarkMode={toggleDarkMode}
        onSignUpClick={() => setAppView('signup')}
      />
    );
  }

  // 2. LOGIN PAGE
  if (appView === 'login') {
    return (
      <LoginPage 
        darkMode={darkMode} 
        onLogin={handleLoginSuccess} 
        onGoToSignUp={() => setAppView('signup')}
        toggleDarkMode={toggleDarkMode}
        onGoToHome={() => setAppView('landing')} // Back button to guest home
      />
    );
  }

  // 3. SIGN UP PAGE
  if (appView === 'signup') {
    return (
      <SignUpPage 
        darkMode={darkMode} 
        onSignUp={handleLoginSuccess} 
        onGoToLogin={() => setAppView('login')}
        toggleDarkMode={toggleDarkMode}
        onGoToHome={() => setAppView('landing')} // Back button to guest home
      />
    );
  }

  // 4. MAIN AUTHENTICATED APP (V1 Structure)
  return (
    <Layout
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
      activePage={activePage}
      setActivePage={setActivePage}
      onLogout={handleLogout} 
    >
      {renderAppPage()}
    </Layout>
  );
}