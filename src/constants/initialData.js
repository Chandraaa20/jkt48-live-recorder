import { ALL_JKT48_MEMBERS } from './allActiveMembers';

// Export complete roster of all 59 active JKT48 members as default initial members
export const INITIAL_JKT48_MEMBERS = ALL_JKT48_MEMBERS;

// REAL-TIME DEFAULT: Empty array so it only reflects genuine JKT48 lives
export const INITIAL_ACTIVE_LIVES = [];

// Sample live used ONLY if user explicitly clicks "Simulasi Live"
export const SAMPLE_SIMULATED_LIVE = {
  id: "live-sim-test",
  member_id: ALL_JKT48_MEMBERS.find(m => m.name.includes('Freya'))?.id || "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  platform: "idn",
  title: "Malam mingguan bareng Freya! ✨ [Sesi Simulasi]",
  stream_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  thumbnail_url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=340&fit=crop",
  started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  is_recording: false,
  is_simulated: true,
};

// Default empty recordings or sample archive
export const INITIAL_RECORDINGS = [];
