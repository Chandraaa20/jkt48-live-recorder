import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Disc3,
  Clock,
  Sparkles,
  ExternalLink,
  PlusCircle,
  Video,
  Trash2,
} from '../components/Icons';

// Format duration from started_at
function formatDuration(startedAt) {
  if (!startedAt) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  if (hrs > 0) {
    return `${hrs}j ${mins}m ${secs}d`;
  }
  return `${mins}m ${secs}d`;
}

export default function LiveView({
  lives = [],
  loading = false,
  onOpenPlayer,
  onTriggerRecord,
  onSimulateLive,
  onClearSimulated,
}) {
  // Live ticker updating duration every second
  const [, setTicker] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasSimulated = lives.some(
    (l) => l.is_simulated || l.id?.startsWith('live-sim-') || l.id === 'live-freya-01' || l.id === 'live-marsha-02'
  );

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-4 max-w-lg mx-auto">
        <div className="h-6 w-36 bg-dark-card animate-pulse rounded-md" />
        {[1, 2].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-dark-card animate-pulse border border-dark-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Top Banner / Headline */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Sedang Live Sekarang</span>
            {lives.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 rec-pulse" />
            )}
          </h2>
          <p className="text-xs text-dark-muted">
            Streaming langsung dari IDN Live & Showroom
          </p>
        </div>

        {/* Action Buttons: Clear Sim & Add Sim */}
        <div className="flex items-center space-x-1.5">
          {hasSimulated && onClearSimulated && (
            <button
              onClick={onClearSimulated}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-[11px] font-semibold text-rose-300 hover:text-white transition-all shadow-xs"
              title="Hapus data simulasi & kembali ke pemantauan live asli"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Hapus Simulasi</span>
            </button>
          )}

          <button
            onClick={onSimulateLive}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
            title="Simulasi live baru untuk testing player & cloud recording"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulasi Live</span>
          </button>
        </div>
      </div>

      {/* Simulated Live Alert Banner */}
      {hasSimulated && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-medium">Data simulasi aktif untuk pengetesan.</span>
          </div>
          {onClearSimulated && (
            <button
              onClick={onClearSimulated}
              className="text-[11px] font-bold text-amber-300 hover:text-white underline ml-2"
            >
              Bersihkan
            </button>
          )}
        </div>
      )}

      {/* Clean Empty State when no members are live */}
      {lives.length === 0 && (
        <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center space-y-4 my-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Radio className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Belum ada member JKT48 yang sedang live saat ini
            </h3>
            <p className="text-xs text-dark-muted max-w-xs mx-auto">
              Saat ini tidak ada siaran langsung di IDN Live maupun Showroom. Data otomatis diperbarui setiap 60 detik.
            </p>
          </div>
          <button
            onClick={onSimulateLive}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-dark-border text-xs font-semibold text-slate-200 hover:text-white active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Mulai Simulasi Live (Testing)</span>
          </button>
        </div>
      )}

      {/* Live Cards List */}
      <div className="space-y-4">
        {lives.map((live) => {
          const member = live.member || {};
          const isShowroom = live.platform?.toLowerCase() === 'showroom';
          const durationStr = formatDuration(live.started_at);

          return (
            <div
              key={live.id}
              className="group relative rounded-2xl bg-dark-card border border-dark-border overflow-hidden hover:border-slate-700 transition-all duration-200 shadow-lg shadow-black/40"
            >
              {/* Thumbnail Container (Click to Play) */}
              <div
                onClick={() => onOpenPlayer(live)}
                className="relative aspect-video w-full bg-slate-900 cursor-pointer overflow-hidden"
              >
                <img
                  src={
                    live.thumbnail_url ||
                    member.avatar_url ||
                    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=340&fit=crop'
                  }
                  alt={live.title || member.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Gradient shade */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-black/30 to-black/60" />

                {/* Top badges bar on thumbnail */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                  {/* Platform badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center space-x-1 ${
                      isShowroom
                        ? 'bg-cyan-500 text-black font-extrabold shadow-cyan-500/30'
                        : 'bg-rose-600 text-white font-extrabold shadow-rose-600/30'
                    }`}
                  >
                    <span>{live.platform?.toUpperCase() || 'IDN'}</span>
                  </span>

                  {/* Cloud Recording REC Blinking Badge */}
                  {live.is_recording ? (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/80 border border-rose-500/50 text-rose-400 text-[10px] font-bold uppercase tracking-wide shadow-md">
                      <span className="w-2 h-2 rounded-full bg-rose-500 rec-pulse" />
                      <span>[REC] Cloud Recording</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/60 text-slate-300 text-[10px] font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{durationStr}</span>
                    </div>
                  )}
                </div>

                {/* Center Big Play Button hover affordance */}
                <div className="absolute inset-0 flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all">
                  <div className="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-xl shadow-rose-950/80 backdrop-blur-xs">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                </div>

                {/* Bottom timer indicator on thumbnail */}
                {live.is_recording && (
                  <div className="absolute bottom-2 left-2.5 flex items-center space-x-1 text-slate-300 text-[11px] font-medium bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    <Clock className="w-3 h-3 text-rose-400" />
                    <span>Durasi: {durationStr}</span>
                  </div>
                )}
              </div>

              {/* Bottom Card Info & Actions */}
              <div className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img
                      src={
                        member.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={member.name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover border border-dark-border shrink-0"
                    />
                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm text-white truncate">
                          {member.name || 'JKT48 Member'}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                            Gen {member.generation}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 truncate mt-0.5 font-medium">
                        {live.title || 'Live Streaming'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-1 flex items-center gap-2 border-t border-dark-border/60">
                  {/* Watch Button */}
                  <button
                    onClick={() => onOpenPlayer(live)}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-98 text-xs font-semibold text-slate-100 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-100" />
                    <span>Nonton Stream</span>
                  </button>

                  {/* Trigger Manual Record Button */}
                  {!live.is_recording ? (
                    <button
                      onClick={() =>
                        onTriggerRecord(
                          live.id,
                          live.member_id,
                          live.title,
                          live.platform,
                          member.name,
                          live.stream_url
                        )
                      }
                      className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-98 text-xs font-bold text-white transition-all shadow-md shadow-rose-950/40"
                    >
                      <Disc3 className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>Picu Rekam Manual</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500 rec-pulse" />
                      <span>Sedang Merekam</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
