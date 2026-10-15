import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Disc3,
  CheckCircle2,
  Clock,
} from '../components/Icons';

function formatDuration(sec) {
  if (!sec) return '0m 0d';
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs}d`;
}

export default function LiveView({
  lives = [],
  loading = false,
  onOpenPlayer,
  onTriggerRecord,
}) {
  const [triggeringId, setTriggeringId] = useState(null);
  const [elapsedSecs, setElapsedSecs] = useState({});

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSecs((prev) => {
        const next = { ...prev };
        lives.forEach((live) => {
          if (live.started_at) {
            const diff = Math.floor(
              (Date.now() - new Date(live.started_at).getTime()) / 1000
            );
            next[live.id] = diff > 0 ? diff : 0;
          }
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lives]);

  const handleRecord = async (live) => {
    setTriggeringId(live.id);
    try {
      await onTriggerRecord(
        live.id,
        live.member_id,
        live.title,
        live.platform,
        live.member?.name,
        live.stream_url
      );
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 pt-5 pb-32 max-w-lg mx-auto space-y-5">
      {/* View Header with Title */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-[#2B2522] tracking-tight">
              Sedang Live Sekarang
            </h2>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C94A3D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C94A3D]"></span>
            </span>
          </div>
          <p className="text-xs text-[#6D655F] mt-0.5">
            Streaming langsung dari IDN Live & Showroom
          </p>
        </div>
      </div>

      {/* Lives List / Empty State */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-72 rounded-2xl bg-white animate-pulse border border-[#E8E1D5] shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
            />
          ))}
        </div>
      ) : lives.length === 0 ? (
        <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8E1D5] text-center space-y-3 my-2 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF0E6] flex items-center justify-center text-[#8C4A36]">
            <Radio className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#2B2522]">
              Belum ada member yang sedang live saat ini
            </h3>
            <p className="text-xs text-[#6D655F] max-w-sm mx-auto leading-relaxed">
              Saat ini tidak ada siaran langsung di IDN Live maupun Showroom. Data diperiksa dan disinkronkan secara real-time.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {lives.map((live) => {
            const member = live.member || {};
            const isShowroom = live.platform?.toLowerCase() === 'showroom';
            const duration = elapsedSecs[live.id] || 0;

            return (
              <div
                key={live.id}
                className="rounded-2xl bg-white border border-[#E8E1D5] overflow-hidden transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)] hover:border-[#D5C9BC]"
              >
                {/* Live Stream Media Container */}
                <div
                  className="relative aspect-video bg-black/90 cursor-pointer group flex items-center justify-center overflow-hidden"
                  onClick={() => onOpenPlayer(live)}
                >
                  <img
                    src={
                      live.thumbnail_url ||
                      member.avatar_url ||
                      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=350&fit=crop'
                    }
                    alt={live.title || 'Live Stream'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-13 h-13 rounded-full bg-[#3D5E52]/90 flex items-center justify-center text-white shadow-lg backdrop-blur-xs group-hover:scale-110 group-active:scale-95 transition-all">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Top Overlay Badges */}
                  <div className="absolute top-3 left-3 flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider text-white shadow-sm ${
                        isShowroom ? 'bg-[#2F4855]' : 'bg-[#C94A3D]'
                      }`}
                    >
                      {live.platform?.toUpperCase() || 'LIVE'}
                    </span>
                  </div>

                  {/* Top Right Live Recording Pill */}
                  {live.is_recording && (
                    <div className="absolute top-3 right-3 flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-[#FAF8F2] border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-[#C94A3D] rec-pulse" />
                      <span>[REC] CLOUD RECORDING</span>
                    </div>
                  )}

                  {/* Bottom Duration Badge */}
                  <div className="absolute bottom-3 left-3 flex items-center space-x-1 text-white text-[11px] font-medium bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Durasi: {formatDuration(duration)}</span>
                  </div>
                </div>

                {/* Member Info and Action Buttons */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center space-x-3.5 overflow-hidden">
                    <img
                      src={
                        member.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={member.name || 'Member'}
                      className="w-11 h-11 rounded-full object-cover border-2 border-[#E8E1D5] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-[#2B2522] truncate">
                          {member.name || 'JKT48 Member'}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#F4EFE7] text-[#6D655F] border border-[#E8E1D5] shrink-0">
                            Gen {member.generation}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6D655F] font-medium truncate mt-0.5">
                        {live.title || 'Sedang siaran langsung di platform'}
                      </p>
                    </div>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      onClick={() => onOpenPlayer(live)}
                      className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] text-xs font-bold text-[#2B2522] border border-[#E8E1D5] transition-all active:scale-95 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-[#2B2522]" />
                      <span>Nonton Stream</span>
                    </button>

                    {live.is_recording ? (
                      <div className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-[#8C4A36] text-xs font-bold shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-[#C94A3D] rec-pulse" />
                        <span>Sedang Merekam</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRecord(live)}
                        disabled={triggeringId === live.id}
                        className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-white text-xs font-bold transition-all shadow-md shadow-[#3D5E52]/20 active:scale-95 disabled:opacity-50"
                      >
                        <Disc3
                          className={`w-3.5 h-3.5 ${
                            triggeringId === live.id ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {triggeringId === live.id ? 'Memicu...' : 'Picu Rekam'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
