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
  Radio,
  CheckCircle2,
} from './Icons';

export default function LivePlayerModal({
  live,
  isOpen,
  onClose,
  onTriggerRecord,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [recordingSuccess, setRecordingSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !live) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setErrorMsg(null);

    const streamUrl = live.stream_url;

    // 1. Check HLS.js support (Android / Chrome / Firefox)
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {
          // Auto-play was prevented by browser policy (mute and retry)
          video.muted = true;
          setIsMuted(true);
          video.play().catch((e) => console.log('Autoplay failed:', e));
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS Event Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorMsg('Gagal memuat stream: Kendala jaringan atau CORS.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setErrorMsg('Kesalahan format media stream.');
              hls.recoverMediaError();
              break;
            default:
              setErrorMsg('Stream offline atau tautan .m3u8 tidak dapat diputar.');
              hls.destroy();
              break;
          }
        }
      });
    }
    // 2. Check native HLS support (Safari / iOS)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play();
        });
      });
      video.addEventListener('error', () => {
        setErrorMsg('Gagal memutar video live stream.');
        setIsLoading(false);
      });
    } else {
      setErrorMsg('Browser Anda tidak mendukung pemutar video HLS (.m3u8).');
      setIsLoading(false);
    }

    return () => {
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
    try {
      await onTriggerRecord(
        live.id,
        live.member_id,
        live.title,
        live.platform,
        member.name,
        live.stream_url
      );
      setTimeout(() => setRecordingSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecordingLoading(false);
    }
  };

  const isShowroom = live.platform?.toLowerCase() === 'showroom';
  const member = live.member || {};

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Content */}
      <div 
        className="w-full sm:max-w-lg bg-dark-card border border-dark-border sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom-6 duration-200"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar inside modal */}
        <div className="px-4 py-3 bg-dark-bg/90 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <img
              src={member.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={member.name || 'Member'}
              className="w-8 h-8 rounded-full object-cover border border-dark-border"
            />
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm text-white truncate">
                  {member.name || 'JKT48 Member'}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    isShowroom
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {live.platform?.toUpperCase() || 'LIVE'}
                </span>
              </div>
              <p className="text-xs text-dark-muted truncate">
                {live.title || 'Sedang Live Streaming'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-hover transition-colors"
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
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-slate-300">Menghubungkan stream HLS...</span>
            </div>
          )}

          {/* Error fallback overlay */}
          {errorMsg && (
            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-dark-bg/95 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-xs text-slate-300 max-w-xs">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsLoading(true);
                  if (hlsRef.current) {
                    hlsRef.current.loadSource(live.stream_url);
                  }
                }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
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
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleMute}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-black/50 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-rose-400 font-semibold uppercase">LIVE</span>
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Footer & Actions */}
        <div className="p-4 bg-dark-card space-y-3">
          {/* Status recording banner */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-bg border border-dark-border">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  live.is_recording ? 'bg-rose-500 rec-pulse' : 'bg-slate-600'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {live.is_recording
                    ? 'Status: Cloud Recording Aktif'
                    : 'Status: Belum Direkam Otomatis'}
                </div>
                <div className="text-[11px] text-dark-muted">
                  {live.is_recording
                    ? 'Sesi live ini sedang direkam di server cloud'
                    : 'Aktifkan auto-record di menu Member atau picu manual'}
                </div>
              </div>
            </div>

            {/* Manual Record Trigger Button */}
            {!live.is_recording && (
              <button
                onClick={handleManualRecord}
                disabled={isRecordingLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-rose-950/40 disabled:opacity-50"
              >
                <Disc3 className={`w-3.5 h-3.5 ${isRecordingLoading ? 'animate-spin' : ''}`} />
                <span>{isRecordingLoading ? 'Memicu...' : 'Picu Rekam'}</span>
              </button>
            )}

            {live.is_recording && (
              <span className="flex items-center space-x-1 text-xs font-semibold text-rose-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Direkam</span>
              </span>
            )}
          </div>

          {recordingSuccess && (
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Perintah rekam cloud manual berhasil dikirim!</span>
            </div>
          )}

          {/* Quick links & info */}
          <div className="flex items-center justify-between text-xs text-dark-muted pt-1">
            <span className="truncate max-w-[200px]">
              URL: {live.stream_url ? live.stream_url.substring(0, 32) + '...' : '-'}
            </span>
            <a
              href={live.stream_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 text-rose-400 hover:text-rose-300 font-medium"
            >
              <span>Tautan .m3u8</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
