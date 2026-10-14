import React from 'react';
import { Radio, RefreshCw, Wifi, WifiOff } from './Icons';

export default function Header({ 
  isConnected, 
  activeLivesCount = 0, 
  onRefresh, 
  isRefreshing = false 
}) {
  return (
    <header className="sticky top-0 z-30 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border px-4 py-3 pt-safe">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-bold text-base tracking-tight text-white leading-none">
                JKT48 <span className="text-rose-500">Live</span>
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                REC
              </span>
            </div>
            <p className="text-[11px] text-dark-muted font-medium mt-0.5">
              Cloud Auto-Recorder
            </p>
          </div>
        </div>

        {/* Right side status & refresh */}
        <div className="flex items-center space-x-2">
          {/* Live badge count */}
          {activeLivesCount > 0 ? (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 rec-pulse"></span>
              <span>{activeLivesCount} Live</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              <span>0 Live</span>
            </div>
          )}

          {/* Connection status pill */}
          <div 
            title={isConnected ? "Terhubung ke Supabase" : "Mode Offline / Lokal"}
            className={`p-1.5 rounded-lg border text-xs flex items-center transition-colors ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Data"
            className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-slate-300 hover:text-white hover:bg-dark-hover active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
