/**
 * Helper to resolve Amazon IVS / Showroom master playlists to direct media streams
 */

async function resolveStream() {
  const url = process.argv[2] || process.env.STREAM_URL;
  const platform = process.argv[3] || process.env.PLATFORM || 'idn';

  if (!url) {
    console.error('No stream URL provided');
    process.exit(1);
  }

  const referer = platform === 'showroom' ? 'https://www.showroom-live.com/' : 'https://www.idn.app/';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  console.error(`[StreamResolver] Resolving stream for platform: ${platform}`);
  console.error(`[StreamResolver] Source URL: ${url}`);

  let resolvedUrl = url;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Referer': referer,
          'User-Agent': ua,
        },
      });

      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');

        // Look for variant stream (.m3u8)
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.startsWith('http'))) {
            resolvedUrl = new URL(trimmed, url).toString();
            console.error(`[StreamResolver] Successfully resolved child media playlist: ${resolvedUrl}`);
            break;
          }
        }
        break;
      } else {
        console.error(`[StreamResolver] Attempt ${attempt} returned status ${res.status}`);
      }
    } catch (e) {
      console.error(`[StreamResolver] Attempt ${attempt} error:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // If still equal to source or failed, try via Cloudflare Worker proxy
  if (resolvedUrl === url) {
    try {
      const proxyUrl = `https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/stream.m3u8?url=${encodeURIComponent(url)}`;
      const pRes = await fetch(proxyUrl);
      if (pRes.ok) {
        const text = await pRes.text();
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.startsWith('http'))) {
            resolvedUrl = trimmed;
            console.error(`[StreamResolver] Successfully resolved via Worker Proxy: ${resolvedUrl}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error('[StreamResolver] Worker proxy resolution fallback error:', e.message);
    }
  }

  // If in GitHub Actions, also append to GITHUB_ENV
  const fs = require('fs');
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `RESOLVED_STREAM_URL=${resolvedUrl}\n`);
  }
  
  console.error(`[StreamResolver] Final resolved stream URL: ${resolvedUrl}`);
  process.stdout.write(resolvedUrl);
}

resolveStream().catch((err) => {
  console.error('[StreamResolver] Fatal:', err);
  process.exit(1);
});
