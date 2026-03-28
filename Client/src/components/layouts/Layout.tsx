import { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom'; // Added Outlet and useNavigate
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';

interface LayoutProps {
  children?: ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
}

export function Layout({ 
  darkMode, 
  toggleDarkMode, 
  onLogout 
}: LayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-main text-main font-sans">
      
      {/* SideNav now handles navigation via URLs internally or via navigate() */}
      <SideNav 
        onLogout={onLogout} 
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <TopNav 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode} 
          onLogout={onLogout} 
          // Instead of setActivePage, we use navigate to change the URL
          onProfileClick={() => navigate('/app/portfolio')}
        />
        
        <main className="flex-1 p-2 overflow-auto md:overflow-hidden flex gap-2 w-full max-w-[1600px] mx-auto">
          {/* CRITICAL CHANGE: 
             <Outlet /> renders the component matched by the child route 
             (e.g., TradePage, MarketsPage, etc.) 
          */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}