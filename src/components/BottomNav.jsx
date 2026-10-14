import React from 'react';
import { Radio, Users, Disc3, Settings } from './Icons';

export const TABS = {
  LIVE: 'live',
  MEMBERS: 'members',
  RECORDINGS: 'recordings',
  SETTINGS: 'settings',
};

export default function BottomNav({ 
  currentTab, 
  onTabChange, 
  liveCount = 0, 
  activeRecCount = 0 
}) {
  const navItems = [
    {
      id: TABS.LIVE,
      label: 'Sedang Live',
      icon: Radio,
      badge: liveCount > 0 ? liveCount : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: TABS.MEMBERS,
      label: 'Member',
      icon: Users,
      badge: null,
    },
    {
      id: TABS.RECORDINGS,
      label: 'Rekaman',
      icon: Disc3,
      badge: activeRecCount > 0 ? activeRecCount : null,
      badgeColor: 'bg-rose-600 animate-pulse',
    },
    {
      id: TABS.SETTINGS,
      label: 'Pengaturan',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-bg/95 backdrop-blur-lg border-t border-dark-border pb-safe">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => {
                console.log('Switching tab to:', item.id);
                onTabChange(item.id);
              }}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 select-none cursor-pointer z-50 ${
                isActive
                  ? 'text-rose-500 font-semibold scale-100'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              {/* Active subtle pill indicator on top */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              )}

              {/* Icon with relative badge */}
              <div className="relative my-0.5">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
                      item.badgeColor || 'bg-rose-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[11px] tracking-tight leading-tight mt-0.5 ${isActive ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
