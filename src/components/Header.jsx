import React from 'react';
import { Radio, RefreshCw, Wifi, WifiOff } from './Icons';

export default function Header({ 
  isConnected, 
  activeLivesCount = 0, 
  onRefresh, 
  isRefreshing = false 
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] px-4 py-3 pt-safe">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center shadow-md shadow-rose-500/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-bold text-base tracking-tight text-slate-900 leading-none">
                JKT48 <span className="text-rose-600">Live</span>
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                REC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Cloud Auto-Recorder
            </p>
          </div>
        </div>

        {/* Right side status & refresh */}
        <div className="flex items-center space-x-2">
          {/* Live badge count */}
          {activeLivesCount > 0 ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-600 rec-pulse"></span>
              <span>{activeLivesCount} Live</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>0 Live</span>
            </div>
          )}

          {/* Connection status pill */}
          <div 
            title={isConnected ? "Terhubung ke Supabase" : "Mode Offline / Lokal"}
            className={`p-2 rounded-xl border text-xs flex items-center justify-center min-w-[36px] min-h-[36px] transition-colors ${
              isConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Data"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 active:scale-95 transition-all shadow-xs disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-600' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
