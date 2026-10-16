import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  X,
  Maximize2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Disc3,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from './Icons';

import { getAppConfig } from '../services/supabase';

// Resolve appropriate CORS Proxy URL (Always use absolute Cloudflare Worker URL)
function getProxyUrl(targetUrl) {
  if (!targetUrl) return '';
  const config = getAppConfig();
  const workerBase = (config.workerUrl ? config.workerUrl.replace(/\/$/, '') : '') || 'https://jkt48-live-watcher.chandra02new.workers.dev';
  return `${workerBase}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

// Fetch fresh stream URL from live aggregator to avoid expired tokens
async function fetchFreshStreamUrl(currentLive) {
  try {
    let lives = [];
    const proxyCheck = `https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy?url=${encodeURIComponent('https://api.crstlnz.my.id/api/now_live?group=jkt48')}`;
    try {
      const res = await fetch(proxyCheck);
      if (res.ok) lives = await res.json();
    } catch (_) {
      const direct = await fetch('https://api.crstlnz.my.id/api/now_live?group=jkt48');
      if (direct.ok) lives = await direct.json();
    }

    if (Array.isArray(lives) && lives.length > 0) {
      const idnSlug = (currentLive.room_url_key || currentLive.member?.platforms?.find(p => p.platform === 'idn')?.external_id || '').toLowerCase();
      const targetName = (currentLive.member?.name || currentLive.title || '').replace(/jkt48/gi, '').trim().toLowerCase();

      const found = lives.find(l => {
        const itemKey = (l.url_key || l.username || '').toLowerCase();
        if (idnSlug && itemKey && (itemKey === idnSlug || idnSlug.includes(itemKey))) return true;
        if (currentLive.platform === 'showroom' && l.room_id && String(l.room_id) === String(currentLive.room_id)) return true;
        if (l.name) {
          const lName = l.name.replace(/jkt48/gi, '').trim().toLowerCase();
          if (targetName && (targetName.includes(lName) || lName.includes(targetName))) return true;
        }
        return false;
      });

      if (found && found.streaming_url_list && found.streaming_url_list.length > 0) {
        const sorted = [...found.streaming_url_list].sort((a, b) => (b.quality || 0) - (a.quality || 0));
        return sorted[0].url;
      }
    }
  } catch (e) {
    console.warn('fetchFreshStreamUrl note:', e);
  }
  return currentLive.stream_url;
}

export default function LivePlayerModal({
  live,
  isOpen,
  onClose,
  onTriggerRecord,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const attemptRef = useRef(1);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [recordingSuccess, setRecordingSuccess] = useState(false);
  const [activeUrl, setActiveUrl] = useState('');
  const member = live?.member || {};

  // Start playback with triple-fallback engine
  const startPlayback = (targetUrl, attempt = 1) => {
    attemptRef.current = attempt;
    setIsLoading(true);
    setErrorMsg(null);

    const video = videoRef.current;
    if (!video) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.removeAttribute('src');

    console.log(`[LivePlayer] Attempt ${attempt}:`, attempt === 1 ? 'HLS.js Direct' : attempt === 2 ? 'Native HTML5 Video' : 'HLS.js CORS Proxy');

    // ATTEMPT 1: Hls.js Direct
    if (attempt === 1) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch((e) => console.log('Autoplay retry:', e));
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn('[LivePlayer] Attempt 1 Hls.js failed, switching to Attempt 2 (Native):', data);
            hls.destroy();
            hlsRef.current = null;
            startPlayback(targetUrl, 2);
          }
        });
        return;
      } else {
        startPlayback(targetUrl, 2);
        return;
      }
    }

    // ATTEMPT 2: Native HTML5 Video (Android System WebView & Safari support)
    if (attempt === 2) {
      video.src = targetUrl;
      video.load();

      let settled = false;

      const onPlaying = () => {
        settled = true;
        setIsLoading(false);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };

      const onError = (e) => {
        if (settled) return;
        settled = true;
        console.warn('[LivePlayer] Attempt 2 Native Video failed, switching to Attempt 3 (CORS Proxy):', e);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
        startPlayback(targetUrl, 3);
      };

      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);

      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {
          if (!settled && attemptRef.current === 2) {
            settled = true;
            startPlayback(targetUrl, 3);
          }
        });
      });
      return;
    }

    // ATTEMPT 3: CORS Proxy (Proxies master playlist and rewrites segments with CORS headers)
    if (attempt === 3) {
      const proxiedUrl = getProxyUrl(targetUrl);
      console.log('[LivePlayer] Playing via CORS Proxy:', proxiedUrl);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
        });
        hlsRef.current = hls;

        hls.loadSource(proxiedUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('[LivePlayer] All 3 attempts failed:', data);
            hls.destroy();
            hlsRef.current = null;
            setIsLoading(false);
            setErrorMsg('Gagal memuat stream live. Siaran mungkin telah berakhir atau koneksi server CDN terputus.');
          }
        });
      } else {
        video.src = proxiedUrl;
        video.load();
        video.play().then(() => {
          setIsLoading(false);
        }).catch(() => {
          setIsLoading(false);
          setErrorMsg('Browser Anda tidak mendukung pemutar video stream ini.');
        });
      }
    }
  };

  useEffect(() => {
    if (!isOpen || !live) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    // Fetch fresh stream URL on modal open to avoid stale playback tokens
    fetchFreshStreamUrl(live).then((freshUrl) => {
      if (!isSubscribed) return;
      setActiveUrl(freshUrl || live.stream_url);
      startPlayback(freshUrl || live.stream_url, 1);
    });

    return () => {
      isSubscribed = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, live]);

  if (!isOpen || !live) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    }
  };

  const handleManualRecord = async () => {
    if (isRecordingLoading) return;
    setIsRecordingLoading(true);
    try {
      await onTriggerRecord(
        live.id,
        live.member_id,
        live.title,
        live.platform,
        member.name,
        live.stream_url
      );
      setRecordingSuccess(true);
      setTimeout(() => setRecordingSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecordingLoading(false);
    }
  };

  const isShowroom = live.platform?.toLowerCase() === 'showroom';
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2B2522]/60 backdrop-blur-sm transition-all duration-200 p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Modal Dialog Content */}
      <div 
        className="w-full sm:max-w-lg bg-white border border-[#E8E1D5] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom-6 duration-200"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar inside modal */}
        <div className="px-5 py-3.5 bg-[#FAF8F2] border-b border-[#E8E1D5] flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <img
              src={member.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={member.name || 'Member'}
              className="w-9 h-9 rounded-full object-cover border border-[#E8E1D5] shrink-0"
            />
            <div className="truncate">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-bold text-sm text-[#2B2522] truncate">
                  {member.name || 'JKT48 Member'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                    isShowroom
                      ? 'bg-[#ECF2F6] text-[#2F4855] border-[#CADAE2]'
                      : 'bg-[#FAF0E6] text-[#8C4A36] border-[#ECD9C8]'
                  }`}
                >
                  {live.platform?.toUpperCase() || 'LIVE'}
                </span>
              </div>
              <p className="text-xs text-[#6D655F] font-medium truncate mt-0.5">
                {live.title || 'Sedang Live Streaming'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8A8179] hover:text-[#2B2522] hover:bg-[#F4EFE7] transition-colors"
            aria-label="Tutup Player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Container */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            controls={false}
          />

          {/* Buffering Loading Indicator */}
          {isLoading && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs space-y-2">
              <div className="w-8 h-8 border-2 border-[#3D5E52] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-white">Menghubungkan stream HLS...</span>
            </div>
          )}

          {/* Error fallback overlay */}
          {errorMsg && (
            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-[#2B2522]/95 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-[#C94A3D]" />
              <p className="text-xs text-white max-w-xs">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsLoading(true);
                  if (hlsRef.current) {
                    hlsRef.current.loadSource(live.stream_url);
                  }
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] text-xs font-bold text-white transition-colors"
              >
                Coba Muat Ulang
              </button>
            </div>
          )}

          {/* Custom On-screen Video Controls */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleMute}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-[#FAF0E6]" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-black/50 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C94A3D] animate-pulse" />
                <span className="text-white font-semibold uppercase">LIVE</span>
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Footer & Actions */}
        <div className="p-5 bg-white space-y-4">
          {/* Status recording banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E8E1D5] gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  live.is_recording ? 'bg-[#C94A3D] rec-pulse' : 'bg-[#B6ACA3]'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#2B2522] truncate">
                  {live.is_recording
                    ? 'Status: Cloud Recording Aktif'
                    : 'Status: Belum Direkam'}
                </div>
                <div className="text-[11px] text-[#6D655F] truncate">
                  {live.is_recording
                    ? 'Sesi live ini sedang direkam secara cloud'
                    : 'Picu manual atau aktifkan auto-record'}
                </div>
              </div>
            </div>

            {/* Manual Record Trigger Button (Min Touch Target 44px) */}
            {!live.is_recording && (
              <button
                onClick={handleManualRecord}
                disabled={isRecordingLoading}
                className="min-h-[44px] flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#3D5E52] hover:bg-[#314D43] active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-[#3D5E52]/20 disabled:opacity-50 shrink-0"
              >
                <Disc3 className={`w-3.5 h-3.5 ${isRecordingLoading ? 'animate-spin' : ''}`} />
                <span>{isRecordingLoading ? 'Memicu...' : 'Picu Rekam'}</span>
              </button>
            )}

            {live.is_recording && (
              <span className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAF0E6] border border-[#ECD9C8] text-xs font-bold text-[#8C4A36] shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8C4A36]" />
                <span>Direkam</span>
              </span>
            )}
          </div>

          {recordingSuccess && (
            <div className="p-3 bg-[#EAF1EE] border border-[#BED5CC] rounded-xl text-[#2D4A3F] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#3D5E52]" />
              <span className="font-semibold">Perintah rekam cloud manual berhasil dikirim!</span>
            </div>
          )}

          {/* Quick links & info */}
          <div className="flex items-center justify-between text-xs text-[#6D655F] pt-1">
            <span className="truncate max-w-[200px]">
              URL: {(activeUrl || live.stream_url) ? (activeUrl || live.stream_url).substring(0, 32) + '...' : '-'}
            </span>
            <a
              href={activeUrl || live.stream_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 text-[#3D5E52] hover:underline font-bold"
            >
              <span>Tautan .m3u8</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
