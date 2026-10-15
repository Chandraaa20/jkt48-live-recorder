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
      badgeColor: 'bg-[#C94A3D]',
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
      badgeColor: 'bg-[#3D5E52] animate-pulse',
    },
    {
      id: TABS.SETTINGS,
      label: 'Pengaturan',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#E8E1D5] shadow-[0_-4px_20px_rgba(43,37,34,0.05)] pb-safe">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => {
                onTabChange(item.id);
              }}
              className={`flex flex-col items-center justify-between flex-1 h-full pt-1 pb-1.5 transition-all duration-150 select-none cursor-pointer min-h-[48px] ${
                isActive
                  ? 'text-[#3D5E52] font-semibold'
                  : 'text-[#8A8179] hover:text-[#2B2522] active:scale-95'
              }`}
            >
              {/* Active centered pill indicator on top (in normal flex flow) */}
              <span
                className={`w-8 h-1 rounded-full transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-[#3D5E52] shadow-xs shadow-[#3D5E52]/40 opacity-100'
                    : 'bg-transparent opacity-0'
                }`}
              />

              {/* Icon with relative badge & soft active pill container */}
              <div className={`relative px-3.5 py-1 rounded-xl transition-all duration-150 flex items-center justify-center ${isActive ? 'bg-[#3D5E52]/12' : ''}`}>
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-105 text-[#3D5E52]' : 'text-[#8A8179]'}`} />
                {item.badge && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${
                      item.badgeColor || 'bg-[#3D5E52]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[11px] tracking-tight leading-none text-center ${isActive ? 'text-[#3D5E52] font-bold' : 'text-[#6D655F] font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
