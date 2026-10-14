import { createClient } from '@supabase/supabase-js';

// Unified Storage Key
const STORAGE_UNIFIED = 'jkt48_unified_config';

// Individual storage keys for fallback/compatibility
const STORAGE_KEY_URL = 'jkt48_supabase_url';
const STORAGE_KEY_KEY = 'jkt48_supabase_anon_key';
const STORAGE_KEY_WORKER_URL = 'jkt48_worker_url';
const STORAGE_KEY_GITHUB_TOKEN = 'jkt48_github_token';
const STORAGE_KEY_GITHUB_REPO = 'jkt48_github_repo';
const STORAGE_KEY_TELEGRAM_TOKEN = 'jkt48_telegram_token';
const STORAGE_KEY_TELEGRAM_CHAT_ID = 'jkt48_telegram_chat_id';
const STORAGE_KEY_BROWSER_NOTIF = 'jkt48_browser_notif';

// Default values (Baked-in so Android APK is 100% pre-configured on first install)
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rugjqcvwlfkonziykita.supabase.co';
const DEFAULT_GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'Chandraaa20/jkt48-live-recorder';
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Z2pxY3Z3bGZrb256aXlraXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5ODQyNzUsImV4cCI6MjEwNzU2MDI3NX0.g6RFp4Ykir52EvdCpbZfZfyeoKGb5ohwLTD2YjkYNE8';
const DEFAULT_WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const DEFAULT_GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const DEFAULT_TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '8984988206:AAEpkoy-TRN6HGg0Uk_MI67Pon7gJiucEuU';
const DEFAULT_TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '-1004418157265';

/**
 * Single source of truth for all application configuration
 */
export function getAppConfig() {
  let parsed = {};
  try {
    const raw = localStorage.getItem(STORAGE_UNIFIED);
    if (raw) parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse jkt48_unified_config:', e);
  }

  const supabaseUrl = (
    parsed.supabaseUrl ??
    localStorage.getItem(STORAGE_KEY_URL) ??
    DEFAULT_SUPABASE_URL
  ).trim();

  const supabaseKey = (
    parsed.supabaseKey ??
    localStorage.getItem(STORAGE_KEY_KEY) ??
    DEFAULT_SUPABASE_KEY
  ).trim();

  const workerUrl = (
    parsed.workerUrl ??
    localStorage.getItem(STORAGE_KEY_WORKER_URL) ??
    DEFAULT_WORKER_URL
  ).trim();

  const githubToken = (
    parsed.githubToken ??
    localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN) ??
    DEFAULT_GITHUB_TOKEN
  ).trim();

  const githubRepo = (
    parsed.githubRepo ??
    localStorage.getItem(STORAGE_KEY_GITHUB_REPO) ??
    DEFAULT_GITHUB_REPO
  ).trim();

  const telegramBotToken = (
    parsed.telegramBotToken ??
    localStorage.getItem(STORAGE_KEY_TELEGRAM_TOKEN) ??
    DEFAULT_TELEGRAM_TOKEN
  ).trim();

  const telegramChatId = (
    parsed.telegramChatId ??
    localStorage.getItem(STORAGE_KEY_TELEGRAM_CHAT_ID) ??
    DEFAULT_TELEGRAM_CHAT_ID
  ).trim();

  const enableBrowserNotification = (
    parsed.enableBrowserNotification !== undefined
      ? Boolean(parsed.enableBrowserNotification)
      : localStorage.getItem(STORAGE_KEY_BROWSER_NOTIF) !== 'false'
  );

  return {
    supabaseUrl,
    supabaseKey,
    workerUrl,
    githubToken,
    githubRepo,
    telegramBotToken,
    telegramChatId,
    enableBrowserNotification,
  };
}

/**
 * Save configuration to localStorage with automatic cache invalidation
 */
export function saveAppConfig(updates = {}) {
  const current = getAppConfig();
  const merged = { ...current };

  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) {
      if (typeof v === 'boolean') {
        merged[k] = v;
      } else {
        merged[k] = String(v).trim();
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_UNIFIED, JSON.stringify(merged));
    // Also sync individual keys
    localStorage.setItem(STORAGE_KEY_URL, merged.supabaseUrl);
    localStorage.setItem(STORAGE_KEY_KEY, merged.supabaseKey);
    localStorage.setItem(STORAGE_KEY_WORKER_URL, merged.workerUrl);
    localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, merged.githubToken);
    localStorage.setItem(STORAGE_KEY_GITHUB_REPO, merged.githubRepo);
    localStorage.setItem(STORAGE_KEY_TELEGRAM_TOKEN, merged.telegramBotToken);
    localStorage.setItem(STORAGE_KEY_TELEGRAM_CHAT_ID, merged.telegramChatId);
    localStorage.setItem(STORAGE_KEY_BROWSER_NOTIF, String(merged.enableBrowserNotification));
  } catch (err) {
    console.error('Error saving app config:', err);
  }

  // Invalidate cached client
  cachedClient = null;
  return merged;
}

