import React, { useState, useEffect } from 'react';
import {
  Save,
  Check,
  AlertCircle,
  Database,
  Server,
  Cpu,
  Copy,
  ExternalLink,
  Wifi,
  WifiOff,
  Code2,
  RotateCcw,
  Bell,
  Send,
} from '../components/Icons';
import {
  getAppConfig,
  saveAppConfig,
  testSupabaseConnection,
  triggerCloudflareWorker,
  triggerGitHubRecorder,
  sendTelegramNotification,
  sendDeviceNotification,
} from '../services/supabase';

// SQL Migration script representation for viewing & 1-click copying
const SQL_MIGRATION_TEXT = `-- JKT48 Live & Cloud Recorder Schema
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nickname TEXT,
    generation INT,
    avatar_url TEXT,
    is_notify BOOLEAN NOT NULL DEFAULT true,
    is_auto_record BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS member_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'idn' | 'showroom' | etc
    external_id TEXT NOT NULL,
    room_url_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(member_id, platform, external_id)
);

CREATE TABLE IF NOT EXISTS active_lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    title TEXT,
    stream_url TEXT NOT NULL,
    thumbnail_url TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_recording BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL, -- 'recording' | 'uploading' | 'completed' | 'failed'
    video_url TEXT,
    file_size_mb NUMERIC(10, 2) DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and Realtime
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to member_platforms" ON member_platforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to active_lives" ON active_lives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to recordings" ON recordings FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE active_lives;
ALTER PUBLICATION supabase_realtime ADD TABLE recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE members;`;

