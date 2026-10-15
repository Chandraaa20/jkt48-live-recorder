import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Video, Bell } from './Icons';

const AVAILABLE_PLATFORMS = [
  { id: 'idn', label: 'IDN Live', placeholderId: 'Contoh: jkt48_freya' },
  { id: 'showroom', label: 'Showroom', placeholderId: 'Contoh: 318204' },
  { id: 'youtube', label: 'YouTube', placeholderId: 'Channel ID / @username' },
  { id: 'tiktok', label: 'TikTok', placeholderId: 'Username TikTok' },
  { id: 'other', label: 'Platform Lain', placeholderId: 'ID Akun' },
];

export default function MemberModal({ isOpen, onClose, onSave, memberToEdit = null }) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [generation, setGeneration] = useState(7);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isNotify, setIsNotify] = useState(true);
  const [isAutoRecord, setIsAutoRecord] = useState(false);
  const [platforms, setPlatforms] = useState([
    { platform: 'idn', external_id: '', room_url_key: '' },
    { platform: 'showroom', external_id: '', room_url_key: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (memberToEdit) {
      setName(memberToEdit.name || '');
      setNickname(memberToEdit.nickname || '');
      setGeneration(memberToEdit.generation || 7);
      setAvatarUrl(memberToEdit.avatar_url || '');
      setIsNotify(memberToEdit.is_notify ?? true);
      setIsAutoRecord(memberToEdit.is_auto_record ?? false);
      if (memberToEdit.platforms && memberToEdit.platforms.length > 0) {
        setPlatforms(
          memberToEdit.platforms.map((p) => ({
            id: p.id,
            platform: p.platform || 'idn',
            external_id: p.external_id || '',
            room_url_key: p.room_url_key || '',
          }))
        );
      } else {
        setPlatforms([
          { platform: 'idn', external_id: '', room_url_key: '' },
          { platform: 'showroom', external_id: '', room_url_key: '' },
        ]);
      }
    } else {
      // Default reset
      setName('');
      setNickname('');
      setGeneration(7);
      setAvatarUrl('');
      setIsNotify(true);
      setIsAutoRecord(false);
      setPlatforms([
        { platform: 'idn', external_id: '', room_url_key: '' },
        { platform: 'showroom', external_id: '', room_url_key: '' },
      ]);
    }
    setError('');
  }, [memberToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddPlatform = () => {
    setPlatforms((prev) => [
      ...prev,
      { platform: 'idn', external_id: '', room_url_key: '' },
    ]);
  };

  const handleRemovePlatform = (index) => {
    setPlatforms((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePlatformChange = (index, field, value) => {
    setPlatforms((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama member wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        ...(memberToEdit?.id ? { id: memberToEdit.id } : {}),
        name: name.trim(),
        nickname: nickname.trim() || name.trim().split(' ')[0],
        generation: parseInt(generation, 10) || 1,
        avatar_url: avatarUrl.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop',
        is_notify: isNotify,
        is_auto_record: isAutoRecord,
      };

      await onSave(payload, platforms);
      onClose();
    } catch (err) {
      setError(`Gagal menyimpan member: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2B2522]/60 backdrop-blur-sm overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-white border border-[#E8E1D5] rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E1D5] bg-[#FAF8F2] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-[#EAF1EE] text-[#3D5E52] border border-[#BED5CC]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2B2522]">
                {memberToEdit ? 'Edit Member JKT48' : 'Tambah Member JKT48'}
              </h2>
              <p className="text-xs text-[#6D655F] font-medium">
                Atur info profil & akun platform live
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8A8179] hover:text-[#2B2522] hover:bg-[#F4EFE7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-[#8C4A36] text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Nama Lengkap & Panggilan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2B2522] mb-1">
                Nama Lengkap <span className="text-[#C94A3D]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Freya Jayawardana"
                required
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-sm text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2B2522] mb-1">
                Nama Panggilan
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Contoh: Freya"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-sm text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Generasi & Avatar URL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2B2522] mb-1">
                Generasi (1-13)
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={generation}
                onChange={(e) => setGeneration(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-sm text-[#2B2522] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#2B2522] mb-1">
                URL Foto Avatar
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-sm text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white truncate transition-all"
              />
            </div>
          </div>

          {/* Saklar Konfigurasi Otomatis (Auto-Record & Notifikasi) */}
          <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-[#EAF1EE] text-[#3D5E52] border border-[#BED5CC]">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#2B2522] block">
                    Perekaman Otomatis Cloud (is_auto_record)
                  </span>
                  <span className="text-[11px] text-[#6D655F]">
                    Rekam live stream ke cloud otomatis saat member mulai live
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoRecord(!isAutoRecord)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAutoRecord ? 'bg-[#3D5E52]' : 'bg-[#D8CEBF]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAutoRecord ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-[#E8E1D5] pt-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-[#FAF0E6] text-[#8C4A36] border border-[#ECD9C8]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#2B2522] block">
                    Kirim Notifikasi Live (is_notify)
                  </span>
                  <span className="text-[11px] text-[#6D655F]">
                    Kirim peringatan via Telegram & Android saat member online
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotify(!isNotify)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isNotify ? 'bg-[#3D5E52]' : 'bg-[#D8CEBF]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isNotify ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Modular Member Platforms Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#2B2522] tracking-wide uppercase">
                  Akun Platform Live (Modular)
                </h3>
                <p className="text-[11px] text-[#6D655F]">
                  Dapat ditambah atau disesuaikan untuk platform apa pun
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddPlatform}
                className="min-h-[38px] flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] text-[#3D5E52] border border-[#E8E1D5] text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun</span>
              </button>
            </div>

            <div className="space-y-2">
              {platforms.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  {/* Platform selection */}
                  <select
                    value={p.platform}
                    onChange={(e) => handlePlatformChange(idx, 'platform', e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] font-semibold focus:outline-none focus:border-[#3D5E52]"
                  >
                    {AVAILABLE_PLATFORMS.map((plat) => (
                      <option key={plat.id} value={plat.id}>
                        {plat.label}
                      </option>
                    ))}
                  </select>

                  {/* External ID */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={p.external_id}
                      onChange={(e) => handlePlatformChange(idx, 'external_id', e.target.value)}
                      placeholder={
                        AVAILABLE_PLATFORMS.find((plat) => plat.id === p.platform)?.placeholderId || 'ID Akun'
                      }
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52]"
                    />
                  </div>

                  {/* Room URL Key */}
                  <div className="w-full sm:w-36">
                    <input
                      type="text"
                      value={p.room_url_key || ''}
                      onChange={(e) => handlePlatformChange(idx, 'room_url_key', e.target.value)}
                      placeholder="Room Key / Slug"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52]"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemovePlatform(idx)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-[#8A8179] hover:text-[#8C4A36] rounded-xl hover:bg-[#FAF0E6] transition-colors self-end sm:self-center"
                    title="Hapus platform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-[#E8E1D5] flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E8E1D5] text-xs font-bold text-[#2B2522] hover:bg-[#FAF8F2] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20 disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
