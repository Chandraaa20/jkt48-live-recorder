import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Database,
  Video,
  Bell,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  X,
  Clock,
  HardDrive,
  Play,
  ExternalLink,
  Calendar,
  Sparkles,
} from '../components/Icons';

function formatDuration(sec) {
  if (!sec || sec < 0) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) return `${hrs}j ${mins}m ${secs}d`;
  return `${mins}m ${secs}d`;
}

export default function MemberView({
  members = [],
  recordings = [],
  loading = false,
  onToggleAutoRecord,
  onToggleNotify,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteMember,
  onSeedData,
  isSeeding = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'auto_record' | 'notify'
  const [genFilter, setGenFilter] = useState('all');
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  // Filter members based on search and toggle filters
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        member.name?.toLowerCase().includes(q) ||
        member.nickname?.toLowerCase().includes(q) ||
        member.platforms?.some(
          (p) =>
            p.external_id?.toLowerCase().includes(q) ||
            p.platform?.toLowerCase().includes(q)
        );

      if (!matchSearch) return false;

      // 2. Tab Filter
      if (activeFilter === 'auto_record' && !member.is_auto_record) return false;
      if (activeFilter === 'notify' && !member.is_notify) return false;

      // 3. Generation Filter
      if (genFilter !== 'all' && member.generation !== parseInt(genFilter, 10)) {
        return false;
      }

      return true;
    });
  }, [members, searchQuery, activeFilter, genFilter]);

  const handleSeed = async () => {
    try {
      const res = await onSeedData();
      setFeedbackMsg({
        type: 'success',
        text: res?.message || 'Data awal JKT48 berhasil diisi!',
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: `Gagal seed data: ${err.message}`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const generations = useMemo(() => {
    const gens = new Set(members.map((m) => m.generation).filter(Boolean));
    return Array.from(gens).sort((a, b) => a - b);
  }, [members]);

  return (
    <div className="px-4 sm:px-6 pt-5 pb-32 max-w-lg mx-auto space-y-5">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#2B2522] tracking-tight">
            Daftar Member JKT48
          </h2>
          <p className="text-xs text-[#6D655F] mt-0.5">
            Atur target auto-record cloud & platform akun member
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Seed button */}
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F2] border border-[#E8E1D5] text-xs font-semibold text-[#3D5E52] transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)] disabled:opacity-50 active:scale-95"
            title="Isi data member default JKT48 (Freya, Christy, Marsha, Feni, dll)"
          >
            <Database className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Mengisi...' : 'Seed JKT48'}</span>
          </button>

          {/* Add member button */}
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2.5 animate-in fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F]'
              : 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36]'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-[#3D5E52]" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-[#8C4A36]" />
          )}
          <span className="font-semibold">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#8A8179] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama, panggilan, atau username IDN..."
          className="w-full min-h-[44px] pl-10 pr-12 py-2.5 rounded-2xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:ring-2 focus:ring-[#3D5E52]/10 transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#6D655F] hover:text-[#2B2522] px-2 py-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Row 1: Segmented Status Filter Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F4EFE7]/80 border border-[#E8E1D5]">
        <button
          onClick={() => setActiveFilter('all')}
          className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeFilter === 'all'
              ? 'bg-[#3D5E52] text-white shadow-xs'
              : 'text-[#6D655F] hover:text-[#2B2522]'
          }`}
        >
          <span>Semua</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeFilter === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-white text-[#6D655F] border border-[#E8E1D5]'
            }`}
          >
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('auto_record')}
          className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeFilter === 'auto_record'
              ? 'bg-[#3D5E52] text-white shadow-xs'
              : 'text-[#6D655F] hover:text-[#2B2522]'
          }`}
        >
          <Video className="w-3.5 h-3.5 shrink-0" />
          <span>Auto-Rec</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeFilter === 'auto_record'
                ? 'bg-white/20 text-white'
                : 'bg-white text-[#6D655F] border border-[#E8E1D5]'
            }`}
          >
            {members.filter((m) => m.is_auto_record).length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('notify')}
          className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeFilter === 'notify'
              ? 'bg-[#3D5E52] text-white shadow-xs'
              : 'text-[#6D655F] hover:text-[#2B2522]'
          }`}
        >
          <Bell className="w-3.5 h-3.5 shrink-0" />
          <span>Notif</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeFilter === 'notify'
                ? 'bg-white/20 text-white'
                : 'bg-white text-[#6D655F] border border-[#E8E1D5]'
            }`}
          >
            {members.filter((m) => m.is_notify).length}
          </span>
        </button>
      </div>

      {/* Row 2: Generation Quick Filter Chips (Horizontal Scrollable) */}
      {generations.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setGenFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
              genFilter === 'all'
                ? 'bg-[#2B2522] text-white shadow-xs'
                : 'bg-white text-[#6D655F] border border-[#E8E1D5] hover:bg-[#FAF8F2]'
            }`}
          >
            Semua Gen
          </button>
          {generations.map((g) => (
            <button
              key={g}
              onClick={() => setGenFilter(String(g))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                genFilter === String(g)
                  ? 'bg-[#3D5E52] text-white shadow-xs'
                  : 'bg-white text-[#6D655F] border border-[#E8E1D5] hover:bg-[#FAF8F2]'
              }`}
            >
              Gen {g}
            </button>
          ))}
        </div>
      )}

      {/* Member List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white animate-pulse border border-[#E8E1D5] shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
            />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-[#E8E1D5] text-center space-y-3 my-4 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
          <p className="text-sm font-bold text-[#2B2522]">
            Tidak ada member yang cocok dengan filter
          </p>
          <p className="text-xs text-[#6D655F] max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau klik tombol Seed JKT48 untuk mengisi data awal.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMembers.map((member) => {
            const idnAccount = member.platforms?.find((p) => p.platform === 'idn');
            const showroomAccount = member.platforms?.find((p) => p.platform === 'showroom');

            return (
              <div
                key={member.id}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8E1D5] hover:border-[#BED5CC] transition-all shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Avatar & Names (Clickable to open dossier) */}
                  <div
                    onClick={() => setSelectedMember(member)}
                    className="flex items-center space-x-3.5 overflow-hidden min-w-0 flex-1 cursor-pointer group"
                    title="Ketuk untuk melihat profil lengkap & arsip live"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                        }
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover border border-[#E8E1D5] shadow-xs group-hover:scale-105 group-hover:border-[#3D5E52] transition-all"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-[#2B2522] group-hover:text-[#3D5E52] transition-colors truncate">
                          {member.name}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#F4EFE7] text-[#6D655F] border border-[#E8E1D5] shrink-0">
                            G{member.generation}
                          </span>
                        )}
                      </div>

                      {/* Platform Badges */}
                      <div className="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
                        {idnAccount && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#FAF0E6] text-[#8C4A36] border border-[#ECD9C8] font-semibold truncate max-w-[120px]">
                            IDN: @{idnAccount.external_id}
                          </span>
                        )}
                        {showroomAccount && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ECF2F6] text-[#2F4855] border border-[#CADAE2] font-semibold truncate max-w-[110px]">
                            SR: {showroomAccount.external_id}
                          </span>
                        )}
                        {(!member.platforms || member.platforms.length === 0) && (
                          <span className="text-[10px] text-[#A1988F] font-medium">
                            Belum ada akun platform
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Toggles */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Auto-Record Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAutoRecord(member.id, member.is_auto_record);
                      }}
                      title={
                        member.is_auto_record
                          ? 'Auto-Record Aktif (Ketuk untuk mematikan)'
                          : 'Auto-Record Mati (Ketuk untuk mengaktifkan)'
                      }
                      className={`min-h-[42px] px-3 py-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        member.is_auto_record
                          ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F] shadow-xs'
                          : 'bg-[#FAF8F2] border-[#E8E1D5] text-[#A1988F] hover:text-[#2B2522] hover:bg-[#F4EFE7]'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[9px] font-extrabold mt-0.5 tracking-tight">
                        {member.is_auto_record ? 'REC ON' : 'REC OFF'}
                      </span>
                    </button>

                    {/* Notify Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleNotify(member.id, member.is_notify);
                      }}
                      title={
                        member.is_notify
                          ? 'Notifikasi Aktif (Ketuk untuk mematikan)'
                          : 'Notifikasi Mati (Ketuk untuk mengaktifkan)'
                      }
                      className={`min-h-[42px] px-3 py-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        member.is_notify
                          ? 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36] shadow-xs'
                          : 'bg-[#FAF8F2] border-[#E8E1D5] text-[#A1988F] hover:text-[#2B2522] hover:bg-[#F4EFE7]'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[9px] font-extrabold mt-0.5 tracking-tight">
                        {member.is_notify ? 'NOTIF ON' : 'NOTIF OFF'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Member Dossier & Archive Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#BED5CC] shadow-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6">
            {/* Modal Header */}
            <div className="p-5 pb-4 border-b border-[#F4EFE7] flex items-center justify-between bg-gradient-to-b from-[#FAF8F2] to-white">
              <div className="flex items-center space-x-3.5 min-w-0">
                <img
                  src={selectedMember.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                  alt={selectedMember.name}
                  className="rounded-full object-cover border-2 border-[#3D5E52] shadow-sm shrink-0"
                  style={{ width: '56px', height: '56px', minWidth: '56px', maxWidth: '56px', maxHeight: '56px' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-[#2B2522] truncate">
                      {selectedMember.name}
                    </h3>
                    {selectedMember.generation && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#3D5E52] text-white">
                        Gen {selectedMember.generation}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6D655F] font-medium mt-0.5">
                    {selectedMember.nickname ? `Panggilan: ${selectedMember.nickname}` : 'Member JKT48'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMember(null)}
                className="w-9 h-9 rounded-full bg-[#F4EFE7] hover:bg-[#E8E1D5] flex items-center justify-center text-[#6D655F] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Quick Settings Toggles */}
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  onClick={() => onToggleAutoRecord(selectedMember.id, selectedMember.is_auto_record)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center space-x-3 ${
                    selectedMember.is_auto_record
                      ? 'bg-[#EAF1EE] border-[#BED5CC]'
                      : 'bg-[#FAF8F2] border-[#E8E1D5]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedMember.is_auto_record ? 'bg-[#3D5E52] text-white' : 'bg-[#E8E1D5] text-[#8A8179]'
                  }`}>
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6D655F] block font-medium">Auto-Record</span>
                    <span className={`text-xs font-bold ${selectedMember.is_auto_record ? 'text-[#2D4A3F]' : 'text-[#8A8179]'}`}>
                      {selectedMember.is_auto_record ? '🟢 Aktif' : '⚪ Mati'}
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => onToggleNotify(selectedMember.id, selectedMember.is_notify)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center space-x-3 ${
                    selectedMember.is_notify
                      ? 'bg-[#FAF0E6] border-[#ECD9C8]'
                      : 'bg-[#FAF8F2] border-[#E8E1D5]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedMember.is_notify ? 'bg-[#8C4A36] text-white' : 'bg-[#E8E1D5] text-[#8A8179]'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6D655F] block font-medium">Notifikasi</span>
                    <span className={`text-xs font-bold ${selectedMember.is_notify ? 'text-[#8C4A36]' : 'text-[#8A8179]'}`}>
                      {selectedMember.is_notify ? '🔔 Aktif' : '🔕 Mati'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Archive Stats for this member */}
              {(() => {
                const memberRecs = recordings.filter((r) => r.member_id === selectedMember.id && r.status === 'completed');
                const totalMb = memberRecs.reduce((acc, r) => acc + Number(r.file_size_mb || 0), 0);
                const totalSec = memberRecs.reduce((acc, r) => acc + Number(r.duration_seconds || 0), 0);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-[#3D5E52]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2522]">
                          Arsip Video di Telegram ({memberRecs.length})
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-[#3D5E52] bg-[#EAF1EE] px-2 py-0.5 rounded-md">
                        {totalMb.toFixed(2)} MB • {formatDuration(totalSec)}
                      </span>
                    </div>

                    {memberRecs.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-[#FAF8F2] border border-[#E8E1D5] text-center space-y-1">
                        <p className="text-xs font-bold text-[#2B2522]">
                          Belum ada arsip rekaman untuk {selectedMember.name}
                        </p>
                        <p className="text-[11px] text-[#6D655F]">
                          Ketika live {selectedMember.name} selesai direkam, video Telegram akan otomatis terdaftar di sini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {memberRecs.map((r) => (
                          <div
                            key={r.id}
                            className="p-3.5 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] hover:border-[#3D5E52] transition-all flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#2B2522] truncate">
                                {r.title || 'Rekaman Live'}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-[#6D655F] mt-1">
                                <span className="uppercase font-bold px-1.5 py-0.5 rounded bg-white border border-[#E8E1D5]">
                                  {r.platform?.toUpperCase()}
                                </span>
                                <span>{formatDuration(r.duration_seconds)}</span>
                                <span>•</span>
                                <span>{r.file_size_mb || 0} MB</span>
                              </div>
                            </div>

                            {r.video_url && r.video_url.startsWith('http') && (
                              <a
                                href={r.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="min-h-[36px] px-3 rounded-lg bg-[#3D5E52] hover:bg-[#314D43] text-white text-[11px] font-bold flex items-center space-x-1 shrink-0 active:scale-95 shadow-xs"
                              >
                                <Play className="w-3 h-3 fill-white" />
                                <span>Buka</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#F4EFE7] bg-white flex items-center gap-2">
              <button
                onClick={() => {
                  const m = selectedMember;
                  setSelectedMember(null);
                  onOpenEditModal(m);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] border border-[#E8E1D5] text-xs font-bold text-[#2B2522] flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#3D5E52]" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`Hapus member ${selectedMember.name} dari sistem?`)) {
                    const idToDelete = selectedMember.id;
                    setSelectedMember(null);
                    onDeleteMember(idToDelete);
                  }
                }}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#FAF0E6] hover:bg-[#F5DFD6] border border-[#ECD9C8] text-[#8C4A36] text-xs font-bold flex items-center justify-center space-x-1 transition-all active:scale-95 shadow-xs"
                title="Hapus Member"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>

              <button
                onClick={() => setSelectedMember(null)}
                className="min-h-[44px] px-5 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-xs font-bold text-white transition-all active:scale-95 shadow-md shadow-[#3D5E52]/20"
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
