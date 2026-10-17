import React, { useState, useEffect } from 'react';
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
  Copy,
  Check,
  Edit2,
  X,
  Share2,
  Sparkles,
  AlertCircle,
} from '../components/Icons';
import {
  cleanGarbageRecordings,
  deleteSingleRecording,
  updateRecordingTitle,
} from '../services/dataService';

function formatDuration(sec) {
  if (!sec || sec < 0) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs}j ${mins}m ${secs}d`;
  }
  return `${mins}m ${secs}d`;
}

function formatLiveTimer(sec) {
  if (!sec || sec < 0) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  const pMins = String(mins).padStart(2, '0');
  const pSecs = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${pMins}:${pSecs}`;
  }
  return `${pMins}:${pSecs}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
  const [now, setNow] = useState(Date.now());

  // Interactive card detail & telemetry states
  const [selectedRec, setSelectedRec] = useState(null);
  const [selectedRunning, setSelectedRunning] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Rename inline state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg, duration = 3000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), duration);
  };

  // 1. Live ticking timer every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle Android hardware back button & browser back button to close recording modals
  useEffect(() => {
    if (!selectedRec && !selectedRunning) return;
    window.history.pushState({ recModalOpen: true }, '');
    const handlePopState = () => {
      setSelectedRec(null);
      setSelectedRunning(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedRec, selectedRunning]);

  // 2. Light polling to Supabase recordings every 8 seconds when Recordings tab is open
  useEffect(() => {
    if (!onRefreshRecordings) return;
    const pollInterval = setInterval(() => {
      onRefreshRecordings();
    }, 8000);
    return () => clearInterval(pollInterval);
  }, [onRefreshRecordings]);

  // Calculate real-time duration in seconds for live recordings
  const getLiveDurationSeconds = (rec) => {
    let elapsedFromCreated = 0;
    if (rec.created_at) {
      const startMs = new Date(rec.created_at).getTime();
      if (!isNaN(startMs) && startMs > 0) {
        elapsedFromCreated = Math.max(0, Math.floor((now - startMs) / 1000));
      }
    }
    const runnerDuration = Number(rec.duration_seconds || 0);
    return Math.max(runnerDuration, elapsedFromCreated);
  };

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
      showToast('Perintah stop dikirim! Cloud runner sedang remux & upload ke Telegram...');
      if (selectedRunning?.id === id) {
        setSelectedRunning(null);
      }
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
      const res = await cleanGarbageRecordings();
      if (onRefreshRecordings) {
        await onRefreshRecordings();
      }
      showToast(`Berhasil membersihkan ${res?.count || 0} riwayat 0 MB / gagal!`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCopyLink = async (url, id) => {
    if (!url) {
      showToast('Tautan video belum tersedia');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      showToast('✓ Tautan video Telegram berhasil disalin!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast('Gagal menyalin tautan');
    }
  };

  const handleDeleteSingle = async (recId) => {
    if (!window.confirm('Hapus rekaman ini dari daftar aplikasi? (File video di Channel Telegram tetap aman tidak terhapus)')) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await deleteSingleRecording(recId);
      if (res.success) {
        setSelectedRec(null);
        showToast('Rekaman berhasil dihapus dari database!');
        if (onRefreshRecordings) {
          await onRefreshRecordings();
        }
      } else {
        showToast(`Gagal menghapus: ${res.error}`);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!selectedRec || !editedTitle.trim()) return;
    setIsSavingTitle(true);
    try {
      const res = await updateRecordingTitle(selectedRec.id, editedTitle.trim());
      if (res.success) {
        setSelectedRec((prev) => ({ ...prev, title: editedTitle.trim() }));
        setIsEditingTitle(false);
        showToast('Judul rekaman berhasil diperbarui!');
        if (onRefreshRecordings) {
          await onRefreshRecordings();
        }
      } else {
        showToast(`Gagal mengubah judul: ${res.error}`);
      }
    } finally {
      setIsSavingTitle(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 pt-5 pb-32 max-w-lg mx-auto space-y-4">
      {/* Title & Quick Actions */}
      <div className="flex items-center justify-between gap-3">
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
          className="h-9 flex items-center space-x-1.5 px-3 rounded-xl bg-[#FAF0E6] hover:bg-[#F4E2D3] text-xs font-bold text-[#8C4A36] border border-[#ECD9C8] shrink-0 transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
          title="Bersihkan riwayat rekaman 0 MB atau gagal"
        >
          <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
          <span>Bersihkan</span>
        </button>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-[#EAF1EE] border border-[#BED5CC] text-[#2D4A3F] text-xs font-bold flex items-center space-x-2.5 animate-in fade-in shadow-md">
          <Check className="w-4 h-4 text-[#3D5E52] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex rounded-2xl bg-[#F4EFE7] border border-[#E8E1D5] p-1 gap-1">
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 min-h-[40px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
          className={`flex-1 min-h-[40px] flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
        <div className="space-y-3.5">
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
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F4EFE7] flex items-center justify-center text-[#8A8179]">
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
          <div className="space-y-3.5">
            {inProgressList.map((rec) => {
              const member = rec.member || {};
              const isShowroom = rec.platform?.toLowerCase() === 'showroom';
              const liveSeconds = getLiveDurationSeconds(rec);
              const fileSizeMb = Number(rec.file_size_mb || 0);

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRunning(rec)}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-[#BED5CC] hover:border-[#3D5E52] transition-all relative overflow-hidden shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)] cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <img
                          src={
                            member.avatar_url ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                          }
                          alt={member.name || 'Member'}
                          className="rounded-full object-cover border-2 border-[#3D5E52] shadow-xs group-hover:scale-105 transition-transform shrink-0"
                          style={{ width: '48px', height: '48px', minWidth: '48px', maxWidth: '48px', maxHeight: '48px' }}
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#C94A3D] rec-pulse border-2 border-white" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-[#2B2522] group-hover:text-[#3D5E52] transition-colors truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                              isShowroom
                                ? 'bg-[#ECF2F6] text-[#2F4855] border-[#CADAE2]'
                                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-[#2B2522] font-semibold mt-0.5 leading-snug truncate">
                          {rec.title || 'Live Recording in Progress'}
                        </p>

                        <div className="flex items-center space-x-2 text-xs text-[#6D655F] mt-1.5 flex-wrap gap-y-1">
                          <div className="flex items-center space-x-1 font-semibold bg-[#F4EFE7] px-2 py-0.5 rounded-md border border-[#E8E1D5]">
                            <Clock className="w-3 h-3 text-[#3D5E52]" />
                            <span className="font-mono text-[#2B2522] text-[11px]">
                              {formatLiveTimer(liveSeconds)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 font-semibold bg-[#F4EFE7] px-2 py-0.5 rounded-md border border-[#E8E1D5]">
                            <HardDrive className="w-3 h-3 text-[#8A8179]" />
                            <span className="font-mono text-[#2B2522] text-[11px]">
                              {fileSizeMb > 0 ? `${fileSizeMb} MB` : '0 MB'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Finish / Stop & Upload Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFinish(rec.id);
                      }}
                      disabled={finishingId === rec.id || rec.status === 'uploading'}
                      className={`h-9 flex items-center space-x-1 px-3 rounded-xl text-xs font-bold transition-all border shrink-0 disabled:opacity-50 active:scale-95 shadow-xs cursor-pointer ${
                        rec.status === 'uploading'
                          ? 'bg-[#EAF1EE] text-[#2D4A3F] border-[#BED5CC]'
                          : 'bg-[#FAF0E6] hover:bg-[#F4E2D3] text-[#8C4A36] border-[#ECD9C8]'
                      }`}
                      title={rec.status === 'uploading' ? 'Sedang memproses upload ke Telegram' : 'Hentikan rekaman dan langsung unggah ke Telegram'}
                    >
                      <StopCircle className={`w-3.5 h-3.5 ${rec.status === 'uploading' ? 'animate-spin text-[#2D4A3F]' : 'text-[#8C4A36]'}`} />
                      <span>
                        {finishingId === rec.id
                          ? 'Simpan...'
                          : rec.status === 'uploading'
                          ? 'Upload...'
                          : 'Hentikan'}
                      </span>
                    </button>
                  </div>

                  {/* Status Banner */}
                  <div className="mt-3 pt-2.5 border-t border-[#F4EFE7] flex flex-wrap items-center justify-between gap-2 text-xs leading-snug">
                    <div className="flex items-center space-x-1.5 font-semibold px-2 py-0.5 rounded-lg border text-[11px] bg-[#EAF1EE] text-[#2D4A3F] border-[#BED5CC]">
                      <span>
                        {rec.status === 'uploading'
                          ? '☁️ Menggabungkan MP4 & mengunggah ke Telegram...'
                          : fileSizeMb > 0
                          ? '🔴 Merekam di Cloud • Live berjalan'
                          : '⏳ Menghubungkan ke server perekam cloud...'}
                      </span>
                    </div>
                    <span className="text-[#8A8179] text-[10px] shrink-0 font-medium">
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
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F4EFE7] flex items-center justify-center text-[#8A8179]">
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
          <div className="space-y-3.5">
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
                  onClick={() => {
                    setSelectedRec(rec);
                    setIsEditingTitle(false);
                    setEditedTitle(rec.title || '');
                  }}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E1D5] hover:border-[#BED5CC] transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)] cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <img
                        src={
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                        }
                        alt={member.name || 'Member'}
                        className="rounded-full object-cover border border-[#E8E1D5] shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                        style={{ width: '48px', height: '48px', minWidth: '48px', maxWidth: '48px', maxHeight: '48px' }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-[#2B2522] group-hover:text-[#3D5E52] transition-colors truncate">
                            {member.name || 'JKT48 Member'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                              isShowroom
                                ? 'bg-[#ECF2F6] text-[#2F4855] border-[#CADAE2]'
                                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
                            }`}
                          >
                            {rec.platform?.toUpperCase() || 'IDN'}
                          </span>
                        </div>

                        <p className="text-xs text-[#2B2522] font-semibold mt-0.5 leading-snug truncate">
                          {rec.title || 'Rekaman Live'}
                        </p>

                        <div className="flex items-center space-x-2 text-[11px] text-[#6D655F] mt-1.5 flex-wrap gap-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-[#8A8179]" />
                            <span>{formatDuration(rec.duration_seconds)}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <HardDrive className="w-3 h-3 text-[#8A8179]" />
                            <span className="font-semibold text-[#2B2522]">{rec.file_size_mb || 0} MB</span>
                          </div>
                          <span>•</span>
                          <span className="text-[#8A8179] truncate">{formatDate(rec.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Copy link & Open video */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {canOpen && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLink(rec.video_url, rec.id);
                          }}
                          className="w-9 h-9 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] border border-[#E8E1D5] flex items-center justify-center text-[#6D655F] hover:text-[#2B2522] transition-all active:scale-95 shadow-xs cursor-pointer"
                          title="Salin tautan video Telegram"
                        >
                          {copiedId === rec.id ? (
                            <Check className="w-4 h-4 text-[#3D5E52]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {canOpen ? (
                        <a
                          href={rec.video_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="h-9 flex items-center space-x-1 px-3 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20 active:scale-95"
                          title="Tonton video di Telegram"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Buka</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : isFailed || !hasRealSize ? (
                        <span className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-xs text-[#8C4A36] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#8C4A36]" />
                          <span>0 MB</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-[#EAF1EE] border border-[#BED5CC] text-xs text-[#2D4A3F] font-bold">
                          Tersimpan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ================= MODAL 1: COMPLETED RECORDING DETAIL & ACTIONS ================= */}
      {selectedRec && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#BED5CC] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#F4EFE7] flex items-center justify-between bg-gradient-to-b from-[#FAF8F2] to-white gap-3">
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                <img
                  src={selectedRec.member?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                  alt={selectedRec.member?.name || 'Member'}
                  className="rounded-full object-cover border-2 border-[#3D5E52] shadow-sm shrink-0"
                  style={{ width: '52px', height: '52px', minWidth: '52px', maxWidth: '52px', maxHeight: '52px' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h3 className="font-bold text-base text-[#2B2522] truncate">
                      {selectedRec.member?.name || 'JKT48 Member'}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#3D5E52] text-white uppercase">
                      {selectedRec.platform?.toUpperCase() || 'IDN'}
                    </span>
                  </div>
                  <span className="text-xs text-[#3D5E52] font-semibold flex items-center space-x-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Tersimpan di Cloud Telegram</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRec(null)}
                className="w-9 h-9 rounded-full bg-[#F4EFE7] hover:bg-[#E8E1D5] flex items-center justify-center text-[#6D655F] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Title section with inline edit */}
              <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E8E1D5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8179]">
                    Judul Rekaman
                  </span>
                  {!isEditingTitle && (
                    <button
                      onClick={() => {
                        setIsEditingTitle(true);
                        setEditedTitle(selectedRec.title || '');
                      }}
                      className="text-[11px] font-bold text-[#3D5E52] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Ubah Judul</span>
                    </button>
                  )}
                </div>

                {isEditingTitle ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      placeholder="Masukkan judul baru..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#3D5E52] text-xs font-semibold text-[#2B2522] focus:outline-none"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6D655F] hover:bg-[#E8E1D5] cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleSaveTitle}
                        disabled={isSavingTitle}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D5E52] text-white hover:bg-[#314D43] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSavingTitle ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-[#2B2522] leading-snug">
                    {selectedRec.title || 'Rekaman Live'}
                  </p>
                )}
              </div>

              {/* Stats 4-Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white border border-[#E8E1D5] flex items-center space-x-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE7] flex items-center justify-center text-[#3D5E52] shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6D655F] block font-medium">Durasi Live</span>
                    <span className="text-xs font-bold text-[#2B2522] font-mono">
                      {formatDuration(selectedRec.duration_seconds)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#E8E1D5] flex items-center space-x-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE7] flex items-center justify-center text-[#8C4A36] shrink-0">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6D655F] block font-medium">Ukuran Berkas</span>
                    <span className="text-xs font-bold text-[#2B2522] font-mono">
                      {selectedRec.file_size_mb || 0} MB
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#E8E1D5] flex items-center space-x-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE7] flex items-center justify-center text-[#2F4855] shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#6D655F] block font-medium">Waktu Siaran</span>
                    <span className="text-[11px] font-bold text-[#2B2522] truncate block">
                      {formatDate(selectedRec.created_at)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#E8E1D5] flex items-center space-x-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#F4EFE7] flex items-center justify-center text-[#3D5E52] shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6D655F] block font-medium">Kualitas Video</span>
                    <span className="text-xs font-bold text-[#2B2522]">
                      100% Original
                    </span>
                  </div>
                </div>
              </div>

              {/* Telegram Link Box */}
              {selectedRec.video_url && selectedRec.video_url.startsWith('http') && (
                <div className="p-3.5 rounded-2xl bg-[#EAF1EE] border border-[#BED5CC] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#2D4A3F] block">Tautan Pesan Video Telegram</span>
                    <span className="text-xs text-[#2D4A3F] font-mono truncate block mt-0.5">
                      {selectedRec.video_url}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyLink(selectedRec.video_url, selectedRec.id)}
                    className="min-h-[34px] px-3 rounded-xl bg-white border border-[#BED5CC] text-[#2D4A3F] hover:bg-[#FAF8F2] text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    {copiedId === selectedRec.id ? <Check className="w-3.5 h-3.5 text-[#3D5E52]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === selectedRec.id ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[#F4EFE7] bg-white space-y-2">
              <div className="flex items-center gap-2">
                {selectedRec.video_url && selectedRec.video_url.startsWith('http') && (
                  <a
                    href={selectedRec.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-h-[44px] rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-md shadow-[#3D5E52]/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Tonton Video di Telegram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={() => handleDeleteSingle(selectedRec.id)}
                  disabled={isDeleting}
                  className="min-h-[44px] px-4 rounded-xl bg-[#FAF0E6] hover:bg-[#F4E2D3] border border-[#ECD9C8] text-[#8C4A36] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Hapus dari daftar aplikasi"
                >
                  <Trash2 className="w-4 h-4 text-[#8C4A36]" />
                  <span>{isDeleting ? '...' : 'Hapus'}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedRec(null)}
                className="w-full min-h-[40px] rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] border border-[#E8E1D5] text-xs font-bold text-[#6D655F] transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: IN-PROGRESS CLOUD TELEMETRY ================= */}
      {selectedRunning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#BED5CC] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6">
            <div className="p-4 sm:p-5 border-b border-[#F4EFE7] flex items-center justify-between bg-gradient-to-b from-[#FAF8F2] to-white gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <img
                    src={selectedRunning.member?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt={selectedRunning.member?.name || 'Member'}
                    className="rounded-full object-cover border-2 border-[#3D5E52] shadow-sm shrink-0"
                    style={{ width: '48px', height: '48px', minWidth: '48px', maxWidth: '48px', maxHeight: '48px' }}
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#C94A3D] rec-pulse border-2 border-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base text-[#2B2522] truncate">
                    {selectedRunning.member?.name || 'Member JKT48'}
                  </h3>
                  <span className="text-xs text-[#C94A3D] font-bold flex items-center space-x-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#C94A3D] animate-ping shrink-0" />
                    <span className="truncate">Merekam di Cloud Runner GitHub</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRunning(null)}
                className="w-9 h-9 rounded-full bg-[#F4EFE7] hover:bg-[#E8E1D5] flex items-center justify-center text-[#6D655F] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E8E1D5] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8179]">
                  Judul Live
                </span>
                <p className="text-xs font-bold text-[#2B2522]">
                  {selectedRunning.title || 'Live Streaming'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#E8E1D5] shadow-xs text-center space-y-1">
                  <span className="text-[10px] text-[#6D655F] block font-medium">Durasi Berjalan</span>
                  <span className="text-lg font-bold font-mono text-[#3D5E52]">
                    {formatLiveTimer(getLiveDurationSeconds(selectedRunning))}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E1D5] shadow-xs text-center space-y-1">
                  <span className="text-[10px] text-[#6D655F] block font-medium">Ukuran Berkas</span>
                  <span className="text-lg font-bold font-mono text-[#8C4A36]">
                    {selectedRunning.file_size_mb || 0} MB
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#EAF1EE] border border-[#BED5CC] text-xs text-[#2D4A3F] space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#3D5E52]" />
                  <span>Perekaman Lossless MPEG-TS</span>
                </p>
                <p className="text-[11px] text-[#4A675B]">
                  Video diunduh langsung segmen per segmen dari CDN siaran. Ketika member selesai siaran atau Anda menekan tombol di bawah, file akan langsung digabungkan menjadi MP4 original dan diunggah otomatis ke Telegram.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-[#F4EFE7] bg-white flex items-center gap-2">
              <button
                onClick={() => handleFinish(selectedRunning.id)}
                disabled={finishingId === selectedRunning.id || selectedRunning.status === 'uploading'}
                className="flex-1 min-h-[44px] rounded-xl bg-[#FAF0E6] hover:bg-[#F4E2D3] border border-[#ECD9C8] text-[#8C4A36] text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-[#8C4A36]" />
                <span>
                  {finishingId === selectedRunning.id
                    ? 'Menyimpan...'
                    : selectedRunning.status === 'uploading'
                    ? 'Mengunggah...'
                    : 'Hentikan & Upload Sekarang'}
                </span>
              </button>

              <button
                onClick={() => setSelectedRunning(null)}
                className="min-h-[44px] px-5 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-[#3D5E52]/20 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
