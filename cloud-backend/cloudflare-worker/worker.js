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
          if (type.includes('idn') || item.stream_url?.includes('idn')) {
            const externalId = item.username || item.slug || item.room_id || '';
            const streamUrl = item.stream_url || item.streaming_url_list?.[0]?.url || '';

            if (streamUrl) {
              lives.push({
                platform: 'idn',
                external_id: String(externalId).toLowerCase().replace(/^@/, ''),
                room_url_key: item.slug || item.username || '',
                title: item.title || 'IDN Live Streaming',
                stream_url: streamUrl,
                thumbnail_url: item.image || item.img_alt || item.avatar || '',
                started_at: item.started_at || new Date().toISOString(),
              });
            }
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
            getLivestreams(status: "live") {
              title
              slug
              image_url
              playback_url
              creator {
                username
                name
                avatar_url
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
            const streamUrl = item.stream_url || item.streaming_url_list?.[0]?.url || '';

            if (streamUrl) {
              lives.push({
                platform: 'showroom',
                external_id: roomId,
                room_url_key: item.room_url_key || item.url_key || '',
                title: item.title || 'Showroom Live Streaming',
                stream_url: streamUrl,
                thumbnail_url: item.image || item.img_alt || '',
                started_at: item.started_at || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[ShowroomAdapter] Aggregator fetch failed, trying direct showroom API:', err.message);
    }

    // 2. Fallback: Direct Showroom Onlives API
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
              const roomId = String(room.room_id);
              // Filter candidate idol/JKT rooms or let the matching engine match against DB
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

    const matched = platformLookup.get(matchKeyId) || (matchKeySlug ? platformLookup.get(matchKeySlug) : null);

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
      // Member just started live -> Insert to active_lives
      const liveId = crypto.randomUUID();
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
    if (member.is_auto_record && !activeLiveRecord.is_recording) {
      const recordingId = crypto.randomUUID();

      // a. Mark is_recording = true on active_lives
      await supabase.updateActiveLive(activeLiveRecord.id, { is_recording: true });

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

// ==============================================================================
// 4. CLOUDFLARE WORKER EXPORT (FETCH & SCHEDULED CRON)
// ==============================================================================

export default {
  // HTTP Endpoint (Manual Trigger / Health Check from Web App)
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const result = await processLiveStreams(env);
      return new Response(JSON.stringify(result, null, 2), {
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
