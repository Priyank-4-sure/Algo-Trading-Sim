import { ReactNode } from 'react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import type { PageId } from '../../App';

interface LayoutProps {
  children: ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  onLogout: () => void; // <-- Added new prop
}

export function Layout({ 
  children, 
  darkMode, 
  toggleDarkMode, 
  activePage, 
  setActivePage,
  onLogout // <-- Destructured here
}: LayoutProps) {
  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-main text-main font-sans">
      
      {/* Passed to SideNav (Common place for a logout button at the bottom) */}
      <SideNav 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={onLogout} 
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Also passed to TopNav (Common place for a user profile dropdown) */}
        <TopNav 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode} 
          onLogout={onLogout} 
          onProfileClick={() => setActivePage('portfolio')}
        />
        
        <main className="flex-1 p-2 overflow-auto md:overflow-hidden flex gap-2 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}