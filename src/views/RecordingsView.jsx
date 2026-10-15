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
  Trash2,
  RefreshCw,
} from '../components/Icons';
import { cleanGarbageRecordings } from '../services/dataService';

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
  onRefreshRecordings,
}) {
  const [activeTab, setActiveTab] = useState('in_progress'); // 'in_progress' | 'completed'
  const [finishingId, setFinishingId] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

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

  const handleCleanGarbage = async () => {
    if (!window.confirm('Bersihkan seluruh rekaman 0 MB, durasi 00:00, atau rekaman gagal dari database?')) {
      return;
    }
    setIsCleaning(true);
    try {
      await cleanGarbageRecordings();
      if (onRefreshRecordings) {
        await onRefreshRecordings();
      }
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 pt-5 pb-32 max-w-lg mx-auto space-y-5">
      {/* Title & Quick Actions */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#2B2522] tracking-tight">
            Arsip Rekaman Cloud
          </h2>
          <p className="text-xs text-[#6D655F] mt-0.5">
            Perekaman otomatis tanpa putus & arsip video live JKT48
          </p>
        </div>

        {/* Clean Garbage Button */}
        <button
          onClick={handleCleanGarbage}
          disabled={isCleaning}
          className="min-h-[38px] flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#FAF0E6] hover:bg-[#F4E2D3] text-xs font-bold text-[#8C4A36] border border-[#ECD9C8] shrink-0 transition-all active:scale-95 shadow-xs disabled:opacity-50"
          title="Bersihkan riwayat rekaman 0 MB atau gagal"
        >
          <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Bersihkan 0 MB</span>
          <span className="sm:hidden">Bersihkan</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex rounded-2xl bg-[#F4EFE7] border border-[#E8E1D5] p-1.5">
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 min-h-[42px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'in_progress'
              ? 'bg-[#3D5E52] text-white shadow-sm'
              : 'text-[#6D655F] hover:text-[#2B2522]'
          }`}
        >
          <Disc3 className={`w-3.5 h-3.5 ${inProgressList.length > 0 ? 'animate-spin text-white' : ''}`} />
          <span>Sedang Berjalan</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'in_progress' ? 'bg-black/20 text-white' : 'bg-[#E8E1D5] text-[#2B2522]'}`}>
            {inProgressList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 min-h-[42px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-[#3D5E52] text-white shadow-sm'
              : 'text-[#6D655F] hover:text-[#2B2522]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Selesai & Arsip</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'completed' ? 'bg-black/20 text-white' : 'bg-[#E8E1D5] text-[#2B2522]'}`}>
            {completedList.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white animate-pulse border border-[#E8E1D5] shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
            />
          ))}
        </div>
      ) : activeTab === 'in_progress' ? (
        /* ================= IN PROGRESS LIST ================= */
        inProgressList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8E1D5] text-center space-y-3 my-2 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
            <div className="w-13 h-13 mx-auto rounded-2xl bg-[#F4EFE7] flex items-center justify-center text-[#8A8179]">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2B2522]">
                Tidak ada perekaman cloud yang sedang berjalan
              </p>
              <p className="text-xs text-[#6D655F] mt-1 max-w-xs mx-auto leading-relaxed">
                Perekaman otomatis dimulai saat member dengan saklar auto-record aktif memulai live, atau dapat dipicu manual di tab Sedang Live.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {inProgressList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';

              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl bg-white border border-[#BED5CC] relative overflow-hidden shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
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
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#3D5E52] shadow-xs"
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#C94A3D] rec-pulse border-2 border-white" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-[#2B2522] truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                              isShowroom
                                ? 'bg-[#ECF2F6] text-[#2F4855] border-[#CADAE2]'
                                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-[#2B2522] font-semibold truncate mt-0.5">
                          {rec.title || 'Live Recording in Progress'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-[#6D655F] mt-1.5">
                          <div className="flex items-center space-x-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#3D5E52]" />
                            <span>{formatDuration(rec.duration_seconds || 120)}</span>
                          </div>
                          <div className="flex items-center space-x-1 font-medium">
                            <HardDrive className="w-3.5 h-3.5 text-[#8A8179]" />
                            <span>{rec.file_size_mb || 45.2} MB</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Finish / Stop & Upload Action Button */}
                    <button
                      onClick={() => handleFinish(rec.id)}
                      disabled={finishingId === rec.id || rec.status === 'uploading'}
                      className={`min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 disabled:opacity-50 active:scale-95 shadow-xs ${
                        rec.status === 'uploading'
                          ? 'bg-[#EAF1EE] text-[#2D4A3F] border-[#BED5CC]'
                          : 'bg-[#FAF0E6] hover:bg-[#F4E2D3] text-[#8C4A36] border-[#ECD9C8]'
                      }`}
                      title={rec.status === 'uploading' ? 'Sedang memproses upload ke Telegram' : 'Hentikan rekaman dan langsung unggah ke Telegram'}
                    >
                      <StopCircle className={`w-4 h-4 ${rec.status === 'uploading' ? 'animate-spin text-[#2D4A3F]' : 'text-[#8C4A36]'}`} />
                      <span>
                        {finishingId === rec.id
                          ? 'Menyimpan...'
                          : rec.status === 'uploading'
                          ? 'Mengunggah...'
                          : 'Hentikan & Upload'}
                      </span>
                    </button>
                  </div>

                  {/* Status Banner */}
                  <div className="mt-3.5 pt-3 border-t border-[#F4EFE7] flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5 font-bold px-2 py-0.5 rounded-md border text-[11px] bg-[#EAF1EE] text-[#2D4A3F] border-[#BED5CC]">
                      <span className={`w-2 h-2 rounded-full ${rec.status === 'uploading' ? 'bg-[#3D5E52] animate-bounce' : 'bg-[#3D5E52] animate-ping'}`} />
                      <span>
                        {rec.status === 'uploading'
                          ? 'Menyimpan & Mengunggah ke Telegram...'
                          : 'Sedang merekam (Segmented .ts)'}
                      </span>
                    </div>
                    <span className="text-[#8A8179] text-[10px]">
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
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8E1D5] text-center space-y-3 my-2 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
            <div className="w-13 h-13 mx-auto rounded-2xl bg-[#F4EFE7] flex items-center justify-center text-[#8A8179]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2B2522]">
                Belum ada arsip rekaman selesai
              </p>
              <p className="text-xs text-[#6D655F] mt-1 max-w-xs mx-auto leading-relaxed">
                Rekaman yang telah selesai akan otomatis muncul di sini lengkap dengan ukuran berkas dan tautan unduh/tonton ke Telegram.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {completedList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';
              const isFailed = rec.status === 'failed';
              const isValidVideoUrl = Boolean(
                rec.video_url &&
                typeof rec.video_url === 'string' &&
                rec.video_url.startsWith('http') &&
                !rec.video_url.includes('BigBuckBunny')
              );
              const hasRealSize = Number(rec.file_size_mb || 0) > 0;
              const canOpen = isValidVideoUrl && hasRealSize;

              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl bg-white border border-[#E8E1D5] hover:border-[#D5C9BC] transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3.5 overflow-hidden">
                      <img
                        src={
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                        }
                        alt={member.name || 'Member'}
                        className="w-12 h-12 rounded-full object-cover border border-[#E8E1D5] shrink-0 shadow-xs"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-[#2B2522] truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                              isShowroom
                                ? 'bg-[#ECF2F6] text-[#2F4855] border-[#CADAE2]'
                                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-[#2B2522] font-semibold truncate mt-0.5">
                          {rec.title || 'Rekaman Live'}
                        </p>

                        <div className="flex items-center space-x-3 text-[11px] text-[#6D655F] mt-1.5 flex-wrap gap-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-[#8A8179]" />
                            <span>{formatDuration(rec.duration_seconds)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="w-3.5 h-3.5 text-[#8A8179]" />
                            <span>{rec.file_size_mb || 0} MB</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-[#8A8179]" />
                            <span>{formatDate(rec.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Open Video URL Action */}
                    {canOpen ? (
                      <a
                        href={rec.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-xs font-bold text-white transition-all shrink-0 shadow-md shadow-[#3D5E52]/20 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Buka</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : isFailed || !hasRealSize ? (
                      <span className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-xs text-[#8C4A36] font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#8C4A36]" />
                        <span>Gagal (0 MB)</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-[#EAF1EE] border border-[#BED5CC] text-xs text-[#2D4A3F] font-bold">
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
