import { createClient } from '@supabase/supabase-js';

// Unified Storage Key
const STORAGE_UNIFIED = 'jkt48_unified_config';

// Individual storage keys for fallback/compatibility
const STORAGE_KEY_URL = 'jkt48_supabase_url';
const STORAGE_KEY_KEY = 'jkt48_supabase_anon_key';
const STORAGE_KEY_WORKER_URL = 'jkt48_worker_url';
const STORAGE_KEY_GITHUB_TOKEN = 'jkt48_github_token';
const STORAGE_KEY_GITHUB_REPO = 'jkt48_github_repo';

// Default values
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rugjqcvwlfkonziykita.supabase.co';
const DEFAULT_GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'Chandraaa20/jkt48-live-recorder';
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const DEFAULT_WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const DEFAULT_GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';

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

  return {
    supabaseUrl,
    supabaseKey,
    workerUrl,
    githubToken,
    githubRepo,
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
      merged[k] = String(v).trim();
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
