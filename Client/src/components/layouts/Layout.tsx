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
}

export function Layout({ children, darkMode, toggleDarkMode, activePage, setActivePage }: LayoutProps) {
  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-main text-main font-sans">
      <SideNav activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopNav darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        <main className="flex-1 p-2 overflow-auto md:overflow-hidden flex gap-2 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
