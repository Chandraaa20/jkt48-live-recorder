/**
 * Robust HLS Segment Recorder Engine for IDN Live & Showroom
 * Uses Cloudflare Worker Proxy or Direct HLS
 */
const fs = require('fs');
const path = require('path');

async function recordHls({
  streamUrl,
  outputTsPath,
  maxDurationSec = 45,
  stopSignalFile = null,
  supabaseUrl = null,
  supabaseKey = null,
  recordingId = null
}) {
  console.log(`[RecorderEngine] Starting recording...`);
  console.log(`[RecorderEngine] Stream URL: ${streamUrl}`);
  console.log(`[RecorderEngine] Target Output: ${outputTsPath}`);
  console.log(`[RecorderEngine] Max Duration: ${maxDurationSec}s`);

  const outDir = path.dirname(outputTsPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Resolve master playlist via Cloudflare Worker Proxy with fallback to direct
  let proxyMasterUrl = streamUrl;
  if (streamUrl.includes('live-video.net') || !streamUrl.includes('workers.dev')) {
    const encoded = encodeURIComponent(streamUrl);
    proxyMasterUrl = `https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/stream.m3u8?url=${encoded}`;
  }

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Origin': 'https://www.idn.app',
    'Referer': 'https://www.idn.app/',
    'X-Forwarded-For': '103.28.12.1',
    'X-Real-IP': '103.28.12.1',
    'Client-IP': '103.28.12.1'
  };

  let masterRes = null;
  const urlsToTry = [streamUrl, proxyMasterUrl];

  for (const urlToFetch of urlsToTry) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        console.log(`[RecorderEngine] Fetching master playlist (Attempt ${attempt}): ${urlToFetch}`);
        masterRes = await fetch(urlToFetch, { headers: reqHeaders });
        if (masterRes.ok) break;
        console.warn(`[RecorderEngine] Fetch returned HTTP ${masterRes.status}, retrying in 1.5s...`);
      } catch (fetchErr) {
        console.warn(`[RecorderEngine] Network warning: ${fetchErr.message}, retrying in 1.5s...`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    if (masterRes && masterRes.ok) break;
  }

  if (!masterRes || !masterRes.ok) {
    throw new Error(`Failed to fetch master playlist after retries: HTTP ${masterRes ? masterRes.status : 'ERR'}`);
  }

  const masterText = await masterRes.text();
  const masterLines = masterText.split('\n');

  // Find variant media playlist or use master directly
  let variantUrl = proxyMasterUrl;
  for (const line of masterLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      variantUrl = trimmed;
      break;
    }
  }

  console.log(`[RecorderEngine] Selected variant media playlist: ${variantUrl}`);

  const writeStream = fs.createWriteStream(outputTsPath, { flags: 'a' });
  const downloadedSegments = new Set();
  const startTime = Date.now();
  let totalBytes = 0;
  let totalSegments = 0;

  console.log(`[RecorderEngine] Starting polling loop...`);

  while (true) {
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (maxDurationSec > 0 && elapsedSec >= maxDurationSec) {
      console.log(`[RecorderEngine] Reached target duration of ${maxDurationSec}s. Stopping...`);
      break;
    }

    // Check stop signal file if configured
    if (stopSignalFile && fs.existsSync(stopSignalFile)) {
      console.log(`[RecorderEngine] Stop signal file detected. Stopping...`);
      break;
    }

    // Check Supabase stop signal if configured
    if (supabaseUrl && supabaseKey && recordingId) {
      try {
        const checkRes = await fetch(`${supabaseUrl}/rest/v1/recordings?id=eq.${recordingId}&select=status`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        const rows = await checkRes.json();
        const status = rows?.[0]?.status;
        if (status === 'uploading' || status === 'stopping' || status === 'completed') {
          console.log(`[RecorderEngine] Stop signal from Supabase (${status}). Stopping...`);
          break;
        }
      } catch (e) {
        // ignore network hiccup during poll
      }
    }

    try {
      const varRes = await fetch(variantUrl, { headers: reqHeaders });

      if (varRes.ok) {
        const varText = await varRes.text();
        const lines = varText.split('\n');

        const segmentUrls = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            segmentUrls.push(trimmed);
          }
        }

        for (const segUrl of segmentUrls) {
          if (!downloadedSegments.has(segUrl)) {
            downloadedSegments.add(segUrl);

            try {
              let segRes = await fetch(segUrl, { headers: reqHeaders });
              if (!segRes.ok) {
                await new Promise(r => setTimeout(r, 500));
                segRes = await fetch(segUrl, { headers: reqHeaders });
              }

              if (segRes.ok) {
                const buf = Buffer.from(await segRes.arrayBuffer());
                if (buf.length > 0) {
                  writeStream.write(buf);
                  totalBytes += buf.length;
                  totalSegments++;
                  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
                  console.log(`[RecorderEngine] Segment ${totalSegments} recorded (${(buf.length / 1024).toFixed(1)} KB) | Total: ${mb} MB | Elapsed: ${elapsedSec.toFixed(0)}s`);
                }
              }
            } catch (segErr) {
              console.warn(`[RecorderEngine] Segment fetch warning: ${segErr.message}`);
            }
          }
        }
      }
    } catch (pollErr) {
      console.warn(`[RecorderEngine] Playlist poll warning: ${pollErr.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  writeStream.end();
  await new Promise((resolve) => writeStream.on('finish', resolve));

  const finalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const finalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`[RecorderEngine] Finished: ${totalSegments} segments, ${finalMb} MB, ${finalSec}s duration.`);
  return {
    segments: totalSegments,
    bytes: totalBytes,
    fileSizeMb: parseFloat(finalMb),
    durationSeconds: parseInt(finalSec, 10),
    outputTsPath
  };
}

if (require.main === module) {
  const streamUrl = process.argv[2] || 'https://4b964ca68cf1.us-east-1.playback.live-video.net/api/video/v1/us-east-1.050891932989.channel.948DSG1qwIJH.m3u8';
  const outPath = process.argv[3] || path.join(__dirname, 'test_rec.ts');
  const dur = parseInt(process.argv[4] || '10', 10);
  const recordingId = process.argv[5] || null;
  const supabaseUrl = process.argv[6] || null;
  const supabaseKey = process.argv[7] || null;

  recordHls({
    streamUrl,
    outputTsPath: outPath,
    maxDurationSec: dur,
    recordingId,
    supabaseUrl,
    supabaseKey
  }).then((res) => {
    console.log('Result:', res);
    process.exit(0);
  }).catch((err) => {
    console.error('Recorder error:', err);
    process.exit(1);
  });
}

module.exports = { recordHls };
