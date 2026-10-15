import React from 'react';
import { Radio, RefreshCw, Wifi, WifiOff } from './Icons';

export default function Header({ 
  isConnected, 
  activeLivesCount = 0, 
  onRefresh, 
  isRefreshing = false 
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F2]/90 backdrop-blur-md px-4 sm:px-6 pt-3.5 pb-2">
      <div className="flex items-center justify-between max-w-lg mx-auto bg-white/95 px-4 sm:px-5 py-3 rounded-2xl border border-[#E8E1D5] shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3D5E52] to-[#4D7566] flex items-center justify-center shadow-md shadow-[#3D5E52]/20 shrink-0">
            <Radio className="w-4 h-4 text-[#FAF8F2] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-bold text-base tracking-tight text-[#2B2522] leading-none">
                JKT48 <span className="text-[#3D5E52]">Live</span>
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FAF0E6] text-[#8C4A36] border border-[#ECD9C8]">
                REC
              </span>
            </div>
            <p className="text-[11px] text-[#6D655F] font-medium mt-0.5">
              Cloud Auto-Recorder
            </p>
          </div>
        </div>

        {/* Right side status & refresh */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Live badge count */}
          {activeLivesCount > 0 ? (
            <div className="flex items-center space-x-1.5 px-3 h-[38px] rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-[#8C4A36] text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#C94A3D] rec-pulse"></span>
              <span>{activeLivesCount} Live</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 h-[38px] rounded-xl bg-[#F4EFE7] border border-[#E8E1D5] text-[#6D655F] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B6ACA3]"></span>
              <span>0 Live</span>
            </div>
          )}

          {/* Connection status pill */}
          <div 
            title={isConnected ? "Terhubung ke Supabase" : "Mode Offline / Lokal"}
            className={`w-[38px] h-[38px] rounded-xl border text-xs flex items-center justify-center transition-colors shrink-0 ${
              isConnected 
                ? 'bg-[#EAF1EE] text-[#3D5E52] border-[#BED5CC]' 
                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
            }`}
          >
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Data"
            className="w-[38px] h-[38px] rounded-xl bg-white hover:bg-[#FAF8F2] border border-[#E8E1D5] text-[#2B2522] hover:text-[#3D5E52] active:scale-95 transition-all shadow-xs disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#3D5E52]' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