export default function SettingsView({
  onRefreshAll,
  onResetData,
}) {
  const [supabaseUrl, setSupabaseUrl] = useState(() => getAppConfig().supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(() => getAppConfig().supabaseKey);
  const [workerUrl, setWorkerUrl] = useState(() => getAppConfig().workerUrl);
  const [githubToken, setGithubToken] = useState(() => getAppConfig().githubToken);
  const [githubRepo, setGithubRepo] = useState(() => getAppConfig().githubRepo);
  const [telegramBotToken, setTelegramBotToken] = useState(() => getAppConfig().telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(() => getAppConfig().telegramChatId || '');
  const [enableBrowserNotification, setEnableBrowserNotification] = useState(() => getAppConfig().enableBrowserNotification ?? true);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);
  const [workerFeedback, setWorkerFeedback] = useState(null);
  const [isTestingGithub, setIsTestingGithub] = useState(false);
  const [githubFeedback, setGithubFeedback] = useState(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState(null);

  useEffect(() => {
    const config = getAppConfig();
    setSupabaseUrl(config.supabaseUrl);
    setSupabaseKey(config.supabaseKey);
    setWorkerUrl(config.workerUrl);
    setGithubToken(config.githubToken);
    setGithubRepo(config.githubRepo);
    setTelegramBotToken(config.telegramBotToken || '');
    setTelegramChatId(config.telegramChatId || '');
    setEnableBrowserNotification(config.enableBrowserNotification ?? true);
  }, []);

  const handleSaveConfig = () => {
    saveAppConfig({
      supabaseUrl,
      supabaseKey,
      workerUrl,
      githubToken,
      githubRepo,
      telegramBotToken,
      telegramChatId,
      enableBrowserNotification,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onRefreshAll();
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramFeedback(null);
    try {
      if (enableBrowserNotification) {
        await sendDeviceNotification('JKT48 Live & Cloud Recorder', {
          body: '🔔 Tes Notifikasi Berhasil Terhubung!',
        });
      }

      const res = await sendTelegramNotification({
        token: telegramBotToken,
        chatId: telegramChatId,
        text: `🔔 <b>Tes Notifikasi JKT48 Live & Cloud Recorder Berhasil!</b>\n\n` +
          `Bot Telegram Anda telah terhubung dengan sempurna ke sistem pemantau JKT48.\n` +
          `Sistem akan otomatis mengirim notifikasi instan saat member favorit mulai live di IDN Live atau Showroom. ✨`,
      });

      setTelegramFeedback(res);
    } catch (err) {
      setTelegramFeedback({ success: false, message: `Error: ${err.message}` });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTriggerWorker = async () => {
    setIsTriggeringWorker(true);
    setWorkerFeedback(null);
    try {
      const res = await triggerCloudflareWorker(workerUrl);
      setWorkerFeedback(res);
      if (res.success) {
        onRefreshAll();
      }
    } finally {
      setIsTriggeringWorker(false);
    }
  };

  const handleTestGithub = async () => {
    setIsTestingGithub(true);
    setGithubFeedback(null);
    try {
      const res = await triggerGitHubRecorder({
        recording_id: `test-${Date.now()}`,
        member_name: 'Test Member JKT48',
        platform: 'idn',
        stream_url: '',
      });
      setGithubFeedback(res);
    } finally {
      setIsTestingGithub(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_TEXT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="px-4 sm:px-6 pt-5 pb-32 max-w-lg mx-auto space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-[#2B2522] tracking-tight">
          Pengaturan Sistem
        </h2>
        <p className="text-xs text-[#6D655F] mt-0.5">
          Konfigurasi koneksi Supabase, worker perekam & bot Telegram
        </p>
      </div>

      {/* Supabase Configuration Card */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] space-y-4 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-[#EAF1EE] text-[#3D5E52] border border-[#BED5CC]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2522]">Database Supabase</h3>
              <p className="text-[11px] text-[#6D655F]">
                Penyimpanan utama real-time & sinkronisasi member
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 border ${
              testResult?.connected || (supabaseUrl && supabaseKey)
                ? 'bg-[#EAF1EE] text-[#2D4A3F] border-[#BED5CC]'
                : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
            }`}
          >
            {testResult?.connected || (supabaseUrl && supabaseKey) ? (
              <>
                <Wifi className="w-3 h-3 text-[#3D5E52]" />
                <span>Terhubung</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[#8C4A36]" />
                <span>Mode Offline</span>
              </>
            )}
          </span>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-[#2B2522] mb-1">
              Project URL Supabase
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2B2522] mb-1">
              Anon Public API Key
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={handleSaveConfig}
            className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Pengaturan</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] active:scale-95 text-xs font-bold text-[#2B2522] transition-all border border-[#E8E1D5] disabled:opacity-50"
          >
            <Wifi className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-[#3D5E52]' : 'text-[#6D655F]'}`} />
            <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {saveSuccess && (
          <div className="p-3 rounded-xl bg-[#EAF1EE] border border-[#BED5CC] text-[#2D4A3F] text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-[#3D5E52]" />
            <span className="font-semibold">Konfigurasi Supabase berhasil disimpan!</span>
          </div>
        )}

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              testResult.connected
                ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F]'
                : 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36]'
            }`}
          >
            {testResult.connected ? (
              <Check className="w-4 h-4 shrink-0 text-[#3D5E52]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8C4A36]" />
            )}
            <span className="font-semibold">{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Worker & Automation Configuration Card */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] space-y-4 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-[#ECF2F6] text-[#2F4855] border border-[#CADAE2]">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2522]">Otomasi Worker & Cloud Recorder</h3>
              <p className="text-[11px] text-[#6D655F]">
                Sambungkan Cloudflare Worker dan GitHub Actions Recorder
              </p>
            </div>
          </div>
        </div>

        {/* 1. Cloudflare Worker Section */}
        <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2B2522] flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3D5E52] animate-pulse" />
              <span>1. Cloudflare Worker URL (Proxy Aman & Pemantau)</span>
            </span>
            <span className="text-[10px] font-semibold text-[#6D655F]">Cron 1 Menit</span>
          </div>

          <input
            type="url"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="https://jkt48-live-watcher.yourname.workers.dev"
            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] transition-all"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-[#6D655F] max-w-[260px]">
              Proxy aman untuk memicu perekaman cloud tanpa membocorkan token GitHub ke klien.
            </p>
            <button
              onClick={handleTriggerWorker}
              disabled={isTriggeringWorker || !workerUrl}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F4EFE7] active:scale-95 text-xs font-bold text-[#2B2522] border border-[#E8E1D5] transition-all disabled:opacity-40 shadow-xs self-start sm:self-auto"
            >
              {isTriggeringWorker ? 'Memeriksa...' : 'Picu Cek Sekarang'}
            </button>
          </div>

          {workerFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 border ${
                workerFeedback.success
                  ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F]'
                  : 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36]'
              }`}
            >
              {workerFeedback.success ? <Check className="w-4 h-4 text-[#3D5E52]" /> : <AlertCircle className="w-4 h-4 text-[#8C4A36]" />}
              <span className="font-semibold">{workerFeedback.message}</span>
            </div>
          )}
        </div>

        {/* 2. GitHub Actions Cloud Recorder Section */}
        <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2B2522] flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3D5E52]" />
              <span>2. GitHub Actions Cloud Recorder (Runner FFmpeg)</span>
            </span>
            <span className="text-[10px] font-semibold text-[#6D655F]">Gratis 2000m/bln</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#2B2522] mb-1">
                GitHub Repository (owner/repo)
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="contoh: username/jkt48-live-recorder"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#2B2522] mb-1">
                Personal Access Token (Fallback Lokal)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-[#6D655F] max-w-[260px]">
              Merekam format Transport Stream (.ts) tahan putus & upload arsip ke Telegram Channel.
            </p>
            <button
              onClick={handleTestGithub}
              disabled={isTestingGithub || (!workerUrl && !githubToken)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F4EFE7] active:scale-95 text-xs font-bold text-[#3D5E52] border border-[#E8E1D5] transition-all disabled:opacity-40 shadow-xs self-start sm:self-auto"
            >
              {isTestingGithub ? 'Memicu...' : 'Uji Trigger Rekaman'}
            </button>
          </div>

          {githubFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 border ${
                githubFeedback.triggered
                  ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F]'
                  : 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36]'
              }`}
            >
              {githubFeedback.triggered ? <Check className="w-4 h-4 text-[#3D5E52]" /> : <AlertCircle className="w-4 h-4 text-[#8C4A36]" />}
              <span className="font-semibold">{githubFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Save Button for Automation */}
        <button
          onClick={handleSaveConfig}
          className="w-full min-h-[44px] flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] border border-[#E8E1D5] text-xs font-bold text-[#2B2522] transition-all active:scale-95"
        >
          <Save className="w-3.5 h-3.5 text-[#3D5E52]" />
          <span>Simpan Seluruh Pengaturan Cloud</span>
        </button>
      </div>

      {/* 3. Telegram & Push Notifications Configuration Card */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] space-y-4 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-[#FAF0E6] text-[#8C4A36] border border-[#ECD9C8]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2522]">Notifikasi Live & Bot Telegram</h3>
              <p className="text-[11px] text-[#6D655F]">
                Peringatan instan ke Telegram & Android saat member mulai live
              </p>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#2B2522]">
                Telegram Bot Token
              </label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#3D5E52] hover:underline flex items-center space-x-0.5 font-bold"
              >
                <span>Dapatkan dari @BotFather</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
            <input
              type="password"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder="contoh: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#2B2522]">
                Telegram Chat / Channel ID
              </label>
              <span className="text-[10px] text-[#8A8179] font-medium">
                Chat ID pribadi atau channel (-100xxxx)
              </span>
            </div>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="contoh: 123456789 atau -100123456789"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5] text-xs text-[#2B2522] placeholder-[#8A8179] focus:outline-none focus:border-[#3D5E52] focus:bg-white transition-all"
            />
          </div>

          {/* Toggle Browser / Android System Notification */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F2] border border-[#E8E1D5]">
            <div>
              <p className="text-xs font-bold text-[#2B2522]">
                Aktifkan Notifikasi Push Browser / Android
              </p>
              <p className="text-[11px] text-[#6D655F]">
                Munculkan popup banner notifikasi saat member sedang siaran
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableBrowserNotification}
                onChange={(e) => setEnableBrowserNotification(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${enableBrowserNotification ? 'bg-[#3D5E52]' : 'bg-[#E8E1D5]'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-xs absolute top-0.5 transition-all duration-200 ${enableBrowserNotification ? 'left-[22px]' : 'left-[2px]'}`} />
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons for Telegram */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={handleSaveConfig}
            className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Notifikasi</span>
          </button>

          <button
            onClick={handleTestTelegram}
            disabled={isTestingTelegram || !telegramBotToken || !telegramChatId}
            className="flex-1 min-h-[44px] flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] active:scale-95 text-xs font-bold text-[#2B2522] transition-all border border-[#E8E1D5] disabled:opacity-40"
          >
            <Send className={`w-3.5 h-3.5 ${isTestingTelegram ? 'animate-bounce text-[#3D5E52]' : 'text-[#6D655F]'}`} />
            <span>{isTestingTelegram ? 'Mengirim...' : 'Tes Kirim Notifikasi'}</span>
          </button>
        </div>

        {/* Telegram Feedback Message */}
        {telegramFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
              telegramFeedback.success
                ? 'bg-[#EAF1EE] border-[#BED5CC] text-[#2D4A3F]'
                : 'bg-[#FAF0E6] border-[#ECD9C8] text-[#8C4A36]'
            }`}
          >
            {telegramFeedback.success ? (
              <Check className="w-4 h-4 shrink-0 text-[#3D5E52]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8C4A36]" />
            )}
            <span className="font-semibold">{telegramFeedback.message}</span>
          </div>
        )}
      </div>

      {/* SQL Migration Script Viewer */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] space-y-3.5 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-[#EAF1EE] text-[#3D5E52] border border-[#BED5CC]">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2522]">Skema Database SQL</h3>
              <p className="text-[11px] text-[#6D655F]">
                Jalankan di Supabase SQL Editor untuk membuat tabel
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-[#F4EFE7] border border-[#E8E1D5] text-xs font-bold text-[#2B2522] transition-all"
            >
              {showSql ? 'Sembunyikan' : 'Lihat'}
            </button>

            <button
              onClick={handleCopySql}
              className="min-h-[38px] flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-xs font-bold text-white shadow-xs transition-all active:scale-95"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
            </button>
          </div>
        </div>

        {showSql && (
          <div className="relative rounded-2xl bg-[#2B2522] border border-[#3E3733] p-4 overflow-x-auto text-[11px] font-mono text-[#BED5CC] max-h-52 leading-relaxed shadow-inner">
            <pre>{SQL_MIGRATION_TEXT}</pre>
          </div>
        )}
      </div>

      {/* App & Maintenance Actions */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] space-y-3.5 shadow-[0_2px_12px_-3px_rgba(43,37,34,0.06)]">
        <h3 className="text-sm font-bold text-[#2B2522] flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-[#8A8179]" />
          <span>Informasi & Pemeliharaan Aplikasi</span>
        </h3>

        <div className="text-xs text-[#6D655F] space-y-1">
          <p>
            <strong className="text-[#2B2522]">Versi:</strong> 2.5.0 (Forum Topics • Reconnect Recovery • JKT48 Live)
          </p>
          <p>
            <strong className="text-[#2B2522]">Framework:</strong> React + Tailwind CSS + Lucide Icons + Hls.js
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Reset data lokal ke seed awal default?')) {
              onResetData();
            }
          }}
          className="w-full min-h-[44px] flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#FAF0E6] hover:bg-[#F3E5D6] border border-[#ECD9C8] text-xs font-bold text-[#8C4A36] transition-all active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Data Lokal ke Seed JKT48 Default</span>
        </button>
      </div>
    </div>
  );
}
