import {
  getSupabaseClient,
  triggerGitHubRecorder,
  stopGitHubRecorder,
  sendTelegramNotification,
  sendDeviceNotification,
} from './supabase';
import {
  INITIAL_JKT48_MEMBERS,
  INITIAL_ACTIVE_LIVES,
  INITIAL_RECORDINGS,
} from '../constants/initialData';

const LOCAL_STORAGE_MEMBERS = 'jkt48_local_members';
const LOCAL_STORAGE_LIVES = 'jkt48_local_lives';
const LOCAL_STORAGE_RECORDINGS = 'jkt48_local_recordings';
const LOCAL_STORAGE_NOTIFIED_LIVES = 'jkt48_notified_lives';

export function getNotifiedLives() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFIED_LIVES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markLiveNotified(liveId) {
  try {
    const list = getNotifiedLives();
    if (!list.includes(liveId)) {
      list.push(liveId);
      if (list.length > 200) list.splice(0, list.length - 200);
      localStorage.setItem(LOCAL_STORAGE_NOTIFIED_LIVES, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Failed to update notified lives:', e);
  }
}

// Helper for local mock storage
function getLocalData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setLocalData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

/**
 * 1. MEMBERS API
 */
export async function getMembers() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  }

  try {
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        *,
        member_platforms (*)
      `)
      .order('generation', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    // Normalize platforms property
    return (members || []).map((m) => ({
      ...m,
      platforms: m.member_platforms || [],
    }));
  } catch (err) {
    console.warn('Supabase getMembers error, falling back to local data:', err.message);
    return getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  }
}

export async function toggleAutoRecord(memberId, currentValue) {
  const newValue = !currentValue;
  const supabase = getSupabaseClient();

  // Optimistically update local cache
  const localMembers = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  const updatedLocal = localMembers.map((m) =>
    m.id === memberId ? { ...m, is_auto_record: newValue } : m
  );
  setLocalData(LOCAL_STORAGE_MEMBERS, updatedLocal);

  if (!supabase) return { success: true, is_auto_record: newValue };

  try {
    const { error } = await supabase
      .from('members')
      .update({ is_auto_record: newValue })
      .eq('id', memberId);

    if (error) throw error;
    return { success: true, is_auto_record: newValue };
  } catch (err) {
    console.error('toggleAutoRecord error:', err);
    return { success: false, error: err.message };
  }
}

export async function toggleNotify(memberId, currentValue) {
  const newValue = !currentValue;
  const supabase = getSupabaseClient();

  // Update local cache
  const localMembers = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  const updatedLocal = localMembers.map((m) =>
    m.id === memberId ? { ...m, is_notify: newValue } : m
  );
  setLocalData(LOCAL_STORAGE_MEMBERS, updatedLocal);

  if (!supabase) return { success: true, is_notify: newValue };

  try {
    const { error } = await supabase
      .from('members')
      .update({ is_notify: newValue })
      .eq('id', memberId);

    if (error) throw error;
    return { success: true, is_notify: newValue };
  } catch (err) {
    console.error('toggleNotify error:', err);
    return { success: false, error: err.message };
  }
}

export async function saveMember(memberData, platformsList = []) {
  const supabase = getSupabaseClient();
  const isEditing = Boolean(memberData.id);
  const memberId = memberData.id || crypto.randomUUID();

  const memberPayload = {
    id: memberId,
    name: memberData.name.trim(),
    nickname: (memberData.nickname || '').trim(),
    generation: parseInt(memberData.generation, 10) || 1,
    avatar_url: memberData.avatar_url?.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop',
    is_notify: memberData.is_notify ?? true,
    is_auto_record: memberData.is_auto_record ?? false,
  };

  // Local sync
  const localMembers = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  const localMemberObject = {
    ...memberPayload,
    platforms: platformsList.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      member_id: memberId,
    })),
  };

  if (isEditing) {
    const idx = localMembers.findIndex((m) => m.id === memberId);
    if (idx !== -1) localMembers[idx] = localMemberObject;
    else localMembers.push(localMemberObject);
  } else {
    localMembers.unshift(localMemberObject);
  }
  setLocalData(LOCAL_STORAGE_MEMBERS, localMembers);

  if (!supabase) return { success: true, data: localMemberObject };

  try {
    // 1. Upsert member
    const { data: memberResult, error: memberErr } = await supabase
      .from('members')
      .upsert(memberPayload)
      .select()
      .single();

    if (memberErr) throw memberErr;

    // 2. Refresh member_platforms
    if (isEditing) {
      await supabase.from('member_platforms').delete().eq('member_id', memberId);
    }

    if (platformsList.length > 0) {
      const platformsToInsert = platformsList
        .filter((p) => p.external_id && p.external_id.trim())
        .map((p) => ({
          id: p.id || crypto.randomUUID(),
          member_id: memberId,
          platform: p.platform || 'idn',
          external_id: p.external_id.trim(),
          room_url_key: p.room_url_key?.trim() || p.external_id.trim(),
        }));

      if (platformsToInsert.length > 0) {
        const { error: platErr } = await supabase
          .from('member_platforms')
          .insert(platformsToInsert);
        if (platErr) throw platErr;
      }
    }

    return { success: true, data: memberResult };
  } catch (err) {
    console.error('saveMember error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteMember(memberId) {
  const supabase = getSupabaseClient();

  // Local delete
  const localMembers = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
  setLocalData(LOCAL_STORAGE_MEMBERS, localMembers.filter((m) => m.id !== memberId));

  if (!supabase) return { success: true };

  try {
    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('deleteMember error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. SEED INITIAL JKT48 DATA
 */
export async function seedInitialMembers() {
  const supabase = getSupabaseClient();
  let targetMembers = INITIAL_JKT48_MEMBERS;

  // Try fetching live roster from public JKT48 API
  try {
    const res = await fetch('https://api.crstlnz.my.id/api/member?group=jkt48');
    if (res.ok) {
      const liveData = await res.json();
      const activeOnly = (Array.isArray(liveData) ? liveData : []).filter((m) => !m.is_graduate);

      if (activeOnly.length > 0) {
        targetMembers = activeOnly.map((m) => {
          let genNum = 7;
          if (m.generation) {
            const match = m.generation.match(/gen(\d+)/i);
            if (match) genNum = parseInt(match[1], 10);
            else {
              const digits = m.generation.replace(/\D/g, '');
              genNum = digits.length > 2 ? parseInt(digits.slice(0, -2), 10) : (parseInt(digits, 10) || 7);
            }
          }

          const srUrl = m.socials?.find((s) => s.title === 'SHOWROOM')?.url || '';
          const srKey = srUrl ? srUrl.split('/').pop() : '';
          const idnUsername = (m.idn_username || m.url || '').replace(/^@/, '');

          // Look up existing member to preserve ID if present
          const existing = INITIAL_JKT48_MEMBERS.find((old) => old.name === m.name);

          return {
            id: existing?.id || crypto.randomUUID(),
            name: m.name,
            nickname: m.nicknames?.[0] || m.name.split(' ')[0],
            generation: genNum,
            avatar_url: m.img_alt || m.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop',
            is_notify: true,
            is_auto_record: false, // Default false: user selectively chooses whom to record
            platforms: [
              { platform: 'idn', external_id: idnUsername, room_url_key: idnUsername },
              { platform: 'showroom', external_id: String(m.room_id || ''), room_url_key: srKey },
            ],
          };
        });
      }
    }
  } catch (err) {
    console.warn('Online member fetch failed, using complete offline roster:', err.message);
    targetMembers = INITIAL_JKT48_MEMBERS;
  }

  // Populate local storage
  setLocalData(LOCAL_STORAGE_MEMBERS, targetMembers);
  setLocalData(LOCAL_STORAGE_LIVES, INITIAL_ACTIVE_LIVES);
  setLocalData(LOCAL_STORAGE_RECORDINGS, INITIAL_RECORDINGS);

  if (!supabase) {
    return {
      success: true,
      message: `Berhasil menginisialisasi seluruh ${targetMembers.length} Member Aktif JKT48 ke penyimpanan lokal (Mode Offline)!`,
      count: targetMembers.length,
    };
  }

  try {
    let insertedCount = 0;
    for (const item of targetMembers) {
      const { platforms, ...memberFields } = item;

      const { error: mErr } = await supabase
        .from('members')
        .upsert(memberFields, { onConflict: 'id' });

      if (mErr) console.warn('Member upsert note:', mErr.message);

      if (platforms && platforms.length > 0) {
        const plats = platforms.map((p) => ({
          id: crypto.randomUUID(),
          member_id: item.id,
          platform: p.platform,
          external_id: p.external_id,
          room_url_key: p.room_url_key,
        }));
        await supabase.from('member_platforms').upsert(plats, { onConflict: 'id' });
      }
      insertedCount++;
    }

    return {
      success: true,
      message: `Berhasil mengisi seluruh ${insertedCount} member JKT48 ke database Supabase!`,
      count: insertedCount,
    };
  } catch (err) {
    console.error('Seed error:', err);
    return {
      success: false,
      message: `Gagal seed ke Supabase: ${err.message}`,
    };
  }
}

/**
 * 3. ACTIVE LIVES API (REAL-TIME STREAM SYNC & PURGE DUMMY)
 */
export async function getActiveLives() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const lives = getLocalData(LOCAL_STORAGE_LIVES, []);
    const members = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
    // Filter out obsolete hardcoded dummy records
    const cleanLives = (lives || []).filter((l) => l.id !== 'live-freya-01' && l.id !== 'live-marsha-02');
    return cleanLives.map((live) => ({
      ...live,
      member: live.member || members.find((m) => m.id === live.member_id) || null,
    }));
  }

  try {
    const { data, error } = await supabase
      .from('active_lives')
      .select(`
        *,
        member:members (
          id,
          name,
          nickname,
          generation,
          avatar_url,
          is_auto_record,
          is_notify
        )
      `)
      .order('started_at', { ascending: false });

    if (error) throw error;
    // Filter out dummy records if present in database
    return (data || []).filter((l) => l.id !== 'live-freya-01' && l.id !== 'live-marsha-02');
  } catch (err) {
    console.warn('getActiveLives Supabase error, falling back:', err.message);
    const lives = getLocalData(LOCAL_STORAGE_LIVES, []);
    const members = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
    const cleanLives = (lives || []).filter((l) => l.id !== 'live-freya-01' && l.id !== 'live-marsha-02');
    return cleanLives.map((live) => ({
      ...live,
      member: live.member || members.find((m) => m.id === live.member_id) || null,
    }));
  }
}

/**
 * Fetch real ongoing JKT48 lives from public live stream aggregator API
 * Matches with registered members and updates Supabase active_lives
 */
export async function syncRealActiveLives() {
  const supabase = getSupabaseClient();
  const currentMembers = await getMembers();

  try {
    const res = await fetch('https://api.crstlnz.my.id/api/now_live?group=jkt48', {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const liveApiData = await res.json();
    const liveList = Array.isArray(liveApiData) ? liveApiData : [];

    // Filter and match with our 59 members
    const activeMatched = [];

    for (const item of liveList) {
      const type = (item.type || item.platform || '').toLowerCase();
      const isSr = type.includes('showroom');
      const isIdn = type.includes('idn');
      const platform = isSr ? 'showroom' : (isIdn ? 'idn' : 'other');

      const roomId = String(item.room_id || item.room_url_key || '');
      const idnKey = (item.url_key || item.username || '').toLowerCase().replace(/^@/, '');
      const cleanLiveName = (item.name || '').replace(/jkt48/gi, '').trim().toLowerCase();

      // 1. Strict platform identifier match (IDN url_key or Showroom room_id)
      let matched = currentMembers.find((m) => {
        return (m.platforms || []).some((p) => {
          if (p.platform === 'showroom' && roomId && String(p.external_id) === roomId) return true;
          if (p.platform === 'idn' && idnKey && (p.external_id?.toLowerCase() === idnKey || p.room_url_key?.toLowerCase() === idnKey)) return true;
          return false;
        });
      });

      // 2. Fallback: Exact name or nickname match (avoid partial substring collisions)
      if (!matched && cleanLiveName) {
        matched = currentMembers.find((m) => {
          const nick = (m.nickname || '').toLowerCase();
          const fullName = m.name.toLowerCase();
          return nick === cleanLiveName || fullName === cleanLiveName || fullName.split(' ').includes(cleanLiveName);
        });
      }

      if (!matched) continue;

      // Extract highest quality .m3u8 stream URL
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
          is_simulated: false,
          member: matched,
        });
      }
    }

    // Process notifications & auto-record triggers for active live sessions
    const notifiedIds = getNotifiedLives();
    for (const realLive of activeMatched) {
      // 1. Instant Telegram & Device Push Notification if member.is_notify === true
      if (realLive.member?.is_notify !== false && !notifiedIds.includes(realLive.id)) {
        markLiveNotified(realLive.id);

        const platformName = realLive.platform?.toUpperCase() || 'LIVE';
        const autoRecordStatus = realLive.member?.is_auto_record ? '✅ AKTIF (Otomatis Merekam Cloud)' : '⏸️ Tidak Aktif';
        const formattedTime = new Date(realLive.started_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const messageText =
          `🔔 <b>JKT48 SEDANG LIVE!</b>\n\n` +
          `👤 <b>Member:</b> ${realLive.member.name} ${realLive.member.generation ? `(Gen ${realLive.member.generation})` : ''}\n` +
          `📺 <b>Platform:</b> ${platformName}\n` +
          `📝 <b>Judul:</b> ${realLive.title}\n` +
          `⏺️ <b>Cloud Recording:</b> ${autoRecordStatus}\n` +
          `⏰ <b>Mulai:</b> ${formattedTime} WIB\n\n` +
          `<i>Buka aplikasi JKT48 Live & Cloud Recorder untuk menonton stream langsung!</i>`;

        sendTelegramNotification({
          text: messageText,
          photoUrl: realLive.thumbnail_url || realLive.member?.avatar_url,
        }).catch((e) => console.warn('Telegram notify note:', e));

        sendDeviceNotification(`🔴 ${realLive.member.name} Sedang Live!`, {
          body: `${platformName}: ${realLive.title}`,
          icon: realLive.member?.avatar_url || realLive.thumbnail_url,
        });
      }

      // 2. Instant Auto-Record Trigger if member.is_auto_record === true
      if (realLive.member?.is_auto_record === true && !realLive.is_recording) {
        realLive.is_recording = true;
        console.log(`[AutoRecord] Automatically starting cloud recording for ${realLive.member.name}...`);
        triggerManualRecord(
          realLive.id,
          realLive.member_id,
          realLive.title,
          realLive.platform,
          realLive.member.name,
          realLive.stream_url
        ).then((res) => {
          console.log(`[AutoRecord] Recording started for ${realLive.member.name}:`, res);
        }).catch((err) => {
          console.error(`[AutoRecord] Failed to start recording for ${realLive.member.name}:`, err);
        });
      }
    }

    // Preserve only user-triggered simulated lives (excluding any legacy dummy IDs)
    const localLives = getLocalData(LOCAL_STORAGE_LIVES, []);
    const userSimulated = localLives.filter(
      (l) => (l.is_simulated || l.id?.startsWith('live-sim-')) && l.id !== 'live-freya-01' && l.id !== 'live-marsha-02'
    );

    const mergedLives = [...activeMatched, ...userSimulated];
    setLocalData(LOCAL_STORAGE_LIVES, mergedLives);

    // If connected to Supabase, sync database
    if (supabase) {
      // 1. Purge obsolete dummy records
      await supabase.from('active_lives').delete().in('id', ['live-freya-01', 'live-marsha-02']);

      // 2. Upsert matched real lives
      for (const realLive of activeMatched) {
        const { member, is_simulated, ...payload } = realLive;
        await supabase.from('active_lives').upsert(payload, { onConflict: 'id' });
      }

      // 3. Remove ended lives
      const { data: dbLives } = await supabase.from('active_lives').select('id');
      const activeIds = new Set(activeMatched.map((l) => l.id));
      for (const d of (dbLives || [])) {
        if (!activeIds.has(d.id) && !d.id.startsWith('live-sim-')) {
          await supabase.from('active_lives').delete().eq('id', d.id);
        }
      }
    }

    return mergedLives;
  } catch (err) {
    console.warn('syncRealActiveLives error, using cached lives:', err.message);
    return getActiveLives();
  }
}

/**
 * Remove all simulated lives and return to pure real monitoring mode
 */
export async function clearSimulatedLives() {
  const supabase = getSupabaseClient();
  const localLives = getLocalData(LOCAL_STORAGE_LIVES, []);
  const realOnly = localLives.filter(
    (l) => !l.is_simulated && !l.id?.startsWith('live-sim-') && l.id !== 'live-freya-01' && l.id !== 'live-marsha-02'
  );
  setLocalData(LOCAL_STORAGE_LIVES, realOnly);

  // Clear simulated from notified tracker
  try {
    const list = getNotifiedLives().filter((id) => !id.startsWith('live-sim-'));
    localStorage.setItem(LOCAL_STORAGE_NOTIFIED_LIVES, JSON.stringify(list));
  } catch (_) {}

  if (supabase) {
    try {
      await supabase.from('active_lives').delete().like('id', 'live-sim-%');
      await supabase.from('active_lives').delete().in('id', ['live-freya-01', 'live-marsha-02']);
    } catch (e) {
      console.warn('clearSimulatedLives Supabase note:', e);
    }
  }

  return realOnly;
}

// Trigger manual recording on active live
export async function triggerManualRecord(liveId, memberId, liveTitle, platform, memberName = '', streamUrl = '') {
  const supabase = getSupabaseClient();
  const recordingId = crypto.randomUUID();

  // 1. Local storage update
  const lives = getLocalData(LOCAL_STORAGE_LIVES, INITIAL_ACTIVE_LIVES);
  const updatedLives = lives.map((l) =>
    l.id === liveId ? { ...l, is_recording: true } : l
  );
  setLocalData(LOCAL_STORAGE_LIVES, updatedLives);

  const recordings = getLocalData(LOCAL_STORAGE_RECORDINGS, INITIAL_RECORDINGS);
  const newRec = {
    id: recordingId,
    member_id: memberId,
    platform: platform || 'idn',
    title: `${liveTitle || 'Live Stream'} [Rekaman Manual]`,
    status: 'recording',
    video_url: '',
    file_size_mb: 0,
    duration_seconds: 0,
    created_at: new Date().toISOString(),
  };
  recordings.unshift(newRec);
  setLocalData(LOCAL_STORAGE_RECORDINGS, recordings);

  // 2. Dispatch to GitHub Actions Cloud Recorder if configured
  const githubDispatch = await triggerGitHubRecorder({
    recording_id: recordingId,
    member_name: memberName || liveTitle || 'Member JKT48',
    platform: platform || 'idn',
    stream_url: streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  });

  if (!supabase) {
    return {
      success: true,
      message: githubDispatch.triggered
        ? 'Rekaman manual dipicu & runner GitHub Actions mulai merekam!'
        : 'Cloud recording manual dicatat (Mode Lokal).',
      recordingId,
    };
  }

  try {
    // Update active_lives
    const { error: liveErr } = await supabase
      .from('active_lives')
      .update({ is_recording: true })
      .eq('id', liveId);

    if (liveErr) throw liveErr;

    // Insert new recording entry
    const { error: recErr } = await supabase.from('recordings').insert({
      id: recordingId,
      member_id: memberId,
      platform: platform || 'idn',
      title: `${liveTitle || 'Live Stream'} [Rekaman Manual]`,
      status: 'recording',
      video_url: '',
      file_size_mb: 0,
      duration_seconds: 0,
    });

    if (recErr) throw recErr;

    return {
      success: true,
      message: githubDispatch.triggered
        ? 'Rekaman manual berhasil dimulai di Cloud (GitHub Actions Aktif)!'
        : 'Status rekaman aktif di Supabase! (Konfigurasikan GitHub Token di Pengaturan untuk runner gratis)',
      recordingId,
    };
  } catch (err) {
    console.error('triggerManualRecord error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. RECORDINGS API
 */
export async function getRecordings() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const recs = getLocalData(LOCAL_STORAGE_RECORDINGS, INITIAL_RECORDINGS);
    const members = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
    return recs.map((r) => ({
      ...r,
      member: members.find((m) => m.id === r.member_id) || null,
    }));
  }

  try {
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        member:members (
          id,
          name,
          nickname,
          generation,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('getRecordings Supabase error, falling back:', err.message);
    const recs = getLocalData(LOCAL_STORAGE_RECORDINGS, INITIAL_RECORDINGS);
    const members = getLocalData(LOCAL_STORAGE_MEMBERS, INITIAL_JKT48_MEMBERS);
    return recs.map((r) => ({
      ...r,
      member: members.find((m) => m.id === r.member_id) || null,
    }));
  }
}

// Stop / complete a recording
export async function finishRecording(recordingId) {
  const supabase = getSupabaseClient();

  // Trigger stop on Cloudflare Worker / GitHub Actions proxy
  stopGitHubRecorder({ recording_id: recordingId }).catch((e) =>
    console.warn('stopGitHubRecorder note:', e)
  );

  const recs = getLocalData(LOCAL_STORAGE_RECORDINGS, INITIAL_RECORDINGS);
  const updatedRecs = recs.map((r) =>
    r.id === recordingId
      ? {
          ...r,
          status: 'completed',
          video_url: r.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        }
      : r
  );
  setLocalData(LOCAL_STORAGE_RECORDINGS, updatedRecs);

  if (!supabase) return { success: true };

  try {
    const { error } = await supabase
      .from('recordings')
      .update({
        status: 'completed',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      })
      .eq('id', recordingId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('finishRecording error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 5. REAL-TIME SUBSCRIPTION
 */
export function setupRealtimeSubscription({ onLiveChange, onRecordingsChange, onMembersChange }) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('jkt48-live-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_lives' },
        (payload) => {
          if (onLiveChange) onLiveChange(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recordings' },
        (payload) => {
          if (onRecordingsChange) onRecordingsChange(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        (payload) => {
          if (onMembersChange) onMembersChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('Realtime setup error:', err);
    return () => {};
  }
}
