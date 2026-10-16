/**
 * JKT48 Live Watcher & Auto-Record Dispatcher for GitHub Actions (24/7 Cloud Cron)
 * Runs every 5 minutes in GitHub Actions runner to monitor IDN Live & Showroom.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'Chandraaa20/jkt48-live-recorder';

// Helper: Supabase REST fetch
async function supabaseFetch(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error [${res.status}]: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Helper: Send Telegram notification
async function sendTelegramAlert({ text, photoUrl }) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Skipping alert (token/chatId not configured in env)');
    return;
  }

  const token = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_CHAT_ID;

  try {
    if (photoUrl) {
      const photoApi = `https://api.telegram.org/bot${token}/sendPhoto`;
      const res = await fetch(photoApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
        }),
      });

      if (res.ok) {
        console.log('[Telegram] Photo alert successfully sent!');
        return;
      }
      console.warn('[Telegram] sendPhoto failed, falling back to sendMessage');
    }

    const msgApi = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(msgApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (res.ok) {
      console.log('[Telegram] Text message successfully sent!');
    } else {
      console.error('[Telegram] sendMessage failed:', await res.text());
    }
  } catch (err) {
    console.error('[Telegram] Alert error:', err.message);
  }
}

// Helper: Dispatch GitHub Actions Cloud Recorder (recorder.yml)
async function triggerGitHubRecorder({ recordingId, memberName, platform, streamUrl }) {
  if (!GITHUB_TOKEN) {
    console.warn('[GitHub] GITHUB_TOKEN not provided, cannot dispatch recorder.yml');
    return false;
  }

  console.log(`[GitHub] Dispatching recorder.yml for ${memberName} (${platform})...`);

  // 1. Try repository_dispatch
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JKT48-Live-Watcher-Cron/1.0',
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

    if (res.ok) {
      console.log('[GitHub] repository_dispatch event start_recording sent successfully!');
      return true;
    }
    console.warn(`[GitHub] repository_dispatch status ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.warn('[GitHub] repository_dispatch error:', err.message);
  }

  // 2. Fallback: workflow_dispatch directly targeting recorder.yml
  try {
    const wfRes = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/recorder.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JKT48-Live-Watcher-Cron/1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          recording_id: recordingId,
          member_name: memberName,
          platform: platform,
          stream_url: streamUrl,
        },
      }),
    });

    if (wfRes.ok) {
      console.log('[GitHub] workflow_dispatch recorder.yml triggered successfully!');
      return true;
    }
    console.error(`[GitHub] workflow_dispatch error status ${wfRes.status}: ${await wfRes.text()}`);
  } catch (err) {
    console.error('[GitHub] workflow_dispatch error:', err.message);
  }

  return false;
}

// Load registered member list
async function getMembers() {
  // 1. Try Supabase
  try {
    const dbMembers = await supabaseFetch('members?select=id,name,nickname,generation,avatar_url,is_auto_record,is_notify,member_platforms(*)');
    if (Array.isArray(dbMembers) && dbMembers.length > 0) {
      return dbMembers.map(m => ({
        ...m,
        platforms: m.member_platforms || [],
      }));
    }
  } catch (err) {
    console.warn('[Watcher] Could not fetch members from Supabase:', err.message);
  }

  // 2. Fallback to local active members JSON
  try {
    const jsonPath = path.join(__dirname, '..', 'src', 'constants', 'allActiveMembers.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[Watcher] Local JSON fallback error:', e.message);
  }

  return [];
}

async function main() {
  console.log('=== JKT48 24/7 Cloud Watcher Starting ===');
  console.log('Timestamp:', new Date().toISOString());

  // 1. Fetch live list from aggregator
  let liveList = [];
  try {
    const res = await fetch('https://api.crstlnz.my.id/api/now_live?group=jkt48', {
      headers: { 'User-Agent': 'JKT48-Live-Watcher-Cron/1.0' },
    });
    if (res.ok) {
      liveList = await res.json();
    } else {
      console.error(`[Watcher] API error HTTP ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error('[Watcher] Failed to fetch live list:', err.message);
    return;
  }

  console.log(`[Watcher] Total active streams found: ${liveList.length}`);

  // 2. Fetch members
  const members = await getMembers();
  console.log(`[Watcher] Total registered JKT48 members in system: ${members.length}`);

  // 3. Match streams with members
  const activeMatched = [];

  for (const item of (Array.isArray(liveList) ? liveList : [])) {
    const type = (item.type || item.platform || '').toLowerCase();
    const isSr = type.includes('showroom');
    const platform = isSr ? 'showroom' : 'idn';

    const roomId = String(item.room_id || item.room_url_key || '');
    const idnKey = (item.url_key || item.username || '').toLowerCase().replace(/^@/, '');
    const cleanLiveName = (item.name || '').replace(/jkt48/gi, '').trim().toLowerCase();

    // Strict platform match
    let matched = members.find((m) => {
      return (m.platforms || []).some((p) => {
        if (p.platform === 'showroom' && roomId && String(p.external_id) === roomId) return true;
        if (p.platform === 'idn' && idnKey && (p.external_id?.toLowerCase() === idnKey || p.room_url_key?.toLowerCase() === idnKey)) return true;
        return false;
      });
    });

    // Fallback: Exact name or nickname match
    if (!matched && cleanLiveName) {
      matched = members.find((m) => {
        const nick = (m.nickname || '').toLowerCase();
        const fullName = m.name.toLowerCase();
        return nick === cleanLiveName || fullName === cleanLiveName || fullName.split(' ').includes(cleanLiveName);
      });
    }

    if (!matched) {
      console.log(`[Watcher] Non-JKT or unmatched stream: ${item.name} (${platform})`);
      continue;
    }

    // Extract stream URL
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
    if (!streamUrl) {
      streamUrl = item.stream_url || item.playback_url || item.url || '';
    }

    if (streamUrl) {
      activeMatched.push({
        id: matched.id,
        member_id: matched.id,
        platform,
        title: item.title || item.slug || `Live streaming ${matched.name}`,
        stream_url: streamUrl,
        thumbnail_url: item.image || item.img_alt || item.img || matched.avatar_url,
        started_at: item.started_at ? new Date(item.started_at).toISOString() : new Date().toISOString(),
        is_recording: false,
        member: matched,
      });
    }
  }

  console.log(`[Watcher] Matched JKT48 live streams: ${activeMatched.length}`);

  // 4. Check existing active lives and recordings in Supabase
  let existingActiveLives = [];
  let existingRecordings = [];

  try {
    existingActiveLives = (await supabaseFetch('active_lives?select=*')) || [];
    existingRecordings = (await supabaseFetch('recordings?select=*')) || [];
  } catch (e) {
    console.warn('[Watcher] Could not fetch DB state:', e.message);
  }

  const existingLiveMap = new Map(existingActiveLives.map(l => [l.id, l]));

  // 5. Process Notifications & Auto-Record
  for (const live of activeMatched) {
    console.log(`--> Processing: ${live.member.name} (${live.platform}) | Auto-Rec: ${live.member.is_auto_record} | Notify: ${live.member.is_notify}`);

    const existingLive = existingLiveMap.get(live.id);
    const isNewLive = !existingLive;

    // Check if recording is already active
    const isAlreadyRecording = (existingLive && existingLive.is_recording) ||
      existingRecordings.some(r => r.member_id === live.member_id && r.status === 'recording');

    // Action A: Telegram Notification
    if (isNewLive && live.member.is_notify !== false) {
      const platformName = live.platform.toUpperCase();
      const recStatus = live.member.is_auto_record ? '✅ AKTIF (Auto-Record Dimulai)' : '⏸️ Tidak Aktif';
      const formattedTime = new Date(live.started_at).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit'
      });

      const alertMsg =
        `🔔 <b>JKT48 SEDANG LIVE!</b>\n\n` +
        `👤 <b>Member:</b> ${live.member.name} ${live.member.generation ? `(Gen ${live.member.generation})` : ''}\n` +
        `📺 <b>Platform:</b> ${platformName}\n` +
        `📝 <b>Judul:</b> ${live.title}\n` +
        `⏺️ <b>Cloud Auto-Record:</b> ${recStatus}\n` +
        `⏰ <b>Mulai:</b> ${formattedTime} WIB\n\n` +
        `<i>Notifikasi otomatis 24/7 dari JKT48 Live & Cloud Recorder Cloud Engine.</i>`;

      await sendTelegramAlert({
        text: alertMsg,
        photoUrl: live.thumbnail_url || live.member.avatar_url,
      });
    }

    // Action B: Auto-Record Trigger
    if (live.member.is_auto_record === true && !isAlreadyRecording) {
      console.log(`[Watcher] Auto-record is TRUE for ${live.member.name}. Triggering recording...`);
      const recordingId = crypto.randomUUID();

      // Create recording in DB
      try {
        await supabaseFetch('recordings', {
          method: 'POST',
          body: JSON.stringify({
            id: recordingId,
            member_id: live.member_id,
            platform: live.platform,
            title: `${live.title} [Auto-Record Cloud]`,
            status: 'recording',
            video_url: '',
            file_size_mb: 0,
            duration_seconds: 0,
          }),
        });
        console.log(`[Watcher] Inserted recording ${recordingId} into Supabase.`);
      } catch (err) {
        console.error('[Watcher] Failed to insert recording record:', err.message);
      }

      // Dispatch runner
      const triggered = await triggerGitHubRecorder({
        recordingId,
        memberName: live.member.name,
        platform: live.platform,
        streamUrl: live.stream_url,
      });

      if (triggered) {
        live.is_recording = true;
        await sendTelegramAlert({
          text:
            `⏺️ <b>CLOUD RECORDING DIMULAI!</b>\n\n` +
            `👤 <b>Member:</b> ${live.member.name}\n` +
            `📺 <b>Platform:</b> ${live.platform.toUpperCase()}\n` +
            `⚡ <b>Runner:</b> GitHub Actions Cloud FFmpeg Engine\n` +
            `📦 Format Transport Stream (.ts) anti-corrupt sedang direkam secara cloud tanpa membebani HP!`,
        });
      }
    } else if (isAlreadyRecording) {
      live.is_recording = true;
    }

    // Upsert into active_lives in Supabase
    try {
      const { member, ...dbPayload } = live;
      await supabaseFetch('active_lives', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(dbPayload),
      });
    } catch (e) {
      console.warn('[Watcher] active_lives upsert note:', e.message);
    }
  }

  // 6. Remove ended lives from active_lives
  const activeIds = new Set(activeMatched.map(l => l.id));
  for (const existing of existingActiveLives) {
    if (!activeIds.has(existing.id) && !existing.id.startsWith('live-sim-')) {
      console.log(`[Watcher] Live ended, removing: ${existing.id}`);
      try {
        await supabaseFetch(`active_lives?id=eq.${existing.id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('[Watcher] Delete ended live error:', e.message);
      }
    }
  }

  console.log('=== JKT48 24/7 Cloud Watcher Completed ===');
}

main().catch(err => {
  console.error('[Watcher] Fatal error:', err);
  process.exit(1);
});
