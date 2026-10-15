import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Custom Vite plugin to proxy HLS .m3u8 & .ts streams with CORS and proper Referer
function hlsCorsProxyPlugin() {
  return {
    name: 'hls-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          const reqUrl = new URL(req.url, 'http://localhost:5173');
          const targetUrl = reqUrl.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            return res.end('Missing ?url= query parameter');
          }

          let referer = 'https://www.idn.app/';
          if (targetUrl.includes('showroom') || targetUrl.includes('sr-')) {
            referer = 'https://www.showroom-live.com/';
          }

          const upstreamRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': referer,
            },
          });

          if (!upstreamRes.ok) {
            res.statusCode = upstreamRes.status;
            return res.end(`Upstream error: ${upstreamRes.status}`);
          }

          const contentType = upstreamRes.headers.get('content-type') || '';
          const isPlaylist = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

          if (isPlaylist) {
            const text = await upstreamRes.text();
            const baseUrl = new URL(targetUrl);
            const proxyBase = '/api/proxy?url=';

            // Rewrite relative or nested stream URLs
            const rewritten = text.split('\n').map(line => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.includes('URI="')) {
                  return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                    const absUrl = new URL(uri, baseUrl).toString();
                    return `URI="${proxyBase}${encodeURIComponent(absUrl)}"`;
                  });
                }
                return line;
              }
              const absUrl = new URL(trimmed, baseUrl).toString();
              return `${proxyBase}${encodeURIComponent(absUrl)}`;
            }).join('\n');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.end(rewritten);
          }

          // Segments (.ts) or chunks
          res.statusCode = 200;
          res.setHeader('Content-Type', contentType || 'video/MP2T');
          const buffer = await upstreamRes.arrayBuffer();
          return res.end(Buffer.from(buffer));
        } catch (err) {
          res.statusCode = 500;
          return res.end(`Proxy error: ${err.message}`);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), hlsCorsProxyPlugin()],
})

