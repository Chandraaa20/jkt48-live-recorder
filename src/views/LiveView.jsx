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
      <div className="space-y-4 px-4 sm:px-5 pt-4 pb-28 max-w-lg mx-auto">
        <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-md" />
        {[1, 2].map((i) => (
          <div key={i} className="h-60 rounded-2xl bg-white animate-pulse border border-slate-200/80 shadow-xs" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 pt-4 pb-28 max-w-lg mx-auto space-y-4">
      {/* Top Banner / Headline */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Sedang Live Sekarang</span>
            {lives.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 rec-pulse" />
            )}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Streaming langsung dari IDN Live & Showroom
          </p>
        </div>

        {/* Action Buttons: Clear Sim & Add Sim */}
        <div className="flex items-center space-x-1.5">
          {hasSimulated && onClearSimulated && (
            <button
              onClick={onClearSimulated}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold text-rose-700 transition-all shadow-xs"
              title="Hapus data simulasi & kembali ke pemantauan live asli"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Hapus Simulasi</span>
            </button>
          )}

          <button
            onClick={onSimulateLive}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors shadow-xs"
            title="Simulasi live baru untuk testing player & cloud recording"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>Simulasi Live</span>
          </button>
        </div>
      </div>

      {/* Simulated Live Alert Banner */}
      {hasSimulated && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="font-medium">Data simulasi aktif untuk pengetesan player & recorder.</span>
          </div>
          {onClearSimulated && (
            <button
              onClick={onClearSimulated}
              className="text-[11px] font-bold text-amber-900 hover:underline ml-2"
            >
              Bersihkan
            </button>
          )}
        </div>
      )}

      {/* Clean Empty State when no members are live */}
      {lives.length === 0 && (
        <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)] text-center space-y-4 my-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <Radio className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Belum ada member JKT48 yang sedang live saat ini
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Saat ini tidak ada siaran langsung di IDN Live maupun Showroom. Data otomatis diperbarui setiap 60 detik.
            </p>
          </div>
          <button
            onClick={onSimulateLive}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white active:scale-95 transition-all shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Mulai Simulasi Live (Testing)</span>
          </button>
        </div>
      )}

      {/* Live Cards List */}
      <div className="space-y-3.5">
        {lives.map((live) => {
          const member = live.member || {};
          const isShowroom = live.platform?.toLowerCase() === 'showroom';
          const durationStr = formatDuration(live.started_at);

          return (
            <div
              key={live.id}
              className="group relative rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all duration-200 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.06)] overflow-hidden"
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

                {/* Subtle dark gradient overlay on thumbnail only */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/25 to-black/40" />

                {/* Top badges bar on thumbnail */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                  {/* Platform badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-sm flex items-center space-x-1 ${
                      isShowroom
                        ? 'bg-sky-500 text-white shadow-sky-500/20'
                        : 'bg-rose-600 text-white shadow-rose-600/20'
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
                    <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{durationStr}</span>
                    </div>
                  )}
                </div>

                {/* Center Big Play Button hover affordance */}
                <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all">
                  <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-950/50">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                </div>

                {/* Bottom timer indicator on thumbnail */}
                {live.is_recording && (
                  <div className="absolute bottom-2 left-2.5 flex items-center space-x-1 text-white text-[11px] font-medium bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    <Clock className="w-3 h-3 text-rose-400" />
                    <span>Durasi: {durationStr}</span>
                  </div>
                )}
              </div>

              {/* Bottom Card Info & Actions */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                    <img
                      src={
                        member.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={member.name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {member.name || 'JKT48 Member'}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                            Gen {member.generation}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5 font-medium">
                        {live.title || 'Live Streaming'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
                  {/* Watch Button */}
                  <button
                    onClick={() => onOpenPlayer(live)}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-98 text-xs font-semibold text-slate-700 transition-all min-h-[42px]"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-700" />
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
                      className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-xs font-bold text-white transition-all shadow-xs min-h-[42px]"
                    >
                      <Disc3 className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>Picu Rekam Manual</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 min-h-[42px]">
                      <span className="w-2 h-2 rounded-full bg-amber-500 rec-pulse" />
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