// Aliases for compatibility
export function getStoredSupabaseConfig() {
  const c = getAppConfig();
  return { url: c.supabaseUrl, key: c.supabaseKey };
}

export function saveSupabaseConfig(url, key) {
  return saveAppConfig({ supabaseUrl: url, supabaseKey: key });
}

export function getStoredIntegrationConfig() {
  const c = getAppConfig();
  return {
    workerUrl: c.workerUrl,
    githubToken: c.githubToken,
    githubRepo: c.githubRepo,
  };
}

export function saveIntegrationConfig(config) {
  return saveAppConfig(config);
}

let cachedClient = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const { supabaseUrl, supabaseKey } = getAppConfig();
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    cachedClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

// Test connection to Supabase
export async function testSupabaseConnection(customUrl, customKey) {
  const cfg = getAppConfig();
  const url = customUrl !== undefined ? customUrl.trim() : cfg.supabaseUrl;
  const key = customKey !== undefined ? customKey.trim() : cfg.supabaseKey;

  if (!url || !key) {
    return {
      connected: false,
      message: 'URL atau Anon Key Supabase belum diisi.',
      latency: null,
    };
  }

  const startTime = performance.now();
  try {
    const tempClient = createClient(url, key);
    const { data, error } = await tempClient
      .from('members')
      .select('count', { count: 'exact', head: true });

    const latency = Math.round(performance.now() - startTime);

    if (error) {
      return {
        connected: false,
        message: `Koneksi gagal: ${error.message}`,
        latency,
      };
    }

    return {
      connected: true,
      message: `Terhubung ke Supabase! (Respon ${latency}ms)`,
      latency,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    return {
      connected: false,
      message: `Gagal menjangkau server: ${err.message}`,
      latency,
    };
  }
}

// Trigger Cloudflare Worker manual sync
export async function triggerCloudflareWorker(customUrl) {
  const cfg = getAppConfig();
  const url = customUrl || cfg.workerUrl;
  if (!url) {
    return { success: false, message: 'URL Cloudflare Worker belum diisi di Pengaturan.' };
  }

  try {
    const res = await fetch(url.replace(/\/$/, '') + '/api/check-lives', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, message: `Worker error [${res.status}]: ${text}` };
    }

    const data = await res.json();
    return {
      success: true,
      data,
      message: `Worker berhasil dieksekusi! (${data.active_jkt48_lives || 0} live JKT48 terdeteksi)`,
    };
  } catch (err) {
    return { success: false, message: `Gagal menghubungi Worker: ${err.message}` };
  }
}

// Trigger GitHub Actions Cloud Recorder via repository_dispatch
export async function triggerGitHubRecorder({ recording_id, member_name, platform, stream_url }) {
  const { githubToken, githubRepo } = getAppConfig();

  if (!githubToken || !githubRepo) {
    return {
      triggered: false,
      message: 'GitHub Token atau Repo belum dikonfigurasi di Pengaturan (Perekaman dicatat di database lokal/Supabase).',
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'start_recording',
        client_payload: {
          recording_id,
          member_name,
          platform,
          stream_url,
        },
      }),
    });

    if (res.status === 204 || res.ok) {
      return {
        triggered: true,
        message: 'GitHub Actions Cloud Recorder berhasil dipicu di cloud!',
      };
    } else {
      const err = await res.text();
      return {
        triggered: false,
        message: `Gagal memicu GitHub Actions [${res.status}]: ${err}`,
      };
    }
  } catch (err) {
    return {
      triggered: false,
      message: `Koneksi ke GitHub API gagal: ${err.message}`,
    };
  }
}

/**
 * Send notification to Telegram Bot API
 */
export async function sendTelegramNotification({ token, chatId, text, photoUrl }) {
  const cfg = getAppConfig();
  const botToken = (token || cfg.telegramBotToken || '').trim();
  const targetChatId = (chatId || cfg.telegramChatId || '').trim();

  if (!botToken || !targetChatId) {
    return {
      success: false,
      message: 'Telegram Bot Token atau Chat ID belum diisi di Pengaturan.',
    };
  }

  // 1. If photo is provided, try sendPhoto first
  if (photoUrl && photoUrl.startsWith('http')) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return { success: true, message: 'Notifikasi foto berhasil terkirim ke Telegram!' };
      }
    } catch (e) {
      console.warn('sendPhoto failed, falling back to sendMessage:', e.message);
    }
  }

  // 2. Standard text message fallback
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      return { success: true, message: 'Pesan berhasil terkirim ke Telegram!' };
    } else {
      return {
        success: false,
        message: `Telegram Error: ${data.description || 'Gagal mengirim pesan'}`,
      };
    }
  } catch (err) {
    return { success: false, message: `Gagal menghubungi Telegram Bot API: ${err.message}` };
  }
}

/**
 * Display browser / system Web Notification
 */
export async function sendDeviceNotification(title, options = {}) {
  const cfg = getAppConfig();
  if (cfg.enableBrowserNotification === false) return false;

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Browser/device does not support Web Notifications.');
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      });
      return true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          ...options,
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('Error displaying system notification:', err);
  }
  return false;
}
