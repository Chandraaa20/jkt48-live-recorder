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
  HelpCircle,
  RotateCcw,
} from '../components/Icons';
import {
  getAppConfig,
  saveAppConfig,
  testSupabaseConnection,
  triggerCloudflareWorker,
  triggerGitHubRecorder,
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

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);
  const [workerFeedback, setWorkerFeedback] = useState(null);
  const [isTestingGithub, setIsTestingGithub] = useState(false);
  const [githubFeedback, setGithubFeedback] = useState(null);

  useEffect(() => {
    const config = getAppConfig();
    setSupabaseUrl(config.supabaseUrl);
    setSupabaseKey(config.supabaseKey);
    setWorkerUrl(config.workerUrl);
    setGithubToken(config.githubToken);
    setGithubRepo(config.githubRepo);
  }, []);

  const handleSaveConfig = () => {
    saveAppConfig({
      supabaseUrl,
      supabaseKey,
      workerUrl,
      githubToken,
      githubRepo,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onRefreshAll();
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
        stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
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
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Pengaturan Sistem
        </h2>
        <p className="text-xs text-dark-muted">
          Konfigurasi koneksi Supabase & status worker perekam
        </p>
      </div>

      {/* Supabase Configuration Card */}
      <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Database Supabase</h3>
              <p className="text-[11px] text-dark-muted">
                Penyimpanan utama real-time & sinkronisasi member
              </p>
            </div>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
              testResult?.connected || (supabaseUrl && supabaseKey)
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            {testResult?.connected || (supabaseUrl && supabaseKey) ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>Siap Digunakan</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Mode Offline</span>
              </>
            )}
          </span>
        </div>

        {/* Form Inputs */}
        <div className="space-y-2.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Project URL Supabase
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Anon Public API Key
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSaveConfig}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-rose-950/40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Pengaturan</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-slate-200 transition-all border border-slate-700 disabled:opacity-50"
          >
            <Wifi className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-rose-400' : ''}`} />
            <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {saveSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Konfigurasi Supabase berhasil disimpan!</span>
          </div>
        )}

        {testResult && (
          <div
            className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 ${
              testResult.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {testResult.connected ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Worker & Automation Configuration Card */}
      <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Otomasi Worker & Cloud Recorder</h3>
              <p className="text-[11px] text-dark-muted">
                Sambungkan Cloudflare Worker dan GitHub Actions Recorder
              </p>
            </div>
          </div>
        </div>

        {/* 1. Cloudflare Worker Section */}
        <div className="p-3.5 rounded-xl bg-dark-bg border border-dark-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>1. Cloudflare Worker URL (Pemantau Live)</span>
            </span>
            <span className="text-[10px] text-dark-muted">Cron 1 Menit</span>
          </div>

          <input
            type="url"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="https://jkt48-live-watcher.yourname.workers.dev"
            className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-dark-muted max-w-[220px]">
              Otomatis mendeteksi IDN Live & Showroom JKT48 lalu sinkron ke Supabase
            </p>
            <button
              onClick={handleTriggerWorker}
              disabled={isTriggeringWorker || !workerUrl}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-cyan-400 border border-slate-700 transition-all disabled:opacity-40"
            >
              {isTriggeringWorker ? 'Memeriksa...' : 'Picu Cek Sekarang'}
            </button>
          </div>

          {workerFeedback && (
            <div
              className={`p-2 rounded-lg text-xs flex items-center space-x-2 border ${
                workerFeedback.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {workerFeedback.success ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{workerFeedback.message}</span>
            </div>
          )}
        </div>

        {/* 2. GitHub Actions Cloud Recorder Section */}
        <div className="p-3.5 rounded-xl bg-dark-bg border border-dark-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>2. GitHub Actions Cloud Recorder (Runner FFmpeg)</span>
            </span>
            <span className="text-[10px] text-dark-muted">Gratis 2000m/bln</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                GitHub Repository (owner/repo)
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="contoh: username/jkt48-live-recorder"
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-dark-muted max-w-[220px]">
              Merekam HLS (.m3u8) tahan putus & upload arsip ke Telegram Channel
            </p>
            <button
              onClick={handleTestGithub}
              disabled={isTestingGithub || !githubToken || !githubRepo}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-rose-400 border border-slate-700 transition-all disabled:opacity-40"
            >
              {isTestingGithub ? 'Memicu...' : 'Uji Trigger GitHub'}
            </button>
          </div>

          {githubFeedback && (
            <div
              className={`p-2 rounded-lg text-xs flex items-center space-x-2 border ${
                githubFeedback.triggered
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {githubFeedback.triggered ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{githubFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Save Button for Automation */}
        <button
          onClick={handleSaveConfig}
          className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-dark-bg hover:bg-dark-hover border border-dark-border text-xs font-bold text-slate-200 transition-all"
        >
          <Save className="w-3.5 h-3.5 text-rose-400" />
          <span>Simpan Seluruh Pengaturan Cloud</span>
        </button>
      </div>

      {/* SQL Migration Script Viewer */}
      <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Skema Database SQL</h3>
              <p className="text-[11px] text-dark-muted">
                Jalankan di Supabase SQL Editor untuk membuat tabel
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="px-2.5 py-1 rounded-lg bg-dark-bg hover:bg-dark-hover border border-dark-border text-[11px] font-medium text-slate-300"
            >
              {showSql ? 'Sembunyikan' : 'Lihat'}
            </button>

            <button
              onClick={handleCopySql}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white shadow-sm transition-all"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
            </button>
          </div>
        </div>

        {showSql && (
          <div className="relative rounded-xl bg-black/60 border border-dark-border p-3 overflow-x-auto text-[11px] font-mono text-slate-300 max-h-48 leading-relaxed">
            <pre>{SQL_MIGRATION_TEXT}</pre>
          </div>
        )}
      </div>

      {/* App & Maintenance Actions */}
      <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span>Informasi & Pemeliharaan Aplikasi</span>
        </h3>

        <div className="text-xs text-dark-muted space-y-1">
          <p>
            <strong className="text-slate-300">Versi:</strong> 1.0.0 (PWA & Android Capacitor Ready)
          </p>
          <p>
            <strong className="text-slate-300">Framework:</strong> React (Vite) + Tailwind CSS + Lucide Icons + Hls.js
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Reset data lokal ke seed awal default?')) {
              onResetData();
            }
          }}
          className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-dark-bg hover:bg-rose-950/30 border border-dark-border hover:border-rose-500/30 text-xs font-semibold text-rose-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Data Lokal ke Seed JKT48 Default</span>
        </button>
      </div>
    </div>
  );
}
