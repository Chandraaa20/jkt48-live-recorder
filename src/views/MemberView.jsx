import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Database,
  Video,
  Bell,
  Edit2,
  Trash2,
  Filter,
  Check,
  AlertCircle,
} from '../components/Icons';

export default function MemberView({
  members = [],
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
    <div className="px-4 sm:px-5 pt-4 pb-28 max-w-lg mx-auto space-y-4">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Daftar Member JKT48
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur target auto-record cloud & platform akun member
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Seed button */}
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-rose-600 transition-all shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)] disabled:opacity-50 active:scale-95"
            title="Isi data member default JKT48 (Freya, Christy, Marsha, Feni, dll)"
          >
            <Database className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Mengisi...' : 'Seed JKT48'}</span>
          </button>

          {/* Add member button */}
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-rose-600/20"
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
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama, panggilan, atau username IDN..."
          className="w-full min-h-[44px] pl-10 pr-12 py-2.5 rounded-2xl bg-white border border-slate-200/90 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filter Tabs & Gen Dropdown */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Semua ({members.length})
          </button>

          <button
            onClick={() => setActiveFilter('auto_record')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeFilter === 'auto_record'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Auto-Rec ({members.filter((m) => m.is_auto_record).length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('notify')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeFilter === 'notify'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notif ({members.filter((m) => m.is_notify).length})</span>
          </button>
        </div>

        {/* Gen filter */}
        {generations.length > 0 && (
          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value)}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-700 font-semibold focus:outline-none focus:border-rose-500 shrink-0 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
          >
            <option value="all">Semua Gen</option>
            {generations.map((g) => (
              <option key={g} value={g}>
                Gen {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Member List */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white animate-pulse border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
            />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200/80 text-center space-y-3 my-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-bold text-slate-800">
            Tidak ada member yang cocok dengan filter
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
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
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Avatar & Names */}
                  <div className="flex items-center space-x-3.5 overflow-hidden min-w-0">
                    <img
                      src={
                        member.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
                      loading="lazy"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {member.name}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70 shrink-0">
                            G{member.generation}
                          </span>
                        )}
                      </div>

                      {/* Platform Badges */}
                      <div className="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
                        {idnAccount && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold truncate max-w-[120px]">
                            IDN: @{idnAccount.external_id}
                          </span>
                        )}
                        {showroomAccount && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-semibold truncate max-w-[110px]">
                            SR: {showroomAccount.external_id}
                          </span>
                        )}
                        {(!member.platforms || member.platforms.length === 0) && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Belum ada akun platform
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Toggles & Edit/Delete */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Auto-Record Toggle Button (Min Touch Target 44px) */}
                    <button
                      onClick={() => onToggleAutoRecord(member.id, member.is_auto_record)}
                      title={
                        member.is_auto_record
                          ? 'Auto-Record Aktif (Klik untuk mematikan)'
                          : 'Auto-Record Mati (Klik untuk mengaktifkan)'
                      }
                      className={`min-h-[44px] min-w-[50px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        member.is_auto_record
                          ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold mt-0.5 leading-none">
                        {member.is_auto_record ? 'REC ON' : 'REC OFF'}
                      </span>
                    </button>

                    {/* Notify Toggle Button (Min Touch Target 44px) */}
                    <button
                      onClick={() => onToggleNotify(member.id, member.is_notify)}
                      title={
                        member.is_notify
                          ? 'Notifikasi Aktif (Klik untuk mematikan)'
                          : 'Notifikasi Mati (Klik untuk mengaktifkan)'
                      }
                      className={`min-h-[44px] min-w-[46px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        member.is_notify
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold mt-0.5 leading-none">
                        {member.is_notify ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => onOpenEditModal(member)}
                      className="min-h-[44px] min-w-[36px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Member"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus ${member.name} dari daftar member?`)) {
                          onDeleteMember(member.id);
                        }
                      }}
                      className="min-h-[44px] min-w-[36px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
