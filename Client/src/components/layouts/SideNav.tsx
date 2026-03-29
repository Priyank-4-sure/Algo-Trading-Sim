import { LineChart, BarChart2, PieChart, History, Settings, Activity, Menu, LogOut } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom'; // 1. Import NavLink

interface SideNavProps {
  onLogout: () => void;
}

export function SideNav({ onLogout }: SideNavProps) {
  const [expanded, setExpanded] = useState(false);

  // 2. Updated items to use the actual URL paths defined in App.tsx
  const navItems = [
    { icon: <Activity size={20} />, label: 'Trade', path: '/app/trade' },
    { icon: <BarChart2 size={20} />, label: 'Markets', path: '/app/markets' },
    { icon: <LineChart size={20} />, label: 'Analytics', path: '/app/analytics' },
    { icon: <PieChart size={20} />, label: 'Portfolio', path: '/app/portfolio' },
    { icon: <History size={20} />, label: 'History', path: '/app/history' },
  ];

  return (
    <aside className={`${expanded ? 'w-48' : 'w-16'} hidden md:flex flex-col items-center py-3 border-r border-main bg-panel shrink-0 z-20 transition-all duration-300 ease-in-out relative font-sans`}>
      <div className={`flex items-center mb-6 transition-all ${expanded ? 'w-full px-3' : 'justify-center w-full'}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-main transition-colors text-muted hover:text-main"
          title={expanded ? "Collapse menu" : "Expand menu"}
        >
          <Menu size={20} />
        </button>
        {expanded && <span className="ml-2 text-muted font-medium text-xs uppercase tracking-wider">Menu</span>}
      </div>

      <nav className={`flex flex-col gap-3 w-full ${expanded ? 'px-3' : 'px-2'}`}>
        {navItems.map((item) => (
          /* 3. Replaced <button> with <NavLink> */
          <NavLink
            key={item.path}
            to={item.path}
            title={expanded ? '' : item.label}
            // 4. NavLink provides an 'isActive' boolean in its className callback
            className={({ isActive }) => `
              h-10 flex items-center rounded-xl transition-all duration-200 group relative
              ${expanded ? 'px-3 justify-start gap-3 w-full' : 'w-10 justify-center mx-auto'}
              ${isActive
                ? 'bg-panel border border-white/20 text-main shadow-sm'
                : 'text-muted hover:bg-panel hover:text-main border border-transparent'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110 shrink-0'}`}>
                  {item.icon}
                </div>
                {expanded && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`mt-auto w-full flex flex-col gap-2 ${expanded ? 'px-3' : 'px-2'}`}>
        <button className={`h-10 flex items-center rounded-xl transition-all duration-300 group
              ${expanded ? 'px-3 justify-start gap-3 w-full' : 'w-10 justify-center mx-auto'}
              text-muted hover:text-main hover:bg-panel hover:rotate-6
        `}>
          <div className="shrink-0 transition-transform group-hover:rotate-45 duration-300"><Settings size={20} /></div>
          {expanded && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">Settings</span>}
        </button>
        
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