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
    <div className="px-4 sm:px-5 pt-4 pb-28 max-w-lg mx-auto space-y-4">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Arsip Rekaman Cloud
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Perekaman otomatis tanpa putus & arsip video live JKT48
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex rounded-2xl bg-slate-100/90 border border-slate-200/80 p-1">
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 min-h-[42px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'in_progress'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Disc3 className={`w-3.5 h-3.5 ${inProgressList.length > 0 ? 'animate-spin text-white' : ''}`} />
          <span>Sedang Berjalan</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'in_progress' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {inProgressList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 min-h-[42px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Selesai & Arsip</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'completed' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {completedList.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white animate-pulse border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
            />
          ))}
        </div>
      ) : activeTab === 'in_progress' ? (
        /* ================= IN PROGRESS LIST ================= */
        inProgressList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 text-center space-y-3 my-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Tidak ada perekaman cloud yang sedang berjalan
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Perekaman otomatis dimulai saat member dengan saklar auto-record aktif memulai live, atau dapat dipicu manual di tab Sedang Live.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {inProgressList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';

              return (
                <div
                  key={rec.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/90 relative overflow-hidden shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3.5 overflow-hidden">
                      <div className="relative shrink-0">
                        <img
                          src={
                            member.avatar_url ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                          }
                          alt={member.name || 'Member'}
                          className="w-12 h-12 rounded-full object-cover border-2 border-rose-500 shadow-xs"
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-500 rec-pulse border-2 border-white" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                              isShowroom
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 font-semibold truncate mt-0.5">
                          {rec.title || 'Live Recording in Progress'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1.5">
                          <div className="flex items-center space-x-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-rose-500" />
                            <span>{formatDuration(rec.duration_seconds || 120)}</span>
                          </div>
                          <div className="flex items-center space-x-1 font-medium">
                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                            <span>{rec.file_size_mb || 45.2} MB</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Finish Action Button */}
                    <button
                      onClick={() => handleFinish(rec.id)}
                      disabled={finishingId === rec.id}
                      className="min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition-all border border-slate-200/90 shrink-0 disabled:opacity-50 active:scale-95 shadow-xs"
                      title="Tandai selesai & simpan arsip"
                    >
                      <StopCircle className="w-4 h-4 text-rose-600" />
                      <span>{finishingId === rec.id ? 'Menyimpan...' : 'Selesaikan'}</span>
                    </button>
                  </div>

                  {/* Status Banner */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Sedang merekam (Segmented .ts)</span>
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
          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 text-center space-y-3 my-4 shadow-[0_2px_10px_-3px_rgba(15,23_42,0.06)]">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Belum ada arsip rekaman selesai
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Rekaman yang telah selesai akan otomatis muncul di sini lengkap dengan ukuran berkas dan tautan unduh/tonton ke Telegram.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {completedList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';
              const isFailed = rec.status === 'failed';

              return (
                <div
                  key={rec.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3.5 overflow-hidden">
                      <img
                        src={
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                        }
                        alt={member.name || 'Member'}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                              isShowroom
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 font-semibold truncate mt-0.5">
                          {rec.title || 'Rekaman Live'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1.5 flex-wrap gap-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDuration(rec.duration_seconds)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                            <span>{rec.file_size_mb || 0} MB</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                        className="min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-all shrink-0 shadow-md shadow-rose-600/20 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Buka</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : isFailed ? (
                      <span className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Gagal</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-bold">
                        Tersimpan
                      </span>
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
