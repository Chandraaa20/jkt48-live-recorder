import React, { useState } from 'react';
import {
  Disc3,
  CheckCircle2,
  Clock,
  HardDrive,
  ExternalLink,
  Play,
  Calendar,
  AlertTriangle,
  StopCircle,
} from '../components/Icons';

function formatDuration(sec) {
  if (!sec) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs}j ${mins}m ${secs}d`;
  }
  return `${mins}m ${secs}d`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function RecordingsView({
  recordings = [],
  loading = false,
  onFinishRecording,
}) {
  const [activeTab, setActiveTab] = useState('in_progress'); // 'in_progress' | 'completed'
  const [finishingId, setFinishingId] = useState(null);

  // Split recordings into in-progress vs completed
  const inProgressList = recordings.filter(
    (r) => r.status === 'recording' || r.status === 'uploading'
  );
  const completedList = recordings.filter(
    (r) => r.status === 'completed' || r.status === 'failed'
  );

  const handleFinish = async (id) => {
    setFinishingId(id);
    try {
      await onFinishRecording(id);
    } finally {
      setFinishingId(null);
    }
  };

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Arsip Rekaman Cloud
        </h2>
        <p className="text-xs text-dark-muted">
          Perekaman otomatis & arsip video live JKT48
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-dark-card border border-dark-border p-1">
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'in_progress'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Disc3 className={`w-3.5 h-3.5 ${inProgressList.length > 0 ? 'animate-spin text-white' : ''}`} />
          <span>Sedang Berjalan</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
            {inProgressList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Selesai & Arsip</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
            {completedList.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-dark-card animate-pulse border border-dark-border" />
          ))}
        </div>
      ) : activeTab === 'in_progress' ? (
        /* ================= IN PROGRESS LIST ================= */
        inProgressList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center space-y-3 my-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Tidak ada perekaman cloud yang sedang berjalan
              </p>
              <p className="text-xs text-dark-muted mt-1 max-w-xs mx-auto">
                Perekaman otomatis akan dimulai saat member dengan saklar auto-record aktif memulai live, atau dapat dipicu manual di tab Sedang Live.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {inProgressList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';

              return (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl bg-dark-card border border-rose-500/30 relative overflow-hidden shadow-lg shadow-rose-950/20"
                >
                  {/* Subtle pulsing background glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="relative">
                        <img
                          src={
                            member.avatar_url ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                          }
                          alt={member.name || 'Member'}
                          className="w-12 h-12 rounded-full object-cover border-2 border-rose-500/50"
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-500 rec-pulse border-2 border-dark-card" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-white truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isShowroom
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                          {rec.title || 'Live Recording in Progress'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-dark-muted mt-1.5">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-rose-400" />
                            <span>{formatDuration(rec.duration_seconds || 120)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="w-3 h-3 text-slate-400" />
                            <span>{rec.file_size_mb || 45.2} MB</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Finish Action Button */}
                    <button
                      onClick={() => handleFinish(rec.id)}
                      disabled={finishingId === rec.id}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700 shrink-0 disabled:opacity-50"
                      title="Tandai selesai & simpan arsip"
                    >
                      <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>{finishingId === rec.id ? 'Menyimpan...' : 'Selesaikan'}</span>
                    </button>
                  </div>

                  {/* Status Banner */}
                  <div className="mt-3 pt-2.5 border-t border-dark-border/60 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5 text-rose-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Sedang merekam & mengunggah ke Cloud Storage</span>
                    </div>
                    <span className="text-slate-400 text-[10px]">
                      Mulai: {formatDate(rec.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ================= COMPLETED ARCHIVE LIST ================= */
        completedList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center space-y-3 my-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Belum ada arsip rekaman selesai
              </p>
              <p className="text-xs text-dark-muted mt-1 max-w-xs mx-auto">
                Rekaman yang telah selesai akan otomatis muncul di sini lengkap dengan ukuran berkas dan tautan unduh/tonton.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {completedList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';
              const isFailed = rec.status === 'failed';

              return (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-2xl bg-dark-card border border-dark-border hover:border-slate-700 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <img
                        src={
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                        }
                        alt={member.name || 'Member'}
                        className="w-11 h-11 rounded-full object-cover border border-dark-border shrink-0"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-white truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isShowroom
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                          {rec.title || 'Rekaman Live'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-dark-muted mt-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDuration(rec.duration_seconds)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="w-3 h-3 text-slate-400" />
                            <span>{rec.file_size_mb || 0} MB</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatDate(rec.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Open Video URL Action */}
                    {rec.video_url ? (
                      <a
                        href={rec.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors shrink-0 shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Buka</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : isFailed ? (
                      <span className="flex items-center space-x-1 text-xs text-rose-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Gagal</span>
                      </span>
                    ) : (
                      <span className="text-xs text-dark-muted">Tersimpan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
