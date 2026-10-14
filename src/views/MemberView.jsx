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
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Daftar Member JKT48
          </h2>
          <p className="text-xs text-dark-muted">
            Atur target auto-record cloud & platform akun
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Seed button */}
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors shadow-sm disabled:opacity-50"
            title="Isi data member default JKT48 (Freya, Christy, Marsha, Feni, dll)"
          >
            <Database className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Mengisi...' : 'Seed JKT48'}</span>
          </button>

          {/* Add member button */}
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-rose-950/40"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama, panggilan, atau username IDN..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
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
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-dark-card border border-dark-border text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({members.length})
          </button>

          <button
            onClick={() => setActiveFilter('auto_record')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
              activeFilter === 'auto_record'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-dark-card border border-dark-border text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3 h-3" />
            <span>Auto-Rec ({members.filter((m) => m.is_auto_record).length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('notify')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
              activeFilter === 'notify'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-dark-card border border-dark-border text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3 h-3" />
            <span>Notif ({members.filter((m) => m.is_notify).length})</span>
          </button>
        </div>

        {/* Gen filter */}
        {generations.length > 0 && (
          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-xs text-slate-300 font-medium focus:outline-none focus:border-rose-500 shrink-0"
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-dark-card animate-pulse border border-dark-border"
            />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-dark-card border border-dark-border text-center space-y-3 my-4">
          <p className="text-sm font-semibold text-slate-300">
            Tidak ada member yang cocok dengan filter
          </p>
          <p className="text-xs text-dark-muted">
            Coba ganti kata kunci pencarian atau klik tombol Seed JKT48 untuk mengisi data awal.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMembers.map((member) => {
            const idnAccount = member.platforms?.find((p) => p.platform === 'idn');
            const showroomAccount = member.platforms?.find((p) => p.platform === 'showroom');

            return (
              <div
                key={member.id}
                className="p-3.5 rounded-2xl bg-dark-card border border-dark-border hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Avatar & Names */}
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                    <img
                      src={
                        member.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={member.name}
                      className="w-11 h-11 rounded-full object-cover border border-dark-border shrink-0"
                      loading="lazy"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sm text-white truncate">
                          {member.name}
                        </span>
                        {member.generation && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                            G{member.generation}
                          </span>
                        )}
                      </div>

                      {/* Platform Badges */}
                      <div className="flex items-center space-x-1.5 mt-1">
                        {idnAccount && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium truncate max-w-[110px]">
                            IDN: @{idnAccount.external_id}
                          </span>
                        )}
                        {showroomAccount && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium truncate max-w-[100px]">
                            SR: {showroomAccount.external_id}
                          </span>
                        )}
                        {(!member.platforms || member.platforms.length === 0) && (
                          <span className="text-[10px] text-slate-500">
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
                      onClick={() => onToggleAutoRecord(member.id, member.is_auto_record)}
                      title={
                        member.is_auto_record
                          ? 'Auto-Record Aktif (Klik untuk mematikan)'
                          : 'Auto-Record Mati (Klik untuk mengaktifkan)'
                      }
                      className={`flex flex-col items-center justify-center w-12 py-1.5 rounded-xl border transition-all ${
                        member.is_auto_record
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                          : 'bg-dark-bg border-dark-border text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold mt-0.5 leading-none">
                        {member.is_auto_record ? 'REC ON' : 'REC OFF'}
                      </span>
                    </button>

                    {/* Notify Toggle Button */}
                    <button
                      onClick={() => onToggleNotify(member.id, member.is_notify)}
                      title={
                        member.is_notify
                          ? 'Notifikasi Aktif (Klik untuk mematikan)'
                          : 'Notifikasi Mati (Klik untuk mengaktifkan)'
                      }
                      className={`flex flex-col items-center justify-center w-10 py-1.5 rounded-xl border transition-all ${
                        member.is_notify
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-dark-bg border-dark-border text-slate-500 hover:text-slate-400'
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-hover transition-colors"
                      title="Edit Member"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus ${member.name} dari daftar member?`)) {
                          onDeleteMember(member.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-dark-hover transition-colors"
                      title="Hapus Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
