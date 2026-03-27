import { useState, useEffect } from 'react';
import { Layout } from './components/layouts';
import { TradePage } from './components/pages/TradePage';
import { MarketsPage } from './components/pages/MarketsPage';
import { PortfolioPage } from './components/pages/PortfolioPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { HistoryPage } from './components/pages/HistoryPage';

export type PageId = 'trade' | 'markets' | 'analytics' | 'portfolio' | 'history';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activePage, setActivePage] = useState<PageId>('trade');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const renderPage = () => {
    switch (activePage) {
      case 'trade': return <TradePage darkMode={darkMode} />;
      case 'markets': return <MarketsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'portfolio': return <PortfolioPage />;
      case 'history': return <HistoryPage />;
      default: return <TradePage darkMode={darkMode} />;
    }
  };

  return (
    <Layout
      darkMode={darkMode}
      toggleDarkMode={() => setDarkMode(!darkMode)}
      activePage={activePage}
      setActivePage={setActivePage}
    >
      {renderPage()}
    </Layout>
  );
}
