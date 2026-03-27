import { useState, useEffect } from 'react';
import { Layout } from './components/layouts';
import { 
  TradePage, 
  MarketsPage, 
  PortfolioPage, 
  AnalyticsPage, 
  HistoryPage, 
  LoginPage, 
  ProfilePage 
} from './components/pages';
import { useWebSocket } from './contexts/WebSocketContext';

export type PageId = 'trade' | 'markets' | 'analytics' | 'portfolio' | 'history' | 'profile';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activePage, setActivePage] = useState<PageId>('trade');
  const [previousPage, setPreviousPage] = useState<PageId>('trade');
  const { isAuthenticated } = useWebSocket();

  const handlePageChange = (page: PageId) => {
    if (activePage !== 'profile') {
      setPreviousPage(activePage);
    }
    setActivePage(page);
  };

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
      case 'profile': return <ProfilePage />;
      default: return <TradePage darkMode={darkMode} />;
    }
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout
      darkMode={darkMode}
      toggleDarkMode={() => setDarkMode(!darkMode)}
      activePage={activePage}
      setActivePage={handlePageChange}
      previousPage={previousPage}
    >
      {renderPage()}
    </Layout>
  );
}
