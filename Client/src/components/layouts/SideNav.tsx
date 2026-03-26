import { LineChart, BarChart2, PieChart, History, Settings, Activity, ChevronRight, LogOut } from 'lucide-react';
import { useState } from 'react';
import type { PageId } from '../../App';

interface SideNavProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  onLogout: () => void; // <-- Added Prop
}

export function SideNav({ activePage, setActivePage, onLogout }: SideNavProps) {
  const [expanded, setExpanded] = useState(false);

  const navItems: { icon: React.ReactNode; label: string; page: PageId }[] = [
    { icon: <Activity size={20} />, label: 'Trade', page: 'trade' },
    { icon: <BarChart2 size={20} />, label: 'Markets', page: 'markets' },
    { icon: <LineChart size={20} />, label: 'Analytics', page: 'analytics' },
    { icon: <PieChart size={20} />, label: 'Portfolio', page: 'portfolio' },
    { icon: <History size={20} />, label: 'History', page: 'history' },
  ];

  return (
    <aside className={`${expanded ? 'w-48' : 'w-16'} hidden md:flex flex-col items-center py-3 border-r border-main bg-panel shrink-0 z-20 transition-all duration-300 ease-in-out relative font-sans`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute -right-3 top-6 bg-main text-main rounded-full p-0.5 z-30 hover:bg-panel transition-colors border-2 border-panel"
      >
        <ChevronRight size={14} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`flex items-center mb-10 transition-all ${expanded ? 'w-full px-6' : 'justify-center w-full'}`}>
        <span className="text-main font-black text-2xl tracking-tighter font-display">N</span>
        {expanded && <span className="ml-2 text-main font-extrabold tracking-[0.2em] text-sm font-display">EXTBULL</span>}
      </div>

      <nav className={`flex flex-col gap-3 w-full ${expanded ? 'px-3' : 'px-2'}`}>
        {navItems.map((item) => (
          <button
            key={item.page}
            onClick={() => setActivePage(item.page)}
            title={expanded ? '' : item.label}
            className={`h-10 flex items-center rounded-xl transition-all duration-200 group relative
              ${expanded ? 'px-3 justify-start gap-3 w-full' : 'w-10 justify-center mx-auto'}
              ${activePage === item.page
                ? 'bg-panel border border-white/20 text-main shadow-sm'
                : 'text-muted hover:bg-panel hover:text-main border border-transparent'
              }`}
          >
            <div className={`transition-transform duration-200 ${activePage === item.page ? '' : 'group-hover:scale-110 shrink-0'}`}>
              {item.icon}
            </div>
            {expanded && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom Actions Container */}
      <div className={`mt-auto w-full flex flex-col gap-2 ${expanded ? 'px-3' : 'px-2'}`}>
        <button className={`h-10 flex items-center rounded-xl transition-all duration-300 group
              ${expanded ? 'px-3 justify-start gap-3 w-full' : 'w-10 justify-center mx-auto'}
              text-muted hover:text-main hover:bg-panel hover:rotate-6
        `}>
          <div className="shrink-0 transition-transform group-hover:rotate-45 duration-300"><Settings size={20} /></div>
          {expanded && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">Settings</span>}
        </button>
        
        {/* Logout Button */}
        <button 
          onClick={onLogout}
          title={expanded ? '' : 'Log Out'}
          className={`h-10 flex items-center rounded-xl transition-all duration-300 group
              ${expanded ? 'px-3 justify-start gap-3 w-full' : 'w-10 justify-center mx-auto'}
              text-red-500/70 hover:text-red-500 hover:bg-red-500/10
        `}>
          <div className="shrink-0 transition-transform"><LogOut size={20} /></div>
          {expanded && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">Log Out</span>}
        </button>
      </div>
    </aside>
  );
}