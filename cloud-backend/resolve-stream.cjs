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

  const isIdn = platform === 'idn' || url.includes('live-video.net');
  const urlsToTry = isIdn
    ? [
        `https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/stream.m3u8?url=${encodeURIComponent(url)}`,
        url,
      ]
    : [
        url,
        `https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/stream.m3u8?url=${encodeURIComponent(url)}`,
      ];

  let resolvedUrl = url;

  for (const currentUrl of urlsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(currentUrl, {
          headers: {
            'Referer': referer,
            'User-Agent': ua,
          },
        });

        if (res.ok) {
          const text = await res.text();
          const lines = text.split('\n');

          // Look for child variant stream (.m3u8)
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && (trimmed.includes('.m3u8') || trimmed.startsWith('http'))) {
              resolvedUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, currentUrl).toString();
              console.error(`[StreamResolver] Successfully resolved child media playlist: ${resolvedUrl}`);
              break;
            }
          }
          if (resolvedUrl !== url) break;
        } else {
          console.error(`[StreamResolver] URL attempt ${attempt} returned status ${res.status}`);
        }
      } catch (e) {
        console.error(`[StreamResolver] URL attempt ${attempt} error:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (resolvedUrl !== url) break;
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
