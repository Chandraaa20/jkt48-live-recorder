/**
 * JKT48 Live Watcher & Auto-Record Dispatcher
 * Cloudflare Worker with Adapter Pattern for Multi-Platform Streams
 */

// ==============================================================================
// 1. BASE ADAPTER & CONCRETE ADAPTERS (IDN & SHOWROOM)
// ==============================================================================

class BasePlatformAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Fetches raw live list and normalizes into standard objects:
   * [{ platform, external_id, room_url_key, title, stream_url, thumbnail_url, started_at }]
   */
  async fetchLives() {
    throw new Error('fetchLives() must be implemented by subclass');
  }
}

/**
 * IDN Live Adapter
 * Queries IDN Live and uses high-availability JKT48 live stream aggregator
 */
class IdnAdapter extends BasePlatformAdapter {
  constructor() {
    super('idn');
  }

  async fetchLives() {
    const lives = [];

    // 1. Primary: High-availability JKT48 Live Aggregator endpoint
    try {
      const res = await fetch('https://api.crstlnz.my.id/api/now_live?group=jkt48', {
        headers: { 'User-Agent': 'JKT48-Live-Cloud-Recorder/1.0' },
      });

      if (res.ok) {
        const data = await res.json();
        // The API returns an array of live objects for both IDN and Showroom
        for (const item of (Array.isArray(data) ? data : [])) {
          const type = (item.type || item.platform || '').toLowerCase();
          if (type.includes('showroom')) continue;

          const externalId = item.url_key || item.username || '';
          let streamUrl = '';
          if (item.streaming_url_list && Array.isArray(item.streaming_url_list) && item.streaming_url_list.length > 0) {
            const m3u8s = item.streaming_url_list.filter((s) => s.url && s.url.includes('.m3u8'));
            if (m3u8s.length > 0) {
              const sorted = [...m3u8s].sort((a, b) => (b.quality || 0) - (a.quality || 0));
              streamUrl = sorted[0].url;
            } else {
              streamUrl = item.streaming_url_list[0].url;
            }
          }
          if (!streamUrl) streamUrl = item.stream_url || item.playback_url || '';

          if (streamUrl && externalId) {
            lives.push({
              platform: 'idn',
              external_id: String(externalId).toLowerCase().replace(/^@/, ''),
              room_url_key: item.url_key || item.slug || item.username || '',
              title: item.title || item.slug || `Live streaming ${item.name || ''}`,
              stream_url: streamUrl,
              thumbnail_url: item.image || item.img_alt || item.img || item.avatar || '',
              started_at: item.started_at ? new Date(item.started_at).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('[IdnAdapter] Aggregator fetch failed, falling back:', err.message);
    }

    // 2. Fallback: Direct IDN Live GraphQL if aggregator had no IDN entries
    if (lives.length === 0) {
      try {
        const query = `
          query GetLivestreams {
            getLivestreams {
              title
              slug
              playback_url
              creator {
                username
                name
              }
            }
          }
        `;

        const idnRes = await fetch('https://api.idn.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          body: JSON.stringify({ query }),
        });

        if (idnRes.ok) {
          const json = await idnRes.json();
          const streamList = json?.data?.getLivestreams || [];
          for (const s of streamList) {
            const username = (s.creator?.username || s.slug || '').toLowerCase();
            if (s.playback_url) {
              lives.push({
                platform: 'idn',
                external_id: username,
                room_url_key: s.slug || username,
                title: s.title || `Live bareng ${s.creator?.name || username}`,
                stream_url: s.playback_url,
                thumbnail_url: s.image_url || s.creator?.avatar_url || '',
                started_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (e) {
        console.warn('[IdnAdapter] Direct IDN GraphQL query error:', e.message);
      }
    }

    return lives;
  }
}

/**
 * Showroom Adapter
 * Queries Showroom onlives endpoint and retrieves direct .m3u8 streaming URLs
 */
class ShowroomAdapter extends BasePlatformAdapter {
  constructor() {
    super('showroom');
  }

  async fetchLives() {
    const lives = [];

    // 1. Primary: High-availability aggregator for Showroom JKT48 streams
    try {
      const res = await fetch('https://api.crstlnz.my.id/api/now_live?group=jkt48', {
        headers: { 'User-Agent': 'JKT48-Live-Cloud-Recorder/1.0' },
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of (Array.isArray(data) ? data : [])) {
          const type = (item.type || item.platform || '').toLowerCase();
          if (type.includes('showroom') || item.stream_url?.includes('showroom')) {
            const roomId = String(item.room_id || item.room_url_key || '');
            let streamUrl = '';
            if (item.streaming_url_list && Array.isArray(item.streaming_url_list) && item.streaming_url_list.length > 0) {
              const m3u8s = item.streaming_url_list.filter((s) => s.url && s.url.includes('.m3u8'));
              if (m3u8s.length > 0) {
                const sorted = [...m3u8s].sort((a, b) => (b.quality || 0) - (a.quality || 0));
                streamUrl = sorted[0].url;
              } else {
                streamUrl = item.streaming_url_list[0].url;
              }
            }
            if (!streamUrl) streamUrl = item.stream_url || '';

            if (streamUrl && roomId) {
              lives.push({
                platform: 'showroom',
                external_id: roomId,
                room_url_key: item.room_url_key || item.url_key || '',
                title: item.title || `Showroom Live ${item.name || ''}`,
                stream_url: streamUrl,
                thumbnail_url: item.image || item.img_alt || item.img || '',
                started_at: item.started_at ? new Date(item.started_at).toISOString() : new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[ShowroomAdapter] Aggregator fetch failed, trying direct showroom API:', err.message);
    }

    // 2. Fallback: Direct Showroom Onlives API (strictly filter for JKT48 to avoid subrequest limits)
    if (lives.length === 0) {
      try {
        const srRes = await fetch('https://www.showroom-live.com/api/live/onlives', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (srRes.ok) {
          const srData = await srRes.json();
          const onliveCategories = srData.onlives || [];
          
          for (const cat of onliveCategories) {
            for (const room of (cat.lives || [])) {
              const mainName = (room.main_name || '').toLowerCase();
              // Only query streaming URL for rooms explicitly belonging to JKT48
              if (!mainName.includes('jkt48') && !mainName.includes('jkt 48')) {
                continue;
              }

              const roomId = String(room.room_id);
              const streamRes = await fetch(`https://www.showroom-live.com/api/live/streaming_url?room_id=${roomId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
              });

              if (streamRes.ok) {
                const streamData = await streamRes.json();
                const bestStream = streamData.streaming_url_list?.[0]?.url;
                if (bestStream) {
                  lives.push({
                    platform: 'showroom',
                    external_id: roomId,
                    room_url_key: room.room_url_key || '',
                    title: room.main_name || 'Showroom Live',
                    stream_url: bestStream,
                    thumbnail_url: room.image || room.image_m || '',
                    started_at: new Date(room.started_at * 1000).toISOString(),
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[ShowroomAdapter] Direct Showroom onlives error:', e.message);
      }
    }

    return lives;
  }
}

// ==============================================================================
// 2. SUPABASE REST CLIENT (LIGHTWEIGHT FOR CLOUDFLARE WORKERS)
// ==============================================================================

class SupabaseWorkerClient {
  constructor(url, key) {
    this.url = (url || '').replace(/\/$/, '');
    this.key = key || '';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {}),
    };

    const res = await fetch(`${this.url}/rest/v1/${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase error [${res.status}]: ${errText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async getMembersWithPlatforms() {
    return this.request('members?select=id,name,nickname,generation,avatar_url,is_auto_record,is_notify,member_platforms(*)');
  }

  async getActiveLives() {
    return this.request('active_lives?select=*');
  }

  async insertActiveLive(data) {
    return this.request('active_lives', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActiveLive(id, data) {
    return this.request(`active_lives?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Atomically claim a session. Only the request which changes false -> true
  // may create a recording and dispatch GitHub Actions.
  async claimRecording(id) {
    return this.request(`active_lives?id=eq.${id}&is_recording=eq.false`, {
      method: 'PATCH',
      body: JSON.stringify({ is_recording: true }),
    });
  }

  async deleteActiveLive(id) {
    return this.request(`active_lives?id=eq.${id}`, {
      method: 'DELETE',
    });
  }

  async createRecording(data) {
    return this.request('recordings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRecordingStatus(id, status, videoUrl = null) {
    const payload = { status };
    if (videoUrl) payload.video_url = videoUrl;
    return this.request(`recordings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}

// ==============================================================================
// 3. CORE SYNC & AUTO-RECORD ENGINE
// ==============================================================================

export async function processLiveStreams(env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const supabase = new SupabaseWorkerClient(supabaseUrl, supabaseKey);

  // 1. Fetch DB Registered Members & Platforms
  const members = await supabase.getMembersWithPlatforms();
  const existingActiveLives = await supabase.getActiveLives();

  // Create lookup maps for fast matching
  // Key: `${platform}:${external_id.toLowerCase()}` -> member object
  const platformLookup = new Map();
  for (const m of (members || [])) {
    for (const p of (m.member_platforms || [])) {
      if (p.external_id) {
        const key = `${p.platform}:${p.external_id.toLowerCase()}`;
        platformLookup.set(key, { member: m, platformRecord: p });
      }
      if (p.room_url_key) {
        const keySlug = `${p.platform}:${p.room_url_key.toLowerCase()}`;
        platformLookup.set(keySlug, { member: m, platformRecord: p });
      }
    }
  }

  // 2. Query Adapters (IDN & Showroom)
  const adapters = [new IdnAdapter(), new ShowroomAdapter()];
  const discoveredStreams = [];

  for (const adapter of adapters) {
    try {
      const lives = await adapter.fetchLives();
      discoveredStreams.push(...lives);
    } catch (e) {
      console.error(`Adapter [${adapter.name}] failed:`, e);
    }
  }

  // 3. Strict Filter: Match discovered streams with registered JKT48 members
  const activeJktMembers = [];
  const newlyTriggeredRecordings = [];

  for (const stream of discoveredStreams) {
    const matchKeyId = `${stream.platform}:${stream.external_id.toLowerCase()}`;
    const matchKeySlug = stream.room_url_key ? `${stream.platform}:${stream.room_url_key.toLowerCase()}` : '';

    let matched = platformLookup.get(matchKeyId) || (matchKeySlug ? platformLookup.get(matchKeySlug) : null);

    // Fallback: Exact name or nickname match (avoid partial substring collisions)
    if (!matched && stream.title) {
      const cleanName = (stream.title || '').replace(/jkt48/gi, '').trim().toLowerCase();
      const foundMember = (members || []).find((m) => {
        const nick = (m.nickname || '').toLowerCase();
        const fullName = m.name.toLowerCase();
        return nick === cleanName || fullName === cleanName || fullName.split(' ').includes(cleanName);
      });
      if (foundMember) {
        matched = { member: foundMember };
      }
    }

    if (matched) {
      activeJktMembers.push({
        stream,
        member: matched.member,
      });
    }
  }

  // 4. Sync with active_lives table in Supabase
  const currentLiveIdsInDb = new Set();

  for (const { stream, member } of activeJktMembers) {
    // Check if already in active_lives
    const existing = existingActiveLives.find(
      (l) => l.member_id === member.id && l.platform === stream.platform
    );

    let activeLiveRecord = existing;

    if (!existing) {
      // Member just started live -> Insert to active_lives (1:1 with member UUID)
      const liveId = member.id;
      const newLivePayload = {
        id: liveId,
        member_id: member.id,
        platform: stream.platform,
        title: stream.title,
        stream_url: stream.stream_url,
        thumbnail_url: stream.thumbnail_url || member.avatar_url,
        started_at: stream.started_at || new Date().toISOString(),
        is_recording: false,
      };

      const [inserted] = await supabase.insertActiveLive(newLivePayload);
      activeLiveRecord = inserted || newLivePayload;
      currentLiveIdsInDb.add(activeLiveRecord.id);

      // Trigger Telegram notification if member has is_notify === true
      if (member.is_notify && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        try {
          const autoRecTxt = member.is_auto_record ? '✅ AKTIF (Otomatis Merekam)' : '⏸️ Tidak Aktif';
          const msg =
            `🔔 <b>JKT48 LIVE ALERT!</b>\n\n` +
            `👤 <b>Member:</b> ${member.name} ${member.generation ? `(Gen ${member.generation})` : ''}\n` +
            `📺 <b>Platform:</b> ${stream.platform.toUpperCase()}\n` +
            `📝 <b>Judul:</b> ${stream.title}\n` +
            `⏺️ <b>Cloud Recording:</b> ${autoRecTxt}\n` +
          `⏰ <b>Mulai:</b> ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(newLivePayload.started_at))} WIB\n\n` +
            `<i>Notifikasi otomatis dari Cloudflare Worker JKT48 Watcher.</i>`;

          const photoUrl = newLivePayload.thumbnail_url || member.avatar_url;
          if (photoUrl && photoUrl.startsWith('http')) {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                photo: photoUrl,
                caption: msg,
                parse_mode: 'HTML',
              }),
            });
          } else {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'HTML',
              }),
            });
          }
        } catch (tgErr) {
          console.error('[Worker] Telegram notification dispatch error:', tgErr);
        }
      }
    } else {
      currentLiveIdsInDb.add(existing.id);
      // Update stream_url or title if changed
      if (existing.stream_url !== stream.stream_url || existing.title !== stream.title) {
        await supabase.updateActiveLive(existing.id, {
          stream_url: stream.stream_url,
          title: stream.title,
        });
      }
    }

    // 5. Selective Auto-Record Logic:
    // If member has is_auto_record === true AND active_lives.is_recording === false
    if (member.is_auto_record) {
      // This conditional update is the cross-cron / cross-request lock.
      const claimed = await supabase.claimRecording(activeLiveRecord.id);
      if (!claimed || claimed.length === 0) continue;
      const recordingId = crypto.randomUUID();

      // b. Insert new row in recordings table
      await supabase.createRecording({
        id: recordingId,
        member_id: member.id,
        platform: stream.platform,
        title: `${stream.title || 'Live Stream'} [Auto-Record]`,
        status: 'recording',
        video_url: '',
        file_size_mb: 0,
        duration_seconds: 0,
      });

      // c. Trigger GitHub Actions Cloud Recorder via repository_dispatch
      if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
        try {
          const ghRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'JKT48-Cloudflare-Worker/1.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event_type: 'start_recording',
              client_payload: {
                recording_id: recordingId,
                member_name: member.name,
                platform: stream.platform,
                stream_url: stream.stream_url,
              },
            }),
          });

          if (!ghRes.ok) {
            const errText = await ghRes.text();
            console.error('GitHub Actions trigger failed:', ghRes.status, errText);
          } else {
            newlyTriggeredRecordings.push({
              recordingId,
              member: member.name,
              platform: stream.platform,
            });
          }
        } catch (ghErr) {
          console.error('Error dispatching to GitHub Actions:', ghErr);
        }
      }
    }
  }

  // 6. Cleanup Ended Lives: Remove from active_lives if no longer streaming
  for (const dbLive of existingActiveLives) {
    if (!currentLiveIdsInDb.has(dbLive.id)) {
      await supabase.deleteActiveLive(dbLive.id);
    }
  }

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    total_streams_scanned: discoveredStreams.length,
    active_jkt48_lives: activeJktMembers.length,
    triggered_recordings: newlyTriggeredRecordings,
  };
}

// Helper: Proxy HLS playlists (.m3u8) and video segments (.ts) with CORS headers & Referer spoofing
async function handleHlsProxy(request, env, corsHeaders) {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing ?url= parameter', {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    let referer = 'https://www.idn.app/';
    let origin = 'https://www.idn.app';
    if (targetUrl.includes('showroom') || targetUrl.includes('sr-')) {
      referer = 'https://www.showroom-live.com/';
      origin = 'https://www.showroom-live.com';
    }

    const workerBase = 'https://jkt48-live-watcher.chandra02new.workers.dev';

    let upstreamRes = null;
    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': referer,
      'Origin': origin,
      'Accept': '*/*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    for (let attempt = 0; attempt < 4; attempt++) {
      upstreamRes = await fetch(targetUrl, { headers: upstreamHeaders });
      if (upstreamRes.ok) break;
      if (upstreamRes.status === 403 && attempt < 3) {
        // Small delay to bypass Amazon IVS edge rate-limiting
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (!upstreamRes || !upstreamRes.ok) {
      return new Response(`Upstream error: ${upstreamRes ? upstreamRes.status : 'Unknown'}`, {
        status: upstreamRes ? upstreamRes.status : 502,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isPlaylist = targetUrl.includes('.m3u8') || targetUrl.includes('playlist.live-video.net') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

    if (isPlaylist) {
      const text = await upstreamRes.text();
      const baseUrl = new URL(targetUrl);

      // Rewrite nested variant stream URLs or chunk URLs with explicit extension for FFmpeg, streamlink, and HLS players
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absUrl = new URL(uri, baseUrl).toString();
              const isChild = absUrl.includes('.m3u8') || absUrl.includes('playlist.live-video.net');
              const ext = isChild ? '/stream.m3u8' : '/segment.ts';
              return `URI="${workerBase}/api/proxy${ext}?url=${encodeURIComponent(absUrl)}"`;
            });
          }
          return line;
        }
        const absUrl = new URL(trimmed, baseUrl).toString();
        const isChild = absUrl.includes('.m3u8') || absUrl.includes('playlist.live-video.net');
        const ext = isChild ? '/stream.m3u8' : '/segment.ts';
        return `${workerBase}/api/proxy${ext}?url=${encodeURIComponent(absUrl)}`;
      }).join('\n');

      return new Response(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Segment (.ts) or chunks
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'video/MP2T',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
}

// ==============================================================================
// 4. CLOUDFLARE WORKER EXPORT (FETCH & SCHEDULED CRON)
// ==============================================================================

export default {
  // HTTP Endpoint (Manual Trigger / Proxy / Health Check from Web App)
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // 0. GET /api/proxy: CORS HLS & TS Stream Proxy (supports /api/proxy/stream.m3u8 & /api/proxy/segment.ts)
      if (pathname === '/api/proxy' || pathname.startsWith('/api/proxy/')) {
        return await handleHlsProxy(request, env, corsHeaders);
      }

      // 1. POST /api/trigger-record: Secure server-side GitHub dispatch
      if (request.method === 'POST' && pathname === '/api/trigger-record') {
        const body = await request.json().catch(() => ({}));
        const recordingId = body.recording_id || crypto.randomUUID();
        const memberName = body.member_name || 'Member JKT48';
        const platform = body.platform || 'idn';
        const streamUrl = body.stream_url || '';

        if (!env.GITHUB_TOKEN) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Server Secret GITHUB_TOKEN belum dikonfigurasi di Cloudflare Worker.',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const repo = env.GITHUB_REPO || 'Chandraaa20/jkt48-live-recorder';
        const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'JKT48-Cloudflare-Worker/1.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'start_recording',
            client_payload: {
              recording_id: recordingId,
              member_name: memberName,
              platform: platform,
              stream_url: streamUrl,
            },
          }),
        });

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return new Response(
            JSON.stringify({
              success: false,
              message: `GitHub Actions dispatch failed [${ghRes.status}]: ${errText}`,
            }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Also update active_lives if live_id provided
        if (body.live_id && env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
          const supabase = new SupabaseWorkerClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
          );
          await supabase.updateActiveLive(body.live_id, { is_recording: true }).catch(() => null);
        }

        return new Response(
          JSON.stringify({
            success: true,
            recording_id: recordingId,
            message: 'Perekaman cloud berhasil dipicu melalui Cloudflare Worker Proxy!',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 2. POST /api/stop-record: Stop recording and trigger remux/upload
      if (request.method === 'POST' && pathname === '/api/stop-record') {
        const body = await request.json().catch(() => ({}));
        const recordingId = body.recording_id;
        let runId = body.run_id;

        const repo = env.GITHUB_REPO || 'Chandraaa20/jkt48-live-recorder';

        // Auto-discover in_progress recorder run if runId wasn't passed directly
        if (!runId && env.GITHUB_TOKEN) {
          try {
            const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?status=in_progress`, {
              headers: {
                'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'JKT48-Cloudflare-Worker/1.0',
              },
            });
            if (runsRes.ok) {
              const runsData = await runsRes.json();
              const activeRuns = runsData.workflow_runs || [];
              const recRun = activeRuns.find((r) =>
                (r.path && r.path.includes('recorder.yml')) ||
                (r.name && r.name.toLowerCase().includes('recorder'))
              );
              if (recRun) runId = recRun.id;
            }
          } catch (e) {
            console.warn('[stop-record] Active run query failed:', e.message);
          }
        }

        // Mark as uploading. capture_hls polls this state and exits cleanly,
        // allowing remux/upload instead of cancelling the runner mid-stream.
        if (recordingId && env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
          const supabase = new SupabaseWorkerClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
          );
          await supabase.updateRecordingStatus(recordingId, 'uploading').catch(() => null);
        }

        return new Response(
          JSON.stringify({
            success: true,
            recording_id: recordingId,
            run_id: runId,
            message: 'Perintah penghentian rekaman berhasil dikirim. File video sedang diproses dan diunggah ke Telegram.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 3. Health endpoint must be read-only. Scheduled Worker cron owns mutation.
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: err.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },

  // Scheduled Cron Trigger (Runs every 1 minute)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processLiveStreams(env));
  },
};
